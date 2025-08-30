import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { DeadlineService } from '../services/deadlineService';

const router = Router();
const prisma = new PrismaClient();
const deadlineService = new DeadlineService(prisma);

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Validation middleware
const validateDeadline = [
  body('title').isLength({ min: 1, max: 255 }).withMessage('Deadline title is required'),
  body('description').optional().isLength({ max: 1000 }),
  body('due_date').isISO8601().withMessage('Valid due date is required'),
  body('type').isIn(['application', 'essay', 'test', 'document', 'interview', 'other']),
  body('priority').isIn(['low', 'medium', 'high', 'critical']),
  body('university_id').optional().isUUID(),
  body('application_id').optional().isUUID()
];

// GET /api/v1/deadlines - Get user's deadlines
router.get('/', 
  query('status').optional().isIn(['upcoming', 'due_soon', 'overdue', 'completed']),
  query('type').optional().isIn(['application', 'essay', 'test', 'document', 'interview', 'other']),
  query('university_id').optional().isUUID(),
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
        university_id: req.query.university_id as string,
        upcoming_days: req.query.upcoming_days ? parseInt(req.query.upcoming_days as string) : undefined
      };

      const deadlines = await deadlineService.getUserDeadlines(userId, filters);
      
      res.json({
        deadlines,
        total: deadlines.length
      });
    } catch (error) {
      logger.error('Error fetching deadlines:', error);
      res.status(500).json({ error: 'Failed to fetch deadlines' });
    }
  }
);

// POST /api/v1/deadlines - Create new deadline
router.post('/',
  validateDeadline,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const deadlineData = {
        title: req.body.title,
        description: req.body.description,
        due_date: new Date(req.body.due_date),
        type: req.body.type,
        priority: req.body.priority,
        university_id: req.body.university_id,
        application_id: req.body.application_id,
        user_id: userId,
        reminder_settings: req.body.reminder_settings || {
          enabled: true,
          intervals: [7, 3, 1], // 1 week, 3 days, 1 day before
          channels: ['email']
        }
      };

      const deadline = await deadlineService.createDeadline(deadlineData);
      logger.info(`Deadline created: ${deadline.id} by user: ${userId}`);
      
      res.status(201).json(deadline);
    } catch (error) {
      logger.error('Error creating deadline:', error);
      res.status(500).json({ error: 'Failed to create deadline' });
    }
  }
);

// PUT /api/v1/deadlines/:id - Update deadline
router.put('/:id',
  param('id').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const deadlineId = req.params.id;
      const userId = req.user!.id;

      // Verify deadline ownership
      const existingDeadline = await prisma.deadlines.findUnique({
        where: { id: deadlineId }
      });

      if (!existingDeadline || existingDeadline.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updates = req.body;
      if (updates.due_date) {
        updates.due_date = new Date(updates.due_date);
      }

      const deadline = await deadlineService.updateDeadline(deadlineId, updates);
      logger.info(`Deadline updated: ${deadlineId}`);
      
      res.json(deadline);
    } catch (error) {
      logger.error('Error updating deadline:', error);
      res.status(500).json({ error: 'Failed to update deadline' });
    }
  }
);

// DELETE /api/v1/deadlines/:id - Delete deadline
router.delete('/:id',
  param('id').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const deadlineId = req.params.id;
      const userId = req.user!.id;

      // Verify deadline ownership
      const existingDeadline = await prisma.deadlines.findUnique({
        where: { id: deadlineId }
      });

      if (!existingDeadline || existingDeadline.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await deadlineService.deleteDeadline(deadlineId);
      logger.info(`Deadline deleted: ${deadlineId}`);
      
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting deadline:', error);
      res.status(500).json({ error: 'Failed to delete deadline' });
    }
  }
);

// GET /api/v1/deadlines/analytics - Get deadline analytics
router.get('/analytics',
  query('timeframe').optional().isIn(['week', 'month', 'quarter']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const timeframe = (req.query.timeframe as 'week' | 'month' | 'quarter') || 'month';

      const analytics = await deadlineService.getDeadlineAnalytics(userId, timeframe);
      res.json(analytics);
    } catch (error) {
      logger.error('Error fetching deadline analytics:', error);
      res.status(500).json({ error: 'Failed to fetch deadline analytics' });
    }
  }
);

// GET /api/v1/deadlines/conflicts - Detect deadline conflicts
router.get('/conflicts', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conflicts = await deadlineService.detectDeadlineConflicts(userId);
    res.json(conflicts);
  } catch (error) {
    logger.error('Error detecting deadline conflicts:', error);
    res.status(500).json({ error: 'Failed to detect deadline conflicts' });
  }
});

// POST /api/v1/deadlines/from-application/:applicationId - Create deadlines from application
router.post('/from-application/:applicationId',
  param('applicationId').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const applicationId = req.params.applicationId;
      const userId = req.user!.id;

      // Verify application ownership
      const application = await prisma.applications.findUnique({
        where: { id: applicationId }
      });

      if (!application || application.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const deadlines = await deadlineService.createDeadlineFromApplication(applicationId);
      logger.info(`Created ${deadlines.length} deadlines from application: ${applicationId}`);
      
      res.status(201).json({
        deadlines,
        total: deadlines.length
      });
    } catch (error) {
      logger.error('Error creating deadlines from application:', error);
      res.status(500).json({ error: 'Failed to create deadlines from application' });
    }
  }
);

// GET /api/v1/deadlines/upcoming - Get upcoming deadlines (next 7 days)
router.get('/upcoming', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const upcomingDeadlines = await deadlineService.getUserDeadlines(userId, {
      upcoming_days: 7,
      status: 'upcoming'
    });

    // Group by days until due
    const groupedDeadlines = {
      today: [],
      tomorrow: [],
      this_week: [],
      overdue: []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    for (const deadline of upcomingDeadlines) {
      const dueDate = new Date(deadline.due_date);
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

      if (dueDateOnly < today) {
        groupedDeadlines.overdue.push(deadline);
      } else if (dueDateOnly.getTime() === today.getTime()) {
        groupedDeadlines.today.push(deadline);
      } else if (dueDateOnly.getTime() === tomorrow.getTime()) {
        groupedDeadlines.tomorrow.push(deadline);
      } else if (dueDateOnly <= nextWeek) {
        groupedDeadlines.this_week.push(deadline);
      }
    }

    res.json({
      grouped_deadlines: groupedDeadlines,
      total: upcomingDeadlines.length
    });
  } catch (error) {
    logger.error('Error fetching upcoming deadlines:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming deadlines' });
  }
});

export default router;