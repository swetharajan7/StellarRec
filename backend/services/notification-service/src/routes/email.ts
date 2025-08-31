import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { EmailService } from '../services/emailService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Send single email
router.post('/send',
  [
    body('to').isEmail().withMessage('Valid email address is required'),
    body('subject').isString().notEmpty().withMessage('Subject is required'),
    body('templateId').optional().isString(),
    body('templateData').optional().isObject(),
    body('htmlContent').optional().isString(),
    body('textContent').optional().isString(),
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

    const emailService: EmailService = req.app.locals.services.emailService;
    const result = await emailService.sendEmail({
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

// Send bulk emails
router.post('/send/bulk',
  [
    body('emails').isArray().withMessage('Emails must be an array'),
    body('emails.*.to').isEmail().withMessage('Valid email address is required'),
    body('emails.*.subject').isString().notEmpty().withMessage('Subject is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const emailService: EmailService = req.app.locals.services.emailService;
    const emails = req.body.emails.map((email: any) => ({
      ...email,
      userId: req.user!.id,
      priority: email.priority || 'normal'
    }));

    const results = await emailService.sendBulkEmails(emails);

    res.status(200).json({
      success: true,
      data: results
    });
  })
);

// Schedule email
router.post('/schedule',
  [
    body('to').isEmail().withMessage('Valid email address is required'),
    body('subject').isString().notEmpty().withMessage('Subject is required'),
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

    const emailService: EmailService = req.app.locals.services.emailService;
    const notificationId = await emailService.scheduleEmail(
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

// Get email status
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

    const emailService: EmailService = req.app.locals.services.emailService;
    const status = await emailService.getEmailStatus(req.params.messageId);

    res.status(200).json({
      success: true,
      data: status
    });
  })
);

// Get email templates
router.get('/templates',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const emailService: EmailService = req.app.locals.services.emailService;
    const templates = await emailService.getEmailTemplates();

    res.status(200).json({
      success: true,
      data: templates
    });
  })
);

export default router;