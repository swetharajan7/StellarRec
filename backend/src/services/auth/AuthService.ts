import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { DatabaseService } from '../database';
import { Logger } from '../logger';

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

export class AuthService {
  private logger = new Logger('AuthService');
  private db: DatabaseService;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private tokenExpiry: string;
  private refreshTokenExpiry: string;

  constructor() {
    this.db = new DatabaseService();
    this.jwtSecret = process.env.JWT_SECRET || 'stellarrec-jwt-secret-key';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'stellarrec-refresh-secret-key';
    this.tokenExpiry = process.env.JWT_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      this.logger.info(`Registering new user: ${userData.email}`);

      // Check if user already exists
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Validate school/invite code if provided
      if (userData.schoolCode) {
        await this.validateSchoolCode(userData.schoolCode);
      }

      if (userData.inviteCode) {
        await this.validateInviteCode(userData.inviteCode);
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Create user
      const userId = this.generateUserId();
      const now = new Date();
      
      const defaultPreferences: UserPreferences = {
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

      const user: User = {
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

      // Insert user into database
      await this.createUserInDatabase(user, hashedPassword);

      // Generate tokens
      const tokens = await this.generateTokens(user);

      // Send verification email
      await this.sendVerificationEmail(user);

      // Log successful registration
      this.logger.info(`User registered successfully: ${user.id}`);

      return { user, tokens };

    } catch (error) {
      this.logger.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      this.logger.info(`Login attempt for: ${credentials.email}`);

      // Get user by email
      const user = await this.getUserByEmail(credentials.email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Get password hash from database
      const passwordHash = await this.getUserPasswordHash(user.id);
      
      // Verify password
      const isValidPassword = await bcrypt.compare(credentials.password, passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await this.updateLastLogin(user.id);
      user.lastLoginAt = new Date();

      // Generate tokens
      const tokens = await this.generateTokens(user, credentials.rememberMe);

      this.logger.info(`User logged in successfully: ${user.id}`);

      return { user, tokens };

    } catch (error) {
      this.logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;
      
      // Get user
      const user = await this.getUserById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify refresh token exists in database
      const isValidRefreshToken = await this.verifyRefreshToken(user.id, refreshToken);
      if (!isValidRefreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Revoke old refresh token
      await this.revokeRefreshToken(refreshToken);

      return tokens;

    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Logout user and revoke tokens
   */
  async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      if (refreshToken) {
        await this.revokeRefreshToken(refreshToken);
      }

      // Revoke all refresh tokens for user (optional - for logout from all devices)
      // await this.revokeAllUserRefreshTokens(userId);

      this.logger.info(`User logged out: ${userId}`);

    } catch (error) {
      this.logger.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(request: PasswordResetRequest): Promise<void> {
    try {
      const user = await this.getUserByEmail(request.email);
      if (!user) {
        // Don't reveal if email exists for security
        this.logger.info(`Password reset requested for non-existent email: ${request.email}`);
        return;
      }

      // Generate reset token
      const resetToken = this.generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store reset token
      await this.storePasswordResetToken(user.id, resetToken, expiresAt);

      // Send reset email
      await this.sendPasswordResetEmail(user, resetToken);

      this.logger.info(`Password reset requested for user: ${user.id}`);

    } catch (error) {
      this.logger.error('Password reset request failed:', error);
      throw error;
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(reset: PasswordReset): Promise<void> {
    try {
      // Verify reset token
      const userId = await this.verifyPasswordResetToken(reset.token);
      if (!userId) {
        throw new Error('Invalid or expired reset token');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(reset.newPassword, saltRounds);

      // Update password
      await this.updateUserPassword(userId, hashedPassword);

      // Revoke reset token
      await this.revokePasswordResetToken(reset.token);

      // Revoke all refresh tokens (force re-login)
      await this.revokeAllUserRefreshTokens(userId);

      this.logger.info(`Password reset completed for user: ${userId}`);

    } catch (error) {
      this.logger.error('Password reset failed:', error);
      throw error;
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(verification: EmailVerification): Promise<void> {
    try {
      // Verify email token
      const userId = await this.verifyEmailToken(verification.token);
      if (!userId) {
        throw new Error('Invalid or expired verification token');
      }

      // Mark email as verified
      await this.markEmailAsVerified(userId);

      this.logger.info(`Email verified for user: ${userId}`);

    } catch (error) {
      this.logger.error('Email verification failed:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
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

    } catch (error) {
      this.logger.error('Failed to get user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
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

    } catch (error) {
      this.logger.error('Failed to get user by email:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User> {
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

    } catch (error) {
      this.logger.error('Failed to update user profile:', error);
      throw error;
    }
  }

  // Private helper methods

  private async generateTokens(user: User, rememberMe: boolean = false): Promise<AuthTokens> {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry,
    });

    const refreshTokenExpiry = rememberMe ? '30d' : this.refreshTokenExpiry;
    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: refreshTokenExpiry,
    });

    // Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateResetToken(): string {
    return Math.random().toString(36).substr(2, 32);
  }

  private async createUserInDatabase(user: User, passwordHash: string): Promise<void> {
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

  private async getUserPasswordHash(userId: string): Promise<string> {
    const query = 'SELECT password_hash FROM users WHERE id = $1';
    const result = await this.db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0].password_hash;
  }

  private async updateLastLogin(userId: string): Promise<void> {
    const query = 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1';
    await this.db.query(query, [userId]);
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const query = `
      INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `;

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await this.db.query(query, [userId, refreshToken, expiresAt]);
  }

  private async verifyRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
    const query = `
      SELECT id FROM refresh_tokens 
      WHERE user_id = $1 AND token = $2 AND expires_at > CURRENT_TIMESTAMP AND revoked_at IS NULL
    `;

    const result = await this.db.query(query, [userId, refreshToken]);
    return result.rows.length > 0;
  }

  private async revokeRefreshToken(refreshToken: string): Promise<void> {
    const query = 'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token = $1';
    await this.db.query(query, [refreshToken]);
  }

  private async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    const query = 'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1';
    await this.db.query(query, [userId]);
  }

  private async storePasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    const query = `
      INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `;

    await this.db.query(query, [userId, token, expiresAt]);
  }

  private async verifyPasswordResetToken(token: string): Promise<string | null> {
    const query = `
      SELECT user_id FROM password_reset_tokens 
      WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL
    `;

    const result = await this.db.query(query, [token]);
    return result.rows.length > 0 ? result.rows[0].user_id : null;
  }

  private async revokePasswordResetToken(token: string): Promise<void> {
    const query = 'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = $1';
    await this.db.query(query, [token]);
  }

  private async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    const query = 'UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
    await this.db.query(query, [userId, passwordHash]);
  }

  private async verifyEmailToken(token: string): Promise<string | null> {
    const query = `
      SELECT user_id FROM email_verification_tokens 
      WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL
    `;

    const result = await this.db.query(query, [token]);
    return result.rows.length > 0 ? result.rows[0].user_id : null;
  }

  private async markEmailAsVerified(userId: string): Promise<void> {
    const query = 'UPDATE users SET email_verified = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
    await this.db.query(query, [userId]);
  }

  private async sendVerificationEmail(user: User): Promise<void> {
    // Implementation would send actual email
    this.logger.info(`Verification email sent to: ${user.email}`);
  }

  private async sendPasswordResetEmail(user: User, resetToken: string): Promise<void> {
    // Implementation would send actual email
    this.logger.info(`Password reset email sent to: ${user.email}`);
  }

  private async validateSchoolCode(schoolCode: string): Promise<void> {
    // Implementation would validate school code
    this.logger.info(`Validating school code: ${schoolCode}`);
  }

  private async validateInviteCode(inviteCode: string): Promise<void> {
    // Implementation would validate invite code
    this.logger.info(`Validating invite code: ${inviteCode}`);
  }

  private mapRowToUser(row: any): User {
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