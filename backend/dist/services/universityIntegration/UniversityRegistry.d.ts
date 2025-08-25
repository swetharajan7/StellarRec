export interface UniversityConfig {
    id: string;
    code: string;
    name: string;
    country: 'US' | 'CA';
    state?: string;
    province?: string;
    integrationType: 'commonapp' | 'coalition' | 'uc_system' | 'ouac' | 'state_system' | 'direct_api' | 'email' | 'manual';
    apiEndpoint?: string;
    authConfig?: AuthConfig;
    submissionFormat: 'json' | 'xml' | 'form_data' | 'email';
    rateLimit: RateLimit;
    features: UniversityFeatures;
    requirements: UniversityRequirements;
    isActive: boolean;
    lastUpdated: Date;
    metadata: Record<string, any>;
}
export interface AuthConfig {
    type: 'api_key' | 'oauth2' | 'basic_auth' | 'certificate' | 'none';
    credentials: Record<string, string>;
    refreshToken?: string;
    expiresAt?: Date;
}
export interface RateLimit {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    burstLimit: number;
}
export interface UniversityFeatures {
    realTimeStatus: boolean;
    bulkSubmission: boolean;
    documentUpload: boolean;
    statusWebhooks: boolean;
    customFields: boolean;
}
export interface UniversityRequirements {
    requiredFields: string[];
    optionalFields: string[];
    documentTypes: string[];
    maxRecommendationLength: number;
    supportedPrograms: string[];
    deadlineBuffer: number;
}
export declare class UniversityRegistry {
    private logger;
    private db;
    private cache;
    private cacheExpiry;
    private readonly CACHE_TTL;
    constructor();
    getUniversityConfig(universityId: string): Promise<UniversityConfig | null>;
    getUniversitiesByIntegrationType(integrationType: string): Promise<UniversityConfig[]>;
    getUniversitiesByLocation(country: 'US' | 'CA', state?: string, province?: string): Promise<UniversityConfig[]>;
    upsertUniversityIntegration(universityId: string, config: Partial<UniversityConfig>): Promise<void>;
    getIntegrationStatistics(): Promise<{
        totalUniversities: number;
        byIntegrationType: Record<string, number>;
        byCountry: Record<string, number>;
        byState: Record<string, number>;
    }>;
    searchUniversities(filters: {
        search?: string;
        country?: 'US' | 'CA';
        state?: string;
        province?: string;
        integrationType?: string;
        programType?: string;
        isActive?: boolean;
        limit?: number;
        offset?: number;
    }): Promise<{
        universities: UniversityConfig[];
        total: number;
    }>;
    bulkLoadUniversities(universities: Partial<UniversityConfig>[]): Promise<{
        success: number;
        failed: number;
        errors: string[];
    }>;
    private mapRowToConfig;
    clearCache(): void;
}
//# sourceMappingURL=UniversityRegistry.d.ts.map