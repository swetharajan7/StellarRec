import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { DeadlineService } from '../services/deadlineService';

const router = Router();
const prisma = new PrismaClient();
const deadlineService = new DeadlineService(prisma);

// GET /api/v1/deadlines/upcoming - Get upcoming deadlines
router.get('/upcoming',
  query('days').optional().isInt({ min: 1, max: 365 }),
  query('student_id').optional().isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const studentId = req.query.student_id as string || (req as any).user.user_id;
      const days = parseInt(req.query.days as string) || 30;

      const deadlines = await deadlineService.getUpcomingDeadlines(studentId, days);

      res.json({
        deadlines,
        total: deadlines.length,
        days_ahead: days
      });
    } catch (error) {
      logger.error('Error fetching upcoming deadlines:', error);
      res.status(500).json({ error: 'Failed to fetch upcoming deadlines' });
    }
  }
);

// GET /api/v1/deadlines/overdue - Get overdue tasks
router.get('/overdue',
  query('student_id').optional().isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const studentId = req.query.student_id as string || (req as any).user.user_id;
      const overdueTasks = await deadlineService.getOverdueTasks(studentId);

      res.json({
        overdue_tasks: overdueTasks,
        total: overdueTasks.length
      });
    } catch (error) {
      logger.error('Error fetching overdue tasks:', error);
      res.status(500).json({ error: 'Failed to fetch overdue tasks' });
    }
  }
);

// GET /api/v1/deadlines/calendar - Get calendar view of deadlines
router.get('/calendar',
  query('month').optional().isInt({ min: 1, max: 12 }),
  query('year').optional().isInt({ min: 2020, max: 2030 }),
  query('student_id').optional().isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const studentId = req.query.student_id as string || (req as any).user.user_id;
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      const year = parseInt(req.query.year as string) || new Date().getFullYear();

      // Get first and last day of the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const applications = await prisma.applications.findMany({
        where: {
          student_id: studentId,
          deadline: {
            gte: startDate,
            lte: endDate
          },
          deleted_at: null
        },
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
        },
        orderBy: {
          deadline: 'asc'
        }
      });

      const timeline_events = await prisma.timeline_events.findMany({
        where: {
          application: {
            student_id: studentId
          },
          due_date: {
            gte: startDate,
            lte: endDate
          },
          status: {
            in: ['pending', 'overdue']
          }
        },
        include: {
          application: {
            include: {
              university: {
                select: {
                  name: true
                }
              },
              program: {
                select: {
                  name: true
                }
              }
            }
          }
        },
        orderBy: {
          due_date: 'asc'
        }
      });

      // Group by date
      const calendar: { [key: string]: any[] } = {};

      applications.forEach(app => {
        const dateKey = app.deadline.toISOString().split('T')[0];
        if (!calendar[dateKey]) {
          calendar[dateKey] = [];
        }
        calendar[dateKey].push({
          type: 'deadline',
          id: app.id,
          title: `${app.university.short_name || app.university.name} Application Due`,
          description: `${app.program.name} (${app.program.degree})`,
          time: app.deadline,
          priority: 'critical',
          status: app.status,
          progress: app.progress_percentage
        });
      });

      timeline_events.forEach(event => {
        if (event.due_date) {
          const dateKey = event.due_date.toISOString().split('T')[0];
          if (!calendar[dateKey]) {
            calendar[dateKey] = [];
          }
          calendar[dateKey].push({
            type: 'task',
            id: event.id,
            title: event.title,
            description: event.description,
            time: event.due_date,
            priority: event.priority,
            status: event.status,
            university: event.application.university.name
          });
        }
      });

      res.json({
        month,
        year,
        calendar,
        total_deadlines: applications.length,
        total_tasks: timeline_events.length
      });
    } catch (error) {
      logger.error('Error fetching calendar deadlines:', error);
      res.status(500).json({ error: 'Failed to fetch calendar deadlines' });
    }
  }
);

// POST /api/v1/deadlines/check - Manually trigger deadline check
router.post('/check',
  async (req: Request, res: Response) => {
    try {
      await deadlineService.checkUpcomingDeadlines();
      
      res.json({
        message: 'Deadline check completed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error running deadline check:', error);
      res.status(500).json({ error: 'Failed to run deadline check' });
    }
  }
);

export default router;