import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { NotificationPreferenceService } from '../services/notificationPreferenceService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get user preferences
router.get('/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const preferenceService: NotificationPreferenceService = req.app.locals.services.notificationPreferenceService;
    const preferences = await preferenceService.getUserPreferences(req.user!.id);

    res.status(200).json({
      success: true,
      data: preferences
    });
  })
);

// Update user preferences
router.put('/',
  [
    body('channels').optional().isObject(),
    body('categories').optional().isObject(),
    body('quietHours').optional().isObject(),
    body('frequency').optional().isObject(),
    body('globalOptOut').optional().isBoolean(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const preferenceService: NotificationPreferenceService = req.app.locals.services.notificationPreferenceService;
    const preferences = await preferenceService.updateUserPreferences(req.user!.id, req.body);

    res.status(200).json({
      success: true,
      data: preferences
    });
  })
);

// Update channel preference
router.put('/channels/:channel',
  [
    param('channel').isIn(['email', 'sms', 'push']).withMessage('Valid channel is required'),
    body('enabled').optional().isBoolean(),
    body('address').optional().isString(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const preferenceService: NotificationPreferenceService = req.app.locals.services.notificationPreferenceService;
    await preferenceService.updateChannelPreference(
      req.user!.id,
      req.params.channel as 'email' | 'sms' | 'push',
      req.body
    );

    res.status(200).json({
      success: true,
      data: { message: 'Channel preference updated successfully' }
    });
  })
);

// Verify channel
router.post('/channels/:channel/verify',
  [
    param('channel').isIn(['email', 'sms']).withMessage('Valid channel is required'),
    body('code').isString().isLength({ min: 6, max: 6 }).withMessage('Valid verification code is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const preferenceService: NotificationPreferenceService = req.app.locals.services.notificationPreferenceService;
    const verified = await preferenceService.verifyChannel(
      req.user!.id,
      req.params.channel as 'email' | 'sms',
      req.body.code
    );

    if (verified) {
      res.status(200).json({
        success: true,
        data: { message: 'Channel verified successfully' }
      });
    } else {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid or expired verification code' }
      });
    }
  })
);

// Get notification categories
router.get('/categories',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const preferenceService: NotificationPreferenceService = req.app.locals.services.notificationPreferenceService;
    const categories = await preferenceService.getNotificationCategories();

    res.status(200).json({
      success: true,
      data: categories
    });
  })
);

export default router;