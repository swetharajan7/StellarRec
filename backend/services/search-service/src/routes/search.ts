import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/search - Main search endpoint
router.get('/',
  query('q').optional().isString(),
  query('type').optional().isString(),
  query('category').optional().isString(),
  query('tags').optional().isString(),
  query('author').optional().isString(),
  query('university').optional().isString(),
  query('program').optional().isString(),
  query('location').optional().isString(),
  query('difficulty').optional().isString(),
  query('sort').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('highlight').optional().isBoolean(),
  query('facets').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { searchService } = req.app.locals.services;

      // Build search query from request parameters
      const searchQuery = {
        query: req.query.q as string || '',
        filters: {
          type: req.query.type ? (req.query.type as string).split(',') : undefined,
          category: req.query.category ? (req.query.category as string).split(',') : undefined,
          tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
          author: req.query.author ? (req.query.author as string).split(',') : undefined,
          university: req.query.university ? (req.query.university as string).split(',') : undefined,
          program: req.query.program ? (req.query.program as string).split(',') : undefined,
          location: req.query.location ? (req.query.location as string).split(',') : undefined,
          difficulty: req.query.difficulty ? (req.query.difficulty as string).split(',') : undefined
        },
        sort: req.query.sort ? [{
          field: req.query.sort as string,
          order: 'desc' as const
        }] : undefined,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
        highlight: req.query.highlight === 'true',
        facets: req.query.facets ? (req.query.facets as string).split(',') : undefined,
        userId: (req as any).user?.id,
        sessionId: req.sessionID
      };

      const result = await searchService.search(searchQuery);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      logger.error('Search endpoint error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Search failed',
        total: 0,
        documents: []
      });
    }
  }
);

// GET /api/v1/search/suggestions - Get search suggestions
router.get('/suggestions',
  query('q').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 20 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { searchService } = req.app.locals.services;
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      const suggestions = await searchService.getSearchSuggestions(query, limit);

      res.json({
        success: true,
        query,
        suggestions
      });

    } catch (error) {
      logger.error('Search suggestions error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get suggestions',
        suggestions: []
      });
    }
  }
);

// GET /api/v1/search/popular - Get popular searches
router.get('/popular',
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { searchService } = req.app.locals.services;
      const limit = parseInt(req.query.limit as string) || 10;

      const popularSearches = await searchService.getPopularSearches(limit);

      res.json({
        success: true,
        popularSearches
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

// GET /api/v1/search/trending - Get trending searches
router.get('/trending',
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { searchService } = req.app.locals.services;
      const limit = parseInt(req.query.limit as string) || 10;

      const trendingSearches = await searchService.getTrendingSearches(limit);

      res.json({
        success: true,
        trendingSearches
      });

    } catch (error) {
      logger.error('Trending searches error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get trending searches',
        trendingSearches: []
      });
    }
  }
);

// POST /api/v1/search/advanced - Advanced search with complex filters
router.post('/advanced',
  async (req: Request, res: Response) => {
    try {
      const { searchService } = req.app.locals.services;
      const searchQuery = {
        ...req.body,
        userId: (req as any).user?.id,
        sessionId: req.sessionID
      };

      const result = await searchService.search(searchQuery);

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      logger.error('Advanced search error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Advanced search failed',
        total: 0,
        documents: []
      });
    }
  }
);

// GET /api/v1/search/stats - Get search index statistics
router.get('/stats',
  async (req: Request, res: Response) => {
    try {
      const { searchService } = req.app.locals.services;
      const stats = await searchService.getIndexStats();

      res.json({
        success: true,
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

export default router;