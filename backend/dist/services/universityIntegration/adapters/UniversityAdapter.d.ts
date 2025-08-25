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
                gre?: {
                    verbal: number;
                    quantitative: number;
                    analytical: number;
                };
                gmat?: {
                    total: number;
                    verbal: number;
                    quantitative: number;
                };
                toefl?: {
                    total: number;
                };
                ielts?: {
                    total: number;
                };
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
export declare abstract class UniversityAdapter {
    protected authManager: AuthenticationManager;
    protected rateLimiter: RateLimiter;
    constructor(authManager: AuthenticationManager, rateLimiter: RateLimiter);
    abstract submit(data: AdapterSubmissionData): Promise<AdapterSubmissionResult>;
    abstract getSubmissionStatus(submissionId: string): Promise<{
        status: string;
        lastUpdated: Date;
        universityStatus?: string;
        metadata: Record<string, any>;
    }>;
    abstract testConnection(config: any): Promise<void>;
    getSupportedUniversities?(): Promise<Array<{
        code: string;
        name: string;
        country: string;
        programTypes: string[];
    }>>;
    validateUniversitySupport?(universityCode: string, programType: string): Promise<{
        supported: boolean;
        requirements?: any;
        deadlines?: any;
    }>;
    bulkSubmit?(submissions: AdapterSubmissionData[]): Promise<AdapterSubmissionResult[]>;
    cancelSubmission?(submissionId: string): Promise<boolean>;
    updateSubmission?(submissionId: string, data: Partial<AdapterSubmissionData>): Promise<AdapterSubmissionResult>;
    getSubmissionHistory?(studentId: string): Promise<Array<{
        submissionId: string;
        universityCode: string;
        status: string;
        submittedAt: Date;
        metadata: Record<string, any>;
    }>>;
    protected validateSubmissionData(data: AdapterSubmissionData): {
        valid: boolean;
        errors: string[];
    };
    protected formatContentForUniversity(content: string, requirements: any): string;
    protected calculateRetryDelay(attemptNumber: number): number;
    protected sanitizeForLogging(data: any): any;
    private isValidEmail;
}
//# sourceMappingURL=UniversityAdapter.d.ts.map