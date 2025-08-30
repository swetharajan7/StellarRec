import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /health - Health check endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check timeline service health
    const [activeTimelines, pendingReminders, upcomingDeadlines] = await Promise.all([
      prisma.timelines.count({
        where: {
          updated_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Active in last 7 days
          }
        }
      }),
      prisma.reminders.count({
        where: {
          status: 'pending',
          scheduled_for: {
            gte: new Date(),
            lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
          }
        }
      }),
      prisma.deadlines.count({
        where: {
          status: {
            in: ['upcoming', 'due_soon']
          }
        }
      })
    ]);

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'timeline-service',
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected',
      metrics: {
        active_timelines: activeTimelines,
        pending_reminders: pendingReminders,
        upcoming_deadlines: upcomingDeadlines
      },
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'timeline-service',
      error: error.message
    });
  }
});

// GET /health/detailed - Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const checks = {
      database: false,
      timelines: false,
      deadlines: false,
      reminders: false
    };

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      checks.database = false;
    }

    // Timeline service check
    try {
      await prisma.timelines.findFirst();
      checks.timelines = true;
    } catch (error) {
      checks.timelines = false;
    }

    // Deadline service check
    try {
      await prisma.deadlines.findFirst();
      checks.deadlines = true;
    } catch (error) {
      checks.deadlines = false;
    }

    // Reminder service check
    try {
      await prisma.reminders.findFirst();
      checks.reminders = true;
    } catch (error) {
      checks.reminders = false;
    }

    const allHealthy = Object.values(checks).every(check => check === true);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'timeline-service',
      checks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'timeline-service',
      error: error.message
    });
  }
});

export default router;