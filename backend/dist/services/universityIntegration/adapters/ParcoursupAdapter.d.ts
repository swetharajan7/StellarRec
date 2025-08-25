import { UniversityAdapter, AdapterSubmissionData, AdapterSubmissionResult } from './UniversityAdapter';
import { AuthenticationManager } from '../AuthenticationManager';
import { RateLimiter } from '../RateLimiter';
export declare class ParcoursupAdapter extends UniversityAdapter {
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
    private transformToParcoursupFormat;
    private convertToBaccalaureat;
    private convertGPAToFrenchGrade;
    private convertGPAToFrenchMention;
    private mapMajorToFrenchSerie;
    private convertGradesToFrenchSystem;
    private mapInternationalQualifications;
    private formatVoeux;
    private formatMotivationLetter;
    private formatFrenchRecommendation;
    private generateFrenchEvaluation;
    private formatActivities;
    private mapLanguageSkills;
    private mapCountryToNationality;
    private mapRelationship;
    private determineAcademicYear;
    private determineApplicationPhase;
    private mapParcoursupStatus;
    private isRetryableError;
    getSupportedFormations(): Promise<Array<{
        code: string;
        name: string;
        etablissement: string;
        type: string;
    }>>;
}
//# sourceMappingURL=ParcoursupAdapter.d.ts.map