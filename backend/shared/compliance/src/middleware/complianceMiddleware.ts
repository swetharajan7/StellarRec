import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/auditService';
import { gdprService } from '../services/gdprService';
import { ferpaService } from '../services/ferpaService';
import { logger } from '../utils/logger';
import { 
  isPersonalData, 
  isEducationalRecord, 
  determineSensitivityLevel, 
  getComplianceFlags 
} from '../index';

interface ComplianceRequest extends Request {
  complianceContext?: {
    requiresAudit: boolean;
    requiresGDPRCheck: boolean;
    requiresFERPACheck: boolean;
    dataCategory: string;
    sensitivity: string;
    complianceFlags: string[];
  };
}

// Main compliance middleware
export const complianceMiddleware = async (
  req: ComplianceRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Determine compliance requirements
    const complianceContext = analyzeComplianceRequirements(req);
    req.complianceContext = complianceContext;

    // Pre-request compliance checks
    const preCheckResult = await performPreRequestChecks(req);
    if (!preCheckResult.allowed) {
      return res.status(403).json({
        error: 'Request blocked by compliance policy',
        reason: preCheckResult.reason,
        reference: `COMPLIANCE-${Date.now()}`
      });
    }

    // Store original res.json to intercept response
    const originalJson = res.json;
    res.json = function(data: any) {
      // Post-request compliance logging
      performPostRequestLogging(req, res, data).catch(error => {
        logger.error('Post-request compliance logging failed:', error);
      });
      
      return originalJson.call(this, data);
    };

    next();
  } catch (error) {
    logger.error('Compliance middleware error:', error);
    next(); // Continue processing even if compliance check fails
  }
};

// Analyze what compliance requirements apply to this request
function analyzeComplianceRequirements(req: ComplianceRequest): {
  requiresAudit: boolean;
  requiresGDPRCheck: boolean;
  requiresFERPACheck: boolean;
  dataCategory: string;
  sensitivity: string;
  complianceFlags: string[];
} {
  const path = req.path;
  const method = req.method;
  const body = req.body;

  // Determine if this request requires audit logging
  const requiresAudit = shouldAuditRequest(path, method);

  // Determine if GDPR compliance checks are needed
  const requiresGDPRCheck = isPersonalData(body) || 
                            path.includes('/users') || 
                            path.includes('/profile');

  // Determine if FERPA compliance checks are needed
  const requiresFERPACheck = isEducationalRecord(path, body) ||
                            path.includes('/applications') ||
                            path.includes('/transcripts') ||
                            path.includes('/letters');

  // Determine data category
  const dataCategory = determineDataCategory(path, body);

  // Determine sensitivity level
  const sensitivity = determineSensitivityLevel(path, body);

  // Get compliance flags
  const complianceFlags = getComplianceFlags(path, method);

  return {
    requiresAudit,
    requiresGDPRCheck,
    requiresFERPACheck,
    dataCategory,
    sensitivity,
    complianceFlags
  };
}

// Perform pre-request compliance checks
async function performPreRequestChecks(req: ComplianceRequest): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    const context = req.complianceContext!;

    // FERPA access control check
    if (context.requiresFERPACheck && req.method === 'GET') {
      const ferpaCheck = await checkFERPAAccess(req);
      if (!ferpaCheck.allowed) {
        return { allowed: false, reason: ferpaCheck.reason };
      }
    }

    // GDPR consent check for data processing
    if (context.requiresGDPRCheck && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const gdprCheck = await checkGDPRConsent(req);
      if (!gdprCheck.allowed) {
        return { allowed: false, reason: gdprCheck.reason };
      }
    }

    // Data retention policy check
    if (req.method === 'DELETE') {
      const retentionCheck = await checkDataRetentionPolicy(req);
      if (!retentionCheck.allowed) {
        return { allowed: false, reason: retentionCheck.reason };
      }
    }

    return { allowed: true };
  } catch (error) {
    logger.error('Pre-request compliance check failed:', error);
    return { allowed: true }; // Allow request if check fails
  }
}

// Perform post-request compliance logging
async function performPostRequestLogging(
  req: ComplianceRequest,
  res: Response,
  responseData: any
): Promise<void> {
  try {
    const context = req.complianceContext!;

    if (context.requiresAudit) {
      // Log to audit service
      await auditService.logFromRequest(
        req,
        determineAction(req.method, req.path),
        determineResource(req.path),
        extractResourceId(req),
        req.method === 'PUT' || req.method === 'PATCH' ? req.body : undefined,
        responseData,
        res.statusCode,
        res.statusCode >= 400 ? 'Request failed' : undefined
      );
    }

    // FERPA-specific logging
    if (context.requiresFERPACheck && req.method === 'GET') {
      await logFERPAAccess(req, responseData);
    }

    // GDPR-specific logging
    if (context.requiresGDPRCheck && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
      await logGDPRDataProcessing(req, responseData);
    }
  } catch (error) {
    logger.error('Post-request compliance logging failed:', error);
  }
}

// Check FERPA access permissions
async function checkFERPAAccess(req: ComplianceRequest): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    const user = req.user;
    if (!user) {
      return { allowed: false, reason: 'Authentication required for educational record access' };
    }

    // Extract student ID and record information from request
    const studentId = extractStudentId(req);
    const recordType = extractRecordType(req.path);
    const recordId = extractResourceId(req);

    if (!studentId || !recordType || !recordId) {
      return { allowed: true }; // Not an educational record request
    }

    // Check FERPA access permissions
    const accessCheck = await ferpaService.canAccessEducationalRecord(
      user.id,
      user.role,
      studentId,
      recordType,
      recordId
    );

    return {
      allowed: accessCheck.canAccess,
      reason: accessCheck.reason
    };
  } catch (error) {
    logger.error('FERPA access check failed:', error);
    return { allowed: true }; // Allow if check fails
  }
}

// Check GDPR consent for data processing
async function checkGDPRConsent(req: ComplianceRequest): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    const user = req.user;
    const body = req.body;

    // Check if this operation requires consent
    if (!requiresGDPRConsent(req.path, body)) {
      return { allowed: true };
    }

    // For now, assume consent is handled at the application level
    // In a full implementation, this would check the consent database
    return { allowed: true };
  } catch (error) {
    logger.error('GDPR consent check failed:', error);
    return { allowed: true }; // Allow if check fails
  }
}

// Check data retention policy compliance
async function checkDataRetentionPolicy(req: ComplianceRequest): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  try {
    // Check if the data being deleted is subject to retention requirements
    const resourceId = extractResourceId(req);
    const resource = determineResource(req.path);

    // For now, allow all deletions
    // In a full implementation, this would check retention policies
    return { allowed: true };
  } catch (error) {
    logger.error('Data retention policy check failed:', error);
    return { allowed: true }; // Allow if check fails
  }
}

// Log FERPA educational record access
async function logFERPAAccess(req: ComplianceRequest, responseData: any): Promise<void> {
  try {
    const user = req.user;
    if (!user) return;

    const studentId = extractStudentId(req);
    const recordType = extractRecordType(req.path);
    const recordId = extractResourceId(req);

    if (!studentId || !recordType || !recordId) return;

    await ferpaService.logEducationalRecordAccess(
      studentId,
      '', // Student email would be fetched from user service
      user.id,
      user.email,
      user.role,
      recordType,
      recordId,
      'API Access',
      req.ip,
      req.get('User-Agent')
    );
  } catch (error) {
    logger.error('FERPA access logging failed:', error);
  }
}

// Log GDPR data processing
async function logGDPRDataProcessing(req: ComplianceRequest, responseData: any): Promise<void> {
  try {
    const user = req.user;
    if (!user) return;

    const processingPurpose = determineProcessingPurpose(req.path, req.method);
    const dataCategories = identifyDataCategories(req.body);

    if (dataCategories.length === 0) return;

    await auditService.logDataProcessing(
      user.id,
      user.email,
      user.email, // Data subject (could be different in some cases)
      processingPurpose,
      'LEGITIMATE_INTERESTS', // Would be determined based on context
      dataCategories
    );
  } catch (error) {
    logger.error('GDPR data processing logging failed:', error);
  }
}

// Helper functions
function shouldAuditRequest(path: string, method: string): boolean {
  const auditPaths = ['/users', '/applications', '/letters', '/admin', '/compliance'];
  const auditMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  return auditPaths.some(ap => path.includes(ap)) && auditMethods.includes(method);
}

function determineDataCategory(path: string, body: any): string {
  if (path.includes('application') || path.includes('transcript') || path.includes('grade')) {
    return 'EDUCATIONAL';
  }
  if (path.includes('user') || path.includes('profile')) {
    return 'PERSONAL';
  }
  if (path.includes('payment') || path.includes('financial')) {
    return 'FINANCIAL';
  }
  return 'GENERAL';
}

function determineAction(method: string, path: string): string {
  const baseAction = {
    'GET': 'READ',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  }[method] || 'unknown';

  // Add context from path
  if (path.includes('/login')) return 'LOGIN';
  if (path.includes('/logout')) return 'LOGOUT';
  if (path.includes('/export')) return 'EXPORT_DATA';
  if (path.includes('/download')) return 'DOWNLOAD_DATA';

  return baseAction.toUpperCase();
}

function determineResource(path: string): string {
  const pathParts = path.split('/').filter(part => part && !part.match(/^\d+$/));
  return pathParts[pathParts.length - 1] || 'unknown';
}

function extractResourceId(req: ComplianceRequest): string | undefined {
  // Extract ID from URL parameters
  const idParams = ['id', 'userId', 'applicationId', 'letterId'];
  for (const param of idParams) {
    if (req.params[param]) {
      return req.params[param];
    }
  }
  
  // Extract from path
  const pathParts = req.path.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart && lastPart.match(/^[a-f0-9-]{36}$/)) { // UUID pattern
    return lastPart;
  }
  
  return undefined;
}

function extractStudentId(req: ComplianceRequest): string | undefined {
  return req.params.studentId || req.query.studentId as string || req.body?.studentId;
}

function extractRecordType(path: string): string | undefined {
  if (path.includes('application')) return 'APPLICATION';
  if (path.includes('transcript')) return 'TRANSCRIPT';
  if (path.includes('grade')) return 'GRADES';
  if (path.includes('letter') || path.includes('recommendation')) return 'RECOMMENDATION';
  if (path.includes('essay')) return 'ESSAY';
  return undefined;
}

function requiresGDPRConsent(path: string, body: any): boolean {
  // Marketing, analytics, or non-essential data processing requires consent
  const consentRequiredPaths = ['/analytics', '/marketing', '/recommendations', '/tracking'];
  return consentRequiredPaths.some(crp => path.includes(crp));
}

function determineProcessingPurpose(path: string, method: string): string {
  if (path.includes('application')) return 'University Application Processing';
  if (path.includes('user') || path.includes('profile')) return 'User Account Management';
  if (path.includes('analytics')) return 'Analytics and Insights';
  if (path.includes('marketing')) return 'Marketing Communications';
  if (path.includes('recommendation')) return 'Letter of Recommendation Processing';
  
  return `${method} operation on ${path}`;
}

function identifyDataCategories(body: any): string[] {
  if (!body || typeof body !== 'object') return [];
  
  const categories: string[] = [];
  const keys = Object.keys(body);
  
  if (keys.some(key => ['email', 'name', 'phone'].includes(key.toLowerCase()))) {
    categories.push('contact_information');
  }
  if (keys.some(key => ['address', 'city', 'state', 'zip'].includes(key.toLowerCase()))) {
    categories.push('address_information');
  }
  if (keys.some(key => ['gpa', 'grades', 'transcript'].includes(key.toLowerCase()))) {
    categories.push('academic_information');
  }
  if (keys.some(key => ['essay', 'statement', 'writing'].includes(key.toLowerCase()))) {
    categories.push('application_essays');
  }
  
  return categories;
}