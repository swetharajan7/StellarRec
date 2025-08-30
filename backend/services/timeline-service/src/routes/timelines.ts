import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { TimelineService } from '../services/timelineService';

const router = Router();
const prisma = new PrismaClient();
const timelineService = new TimelineService(prisma);

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// Validation middleware
const validateTimeline = [
  body('name').isLength({ min: 1, max: 255 }).withMessage('Timeline name is required'),
  body('description').optional().isLength({ max: 1000 })
];

const validateTimelineItem = [
  body('title').isLength({ min: 1, max: 255 }).withMessage('Item title is required'),
  body('description').optional().isLength({ max: 1000 }),
  body('due_date').isISO8601().withMessage('Valid due date is required'),
  body('priority').isIn(['low', 'medium', 'high', 'critical']),
  body('category').isIn(['application', 'essay', 'recommendation', 'test', 'document', 'other']),
  body('estimated_duration_hours').optional().isFloat({ min: 0.5, max: 100 })
];

// GET /api/v1/timelines - Get user's timelines
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const timelines = await timelineService.getUserTimelines(userId);
    
    res.json({
      timelines,
      total: timelines.length
    });
  } catch (error) {
    logger.error('Error fetching timelines:', error);
    res.status(500).json({ error: 'Failed to fetch timelines' });
  }
});

// GET /api/v1/timelines/:id - Get specific timeline
router.get('/:id',
  param('id').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const timelineId = req.params.id;
      const timeline = await timelineService.getTimeline(timelineId);

      // Check if user owns this timeline
      if (timeline.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(timeline);
    } catch (error) {
      logger.error('Error fetching timeline:', error);
      if (error.message === 'Timeline not found') {
        res.status(404).json({ error: 'Timeline not found' });
      } else {
        res.status(500).json({ error: 'Failed to fetch timeline' });
      }
    }
  }
);

// POST /api/v1/timelines - Create new timeline
router.post('/',
  validateTimeline,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const timelineData = {
        name: req.body.name,
        description: req.body.description
      };

      const timeline = await timelineService.createTimeline(userId, timelineData);
      logger.info(`Timeline created: ${timeline.id} by user: ${userId}`);
      
      res.status(201).json(timeline);
    } catch (error) {
      logger.error('Error creating timeline:', error);
      res.status(500).json({ error: 'Failed to create timeline' });
    }
  }
);

// POST /api/v1/timelines/generate-smart - Generate smart timeline
router.post('/generate-smart',
  body('applications').isArray().withMessage('Applications array is required'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const applications = req.body.applications;

      const timeline = await timelineService.generateSmartTimeline(userId, applications);
      logger.info(`Smart timeline generated: ${timeline.id} for user: ${userId}`);
      
      res.status(201).json(timeline);
    } catch (error) {
      logger.error('Error generating smart timeline:', error);
      res.status(500).json({ error: 'Failed to generate smart timeline' });
    }
  }
);

// POST /api/v1/timelines/:id/items - Add item to timeline
router.post('/:id/items',
  param('id').isUUID(),
  validateTimelineItem,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const timelineId = req.params.id;
      
      // Verify timeline ownership
      const timeline = await timelineService.getTimeline(timelineId);
      if (timeline.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const itemData = {
        title: req.body.title,
        description: req.body.description,
        due_date: new Date(req.body.due_date),
        priority: req.body.priority,
        category: req.body.category,
        status: req.body.status || 'pending',
        estimated_duration_hours: req.body.estimated_duration_hours,
        dependencies: req.body.dependencies,
        university_id: req.body.university_id,
        application_id: req.body.application_id
      };

      const item = await timelineService.addTimelineItem(timelineId, itemData);
      logger.info(`Timeline item added: ${item.id} to timeline: ${timelineId}`);
      
      res.status(201).json(item);
    } catch (error) {
      logger.error('Error adding timeline item:', error);
      res.status(500).json({ error: 'Failed to add timeline item' });
    }
  }
);

// PUT /api/v1/timelines/items/:itemId - Update timeline item
router.put('/items/:itemId',
  param('itemId').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const itemId = req.params.itemId;
      
      // Verify item ownership through timeline
      const item = await prisma.timeline_items.findUnique({
        where: { id: itemId },
        include: {
          timeline: {
            select: {
              user_id: true
            }
          }
        }
      });

      if (!item || item.timeline.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updates = req.body;
      if (updates.due_date) {
        updates.due_date = new Date(updates.due_date);
      }

      const updatedItem = await timelineService.updateTimelineItem(itemId, updates);
      logger.info(`Timeline item updated: ${itemId}`);
      
      res.json(updatedItem);
    } catch (error) {
      logger.error('Error updating timeline item:', error);
      res.status(500).json({ error: 'Failed to update timeline item' });
    }
  }
);

// DELETE /api/v1/timelines/items/:itemId - Delete timeline item
router.delete('/items/:itemId',
  param('itemId').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const itemId = req.params.itemId;
      
      // Verify item ownership through timeline
      const item = await prisma.timeline_items.findUnique({
        where: { id: itemId },
        include: {
          timeline: {
            select: {
              user_id: true
            }
          }
        }
      });

      if (!item || item.timeline.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await timelineService.deleteTimelineItem(itemId);
      logger.info(`Timeline item deleted: ${itemId}`);
      
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting timeline item:', error);
      res.status(500).json({ error: 'Failed to delete timeline item' });
    }
  }
);

// POST /api/v1/timelines/:id/optimize - Optimize timeline
router.post('/:id/optimize',
  param('id').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const timelineId = req.params.id;
      
      // Verify timeline ownership
      const timeline = await timelineService.getTimeline(timelineId);
      if (timeline.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const optimization = await timelineService.optimizeTimeline(timelineId);
      logger.info(`Timeline optimized: ${timelineId}`);
      
      res.json(optimization);
    } catch (error) {
      logger.error('Error optimizing timeline:', error);
      res.status(500).json({ error: 'Failed to optimize timeline' });
    }
  }
);

// GET /api/v1/timelines/:id/analytics - Get timeline analytics
router.get('/:id/analytics',
  param('id').isUUID(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const timelineId = req.params.id;
      
      // Verify timeline ownership
      const timeline = await timelineService.getTimeline(timelineId);
      if (timeline.user_id !== req.user!.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const analytics = await timelineService.getTimelineAnalytics(timelineId);
      res.json(analytics);
    } catch (error) {
      logger.error('Error fetching timeline analytics:', error);
      res.status(500).json({ error: 'Failed to fetch timeline analytics' });
    }
  }
);

export default router;