import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/autocomplete - Get autocomplete suggestions
router.get('/',
  query('q').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 20 }),
  query('types').optional().isString(),
  query('fuzzy').optional().isBoolean(),
  query('includePopular').optional().isBoolean(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { autocompleteService } = req.app.locals.services;
      
      const query = req.query.q as string;
      const options = {
        limit: parseInt(req.query.limit as string) || 10,
        types: req.query.types ? (req.query.types as string).split(',') : undefined,
        fuzzy: req.query.fuzzy !== 'false',
        includePopular: req.query.includePopular !== 'false',
        userId: (req as any).user?.id
      };

      const result = await autocompleteService.getSuggestions(query, options);

      res.json({
        success: true,
        query,
        ...result
      });

    } catch (error) {
      logger.error('Autocomplete error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Autocomplete failed',
        suggestions: [],
        processingTime: 0
      });
    }
  }
);

// GET /api/v1/autocomplete/categories - Get category suggestions
router.get('/categories',
  query('q').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 20 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { autocompleteService } = req.app.locals.services;
      
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      const suggestions = await autocompleteService.getCategorySuggestions(query, limit);

      res.json({
        success: true,
        query,
        suggestions
      });

    } catch (error) {
      logger.error('Category autocomplete error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Category autocomplete failed',
        suggestions: []
      });
    }
  }
);

// GET /api/v1/autocomplete/locations - Get location suggestions
router.get('/locations',
  query('q').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 20 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { autocompleteService } = req.app.locals.services;
      
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 10;

      const suggestions = await autocompleteService.getLocationSuggestions(query, limit);

      res.json({
        success: true,
        query,
        suggestions
      });

    } catch (error) {
      logger.error('Location autocomplete error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Location autocomplete failed',
        suggestions: []
      });
    }
  }
);

// GET /api/v1/autocomplete/contextual - Get contextual suggestions
router.get('/contextual',
  query('q').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 20 }),
  query('userType').optional().isIn(['student', 'recommender']),
  query('interests').optional().isString(),
  query('location').optional().isString(),
  query('academicLevel').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { autocompleteService } = req.app.locals.services;
      
      const query = req.query.q as string;
      const context = {
        userType: req.query.userType as 'student' | 'recommender' | undefined,
        interests: req.query.interests ? (req.query.interests as string).split(',') : undefined,
        location: req.query.location as string,
        academicLevel: req.query.academicLevel as string
      };
      
      const options = {
        limit: parseInt(req.query.limit as string) || 10,
        userId: (req as any).user?.id
      };

      const result = await autocompleteService.getSuggestionsWithContext(query, context, options);

      res.json({
        success: true,
        query,
        context,
        ...result
      });

    } catch (error) {
      logger.error('Contextual autocomplete error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Contextual autocomplete failed',
        suggestions: [],
        processingTime: 0
      });
    }
  }
);

// GET /api/v1/autocomplete/recent - Get user's recent searches
router.get('/recent',
  query('limit').optional().isInt({ min: 1, max: 20 }),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ 
          success: false,
          error: 'Authentication required'
        });
      }

      const { autocompleteService } = req.app.locals.services;
      const limit = parseInt(req.query.limit as string) || 10;

      const recentSearches = await autocompleteService.getRecentSearches(userId, limit);

      res.json({
        success: true,
        recentSearches
      });

    } catch (error) {
      logger.error('Recent searches error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get recent searches',
        recentSearches: []
      });
    }
  }
);

export default router;