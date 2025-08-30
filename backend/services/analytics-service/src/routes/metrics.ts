import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/v1/metrics - Collect metric data
router.post('/',
  authMiddleware,
  body('metricName').isString().notEmpty(),
  body('metricType').isIn(['counter', 'gauge', 'histogram', 'summary']),
  body('value').isNumeric(),
  body('dimensions').optional().isObject(),
  body('source').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { metricsCollectionService } = req.app.locals.services;
      const userId = (req as any).user?.id;

      await metricsCollectionService.collectMetric({
        metricName: req.body.metricName,
        metricType: req.body.metricType,
        value: parseFloat(req.body.value),
        dimensions: req.body.dimensions || {},
        source: req.body.source,
        userId,
        sessionId: req.sessionID,
        timestamp: new Date()
      });

      res.json({
        success: true,
        message: 'Metric collected successfully'
      });

    } catch (error) {
      logger.error('Metrics collection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to collect metric'
      });
    }
  }
);

// POST /api/v1/metrics/batch - Collect multiple metrics
router.post('/batch',
  authMiddleware,
  body('metrics').isArray().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const { metricsCollectionService } = req.app.locals.services;
      const userId = (req as any).user?.id;

      const metrics = req.body.metrics.map((metric: any) => ({
        ...metric,
        userId,
        sessionId: req.sessionID,
        timestamp: new Date()
      }));

      await metricsCollectionService.collectMultipleMetrics(metrics);

      res.json({
        success: true,
        message: `${metrics.length} metrics collected successfully`
      });

    } catch (error) {
      logger.error('Batch metrics collection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to collect metrics'
      });
    }
  }
);

// GET /api/v1/metrics/query - Query metrics
router.get('/query',
  query('metricNames').optional().isArray(),
  query('startTime').optional().isISO8601(),
  query('endTime').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  async (req: Request, res: Response) => {
    try {
      const { metricsCollectionService } = req.app.locals.services;

      const queryParams = {
        metricNames: req.query.metricNames as string[],
        startTime: req.query.startTime ? new Date(req.query.startTime as string) : undefined,
        endTime: req.query.endTime ? new Date(req.query.endTime as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 100
      };

      const metrics = await metricsCollectionService.queryMetrics(queryParams);

      res.json({
        success: true,
        metrics,
        count: metrics.length
      });

    } catch (error) {
      logger.error('Metrics query error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to query metrics'
      });
    }
  }
);

// GET /api/v1/metrics/summary - Get metrics summary
router.get('/summary',
  query('timeframe').optional().isIn(['day', 'week', 'month']),
  async (req: Request, res: Response) => {
    try {
      const { metricsCollectionService } = req.app.locals.services;
      const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'day';

      const summary = await metricsCollectionService.getMetricsSummary(timeframe);

      res.json({
        success: true,
        summary
      });

    } catch (error) {
      logger.error('Metrics summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics summary'
      });
    }
  }
);

export default router;