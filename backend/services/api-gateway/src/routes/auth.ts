import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validation';
import { authMiddleware, blacklistToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import { APIError, ErrorCodes, APIResponse } from '@stellarrec/types';

const router = express.Router();

// Mock user data (in real implementation, this would come from user service)
const mockUsers = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'student@stellarrec.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LQ4YCOuLQv3c1yqBWVHxkd0LQ4YCOuLQv3c1y', // password123
    role: 'student',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
    },
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    email: 'recommender@stellarrec.com',
    password: '$2a$12$LQv3c1yqBWVHxkd0LQ4YCOuLQv3c1yqBWVHxkd0LQ4YCOuLQv3c1y', // password123
    role: 'recommender',
    profile: {
      firstName: 'Dr. Sarah',
      lastName: 'Chen',
    },
  },
];

// Login endpoint
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Find user (in real implementation, this would query the user service)
      const user = mockUsers.find(u => u.email === email);
      if (!user) {
        throw new APIError(
          ErrorCodes.INVALID_CREDENTIALS,
          'Invalid email or password',
          401
        );
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        throw new APIError(
          ErrorCodes.INVALID_CREDENTIALS,
          'Invalid email or password',
          401
        );
      }

      // Generate JWT tokens
      const accessTokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = jwt.sign(
        accessTokenPayload,
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
      );

      logger.info(`User ${user.email} logged in successfully`);

      const response: APIResponse = {
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            profile: user.profile,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// Refresh token endpoint
router.post(
  '/refresh',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret'
      ) as { id: string };

      // Find user
      const user = mockUsers.find(u => u.id === decoded.id);
      if (!user) {
        throw new APIError(
          ErrorCodes.INVALID_CREDENTIALS,
          'Invalid refresh token',
          401
        );
      }

      // Generate new access token
      const accessTokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = jwt.sign(
        accessTokenPayload,
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      const response: APIResponse = {
        success: true,
        data: {
          accessToken,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      };

      res.json(response);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
        return next(
          new APIError(
            ErrorCodes.INVALID_CREDENTIALS,
            'Invalid refresh token',
            401
          )
        );
      }
      next(error);
    }
  }
);

// Get current user endpoint
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = mockUsers.find(u => u.id === req.user?.id);
    if (!user) {
      throw new APIError(
        ErrorCodes.INVALID_CREDENTIALS,
        'User not found',
        404
      );
    }

    const response: APIResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Logout endpoint
router.post('/logout', authMiddleware, async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await blacklistToken(token);
    }

    logger.info(`User ${req.user?.email} logged out successfully`);

    const response: APIResponse = {
      success: true,
      data: {
        message: 'Logged out successfully',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Register endpoint (simplified for demo)
router.post(
  '/register',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('role')
      .isIn(['student', 'recommender'])
      .withMessage('Role must be either student or recommender'),
    body('firstName')
      .trim()
      .isLength({ min: 1 })
      .withMessage('First name is required'),
    body('lastName')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Last name is required'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { email, password, role, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = mockUsers.find(u => u.email === email);
      if (existingUser) {
        throw new APIError(
          ErrorCodes.INVALID_INPUT,
          'User with this email already exists',
          409
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create new user (in real implementation, this would call the user service)
      const newUser = {
        id: `550e8400-e29b-41d4-a716-${Date.now()}`,
        email,
        password: hashedPassword,
        role,
        profile: {
          firstName,
          lastName,
        },
      };

      mockUsers.push(newUser);

      logger.info(`New user registered: ${email}`);

      const response: APIResponse = {
        success: true,
        data: {
          message: 'User registered successfully',
          user: {
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            profile: newUser.profile,
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;