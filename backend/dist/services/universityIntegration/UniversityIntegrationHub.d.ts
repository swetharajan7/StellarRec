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
export declare class UniversityIntegrationHub {
    private logger;
    private adapters;
    private registry;
    private tracker;
    private rateLimiter;
    private authManager;
    constructor();
    private initializeAdapters;
    private registerAdapter;
    submitToUniversities(request: SubmissionRequest): Promise<BulkSubmissionResult>;
    private submitToSingleUniversity;
    getSubmissionStatus(recommendationId: string): Promise<SubmissionResult[]>;
    retryFailedSubmissions(recommendationId: string): Promise<BulkSubmissionResult>;
    private getAdapter;
    private prepareSubmissionData;
    private chunkArray;
    private delay;
    getIntegrationStats(): Promise<{
        totalUniversities: number;
        byIntegrationType: Record<string, number>;
        byCountry: Record<string, number>;
        byState: Record<string, number>;
    }>;
    testUniversityConnection(universityId: string): Promise<{
        success: boolean;
        responseTime: number;
        error?: string;
    }>;
}
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
}
export interface SubmissionMetadata {
    submissionType: 'recommendation';
    priority: 'normal' | 'high' | 'urgent';
    deadline: Date;
    source: 'web' | 'mobile' | 'api';
    version: string;
}
//# sourceMappingURL=UniversityIntegrationHub.d.ts.map