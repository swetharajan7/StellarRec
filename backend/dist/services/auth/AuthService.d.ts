export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'student' | 'counselor' | 'admin';
    profileComplete: boolean;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
    preferences: UserPreferences;
}
export interface UserPreferences {
    theme: 'light' | 'dark' | 'auto';
    notifications: {
        email: boolean;
        push: boolean;
        deadlineReminders: boolean;
        aiInsights: boolean;
        universityUpdates: boolean;
    };
    privacy: {
        profileVisibility: 'private' | 'counselors' | 'public';
        dataSharing: boolean;
        analyticsOptOut: boolean;
    };
    language: string;
    timezone: string;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface LoginCredentials {
    email: string;
    password: string;
    rememberMe?: boolean;
}
export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'student' | 'counselor';
    schoolCode?: string;
    inviteCode?: string;
}
export interface PasswordResetRequest {
    email: string;
}
export interface PasswordReset {
    token: string;
    newPassword: string;
}
export interface EmailVerification {
    token: string;
}
export declare class AuthService {
    private logger;
    private db;
    private jwtSecret;
    private jwtRefreshSecret;
    private tokenExpiry;
    private refreshTokenExpiry;
    constructor();
    register(userData: RegisterData): Promise<{
        user: User;
        tokens: AuthTokens;
    }>;
    login(credentials: LoginCredentials): Promise<{
        user: User;
        tokens: AuthTokens;
    }>;
    refreshToken(refreshToken: string): Promise<AuthTokens>;
    logout(userId: string, refreshToken?: string): Promise<void>;
    requestPasswordReset(request: PasswordResetRequest): Promise<void>;
    resetPassword(reset: PasswordReset): Promise<void>;
    verifyEmail(verification: EmailVerification): Promise<void>;
    getUserById(userId: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    updateUserProfile(userId: string, updates: Partial<User>): Promise<User>;
    private generateTokens;
    private generateUserId;
    private generateResetToken;
    private createUserInDatabase;
    private getUserPasswordHash;
    private updateLastLogin;
    private storeRefreshToken;
    private verifyRefreshToken;
    private revokeRefreshToken;
    private revokeAllUserRefreshTokens;
    private storePasswordResetToken;
    private verifyPasswordResetToken;
    private revokePasswordResetToken;
    private updateUserPassword;
    private verifyEmailToken;
    private markEmailAsVerified;
    private sendVerificationEmail;
    private sendPasswordResetEmail;
    private validateSchoolCode;
    private validateInviteCode;
    private mapRowToUser;
}
//# sourceMappingURL=AuthService.d.ts.map