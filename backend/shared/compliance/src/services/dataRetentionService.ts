import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { auditService } from './auditService';
import * as cron from 'node-cron';

interface RetentionPolicy {
  name: string;
  description: string;
  dataCategory: string;
  retentionPeriod: number; // in days
  purgeMethod: 'SOFT_DELETE' | 'HARD_DELETE' | 'ANONYMIZE' | 'ENCRYPT';
  conditions?: any;
  exceptions?: any;
}

interface PurgeResult {
  recordsProcessed: number;
  recordsPurged: number;
  recordsRetained: number;
  errors: string[];
}

class DataRetentionService {
  private prisma: PrismaClient;
  private isRunning = false;

  constructor() {
    this.prisma = new PrismaClient();
    this.initializeDefaultPolicies();
    this.scheduleRetentionJobs();
  }

  // Initialize default retention policies
  private async initializeDefaultPolicies(): Promise<void> {
    const defaultPolicies: RetentionPolicy[] = [
      {
        name: 'User Account Data',
        description: 'Personal user account information',
        dataCategory: 'PERSONAL',
        retentionPeriod: 2555, // 7 years
        purgeMethod: 'ANONYMIZE',
        conditions: { accountStatus: 'inactive' },
        exceptions: { legalHold: false }
      },
      {
        name: 'Educational Records',
        description: 'Student educational records (FERPA)',
        dataCategory: 'EDUCATIONAL',
        retentionPeriod: 1825, // 5 years after graduation
        purgeMethod: 'SOFT_DELETE',
        conditions: { graduationStatus: 'graduated' },
        exceptions: { transcriptRequests: true }
      },
      {
        name: 'Application Data',
        description: 'University application information',
        dataCategory: 'EDUCATIONAL',
        retentionPeriod: 1095, // 3 years
        purgeMethod: 'SOFT_DELETE',
        conditions: { applicationStatus: ['rejected', 'withdrawn'] }
      },
      {
        name: 'Financial Records',
        description: 'Payment and financial information',
        dataCategory: 'FINANCIAL',
        retentionPeriod: 2555, // 7 years (tax requirements)
        purgeMethod: 'ENCRYPT',
        exceptions: { auditRequirements: true }
      },
      {
        name: 'Audit Logs',
        description: 'System audit and compliance logs',
        dataCategory: 'GENERAL',
        retentionPeriod: 2190, // 6 years
        purgeMethod: 'HARD_DELETE',
        exceptions: { complianceInvestigation: false }
      },
      {
        name: 'Marketing Data',
        description: 'Marketing and analytics data',
        dataCategory: 'PERSONAL',
        retentionPeriod: 730, // 2 years
        purgeMethod: 'ANONYMIZE',
        conditions: { consentWithdrawn: true }
      },
      {
        name: 'Session Data',
        description: 'User session and temporary data',
        dataCategory: 'GENERAL',
        retentionPeriod: 90, // 3 months
        purgeMethod: 'HARD_DELETE'
      },
      {
        name: 'Communication Logs',
        description: 'Email and notification logs',
        dataCategory: 'PERSONAL',
        retentionPeriod: 1095, // 3 years
        purgeMethod: 'SOFT_DELETE'
      }
    ];

    for (const policy of defaultPolicies) {
      await this.createOrUpdatePolicy(policy);
    }
  }

  // Create or update retention policy
  async createOrUpdatePolicy(policy: RetentionPolicy): Promise<string> {
    try {
      const existingPolicy = await this.prisma.dataRetentionPolicy.findUnique({
        where: { name: policy.name }
      });

      let policyRecord;
      if (existingPolicy) {
        policyRecord = await this.prisma.dataRetentionPolicy.update({
          where: { name: policy.name },
          data: {
            description: policy.description,
            dataCategory: policy.dataCategory as any,
            retentionPeriod: policy.retentionPeriod,
            purgeMethod: policy.purgeMethod as any,
            conditions: policy.conditions,
            exceptions: policy.exceptions,
            nextExecution: this.calculateNextExecution()
          }
        });
      } else {
        policyRecord = await this.prisma.dataRetentionPolicy.create({
          data: {
            name: policy.name,
            description: policy.description,
            dataCategory: policy.dataCategory as any,
            retentionPeriod: policy.retentionPeriod,
            purgeMethod: policy.purgeMethod as any,
            conditions: policy.conditions,
            exceptions: policy.exceptions,
            nextExecution: this.calculateNextExecution()
          }
        });
      }

      await auditService.logEvent({
        action: 'RETENTION_POLICY_UPDATED',
        resource: 'data_retention_policy',
        resourceId: policyRecord.id,
        metadata: policy,
        complianceFlags: ['GDPR', 'FERPA'],
        dataCategory: 'GENERAL',
        sensitivity: 'MEDIUM'
      });

      return policyRecord.id;
    } catch (error) {
      logger.error('Failed to create/update retention policy:', error);
      throw error;
    }
  }

  // Execute retention policies
  async executeRetentionPolicies(): Promise<{
    policiesExecuted: number;
    totalRecordsProcessed: number;
    totalRecordsPurged: number;
    results: Array<{ policyName: string; result: PurgeResult }>;
  }> {
    if (this.isRunning) {
      logger.warn('Retention policy execution already in progress');
      return {
        policiesExecuted: 0,
        totalRecordsProcessed: 0,
        totalRecordsPurged: 0,
        results: []
      };
    }

    this.isRunning = true;
    logger.info('Starting retention policy execution');

    try {
      const activePolicies = await this.prisma.dataRetentionPolicy.findMany({
        where: { isActive: true }
      });

      const results: Array<{ policyName: string; result: PurgeResult }> = [];
      let totalRecordsProcessed = 0;
      let totalRecordsPurged = 0;

      for (const policy of activePolicies) {
        try {
          const result = await this.executeSinglePolicy(policy);
          results.push({ policyName: policy.name, result });
          totalRecordsProcessed += result.recordsProcessed;
          totalRecordsPurged += result.recordsPurged;

          // Update policy execution timestamp
          await this.prisma.dataRetentionPolicy.update({
            where: { id: policy.id },
            data: {
              lastExecuted: new Date(),
              nextExecution: this.calculateNextExecution()
            }
          });
        } catch (error) {
          logger.error(`Failed to execute retention policy ${policy.name}:`, error);
          results.push({
            policyName: policy.name,
            result: {
              recordsProcessed: 0,
              recordsPurged: 0,
              recordsRetained: 0,
              errors: [error.message]
            }
          });
        }
      }

      // Log retention execution summary
      await auditService.logEvent({
        action: 'RETENTION_POLICIES_EXECUTED',
        resource: 'data_retention',
        metadata: {
          policiesExecuted: activePolicies.length,
          totalRecordsProcessed,
          totalRecordsPurged,
          results: results.map(r => ({
            policy: r.policyName,
            processed: r.result.recordsProcessed,
            purged: r.result.recordsPurged
          }))
        },
        complianceFlags: ['GDPR', 'FERPA'],
        dataCategory: 'GENERAL',
        sensitivity: 'HIGH'
      });

      return {
        policiesExecuted: activePolicies.length,
        totalRecordsProcessed,
        totalRecordsPurged,
        results
      };
    } finally {
      this.isRunning = false;
      logger.info('Retention policy execution completed');
    }
  }

  // Execute single retention policy
  private async executeSinglePolicy(policy: any): Promise<PurgeResult> {
    logger.info(`Executing retention policy: ${policy.name}`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriod);

    let recordsProcessed = 0;
    let recordsPurged = 0;
    let recordsRetained = 0;
    const errors: string[] = [];

    try {
      switch (policy.dataCategory) {
        case 'PERSONAL':
          const personalResult = await this.purgePersonalData(policy, cutoffDate);
          recordsProcessed += personalResult.recordsProcessed;
          recordsPurged += personalResult.recordsPurged;
          recordsRetained += personalResult.recordsRetained;
          errors.push(...personalResult.errors);
          break;

        case 'EDUCATIONAL':
          const educationalResult = await this.purgeEducationalData(policy, cutoffDate);
          recordsProcessed += educationalResult.recordsProcessed;
          recordsPurged += educationalResult.recordsPurged;
          recordsRetained += educationalResult.recordsRetained;
          errors.push(...educationalResult.errors);
          break;

        case 'FINANCIAL':
          const financialResult = await this.purgeFinancialData(policy, cutoffDate);
          recordsProcessed += financialResult.recordsProcessed;
          recordsPurged += financialResult.recordsPurged;
          recordsRetained += financialResult.recordsRetained;
          errors.push(...financialResult.errors);
          break;

        case 'GENERAL':
          const generalResult = await this.purgeGeneralData(policy, cutoffDate);
          recordsProcessed += generalResult.recordsProcessed;
          recordsPurged += generalResult.recordsPurged;
          recordsRetained += generalResult.recordsRetained;
          errors.push(...generalResult.errors);
          break;

        default:
          errors.push(`Unknown data category: ${policy.dataCategory}`);
      }
    } catch (error) {
      errors.push(`Policy execution failed: ${error.message}`);
    }

    return {
      recordsProcessed,
      recordsPurged,
      recordsRetained,
      errors
    };
  }

  // Purge personal data
  private async purgePersonalData(policy: any, cutoffDate: Date): Promise<PurgeResult> {
    let recordsProcessed = 0;
    let recordsPurged = 0;
    let recordsRetained = 0;
    const errors: string[] = [];

    try {
      // Find records to purge based on policy conditions
      const recordsToPurge = await this.findRecordsToPurge('users', policy, cutoffDate);
      recordsProcessed = recordsToPurge.length;

      for (const record of recordsToPurge) {
        try {
          // Check for exceptions
          if (await this.hasRetentionException(record, policy.exceptions)) {
            recordsRetained++;
            continue;
          }

          // Apply purge method
          await this.applyPurgeMethod(record, policy.purgeMethod, 'users');
          recordsPurged++;

          // Log individual purge
          await auditService.logEvent({
            action: 'DATA_PURGED',
            resource: 'users',
            resourceId: record.id,
            metadata: {
              policyName: policy.name,
              purgeMethod: policy.purgeMethod,
              retentionPeriod: policy.retentionPeriod
            },
            complianceFlags: ['GDPR'],
            dataCategory: 'PERSONAL',
            sensitivity: 'HIGH'
          });
        } catch (error) {
          errors.push(`Failed to purge record ${record.id}: ${error.message}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to purge personal data: ${error.message}`);
    }

    return { recordsProcessed, recordsPurged, recordsRetained, errors };
  }

  // Purge educational data
  private async purgeEducationalData(policy: any, cutoffDate: Date): Promise<PurgeResult> {
    let recordsProcessed = 0;
    let recordsPurged = 0;
    let recordsRetained = 0;
    const errors: string[] = [];

    try {
      // Handle different types of educational records
      const tables = ['applications', 'transcripts', 'recommendations'];
      
      for (const table of tables) {
        const records = await this.findRecordsToPurge(table, policy, cutoffDate);
        recordsProcessed += records.length;

        for (const record of records) {
          try {
            if (await this.hasRetentionException(record, policy.exceptions)) {
              recordsRetained++;
              continue;
            }

            await this.applyPurgeMethod(record, policy.purgeMethod, table);
            recordsPurged++;

            await auditService.logEvent({
              action: 'EDUCATIONAL_DATA_PURGED',
              resource: table,
              resourceId: record.id,
              metadata: {
                policyName: policy.name,
                purgeMethod: policy.purgeMethod
              },
              complianceFlags: ['FERPA'],
              dataCategory: 'EDUCATIONAL',
              sensitivity: 'HIGH'
            });
          } catch (error) {
            errors.push(`Failed to purge ${table} record ${record.id}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      errors.push(`Failed to purge educational data: ${error.message}`);
    }

    return { recordsProcessed, recordsPurged, recordsRetained, errors };
  }

  // Purge financial data
  private async purgeFinancialData(policy: any, cutoffDate: Date): Promise<PurgeResult> {
    let recordsProcessed = 0;
    let recordsPurged = 0;
    let recordsRetained = 0;
    const errors: string[] = [];

    try {
      const records = await this.findRecordsToPurge('payments', policy, cutoffDate);
      recordsProcessed = records.length;

      for (const record of records) {
        try {
          // Financial data often has strict retention requirements
          if (await this.hasRetentionException(record, policy.exceptions)) {
            recordsRetained++;
            continue;
          }

          // Financial data is typically encrypted rather than deleted
          await this.applyPurgeMethod(record, 'ENCRYPT', 'payments');
          recordsPurged++;

          await auditService.logEvent({
            action: 'FINANCIAL_DATA_PURGED',
            resource: 'payments',
            resourceId: record.id,
            metadata: {
              policyName: policy.name,
              purgeMethod: 'ENCRYPT'
            },
            complianceFlags: ['GDPR'],
            dataCategory: 'FINANCIAL',
            sensitivity: 'CRITICAL'
          });
        } catch (error) {
          errors.push(`Failed to purge financial record ${record.id}: ${error.message}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to purge financial data: ${error.message}`);
    }

    return { recordsProcessed, recordsPurged, recordsRetained, errors };
  }

  // Purge general data
  private async purgeGeneralData(policy: any, cutoffDate: Date): Promise<PurgeResult> {
    let recordsProcessed = 0;
    let recordsPurged = 0;
    let recordsRetained = 0;
    const errors: string[] = [];

    try {
      // Handle audit logs and session data
      if (policy.name.includes('Audit')) {
        const auditLogs = await this.prisma.auditLog.findMany({
          where: {
            timestamp: { lt: cutoffDate }
          }
        });

        recordsProcessed = auditLogs.length;

        // Hard delete old audit logs
        const deleteResult = await this.prisma.auditLog.deleteMany({
          where: {
            timestamp: { lt: cutoffDate }
          }
        });

        recordsPurged = deleteResult.count;
      }

      // Handle session data and temporary files
      if (policy.name.includes('Session')) {
        // This would integrate with session storage cleanup
        recordsProcessed += await this.cleanupSessionData(cutoffDate);
        recordsPurged = recordsProcessed; // Assume all session data is purged
      }
    } catch (error) {
      errors.push(`Failed to purge general data: ${error.message}`);
    }

    return { recordsProcessed, recordsPurged, recordsRetained, errors };
  }

  // Helper methods
  private async findRecordsToPurge(table: string, policy: any, cutoffDate: Date): Promise<any[]> {
    // This would be implemented based on your actual database schema
    // For now, return empty array as placeholder
    return [];
  }

  private async hasRetentionException(record: any, exceptions: any): Promise<boolean> {
    if (!exceptions) return false;

    // Check various exception conditions
    if (exceptions.legalHold && record.legalHold) return true;
    if (exceptions.auditRequirements && record.underAudit) return true;
    if (exceptions.complianceInvestigation && record.underInvestigation) return true;
    if (exceptions.transcriptRequests && record.hasActiveTranscriptRequests) return true;

    return false;
  }

  private async applyPurgeMethod(record: any, method: string, table: string): Promise<void> {
    switch (method) {
      case 'SOFT_DELETE':
        await this.softDeleteRecord(record, table);
        break;
      case 'HARD_DELETE':
        await this.hardDeleteRecord(record, table);
        break;
      case 'ANONYMIZE':
        await this.anonymizeRecord(record, table);
        break;
      case 'ENCRYPT':
        await this.encryptRecord(record, table);
        break;
      default:
        throw new Error(`Unknown purge method: ${method}`);
    }
  }

  private async softDeleteRecord(record: any, table: string): Promise<void> {
    // Mark record as deleted without actually removing it
    logger.info(`Soft deleting record ${record.id} from ${table}`);
  }

  private async hardDeleteRecord(record: any, table: string): Promise<void> {
    // Permanently delete the record
    logger.info(`Hard deleting record ${record.id} from ${table}`);
  }

  private async anonymizeRecord(record: any, table: string): Promise<void> {
    // Remove or hash personally identifiable information
    logger.info(`Anonymizing record ${record.id} from ${table}`);
  }

  private async encryptRecord(record: any, table: string): Promise<void> {
    // Encrypt sensitive fields
    logger.info(`Encrypting record ${record.id} from ${table}`);
  }

  private async cleanupSessionData(cutoffDate: Date): Promise<number> {
    // Clean up expired session data
    return 0; // Placeholder
  }

  private calculateNextExecution(): Date {
    const nextExecution = new Date();
    nextExecution.setDate(nextExecution.getDate() + 1); // Daily execution
    return nextExecution;
  }

  // Schedule retention jobs
  private scheduleRetentionJobs(): void {
    // Run retention policies daily at 2 AM
    cron.schedule('0 2 * * *', async () => {
      logger.info('Starting scheduled retention policy execution');
      try {
        await this.executeRetentionPolicies();
      } catch (error) {
        logger.error('Scheduled retention execution failed:', error);
      }
    });

    // Run weekly compliance check on Sundays at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      logger.info('Starting weekly retention compliance check');
      try {
        await this.generateRetentionComplianceReport();
      } catch (error) {
        logger.error('Weekly retention compliance check failed:', error);
      }
    });
  }

  // Get user retention periods
  async getUserRetentionPeriods(userId: string): Promise<Record<string, number>> {
    const policies = await this.prisma.dataRetentionPolicy.findMany({
      where: { isActive: true }
    });

    const retentionPeriods: Record<string, number> = {};
    for (const policy of policies) {
      retentionPeriods[policy.dataCategory] = policy.retentionPeriod;
    }

    return retentionPeriods;
  }

  // Generate retention compliance report
  async generateRetentionComplianceReport(): Promise<{
    activePolicies: number;
    lastExecutionDate: Date | null;
    upcomingPurges: number;
    retentionViolations: any[];
    recommendations: string[];
  }> {
    try {
      const activePolicies = await this.prisma.dataRetentionPolicy.count({
        where: { isActive: true }
      });

      const lastExecution = await this.prisma.dataRetentionPolicy.findFirst({
        where: { lastExecuted: { not: null } },
        orderBy: { lastExecuted: 'desc' }
      });

      const upcomingPurges = await this.prisma.dataRetentionPolicy.count({
        where: {
          isActive: true,
          nextExecution: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } // Next 7 days
        }
      });

      // Check for retention violations (data older than policy allows)
      const retentionViolations = await this.checkRetentionViolations();

      const recommendations = this.generateRetentionRecommendations(retentionViolations);

      return {
        activePolicies,
        lastExecutionDate: lastExecution?.lastExecuted || null,
        upcomingPurges,
        retentionViolations,
        recommendations
      };
    } catch (error) {
      logger.error('Failed to generate retention compliance report:', error);
      throw error;
    }
  }

  private async checkRetentionViolations(): Promise<any[]> {
    // Check for data that should have been purged but wasn't
    const violations: any[] = [];
    
    // This would check actual data against retention policies
    // For now, return empty array
    
    return violations;
  }

  private generateRetentionRecommendations(violations: any[]): string[] {
    const recommendations: string[] = [];

    if (violations.length > 0) {
      recommendations.push('Execute retention policies to address violations');
      recommendations.push('Review retention policy configurations');
    }

    recommendations.push('Regularly monitor retention policy execution');
    recommendations.push('Update retention periods based on legal requirements');
    recommendations.push('Implement automated alerts for retention violations');

    return recommendations;
  }
}

export const dataRetentionService = new DataRetentionService();