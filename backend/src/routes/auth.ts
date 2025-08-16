import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { 
  authenticateToken, 
  requireRole, 
  requireEmailVerification,
  authRateLimit,
  logAuthEvent
} from '../middleware/auth';
import { body, query, param } from 'express-validator';

const router = Router();
const authController = new AuthController();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique user identifier
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         firstName:
 *           type: string
 *           description: User's first name
 *         lastName:
 *           type: string
 *           description: User's last name
 *         role:
 *           type: string
 *           enum: [student, counselor, admin]
 *           description: User's role in the system
 *         profileComplete:
 *           type: boolean
 *           description: Whether user has completed their profile
 *         emailVerified:
 *           type: boolean
 *           description: Whether user's email is verified
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Account creation timestamp
 *         preferences:
 *           type: object
 *           description: User preferences and settings
 *     
 *     AuthTokens:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: JWT access token
 *         refreshToken:
 *           type: string
 *           description: JWT refresh token
 *         expiresIn:
 *           type: number
 *           description: Access token expiry time in seconds
 *     
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         password:
 *           type: string
 *           minLength: 8
 *           description: User's password
 *         rememberMe:
 *           type: boolean
 *           description: Whether to extend token expiry
 *     
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *         password:
 *           type: string
 *           minLength: 8
 *           description: User's password
 *         firstName:
 *           type: string
 *           minLength: 1
 *           description: User's first name
 *         lastName:
 *           type: string
 *           minLength: 1
 *           description: User's last name
 *         role:
 *           type: string
 *           enum: [student, counselor]
 *           description: User's role
 *         schoolCode:
 *           type: string
 *           description: Optional school code for verification
 *         inviteCode:
 *           type: string
 *           description: Optional invite code
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       400:
 *         description: Validation error or invalid data
 *       409:
 *         description: User already exists
 *       500:
 *         description: Internal server error
 */
router.post('/register', [
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  logAuthEvent('register'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
  body('role')
    .isIn(['student', 'counselor'])
    .withMessage('Role must be either student or counselor'),
  body('schoolCode')
    .optional()
    .isLength({ min: 3, max: 20 })
    .withMessage('School code must be between 3 and 20 characters'),
  body('inviteCode')
    .optional()
    .isLength({ min: 6, max: 50 })
    .withMessage('Invite code must be between 6 and 50 characters')
], authController.register.bind(authController));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many login attempts
 *       500:
 *         description: Internal server error
 */
router.post('/login', [
  authRateLimit(10, 15 * 60 * 1000), // 10 attempts per 15 minutes
  logAuthEvent('login'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean')
], authController.login.bind(authController));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Valid refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     tokens:
 *                       $ref: '#/components/schemas/AuthTokens'
 *       401:
 *         description: Invalid refresh token
 *       500:
 *         description: Internal server error
 */
router.post('/refresh', [
  logAuthEvent('refresh_token'),
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
], authController.refreshToken.bind(authController));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token to revoke
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/logout', [
  authenticateToken,
  logAuthEvent('logout')
], authController.logout.bind(authController));

/**
 * @swagger
 * /api/auth/password/reset-request:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address for password reset
 *     responses:
 *       200:
 *         description: Password reset email sent (if account exists)
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/password/reset-request', [
  authRateLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  logAuthEvent('password_reset_request'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
], authController.requestPasswordReset.bind(authController));

/**
 * @swagger
 * /api/auth/password/reset:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
router.post('/password/reset', [
  logAuthEvent('password_reset'),
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
], authController.resetPassword.bind(authController));

/**
 * @swagger
 * /api/auth/email/verify/{token}:
 *   get:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Internal server error
 */
router.get('/email/verify/:token', [
  logAuthEvent('email_verification'),
  param('token')
    .notEmpty()
    .withMessage('Verification token is required')
], authController.verifyEmail.bind(authController));

/**
 * @swagger
 * /api/auth/email/resend-verification:
 *   post:
 *     summary: Resend email verification
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       400:
 *         description: Email already verified
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/email/resend-verification', [
  authenticateToken,
  authRateLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  logAuthEvent('resend_verification')
], authController.resendEmailVerification.bind(authController));

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/profile', [
  authenticateToken
], authController.getProfile.bind(authController));

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *               lastName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *               preferences:
 *                 type: object
 *                 description: User preferences object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.put('/profile', [
  authenticateToken,
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name must be between 1 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name must be between 1 and 50 characters'),
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object')
], authController.updateProfile.bind(authController));

/**
 * @swagger
 * /api/auth/email/check-availability:
 *   get:
 *     summary: Check if email is available
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Email to check availability
 *     responses:
 *       200:
 *         description: Email availability checked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: string
 *                     available:
 *                       type: boolean
 *       400:
 *         description: Invalid email parameter
 *       500:
 *         description: Internal server error
 */
router.get('/email/check-availability', [
  query('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required')
], authController.checkEmailAvailability.bind(authController));

export default router;