import express from 'express';
import { prisma } from '../index';
import { APIResponse } from '@stellarrec/types';

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  const healthCheck: APIResponse = {
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'checking...',
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    },
  };

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    healthCheck.data.services.database = 'healthy';
  } catch (error) {
    healthCheck.data.services.database = 'unhealthy';
    healthCheck.success = false;
  }

  const statusCode = healthCheck.success ? 200 : 503;
  res.status(statusCode).json(healthCheck);
});

// Readiness check endpoint
router.get('/ready', async (req, res) => {
  const readinessCheck: APIResponse = {
    success: true,
    data: {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'checking...',
        memory: 'checking...',
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    },
  };

  let allChecksPass = true;

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    readinessCheck.data.checks.database = 'ready';
  } catch (error) {
    readinessCheck.data.checks.database = 'not ready';
    allChecksPass = false;
  }

  // Check memory usage
  const memoryUsage = process.memoryUsage();
  const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const memoryLimit = 512; // MB

  if (memoryUsageMB < memoryLimit) {
    readinessCheck.data.checks.memory = `ready (${memoryUsageMB}MB used)`;
  } else {
    readinessCheck.data.checks.memory = `not ready (${memoryUsageMB}MB used, limit: ${memoryLimit}MB)`;
    allChecksPass = false;
  }

  readinessCheck.success = allChecksPass;
  readinessCheck.data.status = allChecksPass ? 'ready' : 'not ready';

  const statusCode = allChecksPass ? 200 : 503;
  res.status(statusCode).json(readinessCheck);
});

export default router;