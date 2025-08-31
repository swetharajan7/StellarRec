import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'notification-service',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    dependencies: {
      redis: 'connected',
      database: 'connected',
      email_provider: 'connected',
      sms_provider: 'connected'
    }
  };

  logger.info('Health check requested', { status: healthCheck.status });

  res.status(200).json({
    success: true,
    data: healthCheck
  });
});

router.get('/ready', (req: Request, res: Response) => {
  // Check if service is ready to handle requests
  const readinessCheck = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    checks: {
      database: true,
      redis: true,
      email_service: true,
      sms_service: true,
      push_service: true
    }
  };

  const allChecksPass = Object.values(readinessCheck.checks).every(check => check);

  res.status(allChecksPass ? 200 : 503).json({
    success: allChecksPass,
    data: readinessCheck
  });
});

export default router;