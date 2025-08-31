import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { SMSService } from '../services/smsService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Send single SMS
router.post('/send',
  [
    body('to').isMobilePhone().withMessage('Valid phone number is required'),
    body('message').optional().isString().isLength({ min: 1, max: 1600 }),
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

    if (!req.body.message && !req.body.templateId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Either message or templateId is required' }
      });
    }

    const smsService: SMSService = req.app.locals.services.smsService;
    const result = await smsService.sendSMS({
      ...req.body,
      userId: req.user!.id,
      priority: req.body.priority || 'normal'
    });

    res.status(200).json({
      success: true,
      data: result
    });
  })
);

// Send bulk SMS
router.post('/send/bulk',
  [
    body('messages').isArray().withMessage('Messages must be an array'),
    body('messages.*.to').isMobilePhone().withMessage('Valid phone number is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const smsService: SMSService = req.app.locals.services.smsService;
    const messages = req.body.messages.map((message: any) => ({
      ...message,
      userId: req.user!.id,
      priority: message.priority || 'normal'
    }));

    const results = await smsService.sendBulkSMS(messages);

    res.status(200).json({
      success: true,
      data: results
    });
  })
);

// Schedule SMS
router.post('/schedule',
  [
    body('to').isMobilePhone().withMessage('Valid phone number is required'),
    body('scheduledAt').isISO8601().withMessage('Valid scheduled date is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    if (!req.body.message && !req.body.templateId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Either message or templateId is required' }
      });
    }

    const smsService: SMSService = req.app.locals.services.smsService;
    const notificationId = await smsService.scheduleSMS(
      {
        ...req.body,
        userId: req.user!.id,
        priority: req.body.priority || 'normal'
      },
      new Date(req.body.scheduledAt)
    );

    res.status(200).json({
      success: true,
      data: { notificationId }
    });
  })
);

// Get SMS status
router.get('/status/:messageId',
  [
    param('messageId').isString().notEmpty().withMessage('Message ID is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const smsService: SMSService = req.app.locals.services.smsService;
    const status = await smsService.getSMSStatus(req.params.messageId);

    res.status(200).json({
      success: true,
      data: status
    });
  })
);

// Get SMS templates
router.get('/templates',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const smsService: SMSService = req.app.locals.services.smsService;
    const templates = await smsService.getSMSTemplates();

    res.status(200).json({
      success: true,
      data: templates
    });
  })
);

export default router;