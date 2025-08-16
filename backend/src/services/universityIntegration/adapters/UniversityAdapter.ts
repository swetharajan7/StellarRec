import { AuthenticationManager } from '../AuthenticationManager';
import { RateLimiter } from '../RateLimiter';

export interface AdapterSubmissionData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth: Date;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    academicInfo: {
      currentInstitution: string;
      gpa: number;
      graduationDate: Date;
      major: string;
      testScores?: {
        gre?: { verbal: number; quantitative: number; analytical: number };
        gmat?: { total: number; verbal: number; quantitative: number };
        toefl?: { total: number };
        ielts?: { total: number };
      };
    };
  };
  recommender: {
    id: string;
    firstName: string;
    lastName: string;
    title: string;
    institution: string;
    email: string;
    phone?: string;
    relationship: string;
    yearsKnown: number;
  };
  recommendation: {
    content: string;
    wordCount: number;
    programType: string;
    customizations: Record<string, string>;
  };
  university: {
    universityId: string;
    universityCode: string;
    programType: string;
    applicationDeadline: Date;
    specificRequirements?: Record<string, any>;
  };
  config: any;
  metadata: {
    submissionType: string;
    priority: string;
    deadline: Date;
    source: string;
    version: string;
  };
}

export interface AdapterSubmissionResult {
  status: 'success' | 'failed' | 'pending' | 'retry';
  submissionId?: string;
  confirmationCode?: string;
  errorMessage?: string;
  retryAfter?: Date;
  metadata: Record<string, any>;
}

/**
 * Abstract base class for all university integration adapters
 */
export abstract class UniversityAdapter {
  protected authManager: AuthenticationManager;
  protected rateLimiter: RateLimiter;

  constructor(authManager: AuthenticationManager, rateLimiter: RateLimiter) {
    this.authManager = authManager;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Submit a recommendation to the university system
   */
  abstract submit(data: AdapterSubmissionData): Promise<AdapterSubmissionResult>;

  /**
   * Get the status of a previously submitted recommendation
   */
  abstract getSubmissionStatus(submissionId: string): Promise<{
    status: string;
    lastUpdated: Date;
    universityStatus?: string;
    metadata: Record<string, any>;
  }>;

  /**
   * Test connection to the university system
   */
  abstract testConnection(config: any): Promise<void>;

  /**
   * Get supported universities for this adapter (optional)
   */
  async getSupportedUniversities?(): Promise<Array<{
    code: string;
    name: string;
    country: string;
    programTypes: string[];
  }>>;

  /**
   * Validate if a university/program combination is supported (optional)
   */
  async validateUniversitySupport?(universityCode: string, programType: string): Promise<{
    supported: boolean;
    requirements?: any;
    deadlines?: any;
  }>;

  /**
   * Bulk submit multiple recommendations (optional, for systems that support it)
   */
  async bulkSubmit?(submissions: AdapterSubmissionData[]): Promise<AdapterSubmissionResult[]>;

  /**
   * Cancel a pending submission (optional)
   */
  async cancelSubmission?(submissionId: string): Promise<boolean>;

  /**
   * Update a submitted recommendation (optional, for systems that support it)
   */
  async updateSubmission?(submissionId: string, data: Partial<AdapterSubmissionData>): Promise<AdapterSubmissionResult>;

  /**
   * Get submission history for a student (optional)
   */
  async getSubmissionHistory?(studentId: string): Promise<Array<{
    submissionId: string;
    universityCode: string;
    status: string;
    submittedAt: Date;
    metadata: Record<string, any>;
  }>>;

  /**
   * Validate submission data before sending (common validation logic)
   */
  protected validateSubmissionData(data: AdapterSubmissionData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Student validation
    if (!data.student.firstName?.trim()) errors.push('Student first name is required');
    if (!data.student.lastName?.trim()) errors.push('Student last name is required');
    if (!data.student.email?.trim()) errors.push('Student email is required');
    if (!this.isValidEmail(data.student.email)) errors.push('Student email is invalid');

    // Recommender validation
    if (!data.recommender.firstName?.trim()) errors.push('Recommender first name is required');
    if (!data.recommender.lastName?.trim()) errors.push('Recommender last name is required');
    if (!data.recommender.email?.trim()) errors.push('Recommender email is required');
    if (!this.isValidEmail(data.recommender.email)) errors.push('Recommender email is invalid');
    if (!data.recommender.institution?.trim()) errors.push('Recommender institution is required');

    // Recommendation validation
    if (!data.recommendation.content?.trim()) errors.push('Recommendation content is required');
    if (data.recommendation.wordCount < 50) errors.push('Recommendation content too short (minimum 50 words)');
    if (data.recommendation.wordCount > 10000) errors.push('Recommendation content too long (maximum 10000 words)');

    // University validation
    if (!data.university.universityCode?.trim()) errors.push('University code is required');
    if (!data.university.programType?.trim()) errors.push('Program type is required');
    if (!data.university.applicationDeadline) errors.push('Application deadline is required');
    if (data.university.applicationDeadline < new Date()) errors.push('Application deadline has passed');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Format content for university-specific requirements
   */
  protected formatContentForUniversity(content: string, requirements: any): string {
    let formattedContent = content;

    // Apply word count limits
    if (requirements.maxWordCount) {
      const words = content.split(/\s+/);
      if (words.length > requirements.maxWordCount) {
        formattedContent = words.slice(0, requirements.maxWordCount).join(' ') + '...';
      }
    }

    // Apply character limits
    if (requirements.maxCharacters && formattedContent.length > requirements.maxCharacters) {
      formattedContent = formattedContent.substring(0, requirements.maxCharacters - 3) + '...';
    }

    // Remove or replace unsupported formatting
    if (requirements.plainTextOnly) {
      formattedContent = formattedContent.replace(/<[^>]*>/g, ''); // Remove HTML tags
      formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove markdown bold
      formattedContent = formattedContent.replace(/\*(.*?)\*/g, '$1'); // Remove markdown italic
    }

    return formattedContent;
  }

  /**
   * Generate retry delay based on attempt number (exponential backoff)
   */
  protected calculateRetryDelay(attemptNumber: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 300000; // 5 minutes
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Sanitize data for logging (remove sensitive information)
   */
  protected sanitizeForLogging(data: any): any {
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'apiKey', 'token', 'ssn', 'dateOfBirth'];
    
    const removeSensitiveData = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          removeSensitiveData(obj[key]);
        }
      }
    };

    removeSensitiveData(sanitized);
    return sanitized;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}