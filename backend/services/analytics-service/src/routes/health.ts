import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// GET /health - Health check endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'USER_SERVICE_URL',
      'SEARCH_SERVICE_URL'
    ];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

    if (missingEnvVars.length > 0) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Missing required environment variables',
        missing: missingEnvVars,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      status: 'healthy',
      service: 'analytics-service',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      dependencies: {
        userService: process.env.USER_SERVICE_URL,
        searchService: process.env.SEARCH_SERVICE_URL,
        applicationService: process.env.APPLICATION_SERVICE_URL,
        contentDiscoveryService: process.env.CONTENT_DISCOVERY_URL
      }
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'analytics-service',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;