import express from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validation';
import { prisma } from '../index';
import { logger } from '../utils/logger';
import { APIError, ErrorCodes, APIResponse } from '@stellarrec/types';

const router = express.Router();

// Get user profile
router.get('/', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;

    let profile = null;

    switch (userRole) {
      case 'student':
        profile = await prisma.student_profiles.findUnique({
          where: { user_id: userId },
        });
        break;
      case 'recommender':
        profile = await prisma.recommender_profiles.findUnique({
          where: { user_id: userId },
        });
        break;
      case 'institution':
        profile = await prisma.institution_profiles.findUnique({
          where: { user_id: userId },
        });
        break;
      default:
        throw new APIError(
          ErrorCodes.INVALID_INPUT,
          'Invalid user role',
          400
        );
    }

    const response: APIResponse = {
      success: true,
      data: profile,
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

// Update student profile
router.put('/student', [
  body('firstName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Valid date of birth is required'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('gpa')
    .optional()
    .isFloat({ min: 0, max: 4 })
    .withMessage('GPA must be between 0 and 4'),
  body('graduationYear')
    .optional()
    .isInt({ min: 2020, max: 2030 })
    .withMessage('Graduation year must be between 2020 and 2030'),
  body('academicInterests')
    .optional()
    .isArray()
    .withMessage('Academic interests must be an array'),
  body('targetPrograms')
    .optional()
    .isArray()
    .withMessage('Target programs must be an array'),
], validateRequest, async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;

    if (userRole !== 'student') {
      throw new APIError(
        ErrorCodes.INSUFFICIENT_PERMISSIONS,
        'Only students can update student profiles',
        403
      );
    }

    const {
      firstName,
      lastName,
      dateOfBirth,
      phone,
      address,
      gpa,
      graduationYear,
      academicInterests,
      targetPrograms,
      testScores,
      profileData,
    } = req.body;

    const updatedProfile = await prisma.student_profiles.upsert({
      where: { user_id: userId },
      update: {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        phone,
        address,
        gpa,
        graduation_year: graduationYear,
        academic_interests: academicInterests,
        target_programs: targetPrograms,
        test_scores: testScores,
        profile_data: profileData || {},
      },
      create: {
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        phone,
        address,
        gpa,
        graduation_year: graduationYear,
        academic_interests: academicInterests || [],
        target_programs: targetPrograms || [],
        test_scores: testScores,
        profile_data: profileData || {},
      },
    });

    logger.info(`Student profile updated for user ${userId}`);

    const response: APIResponse = {
      success: true,
      data: {
        message: 'Student profile updated successfully',
        profile: updatedProfile,
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

// Update recommender profile
router.put('/recommender', [
  body('firstName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Last name is required'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Title cannot be empty'),
  body('institution')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Institution cannot be empty'),
  body('department')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Department cannot be empty'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('expertiseAreas')
    .optional()
    .isArray()
    .withMessage('Expertise areas must be an array'),
  body('yearsExperience')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Years of experience must be a positive number'),
], validateRequest, async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;

    if (userRole !== 'recommender') {
      throw new APIError(
        ErrorCodes.INSUFFICIENT_PERMISSIONS,
        'Only recommenders can update recommender profiles',
        403
      );
    }

    const {
      firstName,
      lastName,
      title,
      institution,
      department,
      phone,
      officeAddress,
      expertiseAreas,
      yearsExperience,
      profileData,
    } = req.body;

    const updatedProfile = await prisma.recommender_profiles.upsert({
      where: { user_id: userId },
      update: {
        first_name: firstName,
        last_name: lastName,
        title,
        institution,
        department,
        phone,
        office_address: officeAddress,
        expertise_areas: expertiseAreas,
        years_experience: yearsExperience,
        profile_data: profileData || {},
      },
      create: {
        user_id: userId,
        first_name: firstName,
        last_name: lastName,
        title,
        institution,
        department,
        phone,
        office_address: officeAddress,
        expertise_areas: expertiseAreas || [],
        years_experience: yearsExperience,
        profile_data: profileData || {},
      },
    });

    logger.info(`Recommender profile updated for user ${userId}`);

    const response: APIResponse = {
      success: true,
      data: {
        message: 'Recommender profile updated successfully',
        profile: updatedProfile,
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

// Update institution profile
router.put('/institution', [
  body('institutionName')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Institution name is required'),
  body('contactEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid contact email is required'),
  body('contactPhone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid contact phone is required'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Valid website URL is required'),
], validateRequest, async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const userRole = req.headers['x-user-role'] as string;

    if (userRole !== 'institution') {
      throw new APIError(
        ErrorCodes.INSUFFICIENT_PERMISSIONS,
        'Only institutions can update institution profiles',
        403
      );
    }

    const {
      institutionName,
      contactEmail,
      contactPhone,
      address,
      website,
      integrationConfig,
      profileData,
    } = req.body;

    const updatedProfile = await prisma.institution_profiles.upsert({
      where: { user_id: userId },
      update: {
        institution_name: institutionName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        address,
        website,
        integration_config: integrationConfig || {},
        profile_data: profileData || {},
      },
      create: {
        user_id: userId,
        institution_name: institutionName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        address,
        website,
        integration_config: integrationConfig || {},
        profile_data: profileData || {},
      },
    });

    logger.info(`Institution profile updated for user ${userId}`);

    const response: APIResponse = {
      success: true,
      data: {
        message: 'Institution profile updated successfully',
        profile: updatedProfile,
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

// Get user preferences
router.get('/preferences', async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] as string;

    const preferences = await prisma.user_preferences.findUnique({
      where: { user_id: userId },
    });

    const response: APIResponse = {
      success: true,
      data: preferences,
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

// Update user preferences
router.put('/preferences', [
  body('notifications')
    .optional()
    .isObject()
    .withMessage('Notifications must be an object'),
  body('privacy')
    .optional()
    .isObject()
    .withMessage('Privacy must be an object'),
  body('language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Language must be a valid language code'),
  body('timezone')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Timezone is required'),
  body('theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Theme must be light, dark, or auto'),
], validateRequest, async (req, res, next) => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const { notifications, privacy, language, timezone, theme } = req.body;

    const updatedPreferences = await prisma.user_preferences.upsert({
      where: { user_id: userId },
      update: {
        notifications,
        privacy,
        language,
        timezone,
        theme,
      },
      create: {
        user_id: userId,
        notifications: notifications || { email: true, sms: false, push: true },
        privacy: privacy || { profileVisibility: 'private', dataSharing: false },
        language: language || 'en',
        timezone: timezone || 'UTC',
        theme: theme || 'light',
      },
    });

    logger.info(`User preferences updated for user ${userId}`);

    const response: APIResponse = {
      success: true,
      data: {
        message: 'User preferences updated successfully',
        preferences: updatedPreferences,
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