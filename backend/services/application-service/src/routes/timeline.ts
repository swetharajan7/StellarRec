import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient, EventStatus, PriorityLevel } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Validation middleware
const validateTimelineEvent = [
  body('application_id').isUUID().withMessage('Valid application ID is required'),
  body('event_type').isString().isLength({ min: 1, max: 50 }),
  body('title').isString().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('due_date').optional().isISO8601(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical'])
];

// GET /api/v1/timeline - Get timeline events for applications
router.get('/',
  query('application_id').optional().isUUID(),
  query('student_id').optional().isUUID(),
  query('status').optional().isIn(['pending', 'completed', 'overdue']),
  query('event_type').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const applicationId = req.query.application_id as string;
      const studentId = req.query.student_id as string || (req as any).user.user_id;
      const status = req.query.status as EventStatus;
      const eventType = req.query.event_type as string;
      const limit = parseInt(req.query.limit as string) || 50;

      const where: any = {};

      if (applicationId) {
        where.application_id = applicationId;
      } else if (studentId) {
        where.application = {
          student_id: studentId
        };
      }

      if (status) {
        where.status = status;
      }

      if (eventType) {
        where.event_type = eventType;
      }

      const timelineEvents = await prisma.timeline_events.findMany({
        where,
        include: {
          application: {
            include: {
              university: {
                select: {
                  name: true,
                  short_name: true
                }
              },
              program: {
                select: {
                  name: true,
                  degree: true
                }
              }
            }
          }
        },
        orderBy: [
          { due_date: 'asc' },
          { priority: 'desc' },
          { created_at: 'desc' }
        ],
        take: limit
      });

      res.json({
        timeline_events: timelineEvents,
        total: timelineEvents.length
      });
    } catch (error) {
      logger.error('Error fetching timeline events:', error);
      res.status(500).json({ error: 'Failed to fetch timeline events' });
    }
  }
);

// GET /api/v1/timeline/:id - Get specific timeline event
router.get('/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const eventId = req.params.id;
      const timelineEvent = await prisma.timeline_events.findUnique({
        where: { id: eventId },
        include: {
          application: {
            include: {
              university: {
                select: {
                  name: true,
                  short_name: true
                }
              },
              program: {
                select: {
                  name: true,
                  degree: true
                }
              }
            }
          }
        }
      });

      if (!timelineEvent) {
        return res.status(404).json({ error: 'Timeline event not found' });
      }

      res.json(timelineEvent);
    } catch (error) {
      logger.error('Error fetching timeline event:', error);
      res.status(500).json({ error: 'Failed to fetch timeline event' });
    }
  }
);

// POST /api/v1/timeline - Create new timeline event
router.post('/',
  validateTimelineEvent,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const eventData = {
        application_id: req.body.application_id,
        event_type: req.body.event_type,
        title: req.body.title,
        description: req.body.description,
        due_date: req.body.due_date ? new Date(req.body.due_date) : null,
        priority: req.body.priority || 'medium',
        status: 'pending' as EventStatus
      };

      const timelineEvent = await prisma.timeline_events.create({
        data: eventData,
        include: {
          application: {
            include: {
              university: {
                select: {
                  name: true,
                  short_name: true
                }
              },
              program: {
                select: {
                  name: true,
                  degree: true
                }
              }
            }
          }
        }
      });

      logger.info(`Timeline event created: ${timelineEvent.id}`);
      res.status(201).json(timelineEvent);
    } catch (error) {
      logger.error('Error creating timeline event:', error);
      res.status(500).json({ error: 'Failed to create timeline event' });
    }
  }
);

// PUT /api/v1/timeline/:id - Update timeline event
router.put('/:id',
  param('id').isUUID(),
  body('status').optional().isIn(['pending', 'completed', 'overdue']),
  body('title').optional().isString().isLength({ min: 1, max: 200 }),
  body('description').optional().isString().isLength({ max: 1000 }),
  body('due_date').optional().isISO8601(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const eventId = req.params.id;
      const updateData: any = { ...req.body };

      // Set completed_at when status changes to completed
      if (updateData.status === 'completed' && req.body.status !== 'completed') {
        updateData.completed_at = new Date();
      }

      // Convert due_date string to Date object
      if (updateData.due_date) {
        updateData.due_date = new Date(updateData.due_date);
      }

      const timelineEvent = await prisma.timeline_events.update({
        where: { id: eventId },
        data: updateData,
        include: {
          application: {
            include: {
              university: {
                select: {
                  name: true,
                  short_name: true
                }
              },
              program: {
                select: {
                  name: true,
                  degree: true
                }
              }
            }
          }
        }
      });

      logger.info(`Timeline event updated: ${eventId}`);
      res.json(timelineEvent);
    } catch (error) {
      logger.error('Error updating timeline event:', error);
      res.status(500).json({ error: 'Failed to update timeline event' });
    }
  }
);

// DELETE /api/v1/timeline/:id - Delete timeline event
router.delete('/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const eventId = req.params.id;
      
      await prisma.timeline_events.delete({
        where: { id: eventId }
      });

      logger.info(`Timeline event deleted: ${eventId}`);
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting timeline event:', error);
      res.status(500).json({ error: 'Failed to delete timeline event' });
    }
  }
);

// POST /api/v1/timeline/:id/complete - Mark timeline event as completed
router.post('/:id/complete',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const eventId = req.params.id;
      
      const timelineEvent = await prisma.timeline_events.update({
        where: { id: eventId },
        data: {
          status: 'completed',
          completed_at: new Date()
        },
        include: {
          application: {
            include: {
              university: {
                select: {
                  name: true,
                  short_name: true
                }
              },
              program: {
                select: {
                  name: true,
                  degree: true
                }
              }
            }
          }
        }
      });

      logger.info(`Timeline event completed: ${eventId}`);
      res.json(timelineEvent);
    } catch (error) {
      logger.error('Error completing timeline event:', error);
      res.status(500).json({ error: 'Failed to complete timeline event' });
    }
  }
);

// GET /api/v1/timeline/summary/:applicationId - Get timeline summary for application
router.get('/summary/:applicationId',
  param('applicationId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const applicationId = req.params.applicationId;
      
      const events = await prisma.timeline_events.findMany({
        where: { application_id: applicationId },
        orderBy: { due_date: 'asc' }
      });

      const summary = {
        total_events: events.length,
        completed: events.filter(e => e.status === 'completed').length,
        pending: events.filter(e => e.status === 'pending').length,
        overdue: events.filter(e => e.status === 'overdue').length,
        next_deadline: events.find(e => e.status === 'pending' && e.due_date)?.due_date,
        completion_percentage: events.length > 0 ? 
          Math.round((events.filter(e => e.status === 'completed').length / events.length) * 100) : 0
      };

      res.json(summary);
    } catch (error) {
      logger.error('Error fetching timeline summary:', error);
      res.status(500).json({ error: 'Failed to fetch timeline summary' });
    }
  }
);

export default router;