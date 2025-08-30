import { Router, Request, Response } from 'express';
import { query, param, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/v1/predictions/metric/:metric - Predict metric values
router.get('/metric/:metric',
  param('metric').isString().notEmpty(),
  query('daysAhead').optional().isInt({ min: 1, max: 30 }),
  query('modelType').optional().isIn(['auto', 'linear', 'polynomial', 'seasonal']),
  async (req: Request, res: Response) => {
    try {
      const { predictiveAnalyticsService } = req.app.locals.services;
      const metricName = req.params.metric;
      const daysAhead = parseInt(req.query.daysAhead as string) || 7;
      const modelType = req.query.modelType as any || 'auto';

      const predictions = await predictiveAnalyticsService.predictMetric(
        metricName,
        daysAhead,
        modelType
      );

      res.json({
        success: true,
        predictions,
        metric: metricName,
        daysAhead,
        modelType
      });

    } catch (error) {
      logger.error('Metric prediction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to predict metric'
      });
    }
  }
);

// GET /api/v1/predictions/success/:userId - Predict user success
router.get('/success/:userId',
  param('userId').isString().notEmpty(),
  query('applicationId').optional().isString(),
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { predictiveAnalyticsService } = req.app.locals.services;
      const userId = req.params.userId;
      const applicationId = req.query.applicationId as string;
      const requestingUserId = (req as any).user.id;

      // Only allow users to see their own predictions or admin access
      if (userId !== requestingUserId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const prediction = await predictiveAnalyticsService.predictUserSuccess(userId, applicationId);

      res.json({
        success: true,
        prediction
      });

    } catch (error) {
      logger.error('Success prediction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to predict user success'
      });
    }
  }
);

// GET /api/v1/predictions/benchmark/:userId - Get benchmark comparison
router.get('/benchmark/:userId',
  param('userId').isString().notEmpty(),
  query('anonymized').optional().isBoolean(),
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { predictiveAnalyticsService } = req.app.locals.services;
      const userId = req.params.userId;
      const anonymized = req.query.anonymized !== 'false';
      const requestingUserId = (req as any).user.id;

      // Only allow users to see their own benchmarks
      if (userId !== requestingUserId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const benchmark = await predictiveAnalyticsService.getBenchmarkComparison(userId, anonymized);

      res.json({
        success: true,
        benchmark
      });

    } catch (error) {
      logger.error('Benchmark comparison error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get benchmark comparison'
      });
    }
  }
);

// GET /api/v1/predictions/timeline/:userId/:applicationId - Optimize timeline
router.get('/timeline/:userId/:applicationId',
  param('userId').isString().notEmpty(),
  param('applicationId').isString().notEmpty(),
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { predictiveAnalyticsService } = req.app.locals.services;
      const userId = req.params.userId;
      const applicationId = req.params.applicationId;
      const requestingUserId = (req as any).user.id;

      // Only allow users to optimize their own timelines
      if (userId !== requestingUserId && (req as any).user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const optimizedTimeline = await predictiveAnalyticsService.optimizeTimeline(userId, applicationId);

      res.json({
        success: true,
        optimizedTimeline
      });

    } catch (error) {
      logger.error('Timeline optimization error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to optimize timeline'
      });
    }
  }
);

export default router;