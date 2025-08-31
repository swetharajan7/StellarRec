// Service exports
export { auditService } from './services/auditService';
export { gdprService } from './services/gdprService';
export { ferpaService } from './services/ferpaService';
export { dataRetentionService } from './services/dataRetentionService';

// Logger exports
export { logger, complianceLogger } from './utils/logger';

// Middleware exports
export { complianceMiddleware } from './middleware/complianceMiddleware';

// Types and interfaces
export interface ComplianceConfig {
  enableAuditLogging: boolean;
  enableGDPRCompliance: boolean;
  enableFERPACompliance: boolean;
  enableDataRetention: boolean;
  auditLogRetention: number; // days
  dataRetentionSchedule: string; // cron expression
  complianceReportSchedule: string; // cron expression
}

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
  endpoint?: string;
  httpMethod?: string;
  statusCode?: number;
  errorMessage?: string;
  metadata?: any;
  complianceFlags?: string[];
  dataCategory?: 'GENERAL' | 'PERSONAL' | 'SENSITIVE' | 'EDUCATIONAL' | 'FINANCIAL' | 'HEALTH' | 'BIOMETRIC';
  sensitivity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface GDPRRequest {
  userId: string;
  userEmail: string;
  requestType: 'ACCESS' | 'RECTIFICATION' | 'ERASURE' | 'RESTRICT' | 'PORTABILITY' | 'OBJECT';
  details: any;
}

export interface FERPAAccessRequest {
  studentId: string;
  accessorId: string;
  accessorRole: string;
  recordType: string;
  recordId: string;
  accessPurpose: string;
}

export interface RetentionPolicy {
  name: string;
  description: string;
  dataCategory: string;
  retentionPeriod: number;
  purgeMethod: 'SOFT_DELETE' | 'HARD_DELETE' | 'ANONYMIZE' | 'ENCRYPT';
  conditions?: any;
  exceptions?: any;
}

// Configuration helper
export const createComplianceConfig = (overrides: Partial<ComplianceConfig> = {}): ComplianceConfig => {
  return {
    enableAuditLogging: true,
    enableGDPRCompliance: true,
    enableFERPACompliance: true,
    enableDataRetention: true,
    auditLogRetention: 2190, // 6 years
    dataRetentionSchedule: '0 2 * * *', // Daily at 2 AM
    complianceReportSchedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
    ...overrides
  };
};

// Complete compliance middleware stack
export const createComplianceStack = (config: Partial<ComplianceConfig> = {}) => {
  const complianceConfig = createComplianceConfig(config);
  
  const middleware = [];
  
  if (complianceConfig.enableAuditLogging || 
      complianceConfig.enableGDPRCompliance || 
      complianceConfig.enableFERPACompliance) {
    middleware.push(complianceMiddleware);
  }
  
  return middleware;
};

// Compliance report generator
export const generateComplianceReport = async (
  startDate: Date,
  endDate: Date,
  complianceTypes: string[] = ['GDPR', 'FERPA']
): Promise<{
  summary: any;
  gdprCompliance?: any;
  ferpaCompliance?: any;
  auditSummary?: any;
  retentionSummary?: any;
  recommendations: string[];
}> => {
  const report: any = {
    summary: {
      reportPeriod: { startDate, endDate },
      complianceTypes,
      generatedAt: new Date()
    },
    recommendations: []
  };

  try {
    // Generate audit summary
    const auditSummary = await auditService.generateComplianceReport(
      startDate,
      endDate
    );
    report.auditSummary = auditSummary;

    // Generate FERPA compliance report if requested
    if (complianceTypes.includes('FERPA')) {
      const ferpaCompliance = await ferpaService.generateFERPAComplianceReport(
        startDate,
        endDate
      );
      report.ferpaCompliance = ferpaCompliance;
      report.recommendations.push(...ferpaCompliance.recommendations);
    }

    // Generate data retention summary
    const retentionSummary = await dataRetentionService.generateRetentionComplianceReport();
    report.retentionSummary = retentionSummary;
    report.recommendations.push(...retentionSummary.recommendations);

    // Generate overall summary
    report.summary.totalAuditEvents = auditSummary.auditEvents;
    report.summary.totalDataProcessingRecords = auditSummary.dataProcessingRecords;
    report.summary.totalEducationalRecordAccesses = auditSummary.educationalRecordAccesses;
    report.summary.complianceScore = calculateOverallComplianceScore(report);

    // Remove duplicate recommendations
    report.recommendations = [...new Set(report.recommendations)];

  } catch (error) {
    logger.error('Failed to generate compliance report:', error);
    report.error = 'Failed to generate complete compliance report';
  }

  return report;
};

// Calculate overall compliance score
const calculateOverallComplianceScore = (report: any): number => {
  let totalScore = 0;
  let scoreCount = 0;

  if (report.ferpaCompliance?.summary?.complianceScore !== undefined) {
    totalScore += report.ferpaCompliance.summary.complianceScore;
    scoreCount++;
  }

  // Add other compliance scores as they become available
  
  return scoreCount > 0 ? totalScore / scoreCount : 100;
};

// Utility functions
export const isPersonalData = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;
  
  const personalDataKeys = [
    'email', 'phone', 'address', 'ssn', 'birthdate', 'name',
    'firstName', 'lastName', 'dateOfBirth', 'phoneNumber',
    'homeAddress', 'emergencyContact'
  ];

  const dataString = JSON.stringify(data).toLowerCase();
  return personalDataKeys.some(key => dataString.includes(key.toLowerCase()));
};

export const isEducationalRecord = (resource: string, data?: any): boolean => {
  const educationalResources = [
    'applications', 'transcripts', 'grades', 'letters', 
    'recommendations', 'essays', 'attendance', 'disciplinary'
  ];
  
  return educationalResources.some(eduResource => 
    resource.toLowerCase().includes(eduResource)
  );
};

export const determineSensitivityLevel = (
  resource: string, 
  data?: any
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
  if (resource.includes('password') || resource.includes('ssn') || resource.includes('payment')) {
    return 'CRITICAL';
  }
  if (resource.includes('application') || resource.includes('transcript') || resource.includes('grade')) {
    return 'HIGH';
  }
  if (isPersonalData(data) || resource.includes('user') || resource.includes('profile')) {
    return 'MEDIUM';
  }
  return 'LOW';
};

export const getComplianceFlags = (resource: string, action: string): string[] => {
  const flags: string[] = [];

  // FERPA flags
  if (isEducationalRecord(resource)) {
    flags.push('FERPA');
  }

  // GDPR flags
  if (resource.includes('user') || resource.includes('profile') || action.includes('PERSONAL_DATA')) {
    flags.push('GDPR');
  }

  // CCPA flags (if applicable)
  if (resource.includes('analytics') || resource.includes('marketing')) {
    flags.push('CCPA');
  }

  return flags;
};