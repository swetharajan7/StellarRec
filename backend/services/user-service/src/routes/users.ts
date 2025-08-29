import express from 'express';
import bcrypt from 'bcryptjs';
import { body, param } from 'express-validator';
import { validateRequest } from '../middleware/validation';
import { requireRole } from '../middleware/auth';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { APIError, ErrorCodes, APIResponse } from '@stellarrec/types';

const router = express.Router();

// Get current user
router.get('/me', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    
    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: {
        student_profiles: true,
        recommender_profiles: true,
        institution_profiles: true,
        user_preferences: true,
      },
    });

    if (!user) {
      throw new APIError(
        ErrorCodes.INVALID_CREDENTIALS,
        'User not found',
        404
      );
    }

    // Get the appropriate profile based on user role
    let profile = null;
    switch (user.role) {
      case 'student':
        profile = user.student_profiles;
        break;
      case 'recommender':
        profile = user.recommender_profiles;
        break;
      case 'institution':
        profile = user.institution_profiles;
        break;
    }

    const response: APIResponse = {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
        isActive: user.is_active,
        lastLogin: user.last_login,
        profile,
        preferences: user.user_preferences,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Update user account settings
router.put('/me', [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('currentPassword')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Current password is required to change email or password'),
  body('newPassword')
    .optional()
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
], validateRequest, async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { email, currentPassword, newPassword } = req.body;

    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new APIError(
        ErrorCodes.INVALID_CREDENTIALS,
        'User not found',
        404
      );
    }

    const updateData: any = {};

    // If changing email or password, verify current password
    if ((email && email !== user.email) || newPassword) {
      if (!currentPassword) {
        throw new APIError(
          ErrorCodes.INVALID_INPUT,
          'Current password is required to change email or password',
          400
        );
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValidPassword) {
        throw new APIError(
          ErrorCodes.INVALID_CREDENTIALS,
          'Current password is incorrect',
          401
        );
      }
    }

    // Update email
    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await prisma.users.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new APIError(
          ErrorCodes.INVALID_INPUT,
          'Email is already taken',
          409
        );
      }

      updateData.email = email;
      updateData.email_verified = false; // Reset email verification
    }

    // Update password
    if (newPassword) {
      updateData.password_hash = await bcrypt.hash(newPassword, 12);
    }

    // Update user
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: updateData,
      include: {
        student_profiles: true,
        recommender_profiles: true,
        institution_profiles: true,
        user_preferences: true,
      },
    });

    logger.info(`User ${userId} updated account settings`);

    const response: APIResponse = {
      success: true,
      data: {
        message: 'Account settings updated successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
          emailVerified: updatedUser.email_verified,
          isActive: updatedUser.is_active,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Deactivate user account
router.delete('/me', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    await prisma.users.update({
      where: { id: userId },
      data: { is_active: false },
    });

    logger.info(`User ${userId} deactivated account`);

    const response: APIResponse = {
      success: true,
      data: {
        message: 'Account deactivated successfully',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Admin routes - Get all users
router.get('/', requireRole(['admin']), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const role = req.query.role as string;
    const search = req.query.search as string;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        {
          student_profiles: {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
        {
          recommender_profiles: {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
        skip,
        take: limit,
        include: {
          student_profiles: true,
          recommender_profiles: true,
          institution_profiles: true,
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.users.count({ where }),
    ]);

    const response: APIResponse = {
      success: true,
      data: users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.email_verified,
        isActive: user.is_active,
        lastLogin: user.last_login,
        profile: user.student_profiles || user.recommender_profiles || user.institution_profiles,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })),
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Admin routes - Get user by ID
router.get('/:id', [
  param('id').isUUID().withMessage('Valid user ID is required'),
], validateRequest, requireRole(['admin']), async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.users.findUnique({
      where: { id },
      include: {
        student_profiles: true,
        recommender_profiles: true,
        institution_profiles: true,
        user_preferences: true,
      },
    });

    if (!user) {
      throw new APIError(
        ErrorCodes.INVALID_INPUT,
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
        emailVerified: user.email_verified,
        isActive: user.is_active,
        lastLogin: user.last_login,
        profile: user.student_profiles || user.recommender_profiles || user.institution_profiles,
        preferences: user.user_preferences,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Admin routes - Update user status
router.patch('/:id/status', [
  param('id').isUUID().withMessage('Valid user ID is required'),
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
], validateRequest, requireRole(['admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedUser = await prisma.users.update({
      where: { id },
      data: { is_active: isActive },
    });

    logger.info(`Admin updated user ${id} status to ${isActive ? 'active' : 'inactive'}`);

    const response: APIResponse = {
      success: true,
      data: {
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          isActive: updatedUser.is_active,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;