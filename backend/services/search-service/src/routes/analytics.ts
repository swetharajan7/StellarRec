import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/v1/analytics/search - Log search analytics
router.post('/search',
  body('searchId').isUUID(),
  body('query').isString(),
  body('resultsCount').isInt({ min: 0 }),
  body('processingTime').isInt({ min: 0 }),
  body('filters').optional().isObject(),
  body('clickedResults').optional().isArray(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { analyticsService } = req.app.locals.services;
      const userId = (req as any).user?.id;

      const analytics = {
        searchId: req.body.searchId,
        userId,
        sessionId: req.sessionID,
        query: req.body.query,
        filters: req.body.filters,
        resultsCount: req.body.resultsCount,
        processingTime: req.body.processingTime,
        clickedResults: req.body.clickedResults,
        timestamp: new Date(),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      };

      await analyticsService.logSearch(analytics);

      res.json({
        success: true,
        message: 'Search analytics logged'
      });

    } catch (error) {
      logger.error('Search analytics logging error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to log search analytics'
      });
    }
  }
);

// POST /api/v1/analytics/click - Log click analytics
router.post('/click',
  body('searchId').isUUID(),
  body('documentId').isString().notEmpty(),
  body('position').isInt({ min: 0 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { analyticsService } = req.app.locals.services;
      const userId = (req as any).user?.id;

      await analyticsService.logClick(
        req.body.searchId,
        req.body.documentId,
        req.body.position,
        userId
      );

      res.json({
        success: true,
        message: 'Click analytics logged'
      });

    } catch (error) {
      logger.error('Click analytics logging error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to log click analytics'
      });
    }
  }
);

// GET /api/v1/analytics/popular-queries - Get popular queries
router.get('/popular-queries',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('timeframe').optional().isIn(['day', 'week', 'month']),
  async (req: Request, res: Response) => {
    try {
      const { analyticsService } = req.app.locals.services;
      
      const limit = parseInt(req.query.limit as string) || 20;
      const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

      const popularQueries = await analyticsService.getPopularQueries(limit, timeframe);

      res.json({
        success: true,
        timeframe,
        popularQueries
      });

    } catch (error) {
      logger.error('Popular queries error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get popular queries',
        popularQueries: []
      });
    }
  }
);

// GET /api/v1/analytics/trends - Get search trends
router.get('/trends',
  query('period').optional().isIn(['hour', 'day', 'week', 'month']),
  async (req: Request, res: Response) => {
    try {
      const { analyticsService } = req.app.locals.services;
      
      const period = (req.query.period as 'hour' | 'day' | 'week' | 'month') || 'day';

      const trends = await analyticsService.getSearchTrends(period);

      res.json({
        success: true,
        ...trends
      });

    } catch (error) {
      logger.error('Search trends error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get search trends'
      });
    }
  }
);

// GET /api/v1/analytics/query-performance/:query - Get query performance
router.get('/query-performance/:query',
  param('query').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const { analyticsService } = req.app.locals.services;
      const query = decodeURIComponent(req.params.query);

      const performance = await analyticsService.getQueryPerformance(query);

      if (!performance) {
        return res.status(404).json({
          success: false,
          error: 'No performance data found for this query'
        });
      }

      res.json({
        success: true,
        performance
      });

    } catch (error) {
      logger.error('Query performance error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get query performance'
      });
    }
  }
);

// GET /api/v1/analytics/stats - Get search statistics
router.get('/stats',
  query('timeframe').optional().isIn(['day', 'week', 'month']),
  async (req: Request, res: Response) => {
    try {
      const { analyticsService } = req.app.locals.services;
      
      const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'week';

      const stats = await analyticsService.getSearchStats(timeframe);

      res.json({
        success: true,
        timeframe,
        stats
      });

    } catch (error) {
      logger.error('Search stats error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get search statistics'
      });
    }
  }
);

// GET /api/v1/analytics/failed-queries - Get failed queries
router.get('/failed-queries',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const { analyticsService } = req.app.locals.services;
      
      const limit = parseInt(req.query.limit as string) || 20;

      const failedQueries = await analyticsService.getFailedQueries(limit);

      res.json({
        success: true,
        failedQueries
      });

    } catch (error) {
      logger.error('Failed queries error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get failed queries',
        failedQueries: []
      });
    }
  }
);

// GET /api/v1/analytics/user-history - Get user search history
router.get('/user-history',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          error: 'Authentication required'
        });
      }

      const { analyticsService } = req.app.locals.services;
      const limit = parseInt(req.query.limit as string) || 50;

      const searchHistory = await analyticsService.getUserSearchHistory(userId, limit);

      res.json({
        success: true,
        searchHistory
      });

    } catch (error) {
      logger.error('User search history error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get user search history',
        searchHistory: []
      });
    }
  }
);

// POST /api/v1/analytics/optimize-query - Get query optimization suggestions
router.post('/optimize-query',
  body('query').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { analyticsService } = req.app.locals.services;
      const query = req.body.query;

      const optimization = await analyticsService.optimizeQuery(query);

      res.json({
        success: true,
        ...optimization
      });

    } catch (error) {
      logger.error('Query optimization error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to optimize query'
      });
    }
  }
);

// DELETE /api/v1/analytics/cleanup - Cleanup old analytics data
router.delete('/cleanup',
  query('olderThanDays').optional().isInt({ min: 1, max: 365 }),
  async (req: Request, res: Response) => {
    try {
      // This endpoint should be restricted to admin users
      const userRole = (req as any).user?.role;
      if (userRole !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Admin access required'
        });
      }

      const { analyticsService } = req.app.locals.services;
      const olderThanDays = parseInt(req.query.olderThanDays as string) || 90;

      const cleanedCount = await analyticsService.cleanupOldAnalytics(olderThanDays);

      res.json({
        success: true,
        message: `Cleaned up ${cleanedCount} old analytics records`,
        cleanedCount
      });

    } catch (error) {
      logger.error('Analytics cleanup error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to cleanup analytics data'
      });
    }
  }
);

export default router;