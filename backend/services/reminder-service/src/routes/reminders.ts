import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { ReminderSchedulingService } from '../services/reminderSchedulingService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Create reminder schedule
router.post('/',
  [
    body('type').isIn(['deadline', 'milestone', 'task', 'follow_up', 'custom']).withMessage('Valid type is required'),
    body('title').isString().notEmpty().withMessage('Title is required'),
    body('targetDate').isISO8601().withMessage('Valid target date is required'),
    body('priority').isIn(['low', 'medium', 'high', 'critical']).withMessage('Valid priority is required'),
    body('category').isString().notEmpty().withMessage('Category is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const reminderSchedulingService: ReminderSchedulingService = req.app.locals.services.reminderSchedulingService;
    const scheduleId = await reminderSchedulingService.createReminderSchedule({
      ...req.body,
      userId: req.user!.id,
      targetDate: new Date(req.body.targetDate),
      metadata: req.body.metadata || {},
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: { scheduleId }
    });
  })
);

// Get user reminders
router.get('/',
  [
    query('status').optional().isIn(['active', 'paused', 'completed', 'cancelled']),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const reminderSchedulingService: ReminderSchedulingService = req.app.locals.services.reminderSchedulingService;
    const reminders = await reminderSchedulingService.getUserReminderSchedules(
      req.user!.id,
      req.query.status as string
    );

    res.status(200).json({
      success: true,
      data: reminders
    });
  })
);

// Get upcoming reminders
router.get('/upcoming',
  [
    query('hours').optional().isInt({ min: 1, max: 168 }).toInt(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const reminderSchedulingService: ReminderSchedulingService = req.app.locals.services.reminderSchedulingService;
    const upcomingReminders = await reminderSchedulingService.getUpcomingReminders(
      req.user!.id,
      req.query.hours as number || 24
    );

    res.status(200).json({
      success: true,
      data: upcomingReminders
    });
  })
);

export default router;