import { UniversityAdapter, AdapterSubmissionData, AdapterSubmissionResult } from './UniversityAdapter';
import { AuthenticationManager } from '../AuthenticationManager';
import { RateLimiter } from '../RateLimiter';
export declare class UACAdapter extends UniversityAdapter {
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
    private transformToUACFormat;
    private mapUSQualificationToAustralian;
    private mapInternationalQualifications;
    private calculateATAREquivalent;
    private convertSATToATAR;
    private convertACTToATAR;
    private mapEnglishProficiency;
    private formatPreferences;
    private formatAustralianReference;
    private formatPersonalStatement;
    private generateAcademicAssessment;
    private generateRecommendationLevel;
    private mapCitizenship;
    private mapStateCode;
    private mapRelationship;
    private determineEntryYear;
    private determineEntrySemester;
    private determineAdmissionCenter;
    private mapUACStatus;
    private isRetryableError;
    getSupportedInstitutions(): Promise<Array<{
        code: string;
        name: string;
        state: string;
        admissionCenter: string;
    }>>;
}
//# sourceMappingURL=UACAdapter.d.ts.map