import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };

  res.status(200).json({
    success: true,
    data: healthCheck
  });
}));

router.get('/detailed', asyncHandler(async (req, res) => {
  const { healthCheckService, systemMonitoringService } = req.app.locals.services;
  
  const [serviceHealth, systemOverview] = await Promise.all([
    healthCheckService.getSystemOverview(),
    systemMonitoringService.getSystemOverview()
  ]);

  const detailedHealth = {
    status: serviceHealth.uptime > 80 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      total: serviceHealth.totalServices,
      healthy: serviceHealth.healthyServices,
      unhealthy: serviceHealth.unhealthyServices,
      degraded: serviceHealth.degradedServices,
      uptime: serviceHealth.uptime
    },
    system: {
      status: systemOverview.status,
      cpu: systemOverview.cpuUsage,
      memory: systemOverview.memoryUsage,
      disk: systemOverview.diskUsage,
      uptime: systemOverview.uptime
    },
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform
    }
  };

  res.status(200).json({
    success: true,
    data: detailedHealth
  });
}));

export default router;