import { Router } from 'express';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  const { metricsCollectionService } = req.app.locals.services;
  
  const metrics = await metricsCollectionService.collectMetrics();
  
  res.status(200).json({
    success: true,
    data: metrics
  });
}));

router.get('/service/:serviceName', asyncHandler(async (req, res) => {
  const { serviceName } = req.params;
  const { metricsCollectionService } = req.app.locals.services;
  
  const metrics = await metricsCollectionService.getMetricsForService(serviceName);
  
  if (!metrics) {
    throw createError(`Metrics not found for service: ${serviceName}`, 404);
  }
  
  res.status(200).json({
    success: true,
    data: metrics
  });
}));

router.get('/aggregated', asyncHandler(async (req, res) => {
  const { metricsCollectionService } = req.app.locals.services;
  
  const aggregatedMetrics = await metricsCollectionService.getAggregatedMetrics();
  
  res.status(200).json({
    success: true,
    data: aggregatedMetrics
  });
}));

router.post('/record', asyncHandler(async (req, res) => {
  const { metricsCollectionService } = req.app.locals.services;
  const metricData = req.body;
  
  if (!metricData.name || !metricData.type || metricData.value === undefined) {
    throw createError('Missing required fields: name, type, value', 400);
  }
  
  await metricsCollectionService.recordMetric(metricData);
  
  res.status(201).json({
    success: true,
    message: 'Metric recorded successfully'
  });
}));

router.get('/export/prometheus', asyncHandler(async (req, res) => {
  const { metricsCollectionService } = req.app.locals.services;
  
  await metricsCollectionService.exportMetricsToPrometheus();
  
  res.set('Content-Type', metricsCollectionService.getContentType());
  res.end(metricsCollectionService.getMetrics());
}));

export default router;