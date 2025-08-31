import { Request } from 'express';
import { logger, securityLogger } from './logger';

interface ComplianceRule {
  name: string;
  description: string;
  category: 'FERPA' | 'GDPR' | 'CCPA' | 'SOX' | 'GENERAL';
  severity: 'low' | 'medium' | 'high' | 'critical';
  check: (req: Request, data?: any) => Promise<ComplianceResult>;
}

interface ComplianceResult {
  compliant: boolean;
  violations: string[];
  recommendations: string[];
  dataProcessed?: {
    personalData: boolean;
    educationalRecords: boolean;
    sensitiveData: boolean;
  };
}

interface AuditLog {
  timestamp: string;
  userId?: string;
  action: string;
  resource: string;
  ip: string;
  userAgent: string;
  result: 'success' | 'failure' | 'blocked';
  complianceFlags: string[];
}

class ComplianceChecker {
  private rules: ComplianceRule[] = [];
  private auditLogs: AuditLog[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    // FERPA Compliance Rules
    this.rules.push({
      name: 'FERPA_EDUCATIONAL_RECORD_ACCESS',
      description: 'Ensure educational records are only accessed by authorized users',
      category: 'FERPA',
      severity: 'critical',
      check: async (req: Request, data?: any) => {
        const violations: string[] = [];
        const recommendations: string[] = [];
        
        // Check if accessing educational records
        const isEducationalRecord = this.isEducationalRecord(req.path, data);
        if (isEducationalRecord) {
          // Verify user authorization
          if (!req.user) {
            violations.push('Unauthenticated access to educational records');
            recommendations.push('Implement proper authentication for educational record access');
          } else {
            // Check if user has proper role/permissions
            const hasPermission = await this.checkEducationalRecordPermission(req.user, req.path);
            if (!hasPermission) {
              violations.push('Unauthorized access to educational records');
              recommendations.push('Verify user has proper permissions for educational record access');
            }
          }
        }

        return {
          compliant: violations.length === 0,
          violations,
          recommendations,
          dataProcessed: {
            personalData: isEducationalRecord,
            educationalRecords: isEducationalRecord,
            sensitiveData: isEducationalRecord
          }
        };
      }
    });

    // GDPR Compliance Rules
    this.rules.push({
      name: 'GDPR_DATA_MINIMIZATION',
      description: 'Ensure only necessary personal data is collected and processed',
      category: 'GDPR',
      severity: 'high',
      check: async (req: Request, data?: any) => {
        const violations: string[] = [];
        const recommendations: string[] = [];
        
        if (req.body && typeof req.body === 'object') {
          const personalDataFields = this.identifyPersonalData(req.body);
          if (personalDataFields.length > 0) {
            // Check if data collection is justified
            const isJustified = this.isDataCollectionJustified(req.path, personalDataFields);
            if (!isJustified) {
              violations.push('Collecting unnecessary personal data');
              recommendations.push('Review data collection practices and minimize to necessary fields only');
            }
          }
        }

        return {
          compliant: violations.length === 0,
          violations,
          recommendations,
          dataProcessed: {
            personalData: true,
            educationalRecords: false,
            sensitiveData: this.containsSensitiveData(req.body)
          }
        };
      }
    });

    this.rules.push({
      name: 'GDPR_CONSENT_VERIFICATION',
      description: 'Verify user consent for data processing',
      category: 'GDPR',
      severity: 'critical',
      check: async (req: Request, data?: any) => {
        const violations: string[] = [];
        const recommendations: string[] = [];
        
        if (this.requiresConsent(req.path, req.body)) {
          const hasConsent = await this.verifyUserConsent(req.user?.id, req.path);
          if (!hasConsent) {
            violations.push('Processing personal data without verified consent');
            recommendations.push('Implement consent verification mechanism');
          }
        }

        return {
          compliant: violations.length === 0,
          violations,
          recommendations,
          dataProcessed: {
            personalData: true,
            educationalRecords: false,
            sensitiveData: false
          }
        };
      }
    });

    // Data Retention Rule
    this.rules.push({
      name: 'DATA_RETENTION_POLICY',
      description: 'Ensure data retention policies are followed',
      category: 'GENERAL',
      severity: 'medium',
      check: async (req: Request, data?: any) => {
        const violations: string[] = [];
        const recommendations: string[] = [];
        
        // Check if this is a data deletion request
        if (req.method === 'DELETE' || req.path.includes('delete')) {
          const hasRetentionPolicy = await this.checkRetentionPolicy(req.path);
          if (!hasRetentionPolicy) {
            violations.push('No data retention policy defined for this resource');
            recommendations.push('Define and implement data retention policies');
          }
        }

        return {
          compliant: violations.length === 0,
          violations,
          recommendations,
          dataProcessed: {
            personalData: false,
            educationalRecords: false,
            sensitiveData: false
          }
        };
      }
    });

    // Audit Logging Rule
    this.rules.push({
      name: 'AUDIT_LOGGING_REQUIRED',
      description: 'Ensure all sensitive operations are logged',
      category: 'GENERAL',
      severity: 'high',
      check: async (req: Request, data?: any) => {
        const violations: string[] = [];
        const recommendations: string[] = [];
        
        if (this.requiresAuditLogging(req.path, req.method)) {
          // This rule always passes but ensures logging happens
          this.logAuditEvent(req, 'compliance_check', 'success');
        }

        return {
          compliant: true,
          violations,
          recommendations,
          dataProcessed: {
            personalData: false,
            educationalRecords: false,
            sensitiveData: false
          }
        };
      }
    });
  }

  async checkCompliance(req: Request, data?: any): Promise<{
    overallCompliant: boolean;
    results: Array<{ rule: string; result: ComplianceResult }>;
    criticalViolations: string[];
    recommendations: string[];
  }> {
    const results: Array<{ rule: string; result: ComplianceResult }> = [];
    const criticalViolations: string[] = [];
    const allRecommendations: string[] = [];

    for (const rule of this.rules) {
      try {
        const result = await rule.check(req, data);
        results.push({ rule: rule.name, result });

        if (!result.compliant) {
          if (rule.severity === 'critical') {
            criticalViolations.push(...result.violations);
          }
          allRecommendations.push(...result.recommendations);
        }
      } catch (error) {
        logger.error(`Compliance check failed for rule ${rule.name}:`, error);
        results.push({
          rule: rule.name,
          result: {
            compliant: false,
            violations: ['Compliance check failed'],
            recommendations: ['Review compliance rule implementation']
          }
        });
      }
    }

    const overallCompliant = results.every(r => r.result.compliant);

    // Log compliance check results
    securityLogger.info('Compliance check completed', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      overallCompliant,
      criticalViolations: criticalViolations.length,
      totalViolations: results.filter(r => !r.result.compliant).length
    });

    return {
      overallCompliant,
      results,
      criticalViolations,
      recommendations: [...new Set(allRecommendations)] // Remove duplicates
    };
  }

  private isEducationalRecord(path: string, data?: any): boolean {
    const educationalPaths = [
      '/applications',
      '/transcripts',
      '/grades',
      '/letters',
      '/essays',
      '/recommendations'
    ];
    
    return educationalPaths.some(eduPath => path.includes(eduPath));
  }

  private async checkEducationalRecordPermission(user: any, path: string): Promise<boolean> {
    // In a real implementation, this would check against a permission system
    // For now, we'll do basic role-based checks
    
    if (user.role === 'admin') return true;
    if (user.role === 'counselor') return true;
    
    // Students can only access their own records
    if (user.role === 'student') {
      return path.includes(`/users/${user.id}`) || path.includes(`user_id=${user.id}`);
    }
    
    // Recommenders can access records they're authorized for
    if (user.role === 'recommender') {
      // This would need to check against authorized student list
      return true; // Simplified for now
    }
    
    return false;
  }

  private identifyPersonalData(data: any): string[] {
    const personalDataFields: string[] = [];
    const personalDataKeys = [
      'email', 'phone', 'address', 'ssn', 'birthdate', 'name',
      'firstName', 'lastName', 'dateOfBirth', 'phoneNumber',
      'homeAddress', 'emergencyContact'
    ];

    if (typeof data === 'object' && data !== null) {
      for (const key of Object.keys(data)) {
        if (personalDataKeys.some(pdk => key.toLowerCase().includes(pdk.toLowerCase()))) {
          personalDataFields.push(key);
        }
      }
    }

    return personalDataFields;
  }

  private isDataCollectionJustified(path: string, fields: string[]): boolean {
    // Define justified data collection patterns
    const justifiedPatterns = [
      { path: '/users/register', fields: ['email', 'name', 'phone'] },
      { path: '/users/profile', fields: ['email', 'name', 'phone', 'address'] },
      { path: '/applications', fields: ['name', 'email', 'phone', 'address'] }
    ];

    for (const pattern of justifiedPatterns) {
      if (path.includes(pattern.path)) {
        return fields.every(field => 
          pattern.fields.some(jf => field.toLowerCase().includes(jf.toLowerCase()))
        );
      }
    }

    return false; // Conservative approach - require explicit justification
  }

  private containsSensitiveData(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    
    const sensitiveKeys = ['ssn', 'password', 'creditcard', 'bankaccount', 'medical'];
    const dataString = JSON.stringify(data).toLowerCase();
    
    return sensitiveKeys.some(key => dataString.includes(key));
  }

  private requiresConsent(path: string, data: any): boolean {
    // Marketing, analytics, or non-essential data processing requires consent
    const consentRequiredPaths = ['/analytics', '/marketing', '/recommendations'];
    return consentRequiredPaths.some(crp => path.includes(crp));
  }

  private async verifyUserConsent(userId?: string, path?: string): Promise<boolean> {
    if (!userId) return false;
    
    // In a real implementation, this would check a consent database
    // For now, we'll assume consent is required but not verified
    return false; // This will trigger the violation for demonstration
  }

  private async checkRetentionPolicy(path: string): Promise<boolean> {
    // In a real implementation, this would check against defined retention policies
    const hasPolicy = ['/users', '/applications', '/letters'].some(p => path.includes(p));
    return hasPolicy;
  }

  private requiresAuditLogging(path: string, method: string): boolean {
    const auditPaths = ['/users', '/applications', '/letters', '/admin'];
    const auditMethods = ['POST', 'PUT', 'DELETE'];
    
    return auditPaths.some(ap => path.includes(ap)) && auditMethods.includes(method);
  }

  private logAuditEvent(req: Request, action: string, result: 'success' | 'failure' | 'blocked'): void {
    const auditLog: AuditLog = {
      timestamp: new Date().toISOString(),
      userId: req.user?.id,
      action,
      resource: req.path,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      result,
      complianceFlags: []
    };

    this.auditLogs.push(auditLog);
    
    // Also log to security logger
    securityLogger.info('Audit event', auditLog);
    
    // Keep only last 10000 audit logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }

  // Public methods for compliance reporting
  getAuditLogs(limit: number = 100): AuditLog[] {
    return this.auditLogs.slice(-limit);
  }

  async generateComplianceReport(): Promise<{
    summary: {
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      criticalViolations: number;
    };
    ruleStatus: Array<{
      rule: string;
      category: string;
      status: 'passing' | 'failing';
      lastCheck: string;
    }>;
    recommendations: string[];
  }> {
    // This would generate a comprehensive compliance report
    // For now, return a basic structure
    return {
      summary: {
        totalChecks: this.rules.length,
        passedChecks: 0,
        failedChecks: 0,
        criticalViolations: 0
      },
      ruleStatus: this.rules.map(rule => ({
        rule: rule.name,
        category: rule.category,
        status: 'passing' as const,
        lastCheck: new Date().toISOString()
      })),
      recommendations: []
    };
  }
}

export const complianceChecker = new ComplianceChecker();

// Middleware for compliance checking
export const complianceMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const complianceResult = await complianceChecker.checkCompliance(req);
    
    // Block request if there are critical violations
    if (complianceResult.criticalViolations.length > 0) {
      securityLogger.error('Critical compliance violations detected', {
        ip: req.ip,
        path: req.path,
        violations: complianceResult.criticalViolations
      });
      
      return res.status(403).json({
        error: 'Request blocked due to compliance violations',
        reference: `COMPLIANCE-${Date.now()}`
      });
    }

    // Attach compliance result to request for logging
    (req as any).complianceResult = complianceResult;
    next();
  } catch (error) {
    logger.error('Compliance middleware error:', error);
    next(); // Continue processing even if compliance check fails
  }
};