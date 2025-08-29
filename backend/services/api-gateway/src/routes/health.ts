import express from 'express';
import { createClient } from 'redis';
import { APIResponse } from '@stellarrec/types';

const router = express.Router();

// Redis client for health checks
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', () => {
  // Silently handle Redis connection errors for health checks
});

redisClient.connect().catch(() => {
  // Silently handle Redis connection errors
});

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
        redis: 'checking...',
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    },
  };

  // Check Redis connection
  try {
    await redisClient.ping();
    healthCheck.data.services.redis = 'healthy';
  } catch (error) {
    healthCheck.data.services.redis = 'unhealthy';
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
        redis: 'checking...',
        memory: 'checking...',
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    },
  };

  let allChecksPass = true;

  // Check Redis connection
  try {
    await redisClient.ping();
    readinessCheck.data.checks.redis = 'ready';
  } catch (error) {
    readinessCheck.data.checks.redis = 'not ready';
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