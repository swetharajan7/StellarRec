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
      service: 'content-discovery',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      dependencies: {
        userService: process.env.USER_SERVICE_URL,
        searchService: process.env.SEARCH_SERVICE_URL
      }
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'content-discovery',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET /health/detailed - Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const healthChecks = {
      database: false,
      services: {
        recommendation: false,
        trending: false,
        discovery: false,
        behaviorTracking: false,
        personalization: false
      },
      memory: false
    };

    // Database health check
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthChecks.database = true;
    } catch (error) {
      logger.error('Database health check failed:', error);
    }

    // Memory health check
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 1 * 1024 * 1024 * 1024; // 1GB
    healthChecks.memory = memoryUsage.heapUsed < memoryThreshold;

    // Service health checks
    try {
      const { 
        recommendationService, 
        trendingService, 
        discoveryService, 
        behaviorTrackingService, 
        personalizationService 
      } = req.app.locals.services;
      
      healthChecks.services.recommendation = !!recommendationService;
      healthChecks.services.trending = !!trendingService;
      healthChecks.services.discovery = !!discoveryService;
      healthChecks.services.behaviorTracking = !!behaviorTrackingService;
      healthChecks.services.personalization = !!personalizationService;
    } catch (error) {
      logger.error('Service health check failed:', error);
    }

    const allHealthy = Object.values(healthChecks).every(check => {
      if (typeof check === 'object') {
        return Object.values(check).every(subCheck => subCheck === true);
      }
      return check === true;
    });

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'unhealthy',
      service: 'content-discovery',
      checks: healthChecks,
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
      },
      uptime: Math.round(process.uptime()) + ' seconds',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'content-discovery',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;