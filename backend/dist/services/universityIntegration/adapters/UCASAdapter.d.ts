import { UniversityAdapter, AdapterSubmissionData, AdapterSubmissionResult } from './UniversityAdapter';
import { AuthenticationManager } from '../AuthenticationManager';
import { RateLimiter } from '../RateLimiter';
export declare class UCASAdapter extends UniversityAdapter {
    private logger;
    private httpClient;
    private readonly BASE_URL;
    constructor(authManager: AuthenticationManager, rateLimiter: RateLimiter);
    private setupInterceptors;
    submit(data: AdapterSubmissionData): Promise<AdapterSubmissionResult>;
    getSubmissionStatus(submissionId: string): Promise<{
        status: string;
        lastUpdated: Date;
        universityStatus?: string;
        metadata: Record<string, any>;
    }>;
    testConnection(config: any): Promise<void>;
    private transformToUCASFormat;
    private convertToUKQualifications;
    private convertGPAToALevels;
    private mapMajorToALevelSubject;
    private formatPersonalStatement;
    private formatUKReference;
    private generateAcademicAssessment;
    private generatePredictedPerformance;
    private convertGPAToUKGrade;
    private formatCourseChoices;
    private determineEntryYear;
    private determineApplicationCycle;
    private generatePredictedGrades;
    private mapEnglishProficiency;
    private extractTitle;
    private mapUSQualificationToUK;
    private mapUCASStatus;
    private isRetryableError;
    getSupportedUniversities(): Promise<Array<{
        code: string;
        name: string;
        country: string;
        programTypes: string[];
    }>>;
    validateUniversitySupport(universityCode: string, programType: string): Promise<{
        supported: boolean;
        requirements?: any;
        deadlines?: any;
    }>;
}
//# sourceMappingURL=UCASAdapter.d.ts.map