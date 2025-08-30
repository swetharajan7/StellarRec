import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/v1/trending - Get trending content
router.get('/',
  optionalAuthMiddleware,
  query('contentType').optional().isIn(['university', 'program', 'scholarship', 'opportunity']),
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']),
  query('category').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { trendingService } = req.app.locals.services;
      
      const contentType = req.query.contentType as string;
      const timeframe = req.query.timeframe as string || '24h';
      const category = req.query.category as string;
      const limit = parseInt(req.query.limit as string) || 20;

      const trending = await trendingService.getTrendingContent(contentType, timeframe, category, limit);

      res.json({
        success: true,
        ...trending
      });

    } catch (error) {
      logger.error('Trending content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trending content',
        trending: []
      });
    }
  }
);

// GET /api/v1/trending/universities - Get trending universities
router.get('/universities',
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { trendingService } = req.app.locals.services;
      
      const timeframe = req.query.timeframe as string || '24h';
      const limit = parseInt(req.query.limit as string) || 10;

      const trending = await trendingService.getTrendingUniversities(timeframe, limit);

      res.json({
        success: true,
        trending,
        timeframe
      });

    } catch (error) {
      logger.error('Trending universities error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trending universities',
        trending: []
      });
    }
  }
);

// GET /api/v1/trending/programs - Get trending programs
router.get('/programs',
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { trendingService } = req.app.locals.services;
      
      const timeframe = req.query.timeframe as string || '24h';
      const limit = parseInt(req.query.limit as string) || 10;

      const trending = await trendingService.getTrendingPrograms(timeframe, limit);

      res.json({
        success: true,
        trending,
        timeframe
      });

    } catch (error) {
      logger.error('Trending programs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trending programs',
        trending: []
      });
    }
  }
);

// GET /api/v1/trending/scholarships - Get trending scholarships
router.get('/scholarships',
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { trendingService } = req.app.locals.services;
      
      const timeframe = req.query.timeframe as string || '24h';
      const limit = parseInt(req.query.limit as string) || 10;

      const trending = await trendingService.getTrendingScholarships(timeframe, limit);

      res.json({
        success: true,
        trending,
        timeframe
      });

    } catch (error) {
      logger.error('Trending scholarships error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trending scholarships',
        trending: []
      });
    }
  }
);

// GET /api/v1/trending/searches - Get popular searches
router.get('/searches',
  query('timeframe').optional().isIn(['day', 'week', 'month']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { trendingService } = req.app.locals.services;
      
      const timeframe = req.query.timeframe as string || '24h';
      const limit = parseInt(req.query.limit as string) || 10;

      const popularSearches = await trendingService.getPopularSearches(timeframe, limit);

      res.json({
        success: true,
        popularSearches,
        timeframe
      });

    } catch (error) {
      logger.error('Popular searches error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get popular searches',
        popularSearches: []
      });
    }
  }
);

// GET /api/v1/trending/emerging - Get emerging content
router.get('/emerging',
  query('contentType').optional().isIn(['university', 'program', 'scholarship', 'opportunity']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { trendingService } = req.app.locals.services;
      
      const contentType = req.query.contentType as string;
      const limit = parseInt(req.query.limit as string) || 10;

      const emerging = await trendingService.getEmergingContent(contentType, limit);

      res.json({
        success: true,
        emerging,
        contentType
      });

    } catch (error) {
      logger.error('Emerging content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get emerging content',
        emerging: []
      });
    }
  }
);

// GET /api/v1/trending/viral - Get viral content
router.get('/viral',
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { trendingService } = req.app.locals.services;
      
      const timeframe = req.query.timeframe as string || '24h';
      const limit = parseInt(req.query.limit as string) || 10;

      const viral = await trendingService.getViralContent(timeframe, limit);

      res.json({
        success: true,
        viral,
        timeframe
      });

    } catch (error) {
      logger.error('Viral content error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get viral content',
        viral: []
      });
    }
  }
);

export default router;