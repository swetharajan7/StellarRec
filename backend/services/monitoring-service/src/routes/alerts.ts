import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { asyncHandler, createError } from '../middleware/errorHandler';

const router = Router();

router.get('/', [
  query('status').optional().isIn(['active', 'resolved', 'acknowledged']),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('service').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const { alertingService } = req.app.locals.services;
  
  const activeAlerts = await alertingService.getActiveAlerts();
  
  // Filter alerts based on query parameters
  let filteredAlerts = activeAlerts;
  
  if (req.query.status) {
    filteredAlerts = filteredAlerts.filter(alert => alert.status === req.query.status);
  }
  
  if (req.query.severity) {
    filteredAlerts = filteredAlerts.filter(alert => alert.severity === req.query.severity);
  }
  
  if (req.query.service) {
    filteredAlerts = filteredAlerts.filter(alert => alert.service === req.query.service);
  }
  
  res.status(200).json({
    success: true,
    data: filteredAlerts
  });
}));

router.get('/history', [
  query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
  query('offset').optional().isInt({ min: 0 }).toInt()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid query parameters', 400);
  }

  const { alertingService } = req.app.locals.services;
  
  const limit = req.query.limit as number || 100;
  const offset = req.query.offset as number || 0;
  
  const history = await alertingService.getAlertHistory(limit, offset);
  
  res.status(200).json({
    success: true,
    data: history
  });
}));

router.get('/rules', asyncHandler(async (req, res) => {
  const { alertingService } = req.app.locals.services;
  
  const rules = await alertingService.getAlertRules();
  
  res.status(200).json({
    success: true,
    data: rules
  });
}));

router.post('/rules', [
  body('name').isString().notEmpty(),
  body('description').isString().notEmpty(),
  body('condition').isString().notEmpty(),
  body('threshold').isNumeric(),
  body('severity').isIn(['low', 'medium', 'high', 'critical']),
  body('metric').isString().notEmpty(),
  body('operator').isIn(['gt', 'lt', 'eq', 'gte', 'lte']),
  body('timeWindow').isInt({ min: 1 }),
  body('cooldown').isInt({ min: 1 }),
  body('channels').isArray(),
  body('enabled').isBoolean(),
  body('service').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid request body', 400);
  }

  const { alertingService } = req.app.locals.services;
  
  const rule = await alertingService.createAlertRule(req.body);
  
  res.status(201).json({
    success: true,
    data: rule,
    message: 'Alert rule created successfully'
  });
}));

router.put('/rules/:ruleId', [
  body('name').optional().isString().notEmpty(),
  body('description').optional().isString().notEmpty(),
  body('condition').optional().isString().notEmpty(),
  body('threshold').optional().isNumeric(),
  body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
  body('metric').optional().isString().notEmpty(),
  body('operator').optional().isIn(['gt', 'lt', 'eq', 'gte', 'lte']),
  body('timeWindow').optional().isInt({ min: 1 }),
  body('cooldown').optional().isInt({ min: 1 }),
  body('channels').optional().isArray(),
  body('enabled').optional().isBoolean(),
  body('service').optional().isString()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid request body', 400);
  }

  const { ruleId } = req.params;
  const { alertingService } = req.app.locals.services;
  
  const rule = await alertingService.updateAlertRule(ruleId, req.body);
  
  res.status(200).json({
    success: true,
    data: rule,
    message: 'Alert rule updated successfully'
  });
}));

router.delete('/rules/:ruleId', asyncHandler(async (req, res) => {
  const { ruleId } = req.params;
  const { alertingService } = req.app.locals.services;
  
  await alertingService.deleteAlertRule(ruleId);
  
  res.status(200).json({
    success: true,
    message: 'Alert rule deleted successfully'
  });
}));

router.post('/:alertId/acknowledge', [
  body('acknowledgedBy').isString().notEmpty()
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw createError('Invalid request body', 400);
  }

  const { alertId } = req.params;
  const { acknowledgedBy } = req.body;
  const { alertingService } = req.app.locals.services;
  
  await alertingService.acknowledgeAlert(alertId, acknowledgedBy);
  
  res.status(200).json({
    success: true,
    message: 'Alert acknowledged successfully'
  });
}));

router.post('/:alertId/resolve', asyncHandler(async (req, res) => {
  const { alertId } = req.params;
  const { alertingService } = req.app.locals.services;
  
  await alertingService.resolveAlert(alertId);
  
  res.status(200).json({
    success: true,
    message: 'Alert resolved successfully'
  });
}));

export default router;