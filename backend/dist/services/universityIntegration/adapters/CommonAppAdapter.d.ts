import { UniversityAdapter, AdapterSubmissionData, AdapterSubmissionResult } from './UniversityAdapter';
import { AuthenticationManager } from '../AuthenticationManager';
import { RateLimiter } from '../RateLimiter';
export declare class CommonAppAdapter extends UniversityAdapter {
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
    private transformToCommonAppFormat;
    private generateRatingScales;
    private determineEntryTerm;
    private mapCommonAppStatus;
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
    bulkSubmit(submissions: AdapterSubmissionData[]): Promise<AdapterSubmissionResult[]>;
}
//# sourceMappingURL=CommonAppAdapter.d.ts.map