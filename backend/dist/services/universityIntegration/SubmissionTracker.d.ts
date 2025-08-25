export interface SubmissionTrackingData {
    recommendationId: string;
    universityId: string;
    submissionId?: string;
    status: 'pending' | 'submitted' | 'processing' | 'delivered' | 'confirmed' | 'failed' | 'retry' | 'cancelled' | 'expired';
    submittedAt: Date;
    metadata: Record<string, any>;
}
export interface BulkSubmissionResult {
    recommendationId: string;
    totalUniversities: number;
    successful: number;
    failed: number;
    pending: number;
    results: any[];
    overallStatus: 'completed' | 'partial' | 'failed';
}
export declare class SubmissionTracker {
    private logger;
    private db;
    constructor();
    trackSubmission(data: SubmissionTrackingData): Promise<string>;
    updateSubmissionStatus(submissionId: string, status: string, metadata?: Record<string, any>): Promise<void>;
    getSubmissionsByRecommendation(recommendationId: string): Promise<any[]>;
    getFailedSubmissions(recommendationId: string): Promise<any[]>;
    storeBulkSubmissionResult(result: BulkSubmissionResult): Promise<void>;
    getSubmissionStatistics(filters?: {
        dateFrom?: Date;
        dateTo?: Date;
        integrationType?: string;
        universityId?: string;
    }): Promise<{
        totalSubmissions: number;
        successfulSubmissions: number;
        failedSubmissions: number;
        pendingSubmissions: number;
        successRate: number;
        byIntegrationType: Record<string, any>;
        byStatus: Record<string, number>;
    }>;
    getSubmissionsForRetry(): Promise<any[]>;
    markForRetry(submissionId: string, retryAfter: Date, errorMessage?: string): Promise<void>;
    getOriginalRequest(recommendationId: string): Promise<any>;
    cleanupOldSubmissions(olderThanDays?: number): Promise<number>;
}
//# sourceMappingURL=SubmissionTracker.d.ts.map