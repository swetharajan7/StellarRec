import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import ical from 'ical-generator';
import moment from 'moment-timezone';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// GET /api/v1/calendar/export - Export calendar as ICS
router.get('/export',
  query('format').optional().isIn(['ics', 'json']),
  query('include').optional().isIn(['deadlines', 'timeline', 'both']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const format = (req.query.format as string) || 'ics';
      const include = (req.query.include as string) || 'both';

      const events = [];

      // Get deadlines
      if (include === 'deadlines' || include === 'both') {
        const deadlines = await prisma.deadlines.findMany({
          where: {
            user_id: userId,
            status: {
              in: ['upcoming', 'due_soon']
            }
          },
          include: {
            university: {
              select: {
                name: true,
                short_name: true
              }
            }
          }
        });

        for (const deadline of deadlines) {
          events.push({
            id: deadline.id,
            title: deadline.title,
            description: deadline.description || '',
            start: deadline.due_date,
            end: deadline.due_date,
            type: 'deadline',
            priority: deadline.priority,
            university: deadline.university?.name,
            category: deadline.type
          });
        }
      }

      // Get timeline items
      if (include === 'timeline' || include === 'both') {
        const timelineItems = await prisma.timeline_items.findMany({
          where: {
            timeline: {
              user_id: userId
            },
            status: {
              in: ['pending', 'in_progress']
            }
          },
          include: {
            timeline: {
              select: {
                name: true
              }
            },
            university: {
              select: {
                name: true,
                short_name: true
              }
            }
          }
        });

        for (const item of timelineItems) {
          events.push({
            id: item.id,
            title: item.title,
            description: item.description || '',
            start: item.due_date,
            end: item.due_date,
            type: 'timeline_item',
            priority: item.priority,
            university: item.university?.name,
            category: item.category,
            timeline: item.timeline.name
          });
        }
      }

      if (format === 'json') {
        res.json({
          events,
          total: events.length,
          exported_at: new Date()
        });
      } else {
        // Generate ICS calendar
        const calendar = ical({
          domain: 'stellarrec.com',
          name: 'StellarRec Application Calendar',
          description: 'Your university application deadlines and timeline',
          timezone: 'UTC'
        });

        for (const event of events) {
          const calEvent = calendar.createEvent({
            id: event.id,
            start: moment(event.start),
            end: moment(event.end),
            summary: event.title,
            description: `${event.description}\n\nType: ${event.type}\nPriority: ${event.priority}${event.university ? `\nUniversity: ${event.university}` : ''}`,
            categories: [
              {
                name: event.category
              }
            ]
          });

          // Add alarm based on priority
          if (event.priority === 'critical') {
            calEvent.createAlarm({
              type: 'display',
              trigger: 60 * 60 * 24 // 1 day before
            });
            calEvent.createAlarm({
              type: 'display',
              trigger: 60 * 60 * 2 // 2 hours before
            });
          } else if (event.priority === 'high') {
            calEvent.createAlarm({
              type: 'display',
              trigger: 60 * 60 * 24 // 1 day before
            });
          }
        }

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="stellarrec-calendar.ics"');
        res.send(calendar.toString());
      }

      logger.info(`Calendar exported for user ${userId}: ${events.length} events`);
    } catch (error) {
      logger.error('Error exporting calendar:', error);
      res.status(500).json({ error: 'Failed to export calendar' });
    }
  }
);

// GET /api/v1/calendar/view - Get calendar view data
router.get('/view',
  query('start_date').isISO8601().withMessage('Valid start date is required'),
  query('end_date').isISO8601().withMessage('Valid end date is required'),
  query('view').optional().isIn(['month', 'week', 'day']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const startDate = new Date(req.query.start_date as string);
      const endDate = new Date(req.query.end_date as string);
      const view = (req.query.view as string) || 'month';

      // Get deadlines in date range
      const deadlines = await prisma.deadlines.findMany({
        where: {
          user_id: userId,
          due_date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          university: {
            select: {
              name: true,
              short_name: true
            }
          }
        },
        orderBy: {
          due_date: 'asc'
        }
      });

      // Get timeline items in date range
      const timelineItems = await prisma.timeline_items.findMany({
        where: {
          timeline: {
            user_id: userId
          },
          due_date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          timeline: {
            select: {
              name: true
            }
          },
          university: {
            select: {
              name: true,
              short_name: true
            }
          }
        },
        orderBy: {
          due_date: 'asc'
        }
      });

      // Get reminders in date range
      const reminders = await prisma.reminders.findMany({
        where: {
          user_id: userId,
          scheduled_for: {
            gte: startDate,
            lte: endDate
          },
          status: 'pending'
        },
        include: {
          deadline: {
            select: {
              title: true,
              type: true
            }
          }
        },
        orderBy: {
          scheduled_for: 'asc'
        }
      });

      // Organize events by date
      const eventsByDate = {};
      const addEventToDate = (date: Date, event: any) => {
        const dateKey = moment(date).format('YYYY-MM-DD');
        if (!eventsByDate[dateKey]) {
          eventsByDate[dateKey] = [];
        }
        eventsByDate[dateKey].push(event);
      };

      // Add deadlines
      deadlines.forEach(deadline => {
        addEventToDate(deadline.due_date, {
          id: deadline.id,
          type: 'deadline',
          title: deadline.title,
          description: deadline.description,
          time: deadline.due_date,
          priority: deadline.priority,
          status: deadline.status,
          category: deadline.type,
          university: deadline.university?.name
        });
      });

      // Add timeline items
      timelineItems.forEach(item => {
        addEventToDate(item.due_date, {
          id: item.id,
          type: 'timeline_item',
          title: item.title,
          description: item.description,
          time: item.due_date,
          priority: item.priority,
          status: item.status,
          category: item.category,
          university: item.university?.name,
          timeline: item.timeline.name
        });
      });

      // Add reminders
      reminders.forEach(reminder => {
        addEventToDate(reminder.scheduled_for, {
          id: reminder.id,
          type: 'reminder',
          title: reminder.title,
          description: reminder.message,
          time: reminder.scheduled_for,
          priority: 'medium',
          status: reminder.status,
          category: 'reminder',
          deadline_title: reminder.deadline?.title
        });
      });

      // Generate calendar grid for month view
      let calendarGrid = null;
      if (view === 'month') {
        calendarGrid = generateMonthGrid(startDate, endDate, eventsByDate);
      }

      res.json({
        view,
        start_date: startDate,
        end_date: endDate,
        events_by_date: eventsByDate,
        calendar_grid: calendarGrid,
        summary: {
          total_events: deadlines.length + timelineItems.length + reminders.length,
          deadlines: deadlines.length,
          timeline_items: timelineItems.length,
          reminders: reminders.length
        }
      });
    } catch (error) {
      logger.error('Error fetching calendar view:', error);
      res.status(500).json({ error: 'Failed to fetch calendar view' });
    }
  }
);

// POST /api/v1/calendar/google/sync - Sync with Google Calendar (placeholder)
router.post('/google/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // This would integrate with Google Calendar API
    // For now, return a placeholder response
    logger.info(`Google Calendar sync requested for user: ${userId}`);
    
    res.json({
      message: 'Google Calendar sync is not yet implemented',
      status: 'coming_soon',
      user_id: userId
    });
  } catch (error) {
    logger.error('Error syncing with Google Calendar:', error);
    res.status(500).json({ error: 'Failed to sync with Google Calendar' });
  }
});

// POST /api/v1/calendar/outlook/sync - Sync with Outlook Calendar (placeholder)
router.post('/outlook/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // This would integrate with Microsoft Graph API
    // For now, return a placeholder response
    logger.info(`Outlook Calendar sync requested for user: ${userId}`);
    
    res.json({
      message: 'Outlook Calendar sync is not yet implemented',
      status: 'coming_soon',
      user_id: userId
    });
  } catch (error) {
    logger.error('Error syncing with Outlook Calendar:', error);
    res.status(500).json({ error: 'Failed to sync with Outlook Calendar' });
  }
});

function generateMonthGrid(startDate: Date, endDate: Date, eventsByDate: any) {
  const grid = [];
  const start = moment(startDate).startOf('month').startOf('week');
  const end = moment(endDate).endOf('month').endOf('week');
  
  let current = start.clone();
  
  while (current.isSameOrBefore(end, 'day')) {
    const week = [];
    
    for (let i = 0; i < 7; i++) {
      const dateKey = current.format('YYYY-MM-DD');
      const isCurrentMonth = current.isSame(startDate, 'month');
      const events = eventsByDate[dateKey] || [];
      
      week.push({
        date: current.format('YYYY-MM-DD'),
        day: current.date(),
        is_current_month: isCurrentMonth,
        is_today: current.isSame(moment(), 'day'),
        events: events,
        event_count: events.length,
        has_critical: events.some(e => e.priority === 'critical'),
        has_high: events.some(e => e.priority === 'high')
      });
      
      current.add(1, 'day');
    }
    
    grid.push(week);
  }
  
  return grid;
}

export default router;