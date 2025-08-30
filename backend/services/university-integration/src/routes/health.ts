import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /health - Health check endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check integration service health
    const activeIntegrations = await prisma.university_integrations.count({
      where: { is_active: true }
    });

    const recentSyncs = await prisma.university_integrations.count({
      where: {
        is_active: true,
        last_sync: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        },
        sync_status: 'success'
      }
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'university-integration',
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected',
      integrations: {
        active: activeIntegrations,
        recent_successful_syncs: recentSyncs
      },
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'university-integration',
      error: error.message
    });
  }
});

// GET /health/detailed - Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const checks = {
      database: false,
      integrations: false,
      webhooks: false
    };

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (error) {
      checks.database = false;
    }

    // Integration health check
    try {
      const integrationStats = await prisma.university_integrations.groupBy({
        by: ['sync_status'],
        _count: {
          sync_status: true
        },
        where: {
          is_active: true
        }
      });
      checks.integrations = true;
    } catch (error) {
      checks.integrations = false;
    }

    // Webhook health check
    try {
      const recentWebhooks = await prisma.webhook_logs.count({
        where: {
          created_at: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        }
      });
      checks.webhooks = true;
    } catch (error) {
      checks.webhooks = false;
    }

    const allHealthy = Object.values(checks).every(check => check === true);

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'university-integration',
      checks,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'university-integration',
      error: error.message
    });
  }
});

export default router;