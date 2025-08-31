import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

router.get('/', [
  query('service').optional().isString(),
  query('level').optional().isIn(['error', 'warn', 'info', 'debug']),
  query('startTime').optional().isISO8601(),
  query('endTime').optional().isISO8601(),
  query('search').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const { loggingService } = req.app.locals.services;
  
  const query = {
    service: req.query.service as string,
    level: req.query.level as string,
    startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
    endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
    search: req.query.search as string,
    limit: req.query.limit as number || 100,
    offset: req.query.offset as number || 0
  };
  
  const result = await loggingService.queryLogs(query);
  
  res.status(200).json({
    success: true,
    data: result
  });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { loggingService } = req.app.locals.services;
  const logEntry = req.body;
  
  if (!logEntry.level || !logEntry.message || !logEntry.service) {
    throw createError('Missing required fields: level, message, service', 400);
  }
  
  const logId = await loggingService.logEntry({
    ...logEntry,
    timestamp: logEntry.timestamp ? new Date(logEntry.timestamp) : new Date()
  });
  
  res.status(201).json({
    success: true,
    data: { logId },
    message: 'Log entry created successfully'
  });
}));

router.get('/aggregations', [
  query('timeframe').optional().isIn(['hour', 'day', 'week', 'month']),
  query('services').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const { loggingService } = req.app.locals.services;
  
  const timeframe = (req.query.timeframe as 'hour' | 'day' | 'week' | 'month') || 'day';
  const services = req.query.services ? (req.query.services as string).split(',') : undefined;
  
  const aggregations = await loggingService.getLogAggregations(timeframe, services);
  
  res.status(200).json({
    success: true,
    data: aggregations
  });
}));

router.get('/trends/errors', [
  query('timeframe').optional().isIn(['hour', 'day', 'week'])
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const { loggingService } = req.app.locals.services;
  
  const timeframe = (req.query.timeframe as 'hour' | 'day' | 'week') || 'day';
  const trends = await loggingService.getErrorTrends(timeframe);
  
  res.status(200).json({
    success: true,
    data: trends
  });
}));

router.get('/service/:serviceName/stats', asyncHandler(async (req, res) => {
  const { serviceName } = req.params;
  const { loggingService } = req.app.locals.services;
  
  const stats = await loggingService.getServiceLogStats(serviceName);
  
  res.status(200).json({
    success: true,
    data: stats
  });
}));

router.post('/collect', asyncHandler(async (req, res) => {
  const { loggingService } = req.app.locals.services;
  
  await loggingService.collectLogsFromServices();
  
  res.status(200).json({
    success: true,
    message: 'Log collection initiated'
  });
}));

export default router;