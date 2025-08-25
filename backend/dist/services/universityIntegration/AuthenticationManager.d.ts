export interface AuthCredentials {
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
    username?: string;
    password?: string;
    certificate?: string;
    privateKey?: string;
}
export declare class AuthenticationManager {
    private logger;
    private db;
    private encryptionKey;
    private credentialsCache;
    private readonly CACHE_TTL;
    constructor();
    getCredentials(integrationType: string): Promise<AuthCredentials | null>;
    storeCredentials(integrationType: string, credentials: AuthCredentials): Promise<void>;
    refreshTokenIfNeeded(integrationType: string): Promise<AuthCredentials | null>;
    validateCredentials(integrationType: string): Promise<{
        valid: boolean;
        error?: string;
        expiresAt?: Date;
    }>;
    getAuthHeaders(integrationType: string): Promise<Record<string, string>>;
    rotateCredentials(integrationType: string): Promise<void>;
    getCredentialsNeedingRotation(): Promise<Array<{
        integrationType: string;
        lastRotated: Date;
        expiresAt?: Date;
    }>>;
    private encrypt;
    private decrypt;
    private generateEncryptionKey;
    private performTokenRefresh;
    private performCredentialValidation;
    clearCache(): void;
    getCredentialStatistics(): Promise<{
        totalIntegrations: number;
        activeCredentials: number;
        expiringSoon: number;
        needingRotation: number;
    }>;
}
//# sourceMappingURL=AuthenticationManager.d.ts.map