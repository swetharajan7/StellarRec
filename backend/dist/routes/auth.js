"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const authController = new authController_1.AuthController();
router.post('/register', [
    (0, auth_1.authRateLimit)(5, 15 * 60 * 1000),
    (0, auth_1.logAuthEvent)('register'),
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    (0, express_validator_1.body)('firstName')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('First name is required and must be less than 50 characters'),
    (0, express_validator_1.body)('lastName')
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Last name is required and must be less than 50 characters'),
    (0, express_validator_1.body)('role')
        .isIn(['student', 'counselor'])
        .withMessage('Role must be either student or counselor'),
    (0, express_validator_1.body)('schoolCode')
        .optional()
        .isLength({ min: 3, max: 20 })
        .withMessage('School code must be between 3 and 20 characters'),
    (0, express_validator_1.body)('inviteCode')
        .optional()
        .isLength({ min: 6, max: 50 })
        .withMessage('Invite code must be between 6 and 50 characters')
], authController.register.bind(authController));
router.post('/login', [
    (0, auth_1.authRateLimit)(10, 15 * 60 * 1000),
    (0, auth_1.logAuthEvent)('login'),
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required'),
    (0, express_validator_1.body)('password')
        .notEmpty()
        .withMessage('Password is required'),
    (0, express_validator_1.body)('rememberMe')
        .optional()
        .isBoolean()
        .withMessage('Remember me must be a boolean')
], authController.login.bind(authController));
router.post('/refresh', [
    (0, auth_1.logAuthEvent)('refresh_token'),
    (0, express_validator_1.body)('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required')
], authController.refreshToken.bind(authController));
router.post('/logout', [
    auth_1.authenticateToken,
    (0, auth_1.logAuthEvent)('logout')
], authController.logout.bind(authController));
router.post('/password/reset-request', [
    (0, auth_1.authRateLimit)(3, 60 * 60 * 1000),
    (0, auth_1.logAuthEvent)('password_reset_request'),
    (0, express_validator_1.body)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required')
], authController.requestPasswordReset.bind(authController));
router.post('/password/reset', [
    (0, auth_1.logAuthEvent)('password_reset'),
    (0, express_validator_1.body)('token')
        .notEmpty()
        .withMessage('Reset token is required'),
    (0, express_validator_1.body)('newPassword')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
], authController.resetPassword.bind(authController));
router.get('/email/verify/:token', [
    (0, auth_1.logAuthEvent)('email_verification'),
    (0, express_validator_1.param)('token')
        .notEmpty()
        .withMessage('Verification token is required')
], authController.verifyEmail.bind(authController));
router.post('/email/resend-verification', [
    auth_1.authenticateToken,
    (0, auth_1.authRateLimit)(3, 60 * 60 * 1000),
    (0, auth_1.logAuthEvent)('resend_verification')
], authController.resendEmailVerification.bind(authController));
router.get('/profile', [
    auth_1.authenticateToken
], authController.getProfile.bind(authController));
router.put('/profile', [
    auth_1.authenticateToken,
    (0, express_validator_1.body)('firstName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('First name must be between 1 and 50 characters'),
    (0, express_validator_1.body)('lastName')
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage('Last name must be between 1 and 50 characters'),
    (0, express_validator_1.body)('preferences')
        .optional()
        .isObject()
        .withMessage('Preferences must be an object')
], authController.updateProfile.bind(authController));
router.get('/email/check-availability', [
    (0, express_validator_1.query)('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email is required')
], authController.checkEmailAvailability.bind(authController));
exports.default = router;
//# sourceMappingURL=auth.js.map