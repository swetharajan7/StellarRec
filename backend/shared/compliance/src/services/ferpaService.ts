import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { auditService } from './auditService';

interface EducationalRecord {
  id: string;
  studentId: string;
  recordType: string;
  data: any;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface DirectoryInformation {
  name: boolean;
  address: boolean;
  telephone: boolean;
  email: boolean;
  dateOfBirth: boolean;
  placeOfBirth: boolean;
  majorField: boolean;
  participationInActivities: boolean;
  datesOfAttendance: boolean;
  degreesAndAwards: boolean;
  mostRecentEducationalAgency: boolean;
  studentId: boolean;
  photograph: boolean;
}

interface ConsentRecord {
  studentId: string;
  parentId?: string;
  consentType: 'DIRECTORY_INFO' | 'DISCLOSURE' | 'RESEARCH';
  purpose: string;
  recipient: string;
  expiryDate?: Date;
  consentGiven: boolean;
}

class FERPAService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Check if user can access educational record
  async canAccessEducationalRecord(
    accessorId: string,
    accessorRole: string,
    studentId: string,
    recordType: string,
    recordId: string
  ): Promise<{
    canAccess: boolean;
    reason: string;
    requiresConsent: boolean;
    consentObtained?: boolean;
  }> {
    try {
      // Self-access: Students can access their own records
      if (accessorId === studentId && accessorRole === 'student') {
        return {
          canAccess: true,
          reason: 'Student accessing own records',
          requiresConsent: false
        };
      }

      // Parent access (for dependent students under 18)
      if (accessorRole === 'parent') {
        const parentAccess = await this.checkParentAccess(accessorId, studentId);
        return {
          canAccess: parentAccess.canAccess,
          reason: parentAccess.reason,
          requiresConsent: false,
          consentObtained: parentAccess.canAccess
        };
      }

      // School officials with legitimate educational interest
      if (this.isSchoolOfficial(accessorRole)) {
        const legitimateInterest = await this.checkLegitimateEducationalInterest(
          accessorId,
          accessorRole,
          studentId,
          recordType
        );
        
        return {
          canAccess: legitimateInterest.hasInterest,
          reason: legitimateInterest.reason,
          requiresConsent: false
        };
      }

      // External parties - require consent
      const consentCheck = await this.checkDisclosureConsent(
        studentId,
        accessorId,
        recordType
      );

      return {
        canAccess: consentCheck.consentGiven,
        reason: consentCheck.consentGiven 
          ? 'Consent obtained for disclosure' 
          : 'Consent required for external access',
        requiresConsent: true,
        consentObtained: consentCheck.consentGiven
      };
    } catch (error) {
      logger.error('Failed to check educational record access:', error);
      return {
        canAccess: false,
        reason: 'Access check failed',
        requiresConsent: true
      };
    }
  }

  // Log educational record access
  async logEducationalRecordAccess(
    studentId: string,
    studentEmail: string,
    accessorId: string,
    accessorEmail: string,
    accessorRole: string,
    recordType: string,
    recordId: string,
    accessPurpose: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Check if consent was required and obtained
      const accessCheck = await this.canAccessEducationalRecord(
        accessorId,
        accessorRole,
        studentId,
        recordType,
        recordId
      );

      await auditService.logEducationalRecordAccess(
        studentId,
        studentEmail,
        accessorId,
        accessorEmail,
        accessorRole,
        recordType,
        recordId,
        accessPurpose
      );

      // Additional FERPA-specific logging
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
          ipAddress,
          userAgent,
          consentRequired: accessCheck.requiresConsent,
          consentObtained: accessCheck.consentObtained || false,
          disclosureType: this.determineDisclosureType(accessorRole)
        }
      });
    } catch (error) {
      logger.error('Failed to log educational record access:', error);
    }
  }

  // Handle directory information disclosure
  async handleDirectoryInformationRequest(
    studentId: string,
    requestedInfo: Partial<DirectoryInformation>,
    requestorId: string,
    purpose: string
  ): Promise<{
    canDisclose: boolean;
    disclosableInfo: Partial<DirectoryInformation>;
    restrictedInfo: string[];
  }> {
    try {
      // Check if student has opted out of directory information disclosure
      const directoryOptOut = await this.checkDirectoryOptOut(studentId);
      
      if (directoryOptOut.hasOptedOut) {
        return {
          canDisclose: false,
          disclosableInfo: {},
          restrictedInfo: Object.keys(requestedInfo)
        };
      }

      // Check institutional policy for directory information
      const allowedDirectoryInfo = await this.getAllowedDirectoryInformation();
      
      const disclosableInfo: Partial<DirectoryInformation> = {};
      const restrictedInfo: string[] = [];

      for (const [key, requested] of Object.entries(requestedInfo)) {
        if (requested && allowedDirectoryInfo[key as keyof DirectoryInformation]) {
          disclosableInfo[key as keyof DirectoryInformation] = true;
        } else if (requested) {
          restrictedInfo.push(key);
        }
      }

      // Log directory information disclosure
      await auditService.logEvent({
        userId: requestorId,
        action: 'DIRECTORY_INFO_DISCLOSURE',
        resource: 'directory_information',
        resourceId: studentId,
        metadata: {
          requestedInfo,
          disclosableInfo,
          restrictedInfo,
          purpose
        },
        complianceFlags: ['FERPA'],
        dataCategory: 'EDUCATIONAL',
        sensitivity: 'LOW'
      });

      return {
        canDisclose: Object.keys(disclosableInfo).length > 0,
        disclosableInfo,
        restrictedInfo
      };
    } catch (error) {
      logger.error('Failed to handle directory information request:', error);
      throw error;
    }
  }

  // Record consent for educational record disclosure
  async recordDisclosureConsent(consent: ConsentRecord): Promise<string> {
    try {
      // Create consent record
      const consentRecord = await this.prisma.privacyConsent.create({
        data: {
          userId: consent.studentId,
          userEmail: '', // Would be populated from user service
          consentType: consent.consentType as any,
          purpose: consent.purpose,
          consentGiven: consent.consentGiven,
          consentMethod: 'web_form',
          consentVersion: '1.0',
          expiryDate: consent.expiryDate
        }
      });

      // Log consent recording
      await auditService.logEvent({
        userId: consent.studentId,
        action: 'FERPA_CONSENT_RECORDED',
        resource: 'educational_record_consent',
        resourceId: consentRecord.id,
        metadata: {
          consentType: consent.consentType,
          purpose: consent.purpose,
          recipient: consent.recipient,
          consentGiven: consent.consentGiven
        },
        complianceFlags: ['FERPA'],
        dataCategory: 'EDUCATIONAL',
        sensitivity: 'HIGH'
      });

      return consentRecord.id;
    } catch (error) {
      logger.error('Failed to record disclosure consent:', error);
      throw error;
    }
  }

  // Handle student rights request (access to own records)
  async handleStudentRightsRequest(
    studentId: string,
    requestType: 'ACCESS' | 'AMEND' | 'HEARING',
    details: any
  ): Promise<{
    requestId: string;
    status: string;
    response?: any;
  }> {
    try {
      const requestId = `ferpa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      switch (requestType) {
        case 'ACCESS':
          return await this.handleRecordAccessRequest(studentId, requestId, details);
        
        case 'AMEND':
          return await this.handleAmendmentRequest(studentId, requestId, details);
        
        case 'HEARING':
          return await this.handleHearingRequest(studentId, requestId, details);
        
        default:
          throw new Error(`Unsupported request type: ${requestType}`);
      }
    } catch (error) {
      logger.error('Failed to handle student rights request:', error);
      throw error;
    }
  }

  // Generate FERPA compliance report
  async generateFERPAComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: any;
    recordAccesses: number;
    consentRecords: number;
    disclosures: number;
    violations: any[];
    recommendations: string[];
  }> {
    try {
      const [recordAccesses, consentRecords, disclosures] = await Promise.all([
        this.prisma.educationalRecordAccess.count({
          where: {
            timestamp: { gte: startDate, lte: endDate }
          }
        }),
        this.prisma.privacyConsent.count({
          where: {
            consentDate: { gte: startDate, lte: endDate },
            consentType: { in: ['DIRECTORY_INFO', 'DISCLOSURE'] }
          }
        }),
        this.prisma.educationalRecordAccess.count({
          where: {
            timestamp: { gte: startDate, lte: endDate },
            disclosureType: { not: 'INTERNAL' }
          }
        })
      ]);

      // Analyze for potential violations
      const violations = await this.analyzeForViolations(startDate, endDate);
      
      // Generate recommendations
      const recommendations = await this.generateFERPARecommendations(violations);

      const summary = {
        totalRecordAccesses: recordAccesses,
        internalAccesses: recordAccesses - disclosures,
        externalDisclosures: disclosures,
        consentRecords,
        violationCount: violations.length,
        complianceScore: this.calculateFERPAComplianceScore(violations, recordAccesses)
      };

      return {
        summary,
        recordAccesses,
        consentRecords,
        disclosures,
        violations,
        recommendations
      };
    } catch (error) {
      logger.error('Failed to generate FERPA compliance report:', error);
      throw error;
    }
  }

  // Private helper methods
  private async checkParentAccess(parentId: string, studentId: string): Promise<{
    canAccess: boolean;
    reason: string;
  }> {
    // Check if parent has rights to access student records
    // This would typically check:
    // 1. Student age (under 18)
    // 2. Dependency status
    // 3. Parent verification
    
    // For now, simplified logic
    return {
      canAccess: true, // Would be determined by actual parent-student relationship
      reason: 'Parent of dependent student'
    };
  }

  private isSchoolOfficial(role: string): boolean {
    const schoolOfficialRoles = [
      'teacher',
      'counselor',
      'administrator',
      'registrar',
      'financial_aid_officer',
      'admissions_officer',
      'academic_advisor'
    ];
    
    return schoolOfficialRoles.includes(role.toLowerCase());
  }

  private async checkLegitimateEducationalInterest(
    accessorId: string,
    accessorRole: string,
    studentId: string,
    recordType: string
  ): Promise<{
    hasInterest: boolean;
    reason: string;
  }> {
    // Determine if the school official has legitimate educational interest
    const interestMatrix: Record<string, string[]> = {
      'counselor': ['APPLICATION', 'TRANSCRIPT', 'GRADES', 'RECOMMENDATION'],
      'teacher': ['GRADES', 'ATTENDANCE'],
      'administrator': ['APPLICATION', 'TRANSCRIPT', 'GRADES', 'DISCIPLINARY'],
      'registrar': ['TRANSCRIPT', 'GRADES', 'ATTENDANCE'],
      'financial_aid_officer': ['FINANCIAL_AID', 'TRANSCRIPT'],
      'admissions_officer': ['APPLICATION', 'TRANSCRIPT', 'RECOMMENDATION']
    };

    const allowedRecords = interestMatrix[accessorRole.toLowerCase()] || [];
    const hasInterest = allowedRecords.includes(recordType.toUpperCase());

    return {
      hasInterest,
      reason: hasInterest 
        ? `${accessorRole} has legitimate educational interest in ${recordType}`
        : `${accessorRole} does not have legitimate educational interest in ${recordType}`
    };
  }

  private async checkDisclosureConsent(
    studentId: string,
    accessorId: string,
    recordType: string
  ): Promise<{
    consentGiven: boolean;
    consentDate?: Date;
  }> {
    const consent = await this.prisma.privacyConsent.findFirst({
      where: {
        userId: studentId,
        consentType: 'DISCLOSURE',
        consentGiven: true,
        withdrawn: false,
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: new Date() } }
        ]
      },
      orderBy: { consentDate: 'desc' }
    });

    return {
      consentGiven: !!consent,
      consentDate: consent?.consentDate
    };
  }

  private determineDisclosureType(accessorRole: string): 'INTERNAL' | 'EXTERNAL_CONSENT' | 'EXTERNAL_NO_CONSENT' | 'DIRECTORY_INFO' | 'EMERGENCY' {
    if (this.isSchoolOfficial(accessorRole) || accessorRole === 'student' || accessorRole === 'parent') {
      return 'INTERNAL';
    }
    return 'EXTERNAL_CONSENT';
  }

  private async checkDirectoryOptOut(studentId: string): Promise<{
    hasOptedOut: boolean;
    optOutDate?: Date;
  }> {
    const optOut = await this.prisma.privacyConsent.findFirst({
      where: {
        userId: studentId,
        consentType: 'DIRECTORY_INFO',
        consentGiven: false
      },
      orderBy: { consentDate: 'desc' }
    });

    return {
      hasOptedOut: !!optOut,
      optOutDate: optOut?.consentDate
    };
  }

  private async getAllowedDirectoryInformation(): Promise<DirectoryInformation> {
    // This would be configurable per institution
    return {
      name: true,
      address: false,
      telephone: false,
      email: true,
      dateOfBirth: false,
      placeOfBirth: false,
      majorField: true,
      participationInActivities: true,
      datesOfAttendance: true,
      degreesAndAwards: true,
      mostRecentEducationalAgency: true,
      studentId: false,
      photograph: false
    };
  }

  private async handleRecordAccessRequest(
    studentId: string,
    requestId: string,
    details: any
  ): Promise<{ requestId: string; status: string; response?: any }> {
    // Handle student's request to access their own educational records
    const records = await this.collectStudentRecords(studentId);
    
    // Log the access request
    await auditService.logEvent({
      userId: studentId,
      action: 'STUDENT_RECORD_ACCESS_REQUEST',
      resource: 'educational_records',
      resourceId: studentId,
      metadata: { requestId, details },
      complianceFlags: ['FERPA'],
      dataCategory: 'EDUCATIONAL',
      sensitivity: 'MEDIUM'
    });

    return {
      requestId,
      status: 'COMPLETED',
      response: records
    };
  }

  private async handleAmendmentRequest(
    studentId: string,
    requestId: string,
    details: any
  ): Promise<{ requestId: string; status: string; response?: any }> {
    // Handle student's request to amend their educational records
    // This would involve review process
    
    await auditService.logEvent({
      userId: studentId,
      action: 'RECORD_AMENDMENT_REQUEST',
      resource: 'educational_records',
      resourceId: studentId,
      metadata: { requestId, details },
      complianceFlags: ['FERPA'],
      dataCategory: 'EDUCATIONAL',
      sensitivity: 'HIGH'
    });

    return {
      requestId,
      status: 'UNDER_REVIEW',
      response: { message: 'Amendment request is under review' }
    };
  }

  private async handleHearingRequest(
    studentId: string,
    requestId: string,
    details: any
  ): Promise<{ requestId: string; status: string; response?: any }> {
    // Handle student's request for hearing regarding their records
    
    await auditService.logEvent({
      userId: studentId,
      action: 'HEARING_REQUEST',
      resource: 'educational_records',
      resourceId: studentId,
      metadata: { requestId, details },
      complianceFlags: ['FERPA'],
      dataCategory: 'EDUCATIONAL',
      sensitivity: 'HIGH'
    });

    return {
      requestId,
      status: 'SCHEDULED',
      response: { message: 'Hearing has been scheduled' }
    };
  }

  private async collectStudentRecords(studentId: string): Promise<any> {
    // Collect all educational records for the student
    return {
      transcripts: [],
      applications: [],
      recommendations: [],
      disciplinary: [],
      financial_aid: []
    };
  }

  private async analyzeForViolations(startDate: Date, endDate: Date): Promise<any[]> {
    const violations: any[] = [];

    // Check for unauthorized access
    const unauthorizedAccess = await this.prisma.educationalRecordAccess.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
        consentRequired: true,
        consentObtained: false
      }
    });

    violations.push(...unauthorizedAccess.map(access => ({
      type: 'UNAUTHORIZED_ACCESS',
      severity: 'HIGH',
      description: 'Educational record accessed without required consent',
      details: access
    })));

    // Check for excessive access patterns
    const accessCounts = await this.prisma.educationalRecordAccess.groupBy({
      by: ['accessorId'],
      where: {
        timestamp: { gte: startDate, lte: endDate }
      },
      _count: { accessorId: true }
    });

    const excessiveAccess = accessCounts.filter(count => count._count.accessorId > 100);
    violations.push(...excessiveAccess.map(access => ({
      type: 'EXCESSIVE_ACCESS',
      severity: 'MEDIUM',
      description: 'Unusually high number of record accesses',
      details: access
    })));

    return violations;
  }

  private async generateFERPARecommendations(violations: any[]): Promise<string[]> {
    const recommendations: string[] = [];

    if (violations.some(v => v.type === 'UNAUTHORIZED_ACCESS')) {
      recommendations.push('Implement stronger consent verification mechanisms');
      recommendations.push('Review access control policies for educational records');
    }

    if (violations.some(v => v.type === 'EXCESSIVE_ACCESS')) {
      recommendations.push('Implement access monitoring and alerting');
      recommendations.push('Review legitimate educational interest policies');
    }

    if (violations.length === 0) {
      recommendations.push('Continue current compliance practices');
      recommendations.push('Consider implementing additional privacy controls');
    }

    return recommendations;
  }

  private calculateFERPAComplianceScore(violations: any[], totalAccesses: number): number {
    if (totalAccesses === 0) return 100;
    
    const violationWeight = violations.reduce((weight, violation) => {
      switch (violation.severity) {
        case 'CRITICAL': return weight + 10;
        case 'HIGH': return weight + 5;
        case 'MEDIUM': return weight + 2;
        case 'LOW': return weight + 1;
        default: return weight;
      }
    }, 0);

    const score = Math.max(0, 100 - (violationWeight / totalAccesses * 100));
    return Math.round(score * 100) / 100;
  }
}

export const ferpaService = new FERPAService();