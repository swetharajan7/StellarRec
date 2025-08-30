import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/insights - Generate insights
router.get('/',
  query('timeframe').optional().isIn(['day', 'week', 'month']),
  async (req: Request, res: Response) => {
    try {
      const { insightGenerationService } = req.app.locals.services;
      const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'week';

      const insights = await insightGenerationService.generateInsights(timeframe);

      res.json({
        success: true,
        insights,
        count: insights.length,
        timeframe
      });

    } catch (error) {
      logger.error('Insights generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate insights'
      });
    }
  }
);

// GET /api/v1/insights/trends/:metric - Get trend analysis
router.get('/trends/:metric',
  query('period').optional().isIn(['week', 'month', 'quarter']),
  async (req: Request, res: Response) => {
    try {
      const { insightGenerationService } = req.app.locals.services;
      const metricName = req.params.metric;
      const period = req.query.period as 'week' | 'month' | 'quarter' || 'month';

      const trendAnalysis = await insightGenerationService.getTrendAnalysis(metricName, period);

      if (!trendAnalysis) {
        return res.status(404).json({
          success: false,
          error: 'Insufficient data for trend analysis'
        });
      }

      res.json({
        success: true,
        trendAnalysis
      });

    } catch (error) {
      logger.error('Trend analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze trends'
      });
    }
  }
);

// GET /api/v1/insights/anomalies/:metric - Detect anomalies
router.get('/anomalies/:metric',
  query('lookbackDays').optional().isInt({ min: 7, max: 90 }),
  async (req: Request, res: Response) => {
    try {
      const { insightGenerationService } = req.app.locals.services;
      const metricName = req.params.metric;
      const lookbackDays = parseInt(req.query.lookbackDays as string) || 30;

      const anomalies = await insightGenerationService.detectAnomalies(metricName, lookbackDays);

      res.json({
        success: true,
        anomalies,
        count: anomalies.length,
        metric: metricName,
        lookbackDays
      });

    } catch (error) {
      logger.error('Anomaly detection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect anomalies'
      });
    }
  }
);

// GET /api/v1/insights/correlations - Analyze correlations
router.get('/correlations',
  query('metrics').isArray().notEmpty(),
  query('period').optional().isIn(['week', 'month']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { insightGenerationService } = req.app.locals.services;
      const metricNames = req.query.metrics as string[];
      const period = req.query.period as 'week' | 'month' || 'month';

      const correlations = await insightGenerationService.analyzeCorrelations(metricNames, period);

      res.json({
        success: true,
        correlations,
        count: correlations.length,
        metrics: metricNames,
        period
      });

    } catch (error) {
      logger.error('Correlation analysis error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze correlations'
      });
    }
  }
);

// GET /api/v1/insights/history - Get insight history
router.get('/history',
  query('category').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const { insightGenerationService } = req.app.locals.services;
      const category = req.query.category as string;
      const limit = parseInt(req.query.limit as string) || 50;

      const insights = await insightGenerationService.getInsightHistory(category, limit);

      res.json({
        success: true,
        insights,
        count: insights.length,
        category
      });

    } catch (error) {
      logger.error('Insight history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get insight history'
      });
    }
  }
);

export default router;