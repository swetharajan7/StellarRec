import { Logger } from '../logger';
import { UniversityAdapter } from './adapters/UniversityAdapter';
import { CommonAppAdapter } from './adapters/CommonAppAdapter';
import { CoalitionAppAdapter } from './adapters/CoalitionAppAdapter';
import { UCSystemAdapter } from './adapters/UCSystemAdapter';
import { OUACAdapter } from './adapters/OUACAdapter';
import { EmailAdapter } from './adapters/EmailAdapter';
import { UniversityRegistry } from './UniversityRegistry';
import { SubmissionTracker } from './SubmissionTracker';
import { RateLimiter } from './RateLimiter';
import { AuthenticationManager } from './AuthenticationManager';

export interface SubmissionRequest {
  recommendationId: string;
  studentData: StudentData;
  recommenderData: RecommenderData;
  recommendationContent: RecommendationContent;
  universities: UniversitySubmissionTarget[];
  metadata: SubmissionMetadata;
}

export interface UniversitySubmissionTarget {
  universityId: string;
  universityCode: string;
  programType: string;
  applicationDeadline: Date;
  specificRequirements?: Record<string, any>;
}

export interface SubmissionResult {
  universityId: string;
  status: 'success' | 'failed' | 'pending' | 'retry';
  submissionId?: string;
  confirmationCode?: string;
  errorMessage?: string;
  retryAfter?: Date;
  metadata: Record<string, any>;
}

export interface BulkSubmissionResult {
  recommendationId: string;
  totalUniversities: number;
  successful: number;
  failed: number;
  pending: number;
  results: SubmissionResult[];
  overallStatus: 'completed' | 'partial' | 'failed';
}

export class UniversityIntegrationHub {
  private logger = new Logger('UniversityIntegrationHub');
  private adapters = new Map<string, UniversityAdapter>();
  private registry: UniversityRegistry;
  private tracker: SubmissionTracker;
  private rateLimiter: RateLimiter;
  private authManager: AuthenticationManager;

  constructor() {
    this.registry = new UniversityRegistry();
    this.tracker = new SubmissionTracker();
    this.rateLimiter = new RateLimiter();
    this.authManager = new AuthenticationManager();
    this.initializeAdapters();
  }

  private initializeAdapters(): void {
    // Register all available adapters
    this.registerAdapter('commonapp', new CommonAppAdapter(this.authManager, this.rateLimiter));
    this.registerAdapter('coalition', new CoalitionAppAdapter(this.authManager, this.rateLimiter));
    this.registerAdapter('uc_system', new UCSystemAdapter(this.authManager, this.rateLimiter));
    this.registerAdapter('ouac', new OUACAdapter(this.authManager, this.rateLimiter));
    this.registerAdapter('email', new EmailAdapter(this.authManager, this.rateLimiter));
    
    this.logger.info(`Initialized ${this.adapters.size} university adapters`);
  }

  private registerAdapter(type: string, adapter: UniversityAdapter): void {
    this.adapters.set(type, adapter);
  }

  /**
   * Submit recommendation to multiple universities
   */
  async submitToUniversities(request: SubmissionRequest): Promise<BulkSubmissionResult> {
    this.logger.info(`Starting bulk submission for recommendation ${request.recommendationId} to ${request.universities.length} universities`);

    const results: SubmissionResult[] = [];
    let successful = 0;
    let failed = 0;
    let pending = 0;

    // Process submissions in parallel with concurrency control
    const concurrencyLimit = 5; // Prevent overwhelming university systems
    const chunks = this.chunkArray(request.universities, concurrencyLimit);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(university => 
        this.submitToSingleUniversity(request, university)
      );

      const chunkResults = await Promise.allSettled(chunkPromises);
      
      for (const result of chunkResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          switch (result.value.status) {
            case 'success':
              successful++;
              break;
            case 'failed':
              failed++;
              break;
            case 'pending':
            case 'retry':
              pending++;
              break;
          }
        } else {
          // Handle rejected promises
          failed++;
          results.push({
            universityId: 'unknown',
            status: 'failed',
            errorMessage: result.reason?.message || 'Unknown error',
            metadata: {}
          });
        }
      }

      // Small delay between chunks to be respectful to university systems
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await this.delay(1000);
      }
    }

    const bulkResult: BulkSubmissionResult = {
      recommendationId: request.recommendationId,
      totalUniversities: request.universities.length,
      successful,
      failed,
      pending,
      results,
      overallStatus: failed === 0 ? 'completed' : (successful > 0 ? 'partial' : 'failed')
    };

    // Store bulk submission result
    await this.tracker.storeBulkSubmissionResult(bulkResult);

    this.logger.info(`Bulk submission completed: ${successful} successful, ${failed} failed, ${pending} pending`);
    return bulkResult;
  }

  /**
   * Submit to a single university
   */
  private async submitToSingleUniversity(
    request: SubmissionRequest, 
    university: UniversitySubmissionTarget
  ): Promise<SubmissionResult> {
    try {
      // Get university configuration
      const universityConfig = await this.registry.getUniversityConfig(university.universityId);
      if (!universityConfig) {
        throw new Error(`University configuration not found: ${university.universityId}`);
      }

      // Check rate limits
      await this.rateLimiter.checkRateLimit(universityConfig.integrationType, university.universityId);

      // Get appropriate adapter
      const adapter = this.getAdapter(universityConfig.integrationType);
      if (!adapter) {
        throw new Error(`No adapter available for integration type: ${universityConfig.integrationType}`);
      }

      // Prepare submission data
      const submissionData = await this.prepareSubmissionData(request, university, universityConfig);

      // Submit to university
      this.logger.info(`Submitting to ${university.universityCode} via ${universityConfig.integrationType}`);
      const result = await adapter.submit(submissionData);

      // Track submission
      await this.tracker.trackSubmission({
        recommendationId: request.recommendationId,
        universityId: university.universityId,
        submissionId: result.submissionId,
        status: result.status,
        submittedAt: new Date(),
        metadata: result.metadata
      });

      return {
        universityId: university.universityId,
        status: result.status,
        submissionId: result.submissionId,
        confirmationCode: result.confirmationCode,
        metadata: result.metadata
      };

    } catch (error) {
      this.logger.error(`Submission failed for ${university.universityCode}:`, error);
      
      return {
        universityId: university.universityId,
        status: 'failed',
        errorMessage: error.message,
        metadata: { error: error.stack }
      };
    }
  }

  /**
   * Get status of all submissions for a recommendation
   */
  async getSubmissionStatus(recommendationId: string): Promise<SubmissionResult[]> {
    return await this.tracker.getSubmissionsByRecommendation(recommendationId);
  }

  /**
   * Retry failed submissions
   */
  async retryFailedSubmissions(recommendationId: string): Promise<BulkSubmissionResult> {
    const failedSubmissions = await this.tracker.getFailedSubmissions(recommendationId);
    
    if (failedSubmissions.length === 0) {
      throw new Error('No failed submissions found for retry');
    }

    // Convert failed submissions back to submission targets
    const universities: UniversitySubmissionTarget[] = [];
    for (const submission of failedSubmissions) {
      const universityConfig = await this.registry.getUniversityConfig(submission.universityId);
      if (universityConfig) {
        universities.push({
          universityId: submission.universityId,
          universityCode: universityConfig.code,
          programType: submission.metadata.programType || 'graduate',
          applicationDeadline: new Date(submission.metadata.deadline || Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }
    }

    // Get original request data (simplified - in real implementation, store this)
    const originalRequest = await this.tracker.getOriginalRequest(recommendationId);
    
    return await this.submitToUniversities({
      ...originalRequest,
      universities
    });
  }

  private getAdapter(integrationType: string): UniversityAdapter | undefined {
    return this.adapters.get(integrationType);
  }

  private async prepareSubmissionData(
    request: SubmissionRequest,
    university: UniversitySubmissionTarget,
    config: any
  ): Promise<any> {
    // Transform StellarRec data format to university-specific format
    return {
      student: request.studentData,
      recommender: request.recommenderData,
      recommendation: request.recommendationContent,
      university: university,
      config: config,
      metadata: request.metadata
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get integration statistics
   */
  async getIntegrationStats(): Promise<{
    totalUniversities: number;
    byIntegrationType: Record<string, number>;
    byCountry: Record<string, number>;
    byState: Record<string, number>;
  }> {
    return await this.registry.getIntegrationStatistics();
  }

  /**
   * Test connection to a specific university
   */
  async testUniversityConnection(universityId: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const config = await this.registry.getUniversityConfig(universityId);
      if (!config) {
        throw new Error('University configuration not found');
      }

      const adapter = this.getAdapter(config.integrationType);
      if (!adapter) {
        throw new Error('No adapter available');
      }

      await adapter.testConnection(config);
      
      return {
        success: true,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message
      };
    }
  }
}

// Type definitions
export interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth: Date;
  address: Address;
  academicInfo: AcademicInfo;
}

export interface RecommenderData {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  institution: string;
  email: string;
  phone?: string;
  relationship: string;
  yearsKnown: number;
}

export interface RecommendationContent {
  content: string;
  wordCount: number;
  programType: string;
  customizations: Record<string, string>;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface AcademicInfo {
  currentInstitution: string;
  gpa: number;
  graduationDate: Date;
  major: string;
  testScores?: TestScores;
}

export interface TestScores {
  gre?: { verbal: number; quantitative: number; analytical: number };
  gmat?: { total: number; verbal: number; quantitative: number };
  toefl?: { total: number };
  ielts?: { total: number };
}

export interface SubmissionMetadata {
  submissionType: 'recommendation';
  priority: 'normal' | 'high' | 'urgent';
  deadline: Date;
  source: 'web' | 'mobile' | 'api';
  version: string;
}