import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { ReminderService } from '../services/reminderService';

const router = Router();
const prisma = new PrismaClient();
const reminderService = new ReminderService(prisma);

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Validation middleware
const validateCustomReminder = [
  body('title').isLength({ min: 1, max: 255 }).withMessage('Reminder title is required'),
  body('message').isLength({ min: 1, max: 1000 }).withMessage('Reminder message is required'),
  body('scheduled_for').isISO8601().withMessage('Valid scheduled date is required'),
  body('channels').isArray().withMessage('Channels array is required'),
  body('channels.*').isIn(['email', 'sms', 'push']).withMessage('Invalid channel')
];

const validateReminderSettings = [
  body('enabled').isBoolean().withMessage('Enabled must be a boolean'),
  body('intervals').optional().isArray().withMessage('Intervals must be an array'),
  body('intervals.*').optional().isInt({ min: 1, max: 365 }).withMessage('Invalid interval'),
  body('channels').optional().isArray().withMessage('Channels must be an array'),
  body('channels.*').optional().isIn(['email', 'sms', 'push']).withMessage('Invalid channel')
];

// GET /api/v1/reminders - Get user's reminders
router.get('/',
  query('status').optional().isIn(['pending', 'sent', 'failed', 'cancelled']),
  query('type').optional().isIn(['deadline', 'timeline', 'custom', 'urgent']),
  query('upcoming_days').optional().isInt({ min: 1, max: 365 }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const filters = {
        status: req.query.status as string,
        type: req.query.type as string,
        upcoming_days: req.query.upcoming_days ? parseInt(req.query.upcoming_days as string) : undefined
      };

      const reminders = await reminderService.getUserReminders(userId, filters);
      
      res.json({
        reminders,
        total: reminders.length
      });
    } catch (error) {
      logger.error('Error fetching reminders:', error);
      res.status(500).json({ error: 'Failed to fetch reminders' });
    }
  }
);

// POST /api/v1/reminders/custom - Create custom reminder
router.post('/custom',
  validateCustomReminder,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const reminderData = {
        title: req.body.title,
        message: req.body.message,
        scheduled_for: new Date(req.body.scheduled_for),
        channels: req.body.channels
      };

      const reminder = await reminderService.createCustomReminder(userId, reminderData);
      logger.info(`Custom reminder created: ${reminder.id} by user: ${userId}`);
      
      res.status(201).json(reminder);
    } catch (error) {
      logger.error('Error creating custom reminder:', error);
      res.status(500).json({ error: 'Failed to create custom reminder' });
    }
  }
);

// POST /api/v1/reminders/deadline/:deadlineId/schedule - Schedule reminders for deadline
router.post('/deadline/:deadlineId/schedule',
  param('deadlineId').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const deadlineId = req.params.deadlineId;
      const userId = req.user!.id;

      // Verify deadline ownership
      const deadline = await prisma.deadlines.findUnique({
        where: { id: deadlineId }
      });

      if (!deadline || deadline.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const reminders = await reminderService.scheduleDeadlineReminders(deadlineId);
      logger.info(`Scheduled ${reminders.length} reminders for deadline: ${deadlineId}`);
      
      res.status(201).json({
        reminders,
        total: reminders.length
      });
    } catch (error) {
      logger.error('Error scheduling deadline reminders:', error);
      res.status(500).json({ error: 'Failed to schedule deadline reminders' });
    }
  }
);

// PUT /api/v1/reminders/deadline/:deadlineId/settings - Update reminder settings
router.put('/deadline/:deadlineId/settings',
  param('deadlineId').isUUID(),
  validateReminderSettings,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const deadlineId = req.params.deadlineId;
      const userId = req.user!.id;

      // Verify deadline ownership
      const deadline = await prisma.deadlines.findUnique({
        where: { id: deadlineId }
      });

      if (!deadline || deadline.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const settings = {
        enabled: req.body.enabled,
        intervals: req.body.intervals,
        channels: req.body.channels
      };

      await reminderService.updateReminderSettings(userId, deadlineId, settings);
      logger.info(`Reminder settings updated for deadline: ${deadlineId}`);
      
      res.json({ message: 'Reminder settings updated successfully' });
    } catch (error) {
      logger.error('Error updating reminder settings:', error);
      res.status(500).json({ error: 'Failed to update reminder settings' });
    }
  }
);

// POST /api/v1/reminders/:id/snooze - Snooze reminder
router.post('/:id/snooze',
  param('id').isUUID(),
  body('snooze_minutes').isInt({ min: 5, max: 1440 }).withMessage('Snooze minutes must be between 5 and 1440'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const reminderId = req.params.id;
      const userId = req.user!.id;
      const snoozeMinutes = req.body.snooze_minutes;

      // Verify reminder ownership
      const reminder = await prisma.reminders.findUnique({
        where: { id: reminderId }
      });

      if (!reminder || reminder.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const snoozedReminder = await reminderService.snoozeReminder(reminderId, snoozeMinutes);
      logger.info(`Reminder snoozed: ${reminderId} for ${snoozeMinutes} minutes`);
      
      res.json(snoozedReminder);
    } catch (error) {
      logger.error('Error snoozing reminder:', error);
      res.status(500).json({ error: 'Failed to snooze reminder' });
    }
  }
);

// DELETE /api/v1/reminders/:id - Cancel reminder
router.delete('/:id',
  param('id').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const reminderId = req.params.id;
      const userId = req.user!.id;

      // Verify reminder ownership
      const reminder = await prisma.reminders.findUnique({
        where: { id: reminderId }
      });

      if (!reminder || reminder.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await prisma.reminders.update({
        where: { id: reminderId },
        data: {
          status: 'cancelled',
          error_message: 'Cancelled by user'
        }
      });

      logger.info(`Reminder cancelled: ${reminderId}`);
      res.status(204).send();
    } catch (error) {
      logger.error('Error cancelling reminder:', error);
      res.status(500).json({ error: 'Failed to cancel reminder' });
    }
  }
);

// GET /api/v1/reminders/analytics - Get reminder analytics
router.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const analytics = await reminderService.getReminderAnalytics(userId);
    res.json(analytics);
  } catch (error) {
    logger.error('Error fetching reminder analytics:', error);
    res.status(500).json({ error: 'Failed to fetch reminder analytics' });
  }
});

// POST /api/v1/reminders/test - Test reminder delivery (for development)
router.post('/test',
  body('channels').isArray().withMessage('Channels array is required'),
  body('channels.*').isIn(['email', 'sms', 'push']).withMessage('Invalid channel'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const channels = req.body.channels;

      // Create a test reminder
      const testReminder = await reminderService.createCustomReminder(userId, {
        title: 'Test Reminder',
        message: 'This is a test reminder to verify delivery channels are working correctly.',
        scheduled_for: new Date(), // Send immediately
        channels: channels
      });

      logger.info(`Test reminder created: ${testReminder.id} for user: ${userId}`);
      
      res.status(201).json({
        message: 'Test reminder created and will be processed shortly',
        reminder: testReminder
      });
    } catch (error) {
      logger.error('Error creating test reminder:', error);
      res.status(500).json({ error: 'Failed to create test reminder' });
    }
  }
);

// GET /api/v1/reminders/upcoming - Get upcoming reminders (next 24 hours)
router.get('/upcoming', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const upcomingReminders = await reminderService.getUserReminders(userId, {
      status: 'pending',
      upcoming_days: 1
    });

    // Group by time until scheduled
    const now = new Date();
    const groupedReminders = {
      next_hour: [],
      next_6_hours: [],
      next_24_hours: []
    };

    for (const reminder of upcomingReminders) {
      const scheduledTime = new Date(reminder.scheduled_for);
      const hoursUntil = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil <= 1) {
        groupedReminders.next_hour.push(reminder);
      } else if (hoursUntil <= 6) {
        groupedReminders.next_6_hours.push(reminder);
      } else if (hoursUntil <= 24) {
        groupedReminders.next_24_hours.push(reminder);
      }
    }

    res.json({
      grouped_reminders: groupedReminders,
      total: upcomingReminders.length
    });
  } catch (error) {
    logger.error('Error fetching upcoming reminders:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming reminders' });
  }
});

export default router;