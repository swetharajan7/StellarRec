import { PrismaClient } from '@prisma/client';
import { Request } from 'express';
import { logger } from '../utils/logger';
import { createHash } from 'crypto';

interface AuditLogEntry {
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

class AuditService {
  private prisma: PrismaClient;
  private auditQueue: AuditLogEntry[] = [];
  private batchSize = 100;
  private flushInterval = 5000; // 5 seconds

  constructor() {
    this.prisma = new PrismaClient();
    this.startBatchProcessor();
  }

  // Log audit event
  async logEvent(entry: AuditLogEntry): Promise<void> {
    try {
      // Add to queue for batch processing
      this.auditQueue.push({
        ...entry,
        timestamp: new Date(),
        requestId: entry.requestId || this.generateRequestId()
      });

      // If queue is full, flush immediately
      if (this.auditQueue.length >= this.batchSize) {
        await this.flushQueue();
      }
    } catch (error) {
      logger.error('Failed to log audit event:', error);
    }
  }

  // Log from Express request
  async logFromRequest(
    req: Request,
    action: string,
    resource: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any,
    statusCode?: number,
    errorMessage?: string
  ): Promise<void> {
    const entry: AuditLogEntry = {
      userId: req.user?.id,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      action,
      resource,
      resourceId,
      oldValues,
      newValues,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID,
      requestId: req.headers['x-request-id'] as string,
      endpoint: req.path,
      httpMethod: req.method,
      statusCode,
      errorMessage,
      metadata: {
        query: req.query,
        params: req.params,
        headers: this.sanitizeHeaders(req.headers)
      },
      complianceFlags: this.determineComplianceFlags(resource, action),
      dataCategory: this.determineDataCategory(resource),
      sensitivity: this.determineSensitivity(resource, newValues || oldValues)
    };

    await this.logEvent(entry);
  }

  // Educational record access logging (FERPA)
  async logEducationalRecordAccess(
    studentId: string,
    studentEmail: string,
    accessorId: string,
    accessorEmail: string,
    accessorRole: string,
    recordType: string,
    recordId: string,
    accessPurpose: string,
    req?: Request
  ): Promise<void> {
    try {
      await this.prisma.educationalRecordAccess.create({
        data: {
          studentId,
          studentEmail,
          accessorId,
          accessorEmail,
          accessorRole,
          recordType: recordType as any,
          recordId,
          accessPurpose,
          accessMethod: 'api',
          ipAddress: req?.ip,
          userAgent: req?.get('User-Agent'),
          sessionId: req?.sessionID,
          consentRequired: this.isConsentRequired(accessorRole, recordType),
          consentObtained: await this.checkConsent(studentId, accessorId, recordType),
          disclosureType: this.determineDisclosureType(accessorRole)
        }
      });

      // Also log in general audit log
      await this.logEvent({
        userId: accessorId,
        userEmail: accessorEmail,
        userRole: accessorRole,
        action: 'ACCESS_EDUCATIONAL_RECORD',
        resource: 'educational_records',
        resourceId: recordId,
        metadata: {
          studentId,
          recordType,
          accessPurpose
        },
        complianceFlags: ['FERPA'],
        dataCategory: 'EDUCATIONAL',
        sensitivity: 'HIGH'
      });
    } catch (error) {
      logger.error('Failed to log educational record access:', error);
    }
  }

  // Data processing logging (GDPR)
  async logDataProcessing(
    userId: string,
    userEmail: string,
    dataSubject: string,
    processingPurpose: string,
    legalBasis: string,
    dataCategories: string[],
    recipients: string[] = [],
    retentionPeriod?: number
  ): Promise<string> {
    try {
      const record = await this.prisma.dataProcessingRecord.create({
        data: {
          userId,
          userEmail,
          dataSubject,
          processingPurpose,
          legalBasis: legalBasis as any,
          dataCategories,
          recipients,
          retentionPeriod,
          dataMinimized: this.checkDataMinimization(dataCategories),
          encrypted: true, // Assume encrypted in our system
          pseudonymized: this.checkPseudonymization(dataCategories)
        }
      });

      // Log in audit trail
      await this.logEvent({
        userId,
        userEmail,
        action: 'DATA_PROCESSING_START',
        resource: 'data_processing',
        resourceId: record.id,
        metadata: {
          processingPurpose,
          legalBasis,
          dataCategories
        },
        complianceFlags: ['GDPR'],
        dataCategory: 'PERSONAL',
        sensitivity: 'HIGH'
      });

      return record.id;
    } catch (error) {
      logger.error('Failed to log data processing:', error);
      throw error;
    }
  }

  // Get audit logs with filtering
  async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    complianceFlags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const where: any = {};

      if (filters.userId) where.userId = filters.userId;
      if (filters.action) where.action = filters.action;
      if (filters.resource) where.resource = filters.resource;
      if (filters.complianceFlags?.length) {
        where.complianceFlags = {
          hasSome: filters.complianceFlags
        };
      }
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }

      return await this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: filters.limit || 100,
        skip: filters.offset || 0
      });
    } catch (error) {
      logger.error('Failed to get audit logs:', error);
      return [];
    }
  }

  // Generate compliance report
  async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    complianceType?: string
  ): Promise<{
    summary: any;
    auditEvents: number;
    dataProcessingRecords: number;
    educationalRecordAccesses: number;
    dataSubjectRequests: number;
    breachIncidents: number;
  }> {
    try {
      const dateFilter = {
        gte: startDate,
        lte: endDate
      };

      const complianceFilter = complianceType ? {
        hasSome: [complianceType]
      } : undefined;

      const [
        auditEvents,
        dataProcessingRecords,
        educationalRecordAccesses,
        dataSubjectRequests,
        breachIncidents
      ] = await Promise.all([
        this.prisma.auditLog.count({
          where: {
            timestamp: dateFilter,
            complianceFlags: complianceFilter
          }
        }),
        this.prisma.dataProcessingRecord.count({
          where: {
            processingStart: dateFilter
          }
        }),
        this.prisma.educationalRecordAccess.count({
          where: {
            timestamp: dateFilter
          }
        }),
        this.prisma.dataSubjectRequest.count({
          where: {
            requestDate: dateFilter
          }
        }),
        this.prisma.dataBreachIncident.count({
          where: {
            discoveryDate: dateFilter
          }
        })
      ]);

      // Generate summary statistics
      const summary = await this.generateSummaryStats(startDate, endDate, complianceType);

      return {
        summary,
        auditEvents,
        dataProcessingRecords,
        educationalRecordAccesses,
        dataSubjectRequests,
        breachIncidents
      };
    } catch (error) {
      logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  // Private helper methods
  private startBatchProcessor(): void {
    setInterval(async () => {
      if (this.auditQueue.length > 0) {
        await this.flushQueue();
      }
    }, this.flushInterval);
  }

  private async flushQueue(): Promise<void> {
    if (this.auditQueue.length === 0) return;

    const batch = this.auditQueue.splice(0, this.batchSize);
    
    try {
      await this.prisma.auditLog.createMany({
        data: batch.map(entry => ({
          ...entry,
          timestamp: new Date()
        }))
      });
    } catch (error) {
      logger.error('Failed to flush audit queue:', error);
      // Re-add failed entries to queue for retry
      this.auditQueue.unshift(...batch);
    }
  }

  private generateRequestId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    return sanitized;
  }

  private determineComplianceFlags(resource: string, action: string): string[] {
    const flags: string[] = [];

    // FERPA flags
    if (resource.includes('application') || 
        resource.includes('transcript') || 
        resource.includes('grade') || 
        resource.includes('letter')) {
      flags.push('FERPA');
    }

    // GDPR flags
    if (resource.includes('user') || 
        resource.includes('profile') || 
        action.includes('PERSONAL_DATA')) {
      flags.push('GDPR');
    }

    return flags;
  }

  private determineDataCategory(resource: string): 'GENERAL' | 'PERSONAL' | 'SENSITIVE' | 'EDUCATIONAL' | 'FINANCIAL' | 'HEALTH' | 'BIOMETRIC' {
    if (resource.includes('application') || resource.includes('transcript') || resource.includes('grade')) {
      return 'EDUCATIONAL';
    }
    if (resource.includes('user') || resource.includes('profile')) {
      return 'PERSONAL';
    }
    if (resource.includes('payment') || resource.includes('financial')) {
      return 'FINANCIAL';
    }
    return 'GENERAL';
  }

  private determineSensitivity(resource: string, data?: any): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (resource.includes('password') || resource.includes('ssn') || resource.includes('payment')) {
      return 'CRITICAL';
    }
    if (resource.includes('application') || resource.includes('transcript')) {
      return 'HIGH';
    }
    if (resource.includes('user') || resource.includes('profile')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private isConsentRequired(accessorRole: string, recordType: string): boolean {
    // Parents and students don't need consent for their own records
    if (accessorRole === 'student' || accessorRole === 'parent') {
      return false;
    }
    
    // School officials with legitimate educational interest don't need consent
    if (accessorRole === 'school_official' || accessorRole === 'counselor') {
      return false;
    }
    
    // External parties typically need consent
    return true;
  }

  private async checkConsent(studentId: string, accessorId: string, recordType: string): Promise<boolean> {
    // In a real implementation, this would check a consent database
    // For now, assume consent is obtained for legitimate access
    return true;
  }

  private determineDisclosureType(accessorRole: string): 'INTERNAL' | 'EXTERNAL_CONSENT' | 'EXTERNAL_NO_CONSENT' | 'DIRECTORY_INFO' | 'EMERGENCY' {
    if (accessorRole === 'student' || accessorRole === 'school_official' || accessorRole === 'counselor') {
      return 'INTERNAL';
    }
    return 'EXTERNAL_CONSENT';
  }

  private checkDataMinimization(dataCategories: string[]): boolean {
    // Check if only necessary data categories are being processed
    const necessaryCategories = ['name', 'email', 'academic_info'];
    return dataCategories.every(category => necessaryCategories.includes(category));
  }

  private checkPseudonymization(dataCategories: string[]): boolean {
    // Check if sensitive categories are pseudonymized
    const sensitiveCategories = ['ssn', 'financial_info', 'health_info'];
    return !dataCategories.some(category => sensitiveCategories.includes(category));
  }

  private async generateSummaryStats(startDate: Date, endDate: Date, complianceType?: string): Promise<any> {
    // Generate detailed summary statistics
    const actionCounts = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        timestamp: { gte: startDate, lte: endDate },
        complianceFlags: complianceType ? { hasSome: [complianceType] } : undefined
      },
      _count: { action: true }
    });

    const resourceCounts = await this.prisma.auditLog.groupBy({
      by: ['resource'],
      where: {
        timestamp: { gte: startDate, lte: endDate },
        complianceFlags: complianceType ? { hasSome: [complianceType] } : undefined
      },
      _count: { resource: true }
    });

    return {
      actionCounts,
      resourceCounts,
      period: { startDate, endDate },
      complianceType
    };
  }
}

export const auditService = new AuditService();