"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const AuthService_1 = require("../services/auth/AuthService");
const logger_1 = require("../services/logger");
const express_validator_1 = require("express-validator");
class AuthController {
    constructor() {
        this.logger = new logger_1.Logger('AuthController');
        this.authService = new AuthService_1.AuthService();
    }
    async register(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            const registerData = req.body;
            const result = await this.authService.register(registerData);
            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                data: {
                    user: {
                        id: result.user.id,
                        email: result.user.email,
                        firstName: result.user.firstName,
                        lastName: result.user.lastName,
                        role: result.user.role,
                        profileComplete: result.user.profileComplete,
                        emailVerified: result.user.emailVerified,
                        createdAt: result.user.createdAt
                    },
                    tokens: result.tokens
                }
            });
        }
        catch (error) {
            this.logger.error('Registration failed:', error);
            if (error instanceof Error) {
                if (error.message.includes('already exists')) {
                    res.status(409).json({
                        success: false,
                        error: 'User already exists with this email',
                        code: 'USER_EXISTS'
                    });
                }
                else if (error.message.includes('school code')) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid school code',
                        code: 'INVALID_SCHOOL_CODE'
                    });
                }
                else if (error.message.includes('invite code')) {
                    res.status(400).json({
                        success: false,
                        error: 'Invalid invite code',
                        code: 'INVALID_INVITE_CODE'
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        error: 'Registration failed',
                        code: 'REGISTRATION_ERROR'
                    });
                }
            }
            else {
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    code: 'INTERNAL_ERROR'
                });
            }
        }
    }
    async login(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            const credentials = req.body;
            const result = await this.authService.login(credentials);
            res.json({
                success: true,
                message: 'Login successful',
                data: {
                    user: {
                        id: result.user.id,
                        email: result.user.email,
                        firstName: result.user.firstName,
                        lastName: result.user.lastName,
                        role: result.user.role,
                        profileComplete: result.user.profileComplete,
                        emailVerified: result.user.emailVerified,
                        lastLoginAt: result.user.lastLoginAt,
                        preferences: result.user.preferences
                    },
                    tokens: result.tokens
                }
            });
        }
        catch (error) {
            this.logger.error('Login failed:', error);
            if (error instanceof Error && error.message.includes('Invalid email or password')) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid email or password',
                    code: 'INVALID_CREDENTIALS'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: 'Login failed',
                    code: 'LOGIN_ERROR'
                });
            }
        }
    }
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                res.status(400).json({
                    success: false,
                    error: 'Refresh token required',
                    code: 'REFRESH_TOKEN_MISSING'
                });
                return;
            }
            const tokens = await this.authService.refreshToken(refreshToken);
            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: { tokens }
            });
        }
        catch (error) {
            this.logger.error('Token refresh failed:', error);
            res.status(401).json({
                success: false,
                error: 'Invalid refresh token',
                code: 'INVALID_REFRESH_TOKEN'
            });
        }
    }
    async logout(req, res) {
        try {
            const { refreshToken } = req.body;
            const userId = req.userId;
            await this.authService.logout(userId, refreshToken);
            res.json({
                success: true,
                message: 'Logout successful'
            });
        }
        catch (error) {
            this.logger.error('Logout failed:', error);
            res.status(500).json({
                success: false,
                error: 'Logout failed',
                code: 'LOGOUT_ERROR'
            });
        }
    }
    async requestPasswordReset(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            const request = req.body;
            await this.authService.requestPasswordReset(request);
            res.json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent'
            });
        }
        catch (error) {
            this.logger.error('Password reset request failed:', error);
            res.status(500).json({
                success: false,
                error: 'Password reset request failed',
                code: 'PASSWORD_RESET_REQUEST_ERROR'
            });
        }
    }
    async resetPassword(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            const reset = req.body;
            await this.authService.resetPassword(reset);
            res.json({
                success: true,
                message: 'Password reset successful'
            });
        }
        catch (error) {
            this.logger.error('Password reset failed:', error);
            if (error instanceof Error && error.message.includes('Invalid or expired')) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid or expired reset token',
                    code: 'INVALID_RESET_TOKEN'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: 'Password reset failed',
                    code: 'PASSWORD_RESET_ERROR'
                });
            }
        }
    }
    async verifyEmail(req, res) {
        try {
            const { token } = req.params;
            if (!token) {
                res.status(400).json({
                    success: false,
                    error: 'Verification token required',
                    code: 'TOKEN_MISSING'
                });
                return;
            }
            const verification = { token };
            await this.authService.verifyEmail(verification);
            res.json({
                success: true,
                message: 'Email verified successfully'
            });
        }
        catch (error) {
            this.logger.error('Email verification failed:', error);
            if (error instanceof Error && error.message.includes('Invalid or expired')) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid or expired verification token',
                    code: 'INVALID_VERIFICATION_TOKEN'
                });
            }
            else {
                res.status(500).json({
                    success: false,
                    error: 'Email verification failed',
                    code: 'EMAIL_VERIFICATION_ERROR'
                });
            }
        }
    }
    async getProfile(req, res) {
        try {
            const user = req.user;
            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        profileComplete: user.profileComplete,
                        emailVerified: user.emailVerified,
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                        lastLoginAt: user.lastLoginAt,
                        preferences: user.preferences
                    }
                }
            });
        }
        catch (error) {
            this.logger.error('Get profile failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get profile',
                code: 'GET_PROFILE_ERROR'
            });
        }
    }
    async updateProfile(req, res) {
        try {
            const errors = (0, express_validator_1.validationResult)(req);
            if (!errors.isEmpty()) {
                res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: errors.array()
                });
                return;
            }
            const userId = req.userId;
            const updates = req.body;
            delete updates.id;
            delete updates.email;
            delete updates.role;
            delete updates.emailVerified;
            delete updates.createdAt;
            delete updates.updatedAt;
            const updatedUser = await this.authService.updateUserProfile(userId, updates);
            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: {
                    user: {
                        id: updatedUser.id,
                        email: updatedUser.email,
                        firstName: updatedUser.firstName,
                        lastName: updatedUser.lastName,
                        role: updatedUser.role,
                        profileComplete: updatedUser.profileComplete,
                        emailVerified: updatedUser.emailVerified,
                        updatedAt: updatedUser.updatedAt,
                        preferences: updatedUser.preferences
                    }
                }
            });
        }
        catch (error) {
            this.logger.error('Update profile failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update profile',
                code: 'UPDATE_PROFILE_ERROR'
            });
        }
    }
    async checkEmailAvailability(req, res) {
        try {
            const { email } = req.query;
            if (!email || typeof email !== 'string') {
                res.status(400).json({
                    success: false,
                    error: 'Email parameter required',
                    code: 'EMAIL_MISSING'
                });
                return;
            }
            const existingUser = await this.authService.getUserByEmail(email);
            const isAvailable = !existingUser;
            res.json({
                success: true,
                data: {
                    email,
                    available: isAvailable
                }
            });
        }
        catch (error) {
            this.logger.error('Email availability check failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check email availability',
                code: 'EMAIL_CHECK_ERROR'
            });
        }
    }
    async resendEmailVerification(req, res) {
        try {
            const user = req.user;
            if (user.emailVerified) {
                res.status(400).json({
                    success: false,
                    error: 'Email already verified',
                    code: 'EMAIL_ALREADY_VERIFIED'
                });
                return;
            }
            this.logger.info(`Resending verification email to: ${user.email}`);
            res.json({
                success: true,
                message: 'Verification email sent'
            });
        }
        catch (error) {
            this.logger.error('Resend verification failed:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to resend verification email',
                code: 'RESEND_VERIFICATION_ERROR'
            });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map