import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { EarlyWarningService } from '../services/earlyWarningService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Assess risks for current user
router.get('/assess',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const earlyWarningService: EarlyWarningService = req.app.locals.services.earlyWarningService;
    const riskAssessment = await earlyWarningService.assessRisks(userId);

    res.status(200).json({
      success: true,
      data: riskAssessment
    });
  })
);

// Get active warnings for current user
router.get('/active',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const earlyWarningService: EarlyWarningService = req.app.locals.services.earlyWarningService;
    const warnings = await earlyWarningService.getActiveWarnings(userId);

    res.status(200).json({
      success: true,
      data: warnings
    });
  })
);

// Create a new warning (admin only)
router.post('/create',
  [
    body('userId').isString().notEmpty().withMessage('User ID is required'),
    body('type').isIn(['deadline_risk', 'performance_decline', 'completion_risk', 'quality_concern', 'resource_shortage'])
      .withMessage('Invalid warning type'),
    body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
    body('title').isString().notEmpty().withMessage('Title is required'),
    body('description').isString().notEmpty().withMessage('Description is required'),
    body('affectedItems').isArray().withMessage('Affected items must be an array'),
    body('riskScore').isFloat({ min: 0, max: 1 }).withMessage('Risk score must be between 0 and 1'),
    body('timeToImpact').isInt({ min: 0 }).withMessage('Time to impact must be a non-negative integer'),
    body('recommendations').isArray().withMessage('Recommendations must be an array'),
    body('actionRequired').isBoolean().withMessage('Action required must be a boolean'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    // Check if user has admin role (simplified check)
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required' }
      });
    }

    const warningData = req.body;

    const earlyWarningService: EarlyWarningService = req.app.locals.services.earlyWarningService;
    const warning = await earlyWarningService.createWarning(warningData);

    res.status(201).json({
      success: true,
      data: warning
    });
  })
);

// Resolve a warning
router.patch('/:warningId/resolve',
  [
    param('warningId').isString().notEmpty().withMessage('Warning ID is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { warningId } = req.params;
    const userId = req.user!.id;

    const earlyWarningService: EarlyWarningService = req.app.locals.services.earlyWarningService;
    await earlyWarningService.resolveWarning(warningId, userId);

    res.status(200).json({
      success: true,
      data: { message: 'Warning resolved successfully' }
    });
  })
);

// Configure alert settings
router.post('/configure',
  [
    body('enabledAlerts').isArray().withMessage('Enabled alerts must be an array'),
    body('severityThreshold').isIn(['low', 'medium', 'high']).withMessage('Invalid severity threshold'),
    body('notificationChannels').isArray().withMessage('Notification channels must be an array'),
    body('notificationChannels.*').isIn(['email', 'sms', 'push']).withMessage('Invalid notification channel'),
    body('quietHours.start').isString().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid start time format'),
    body('quietHours.end').isString().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid end time format'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const userId = req.user!.id;
    const config = { userId, ...req.body };

    const earlyWarningService: EarlyWarningService = req.app.locals.services.earlyWarningService;
    await earlyWarningService.configureAlerts(userId, config);

    res.status(200).json({
      success: true,
      data: { message: 'Alert configuration updated successfully' }
    });
  })
);

export default router;