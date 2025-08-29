import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Basic health check
router.get('/', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'application-service',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'application-service',
      error: 'Database connection failed'
    });
  }
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'application-service',
    version: '1.0.0',
    checks: {
      database: 'unknown',
      memory: 'unknown',
      uptime: process.uptime()
    }
  };

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.checks.database = 'healthy';
  } catch (error) {
    healthCheck.checks.database = 'unhealthy';
    healthCheck.status = 'degraded';
  }

  // Memory check
  const memUsage = process.memoryUsage();
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024)
  };

  healthCheck.checks.memory = memUsageMB.heapUsed < 500 ? 'healthy' : 'warning';

  const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

export default router;