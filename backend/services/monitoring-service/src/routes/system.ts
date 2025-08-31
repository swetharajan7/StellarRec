import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

router.get('/metrics', asyncHandler(async (req, res) => {
  const { systemMonitoringService } = req.app.locals.services;
  
  const systemMetrics = await systemMonitoringService.getSystemMetrics();
  
  res.status(200).json({
    success: true,
    data: systemMetrics
  });
}));

router.get('/metrics/history', [
  query('hours').optional().isInt({ min: 1, max: 168 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const hours = req.query.hours as number || 24;
  const { systemMonitoringService } = req.app.locals.services;
  
  const history = await systemMonitoringService.getSystemHistory(hours);
  
  res.status(200).json({
    success: true,
    data: history
  });
}));

router.get('/overview', asyncHandler(async (req, res) => {
  const { systemMonitoringService } = req.app.locals.services;
  
  const overview = await systemMonitoringService.getSystemOverview();
  
  res.status(200).json({
    success: true,
    data: overview
  });
}));

router.post('/thresholds', [
  body('metric').isString().notEmpty(),
  body('warningThreshold').isNumeric(),
  body('criticalThreshold').isNumeric()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid request body', 400);
  }

  const { metric, warningThreshold, criticalThreshold } = req.body;
  const { systemMonitoringService } = req.app.locals.services;
  
  await systemMonitoringService.setSystemThreshold(metric, warningThreshold, criticalThreshold);
  
  res.status(201).json({
    success: true,
    message: 'System threshold set successfully'
  });
}));

router.get('/performance', asyncHandler(async (req, res) => {
  const { performanceMonitoringService } = req.app.locals.services;
  
  const performanceMetrics = await performanceMonitoringService.collectAllPerformanceMetrics();
  
  res.status(200).json({
    success: true,
    data: performanceMetrics
  });
}));

router.get('/performance/:serviceName', asyncHandler(async (req, res) => {
  const { serviceName } = req.params;
  const { performanceMonitoringService } = req.app.locals.services;
  
  const performanceMetrics = await performanceMonitoringService.collectPerformanceMetrics(serviceName);
  
  res.status(200).json({
    success: true,
    data: performanceMetrics
  });
}));

router.get('/performance/:serviceName/history', [
  query('hours').optional().isInt({ min: 1, max: 168 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const { serviceName } = req.params;
  const hours = req.query.hours as number || 24;
  const { performanceMonitoringService } = req.app.locals.services;
  
  const history = await performanceMonitoringService.getPerformanceHistory(serviceName, hours);
  
  res.status(200).json({
    success: true,
    data: history
  });
}));

router.get('/performance/aggregates', [
  query('serviceName').optional().isString(),
  query('timeframe').optional().isIn(['hour', 'day', 'week'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const serviceName = req.query.serviceName as string;
  const timeframe = (req.query.timeframe as 'hour' | 'day' | 'week') || 'day';
  const { performanceMonitoringService } = req.app.locals.services;
  
  const aggregates = await performanceMonitoringService.getPerformanceAggregates(serviceName, timeframe);
  
  res.status(200).json({
    success: true,
    data: aggregates
  });
}));

router.post('/performance/thresholds', [
  body('service').isString().notEmpty(),
  body('metric').isString().notEmpty(),
  body('warningThreshold').isNumeric(),
  body('criticalThreshold').isNumeric(),
  body('enabled').isBoolean()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid request body', 400);
  }

  const threshold = req.body;
  const { performanceMonitoringService } = req.app.locals.services;
  
  await performanceMonitoringService.setPerformanceThreshold(threshold);
  
  res.status(201).json({
    success: true,
    message: 'Performance threshold set successfully'
  });
}));

router.get('/performance/thresholds', [
  query('serviceName').optional().isString()
], asyncHandler(async (req, res) => {
  const serviceName = req.query.serviceName as string;
  const { performanceMonitoringService } = req.app.locals.services;
  
  const thresholds = await performanceMonitoringService.getPerformanceThresholds(serviceName);
  
  res.status(200).json({
    success: true,
    data: thresholds
  });
}));

router.get('/health', asyncHandler(async (req, res) => {
  const { healthCheckService } = req.app.locals.services;
  
  const healthChecks = await healthCheckService.performAllHealthChecks();
  
  res.status(200).json({
    success: true,
    data: healthChecks
  });
}));

router.get('/health/:serviceName', asyncHandler(async (req, res) => {
  const { serviceName } = req.params;
  const { healthCheckService } = req.app.locals.services;
  
  const healthCheck = await healthCheckService.performHealthCheck(serviceName);
  
  res.status(200).json({
    success: true,
    data: healthCheck
  });
}));

router.get('/health/:serviceName/history', [
  query('hours').optional().isInt({ min: 1, max: 168 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const { serviceName } = req.params;
  const hours = req.query.hours as number || 24;
  const { healthCheckService } = req.app.locals.services;
  
  const history = await healthCheckService.getHealthHistory(serviceName, hours);
  
  res.status(200).json({
    success: true,
    data: history
  });
}));

export default router;