import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { auditService } from './auditService';
import { dataRetentionService } from './dataRetentionService';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

interface DataPortabilityRequest {
  userId: string;
  userEmail: string;
  requestedData: string[];
  format: 'JSON' | 'CSV' | 'XML';
}

interface DataErasureRequest {
  userId: string;
  userEmail: string;
  reason: string;
  retainLegalBasis?: boolean;
}

interface ConsentRequest {
  userId: string;
  userEmail: string;
  consentType: string;
  purpose: string;
  consentGiven: boolean;
  consentMethod: string;
}

class GDPRService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Article 15: Right of Access
  async handleAccessRequest(userId: string, userEmail: string): Promise<{
    requestId: string;
    data: any;
    processingRecords: any[];
  }> {
    try {
      const requestId = uuidv4();

      // Create data subject request record
      await this.prisma.dataSubjectRequest.create({
        data: {
          requestId,
          userId,
          userEmail,
          requestType: 'ACCESS',
          status: 'IN_PROGRESS'
        }
      });

      // Collect all personal data
      const userData = await this.collectUserData(userId);
      const processingRecords = await this.getProcessingRecords(userId);

      // Update request status
      await this.prisma.dataSubjectRequest.update({
        where: { requestId },
        data: {
          status: 'COMPLETED',
          completionDate: new Date(),
          responseData: {
            userData,
            processingRecords,
            dataCategories: this.identifyDataCategories(userData),
            retentionPeriods: await this.getRetentionPeriods(userId)
          }
        }
      });

      // Log the access request
      await auditService.logEvent({
        userId,
        userEmail,
        action: 'GDPR_ACCESS_REQUEST',
        resource: 'data_subject_requests',
        resourceId: requestId,
        complianceFlags: ['GDPR'],
        dataCategory: 'PERSONAL',
        sensitivity: 'HIGH'
      });

      return {
        requestId,
        data: userData,
        processingRecords
      };
    } catch (error) {
      logger.error('Failed to handle GDPR access request:', error);
      throw error;
    }
  }

  // Article 16: Right to Rectification
  async handleRectificationRequest(
    userId: string,
    userEmail: string,
    corrections: Record<string, any>
  ): Promise<{ requestId: string; updatedFields: string[] }> {
    try {
      const requestId = uuidv4();

      // Create data subject request record
      await this.prisma.dataSubjectRequest.create({
        data: {
          requestId,
          userId,
          userEmail,
          requestType: 'RECTIFICATION',
          status: 'IN_PROGRESS'
        }
      });

      // Get current data for audit trail
      const currentData = await this.collectUserData(userId);
      
      // Apply corrections (this would integrate with your user service)
      const updatedFields = await this.applyDataCorrections(userId, corrections);

      // Update request status
      await this.prisma.dataSubjectRequest.update({
        where: { requestId },
        data: {
          status: 'COMPLETED',
          completionDate: new Date(),
          responseData: {
            correctedFields: updatedFields,
            oldValues: currentData,
            newValues: corrections
          }
        }
      });

      // Log the rectification
      await auditService.logEvent({
        userId,
        userEmail,
        action: 'GDPR_RECTIFICATION',
        resource: 'user_data',
        resourceId: userId,
        oldValues: currentData,
        newValues: corrections,
        complianceFlags: ['GDPR'],
        dataCategory: 'PERSONAL',
        sensitivity: 'MEDIUM'
      });

      return { requestId, updatedFields };
    } catch (error) {
      logger.error('Failed to handle GDPR rectification request:', error);
      throw error;
    }
  }

  // Article 17: Right to Erasure (Right to be Forgotten)
  async handleErasureRequest(request: DataErasureRequest): Promise<{
    requestId: string;
    erasedData: string[];
    retainedData: string[];
  }> {
    try {
      const requestId = uuidv4();

      // Create data subject request record
      await this.prisma.dataSubjectRequest.create({
        data: {
          requestId,
          userId: request.userId,
          userEmail: request.userEmail,
          requestType: 'ERASURE',
          status: 'IN_PROGRESS'
        }
      });

      // Determine what can be erased vs retained
      const erasureAnalysis = await this.analyzeErasureRequest(request.userId);
      
      if (erasureAnalysis.canErase) {
        // Perform data erasure
        const erasedData = await this.performDataErasure(
          request.userId,
          erasureAnalysis.erasableData,
          request.retainLegalBasis
        );

        // Update request status
        await this.prisma.dataSubjectRequest.update({
          where: { requestId },
          data: {
            status: 'COMPLETED',
            completionDate: new Date(),
            responseData: {
              erasedData,
              retainedData: erasureAnalysis.retainedData,
              reason: request.reason
            }
          }
        });

        // Log the erasure
        await auditService.logEvent({
          userId: request.userId,
          userEmail: request.userEmail,
          action: 'GDPR_ERASURE',
          resource: 'user_data',
          resourceId: request.userId,
          metadata: {
            erasedData,
            retainedData: erasureAnalysis.retainedData,
            reason: request.reason
          },
          complianceFlags: ['GDPR'],
          dataCategory: 'PERSONAL',
          sensitivity: 'CRITICAL'
        });

        return {
          requestId,
          erasedData,
          retainedData: erasureAnalysis.retainedData
        };
      } else {
        // Reject erasure request
        await this.prisma.dataSubjectRequest.update({
          where: { requestId },
          data: {
            status: 'REJECTED',
            completionDate: new Date(),
            rejectionReason: erasureAnalysis.rejectionReason
          }
        });

        throw new Error(`Erasure request rejected: ${erasureAnalysis.rejectionReason}`);
      }
    } catch (error) {
      logger.error('Failed to handle GDPR erasure request:', error);
      throw error;
    }
  }

  // Article 18: Right to Restriction of Processing
  async handleRestrictionRequest(
    userId: string,
    userEmail: string,
    reason: string
  ): Promise<{ requestId: string; restrictedProcessing: string[] }> {
    try {
      const requestId = uuidv4();

      // Create data subject request record
      await this.prisma.dataSubjectRequest.create({
        data: {
          requestId,
          userId,
          userEmail,
          requestType: 'RESTRICT',
          status: 'IN_PROGRESS'
        }
      });

      // Implement processing restrictions
      const restrictedProcessing = await this.restrictDataProcessing(userId, reason);

      // Update request status
      await this.prisma.dataSubjectRequest.update({
        where: { requestId },
        data: {
          status: 'COMPLETED',
          completionDate: new Date(),
          responseData: {
            restrictedProcessing,
            reason
          }
        }
      });

      // Log the restriction
      await auditService.logEvent({
        userId,
        userEmail,
        action: 'GDPR_RESTRICT_PROCESSING',
        resource: 'data_processing',
        resourceId: userId,
        metadata: { restrictedProcessing, reason },
        complianceFlags: ['GDPR'],
        dataCategory: 'PERSONAL',
        sensitivity: 'HIGH'
      });

      return { requestId, restrictedProcessing };
    } catch (error) {
      logger.error('Failed to handle GDPR restriction request:', error);
      throw error;
    }
  }

  // Article 20: Right to Data Portability
  async handlePortabilityRequest(request: DataPortabilityRequest): Promise<{
    requestId: string;
    downloadUrl: string;
    expiryDate: Date;
  }> {
    try {
      const requestId = uuidv4();

      // Create data subject request record
      await this.prisma.dataSubjectRequest.create({
        data: {
          requestId,
          userId: request.userId,
          userEmail: request.userEmail,
          requestType: 'PORTABILITY',
          status: 'IN_PROGRESS'
        }
      });

      // Collect portable data
      const portableData = await this.collectPortableData(request.userId, request.requestedData);
      
      // Generate export file
      const exportPath = await this.generateDataExport(
        requestId,
        portableData,
        request.format
      );

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30); // 30-day expiry

      // Update request status
      await this.prisma.dataSubjectRequest.update({
        where: { requestId },
        data: {
          status: 'COMPLETED',
          completionDate: new Date(),
          responseData: {
            exportPath,
            format: request.format,
            dataCategories: request.requestedData,
            expiryDate
          }
        }
      });

      // Log the portability request
      await auditService.logEvent({
        userId: request.userId,
        userEmail: request.userEmail,
        action: 'GDPR_DATA_PORTABILITY',
        resource: 'data_export',
        resourceId: requestId,
        metadata: {
          format: request.format,
          dataCategories: request.requestedData
        },
        complianceFlags: ['GDPR'],
        dataCategory: 'PERSONAL',
        sensitivity: 'HIGH'
      });

      return {
        requestId,
        downloadUrl: `/api/compliance/gdpr/download/${requestId}`,
        expiryDate
      };
    } catch (error) {
      logger.error('Failed to handle GDPR portability request:', error);
      throw error;
    }
  }

  // Article 21: Right to Object
  async handleObjectionRequest(
    userId: string,
    userEmail: string,
    processingPurpose: string,
    objectionReason: string
  ): Promise<{ requestId: string; processingCeased: boolean }> {
    try {
      const requestId = uuidv4();

      // Create data subject request record
      await this.prisma.dataSubjectRequest.create({
        data: {
          requestId,
          userId,
          userEmail,
          requestType: 'OBJECT',
          status: 'IN_PROGRESS'
        }
      });

      // Evaluate objection
      const objectionAnalysis = await this.evaluateObjection(
        userId,
        processingPurpose,
        objectionReason
      );

      let processingCeased = false;
      if (objectionAnalysis.shouldCease) {
        // Cease processing for the specified purpose
        await this.ceaseProcessing(userId, processingPurpose);
        processingCeased = true;
      }

      // Update request status
      await this.prisma.dataSubjectRequest.update({
        where: { requestId },
        data: {
          status: 'COMPLETED',
          completionDate: new Date(),
          responseData: {
            processingPurpose,
            objectionReason,
            processingCeased,
            analysis: objectionAnalysis
          }
        }
      });

      // Log the objection
      await auditService.logEvent({
        userId,
        userEmail,
        action: 'GDPR_OBJECTION',
        resource: 'data_processing',
        resourceId: userId,
        metadata: {
          processingPurpose,
          objectionReason,
          processingCeased
        },
        complianceFlags: ['GDPR'],
        dataCategory: 'PERSONAL',
        sensitivity: 'HIGH'
      });

      return { requestId, processingCeased };
    } catch (error) {
      logger.error('Failed to handle GDPR objection request:', error);
      throw error;
    }
  }

  // Consent Management
  async recordConsent(request: ConsentRequest): Promise<string> {
    try {
      const consent = await this.prisma.privacyConsent.create({
        data: {
          userId: request.userId,
          userEmail: request.userEmail,
          consentType: request.consentType as any,
          purpose: request.purpose,
          consentGiven: request.consentGiven,
          consentMethod: request.consentMethod,
          consentVersion: '1.0', // Should be dynamic based on privacy policy version
          expiryDate: this.calculateConsentExpiry(request.consentType),
          renewalRequired: this.isRenewalRequired(request.consentType)
        }
      });

      // Log consent
      await auditService.logEvent({
        userId: request.userId,
        userEmail: request.userEmail,
        action: request.consentGiven ? 'CONSENT_GIVEN' : 'CONSENT_WITHDRAWN',
        resource: 'privacy_consent',
        resourceId: consent.id,
        metadata: {
          consentType: request.consentType,
          purpose: request.purpose,
          method: request.consentMethod
        },
        complianceFlags: ['GDPR'],
        dataCategory: 'PERSONAL',
        sensitivity: 'MEDIUM'
      });

      return consent.id;
    } catch (error) {
      logger.error('Failed to record consent:', error);
      throw error;
    }
  }

  async withdrawConsent(
    userId: string,
    userEmail: string,
    consentType: string,
    withdrawalMethod: string
  ): Promise<void> {
    try {
      // Update existing consent record
      await this.prisma.privacyConsent.updateMany({
        where: {
          userId,
          consentType: consentType as any,
          withdrawn: false
        },
        data: {
          withdrawn: true,
          withdrawnDate: new Date(),
          withdrawnMethod
        }
      });

      // Stop related processing
      await this.stopConsentBasedProcessing(userId, consentType);

      // Log withdrawal
      await auditService.logEvent({
        userId,
        userEmail,
        action: 'CONSENT_WITHDRAWN',
        resource: 'privacy_consent',
        resourceId: userId,
        metadata: {
          consentType,
          withdrawalMethod
        },
        complianceFlags: ['GDPR'],
        dataCategory: 'PERSONAL',
        sensitivity: 'HIGH'
      });
    } catch (error) {
      logger.error('Failed to withdraw consent:', error);
      throw error;
    }
  }

  // Private helper methods
  private async collectUserData(userId: string): Promise<any> {
    // This would collect data from all services
    // For now, return a placeholder structure
    return {
      profile: {}, // From user service
      applications: [], // From application service
      letters: [], // From letter service
      analytics: {}, // From analytics service
      preferences: {} // From notification service
    };
  }

  private async getProcessingRecords(userId: string): Promise<any[]> {
    return await this.prisma.dataProcessingRecord.findMany({
      where: { userId }
    });
  }

  private identifyDataCategories(userData: any): string[] {
    const categories: string[] = [];
    
    if (userData.profile) categories.push('profile_data');
    if (userData.applications) categories.push('application_data');
    if (userData.letters) categories.push('recommendation_data');
    if (userData.analytics) categories.push('analytics_data');
    
    return categories;
  }

  private async getRetentionPeriods(userId: string): Promise<Record<string, number>> {
    return await dataRetentionService.getUserRetentionPeriods(userId);
  }

  private async applyDataCorrections(userId: string, corrections: Record<string, any>): Promise<string[]> {
    // This would integrate with your user service to apply corrections
    // Return the list of fields that were updated
    return Object.keys(corrections);
  }

  private async analyzeErasureRequest(userId: string): Promise<{
    canErase: boolean;
    erasableData: string[];
    retainedData: string[];
    rejectionReason?: string;
  }> {
    // Analyze what data can be erased vs what must be retained
    const processingRecords = await this.getProcessingRecords(userId);
    
    const erasableData: string[] = [];
    const retainedData: string[] = [];
    
    // Check for legal obligations to retain data
    const hasLegalObligation = processingRecords.some(
      record => record.legalBasis === 'LEGAL_OBLIGATION'
    );
    
    if (hasLegalObligation) {
      retainedData.push('legally_required_data');
    } else {
      erasableData.push('profile_data', 'preferences', 'analytics_data');
    }
    
    return {
      canErase: erasableData.length > 0,
      erasableData,
      retainedData,
      rejectionReason: hasLegalObligation ? 'Legal obligation to retain data' : undefined
    };
  }

  private async performDataErasure(
    userId: string,
    erasableData: string[],
    retainLegalBasis?: boolean
  ): Promise<string[]> {
    const erasedData: string[] = [];
    
    // This would integrate with all services to erase data
    for (const dataType of erasableData) {
      try {
        // Erase data from respective services
        await this.eraseDataType(userId, dataType);
        erasedData.push(dataType);
      } catch (error) {
        logger.error(`Failed to erase ${dataType} for user ${userId}:`, error);
      }
    }
    
    return erasedData;
  }

  private async eraseDataType(userId: string, dataType: string): Promise<void> {
    // Implementation would depend on the data type and service
    logger.info(`Erasing ${dataType} for user ${userId}`);
  }

  private async restrictDataProcessing(userId: string, reason: string): Promise<string[]> {
    // Implement processing restrictions
    const restrictedProcessing = ['analytics', 'marketing', 'recommendations'];
    
    // This would integrate with services to restrict processing
    for (const processing of restrictedProcessing) {
      await this.restrictProcessingType(userId, processing);
    }
    
    return restrictedProcessing;
  }

  private async restrictProcessingType(userId: string, processingType: string): Promise<void> {
    logger.info(`Restricting ${processingType} processing for user ${userId}`);
  }

  private async collectPortableData(userId: string, requestedData: string[]): Promise<any> {
    const portableData: any = {};
    
    for (const dataType of requestedData) {
      portableData[dataType] = await this.getPortableDataType(userId, dataType);
    }
    
    return portableData;
  }

  private async getPortableDataType(userId: string, dataType: string): Promise<any> {
    // Collect specific data type for portability
    return {}; // Placeholder
  }

  private async generateDataExport(
    requestId: string,
    data: any,
    format: 'JSON' | 'CSV' | 'XML'
  ): Promise<string> {
    const exportDir = join(process.cwd(), 'exports');
    const fileName = `gdpr-export-${requestId}.${format.toLowerCase()}`;
    const filePath = join(exportDir, fileName);
    
    // Create export file based on format
    switch (format) {
      case 'JSON':
        await this.createJSONExport(filePath, data);
        break;
      case 'CSV':
        await this.createCSVExport(filePath, data);
        break;
      case 'XML':
        await this.createXMLExport(filePath, data);
        break;
    }
    
    return filePath;
  }

  private async createJSONExport(filePath: string, data: any): Promise<void> {
    const fs = require('fs').promises;
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  private async createCSVExport(filePath: string, data: any): Promise<void> {
    // Implementation for CSV export
    logger.info(`Creating CSV export at ${filePath}`);
  }

  private async createXMLExport(filePath: string, data: any): Promise<void> {
    // Implementation for XML export
    logger.info(`Creating XML export at ${filePath}`);
  }

  private async evaluateObjection(
    userId: string,
    processingPurpose: string,
    objectionReason: string
  ): Promise<{ shouldCease: boolean; reason?: string }> {
    // Evaluate whether the objection should be honored
    // This depends on the legal basis and compelling legitimate interests
    
    const processingRecord = await this.prisma.dataProcessingRecord.findFirst({
      where: {
        userId,
        processingPurpose
      }
    });
    
    if (!processingRecord) {
      return { shouldCease: true, reason: 'No processing record found' };
    }
    
    // If processing is based on consent, honor the objection
    if (processingRecord.legalBasis === 'CONSENT') {
      return { shouldCease: true, reason: 'Consent-based processing' };
    }
    
    // If processing is for legitimate interests, evaluate compelling reasons
    if (processingRecord.legalBasis === 'LEGITIMATE_INTERESTS') {
      // This would involve a more complex evaluation
      return { shouldCease: false, reason: 'Compelling legitimate interests' };
    }
    
    return { shouldCease: false, reason: 'Legal obligation or contract' };
  }

  private async ceaseProcessing(userId: string, processingPurpose: string): Promise<void> {
    // Stop processing for the specified purpose
    await this.prisma.dataProcessingRecord.updateMany({
      where: {
        userId,
        processingPurpose
      },
      data: {
        processingEnd: new Date()
      }
    });
  }

  private calculateConsentExpiry(consentType: string): Date | null {
    const expiry = new Date();
    
    switch (consentType) {
      case 'MARKETING':
        expiry.setFullYear(expiry.getFullYear() + 2); // 2 years
        return expiry;
      case 'ANALYTICS':
        expiry.setFullYear(expiry.getFullYear() + 1); // 1 year
        return expiry;
      default:
        return null; // No expiry
    }
  }

  private isRenewalRequired(consentType: string): boolean {
    return ['MARKETING', 'ANALYTICS'].includes(consentType);
  }

  private async stopConsentBasedProcessing(userId: string, consentType: string): Promise<void> {
    // Stop all processing based on the withdrawn consent
    await this.prisma.dataProcessingRecord.updateMany({
      where: {
        userId,
        legalBasis: 'CONSENT',
        processingPurpose: {
          contains: consentType.toLowerCase()
        }
      },
      data: {
        processingEnd: new Date()
      }
    });
  }
}

export const gdprService = new GDPRService();