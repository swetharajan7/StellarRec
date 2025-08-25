export interface RateLimitConfig {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    burstLimit: number;
}
export declare class RateLimiter {
    private logger;
    private db;
    private memoryCache;
    constructor();
    checkRateLimit(integrationType: string, universityId?: string): Promise<void>;
    private getRateLimitConfig;
    private checkTimeWindow;
    private checkBurstLimit;
    private recordRequest;
    getCurrentUsage(integrationType: string, universityId?: string): Promise<{
        minute: {
            current: number;
            limit: number;
            resetTime: Date;
        };
        hour: {
            current: number;
            limit: number;
            resetTime: Date;
        };
        day: {
            current: number;
            limit: number;
            resetTime: Date;
        };
    }>;
    getRateLimitStatistics(integrationType?: string): Promise<{
        totalRequests: number;
        requestsByHour: Array<{
            hour: string;
            requests: number;
        }>;
        topUniversities: Array<{
            universityId: string;
            requests: number;
        }>;
        rateLimitHits: number;
    }>;
    resetRateLimits(integrationType: string, universityId?: string): Promise<void>;
    private getWindowStart;
    private getNextWindowStart;
    private startCleanupTimer;
}
export declare class RateLimitError extends Error {
    timeWindow: string;
    limit: number;
    current: number;
    resetTime: Date;
    constructor(message: string, timeWindow: string, limit: number, current: number, resetTime: Date);
}
//# sourceMappingURL=RateLimiter.d.ts.map