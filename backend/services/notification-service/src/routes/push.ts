import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { PushNotificationService } from '../services/pushNotificationService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Send push notification
router.post('/send',
  [
    body('to').isString().notEmpty().withMessage('Device token or subscription is required'),
    body('title').isString().notEmpty().withMessage('Title is required'),
    body('body').optional().isString(),
    body('templateId').optional().isString(),
    body('templateData').optional().isObject(),
    body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
    body('category').optional().isString(),
    body('tags').optional().isArray(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const pushService: PushNotificationService = req.app.locals.services.pushNotificationService;
    const results = await pushService.sendPushNotification({
      ...req.body,
      userId: req.user!.id,
      priority: req.body.priority || 'normal'
    });

    res.status(200).json({
      success: true,
      data: results
    });
  })
);

// Register device
router.post('/register',
  [
    body('deviceToken').isString().notEmpty().withMessage('Device token is required'),
    body('platform').isIn(['ios', 'android', 'web']).withMessage('Valid platform is required'),
    body('subscription').optional().isObject(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const pushService: PushNotificationService = req.app.locals.services.pushNotificationService;
    await pushService.registerDevice(
      req.user!.id,
      req.body.deviceToken,
      req.body.platform,
      req.body.subscription
    );

    res.status(200).json({
      success: true,
      data: { message: 'Device registered successfully' }
    });
  })
);

// Get user devices
router.get('/devices',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pushService: PushNotificationService = req.app.locals.services.pushNotificationService;
    const devices = await pushService.getUserDevices(req.user!.id);

    res.status(200).json({
      success: true,
      data: devices
    });
  })
);

export default router;