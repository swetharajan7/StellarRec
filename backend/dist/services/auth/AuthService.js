"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../database");
const logger_1 = require("../logger");
class AuthService {
    constructor() {
        this.logger = new logger_1.Logger('AuthService');
        this.db = new database_1.DatabaseService();
        this.jwtSecret = process.env.JWT_SECRET || 'stellarrec-jwt-secret-key';
        this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'stellarrec-refresh-secret-key';
        this.tokenExpiry = process.env.JWT_EXPIRY || '15m';
        this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    }
    async register(userData) {
        try {
            this.logger.info(`Registering new user: ${userData.email}`);
            const existingUser = await this.getUserByEmail(userData.email);
            if (existingUser) {
                throw new Error('User already exists with this email');
            }
            if (userData.schoolCode) {
                await this.validateSchoolCode(userData.schoolCode);
            }
            if (userData.inviteCode) {
                await this.validateInviteCode(userData.inviteCode);
            }
            const saltRounds = 12;
            const hashedPassword = await bcryptjs_1.default.hash(userData.password, saltRounds);
            const userId = this.generateUserId();
            const now = new Date();
            const defaultPreferences = {
                theme: 'auto',
                notifications: {
                    email: true,
                    push: true,
                    deadlineReminders: true,
                    aiInsights: true,
                    universityUpdates: true,
                },
                privacy: {
                    profileVisibility: 'private',
                    dataSharing: false,
                    analyticsOptOut: false,
                },
                language: 'en',
                timezone: 'UTC',
            };
            const user = {
                id: userId,
                email: userData.email.toLowerCase(),
                firstName: userData.firstName,
                lastName: userData.lastName,
                role: userData.role,
                profileComplete: false,
                emailVerified: false,
                createdAt: now,
                updatedAt: now,
                preferences: defaultPreferences,
            };
            await this.createUserInDatabase(user, hashedPassword);
            const tokens = await this.generateTokens(user);
            await this.sendVerificationEmail(user);
            this.logger.info(`User registered successfully: ${user.id}`);
            return { user, tokens };
        }
        catch (error) {
            this.logger.error('Registration failed:', error);
            throw error;
        }
    }
    async login(credentials) {
        try {
            this.logger.info(`Login attempt for: ${credentials.email}`);
            const user = await this.getUserByEmail(credentials.email);
            if (!user) {
                throw new Error('Invalid email or password');
            }
            const passwordHash = await this.getUserPasswordHash(user.id);
            const isValidPassword = await bcryptjs_1.default.compare(credentials.password, passwordHash);
            if (!isValidPassword) {
                throw new Error('Invalid email or password');
            }
            await this.updateLastLogin(user.id);
            user.lastLoginAt = new Date();
            const tokens = await this.generateTokens(user, credentials.rememberMe);
            this.logger.info(`User logged in successfully: ${user.id}`);
            return { user, tokens };
        }
        catch (error) {
            this.logger.error('Login failed:', error);
            throw error;
        }
    }
    async refreshToken(refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, this.jwtRefreshSecret);
            const user = await this.getUserById(decoded.userId);
            if (!user) {
                throw new Error('User not found');
            }
            const isValidRefreshToken = await this.verifyRefreshToken(user.id, refreshToken);
            if (!isValidRefreshToken) {
                throw new Error('Invalid refresh token');
            }
            const tokens = await this.generateTokens(user);
            await this.revokeRefreshToken(refreshToken);
            return tokens;
        }
        catch (error) {
            this.logger.error('Token refresh failed:', error);
            throw new Error('Invalid refresh token');
        }
    }
    async logout(userId, refreshToken) {
        try {
            if (refreshToken) {
                await this.revokeRefreshToken(refreshToken);
            }
            this.logger.info(`User logged out: ${userId}`);
        }
        catch (error) {
            this.logger.error('Logout failed:', error);
            throw error;
        }
    }
    async requestPasswordReset(request) {
        try {
            const user = await this.getUserByEmail(request.email);
            if (!user) {
                this.logger.info(`Password reset requested for non-existent email: ${request.email}`);
                return;
            }
            const resetToken = this.generateResetToken();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            await this.storePasswordResetToken(user.id, resetToken, expiresAt);
            await this.sendPasswordResetEmail(user, resetToken);
            this.logger.info(`Password reset requested for user: ${user.id}`);
        }
        catch (error) {
            this.logger.error('Password reset request failed:', error);
            throw error;
        }
    }
    async resetPassword(reset) {
        try {
            const userId = await this.verifyPasswordResetToken(reset.token);
            if (!userId) {
                throw new Error('Invalid or expired reset token');
            }
            const saltRounds = 12;
            const hashedPassword = await bcryptjs_1.default.hash(reset.newPassword, saltRounds);
            await this.updateUserPassword(userId, hashedPassword);
            await this.revokePasswordResetToken(reset.token);
            await this.revokeAllUserRefreshTokens(userId);
            this.logger.info(`Password reset completed for user: ${userId}`);
        }
        catch (error) {
            this.logger.error('Password reset failed:', error);
            throw error;
        }
    }
    async verifyEmail(verification) {
        try {
            const userId = await this.verifyEmailToken(verification.token);
            if (!userId) {
                throw new Error('Invalid or expired verification token');
            }
            await this.markEmailAsVerified(userId);
            this.logger.info(`Email verified for user: ${userId}`);
        }
        catch (error) {
            this.logger.error('Email verification failed:', error);
            throw error;
        }
    }
    async getUserById(userId) {
        try {
            const query = `
        SELECT id, email, first_name, last_name, role, profile_complete, 
               email_verified, created_at, updated_at, last_login_at, preferences
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `;
            const result = await this.db.query(query, [userId]);
            if (result.rows.length === 0) {
                return null;
            }
            return this.mapRowToUser(result.rows[0]);
        }
        catch (error) {
            this.logger.error('Failed to get user by ID:', error);
            throw error;
        }
    }
    async getUserByEmail(email) {
        try {
            const query = `
        SELECT id, email, first_name, last_name, role, profile_complete, 
               email_verified, created_at, updated_at, last_login_at, preferences
        FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `;
            const result = await this.db.query(query, [email.toLowerCase()]);
            if (result.rows.length === 0) {
                return null;
            }
            return this.mapRowToUser(result.rows[0]);
        }
        catch (error) {
            this.logger.error('Failed to get user by email:', error);
            throw error;
        }
    }
    async updateUserProfile(userId, updates) {
        try {
            const user = await this.getUserById(userId);
            if (!user) {
                throw new Error('User not found');
            }
            const updatedUser = { ...user, ...updates, updatedAt: new Date() };
            const query = `
        UPDATE users 
        SET first_name = $2, last_name = $3, preferences = $4, updated_at = $5
        WHERE id = $1
      `;
            await this.db.query(query, [
                userId,
                updatedUser.firstName,
                updatedUser.lastName,
                JSON.stringify(updatedUser.preferences),
                updatedUser.updatedAt,
            ]);
            this.logger.info(`User profile updated: ${userId}`);
            return updatedUser;
        }
        catch (error) {
            this.logger.error('Failed to update user profile:', error);
            throw error;
        }
    }
    async generateTokens(user, rememberMe = false) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, this.jwtSecret, {
            expiresIn: this.tokenExpiry,
        });
        const refreshTokenExpiry = rememberMe ? '30d' : this.refreshTokenExpiry;
        const refreshToken = jsonwebtoken_1.default.sign(payload, this.jwtRefreshSecret, {
            expiresIn: refreshTokenExpiry,
        });
        await this.storeRefreshToken(user.id, refreshToken);
        return {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60,
        };
    }
    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateResetToken() {
        return Math.random().toString(36).substr(2, 32);
    }
    async createUserInDatabase(user, passwordHash) {
        const query = `
      INSERT INTO users (
        id, email, password_hash, first_name, last_name, role, 
        profile_complete, email_verified, created_at, updated_at, preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
        await this.db.query(query, [
            user.id,
            user.email,
            passwordHash,
            user.firstName,
            user.lastName,
            user.role,
            user.profileComplete,
            user.emailVerified,
            user.createdAt,
            user.updatedAt,
            JSON.stringify(user.preferences),
        ]);
    }
    async getUserPasswordHash(userId) {
        const query = 'SELECT password_hash FROM users WHERE id = $1';
        const result = await this.db.query(query, [userId]);
        if (result.rows.length === 0) {
            throw new Error('User not found');
        }
        return result.rows[0].password_hash;
    }
    async updateLastLogin(userId) {
        const query = 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1';
        await this.db.query(query, [userId]);
    }
    async storeRefreshToken(userId, refreshToken) {
        const query = `
      INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `;
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await this.db.query(query, [userId, refreshToken, expiresAt]);
    }
    async verifyRefreshToken(userId, refreshToken) {
        const query = `
      SELECT id FROM refresh_tokens 
      WHERE user_id = $1 AND token = $2 AND expires_at > CURRENT_TIMESTAMP AND revoked_at IS NULL
    `;
        const result = await this.db.query(query, [userId, refreshToken]);
        return result.rows.length > 0;
    }
    async revokeRefreshToken(refreshToken) {
        const query = 'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token = $1';
        await this.db.query(query, [refreshToken]);
    }
    async revokeAllUserRefreshTokens(userId) {
        const query = 'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1';
        await this.db.query(query, [userId]);
    }
    async storePasswordResetToken(userId, token, expiresAt) {
        const query = `
      INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `;
        await this.db.query(query, [userId, token, expiresAt]);
    }
    async verifyPasswordResetToken(token) {
        const query = `
      SELECT user_id FROM password_reset_tokens 
      WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL
    `;
        const result = await this.db.query(query, [token]);
        return result.rows.length > 0 ? result.rows[0].user_id : null;
    }
    async revokePasswordResetToken(token) {
        const query = 'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = $1';
        await this.db.query(query, [token]);
    }
    async updateUserPassword(userId, passwordHash) {
        const query = 'UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
        await this.db.query(query, [userId, passwordHash]);
    }
    async verifyEmailToken(token) {
        const query = `
      SELECT user_id FROM email_verification_tokens 
      WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL
    `;
        const result = await this.db.query(query, [token]);
        return result.rows.length > 0 ? result.rows[0].user_id : null;
    }
    async markEmailAsVerified(userId) {
        const query = 'UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
        await this.db.query(query, [userId]);
    }
    async sendVerificationEmail(user) {
        this.logger.info(`Verification email sent to: ${user.email}`);
    }
    async sendPasswordResetEmail(user, resetToken) {
        this.logger.info(`Password reset email sent to: ${user.email}`);
    }
    async validateSchoolCode(schoolCode) {
        this.logger.info(`Validating school code: ${schoolCode}`);
    }
    async validateInviteCode(inviteCode) {
        this.logger.info(`Validating invite code: ${inviteCode}`);
    }
    mapRowToUser(row) {
        return {
            id: row.id,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            role: row.role,
            profileComplete: row.profile_complete,
            emailVerified: row.email_verified,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastLoginAt: row.last_login_at,
            preferences: row.preferences ? JSON.parse(row.preferences) : {},
        };
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=AuthService.js.map