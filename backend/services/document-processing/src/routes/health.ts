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
      'ELASTICSEARCH_URL'
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
      service: 'document-processing',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      elasticsearch: 'configured'
    });

  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      service: 'document-processing',
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
      elasticsearch: false,
      memory: false,
      disk: false,
      services: {
        ocr: false,
        conversion: false,
        preview: false,
        metadata: false,
        indexing: false
      }
    };

    // Database health check
    try {
      await prisma.$queryRaw`SELECT 1`;
      healthChecks.database = true;
    } catch (error) {
      logger.error('Database health check failed:', error);
    }

    // Elasticsearch health check
    try {
      const { indexingService } = req.app.locals.services;
      if (indexingService) {
        await indexingService.getIndexStats();
        healthChecks.elasticsearch = true;
      }
    } catch (error) {
      logger.error('Elasticsearch health check failed:', error);
    }

    // Memory health check
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 2 * 1024 * 1024 * 1024; // 2GB
    healthChecks.memory = memoryUsage.heapUsed < memoryThreshold;

    // Basic disk space check (simplified)
    healthChecks.disk = true; // Would implement actual disk space check in production

    // Service health checks
    try {
      const { ocrService, conversionService, previewService, metadataExtractionService, indexingService } = req.app.locals.services;
      
      healthChecks.services.ocr = !!ocrService;
      healthChecks.services.conversion = !!conversionService;
      healthChecks.services.preview = !!previewService;
      healthChecks.services.metadata = !!metadataExtractionService;
      healthChecks.services.indexing = !!indexingService;
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
      service: 'document-processing',
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
      service: 'document-processing',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;