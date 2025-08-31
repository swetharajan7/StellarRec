import { Router } from 'express';
import { query, validationResult } from 'express-validator';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { dashboardService } = req.app.locals.services;
  
  const dashboardData = await dashboardService.getDashboardData();
  
  res.status(200).json({
    success: true,
    data: dashboardData
  });
}));

router.get('/service/:serviceName/metrics', [
  query('metric').isIn(['responseTime', 'errorRate', 'throughput']),
  query('hours').optional().isInt({ min: 1, max: 168 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const { serviceName } = req.params;
  const metric = req.query.metric as 'responseTime' | 'errorRate' | 'throughput';
  const hours = req.query.hours as number || 24;
  
  const { dashboardService } = req.app.locals.services;
  
  const chartData = await dashboardService.getServiceMetricsChart(serviceName, metric, hours);
  
  res.status(200).json({
    success: true,
    data: chartData
  });
}));

router.get('/system/metrics', [
  query('metric').isIn(['cpu', 'memory', 'disk', 'load']),
  query('hours').optional().isInt({ min: 1, max: 168 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const metric = req.query.metric as 'cpu' | 'memory' | 'disk' | 'load';
  const hours = req.query.hours as number || 24;
  
  const { dashboardService } = req.app.locals.services;
  
  const chartData = await dashboardService.getSystemMetricsChart(metric, hours);
  
  res.status(200).json({
    success: true,
    data: chartData
  });
}));

router.get('/errors/trends', [
  query('hours').optional().isInt({ min: 1, max: 168 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const hours = req.query.hours as number || 24;
  
  const { dashboardService } = req.app.locals.services;
  
  const chartData = await dashboardService.getErrorTrendsChart(hours);
  
  res.status(200).json({
    success: true,
    data: chartData
  });
}));

router.get('/services/health', asyncHandler(async (req, res) => {
  const { dashboardService } = req.app.locals.services;
  
  const healthOverview = await dashboardService.getServiceHealthOverview();
  
  res.status(200).json({
    success: true,
    data: healthOverview
  });
}));

router.get('/errors/top', [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const limit = req.query.limit as number || 10;
  
  const { dashboardService } = req.app.locals.services;
  
  const topErrors = await dashboardService.getTopErrors(limit);
  
  res.status(200).json({
    success: true,
    data: topErrors
  });
}));

router.get('/alerts/summary', asyncHandler(async (req, res) => {
  const { dashboardService } = req.app.locals.services;
  
  const alertsSummary = await dashboardService.getAlertsSummary();
  
  res.status(200).json({
    success: true,
    data: alertsSummary
  });
}));

export default router;