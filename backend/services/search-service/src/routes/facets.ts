import { Router, Request, Response } from 'express';
import { query, body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/facets - Get facets for search results
router.get('/',
  query('q').optional().isString(),
  query('facets').isString().notEmpty(),
  query('filters').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { facetService } = req.app.locals.services;

      const facetQuery = {
        query: req.query.q as string,
        facets: (req.query.facets as string).split(','),
        filters: req.query.filters ? JSON.parse(req.query.filters as string) : undefined
      };

      const facets = await facetService.getFacets(facetQuery);

      res.json({
        success: true,
        facets
      });

    } catch (error) {
      logger.error('Facets error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get facets',
        facets: []
      });
    }
  }
);

// POST /api/v1/facets - Get facets with complex query
router.post('/',
  body('query').optional().isString(),
  body('facets').isArray().notEmpty(),
  body('filters').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { facetService } = req.app.locals.services;

      const facetQuery = {
        query: req.body.query,
        facets: req.body.facets,
        filters: req.body.filters
      };

      const facets = await facetService.getFacets(facetQuery);

      res.json({
        success: true,
        facets
      });

    } catch (error) {
      logger.error('Facets POST error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get facets',
        facets: []
      });
    }
  }
);

// GET /api/v1/facets/values/:facetName - Get values for a specific facet
router.get('/values/:facetName',
  query('q').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const { facetService } = req.app.locals.services;
      
      const facetName = req.params.facetName;
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 50;

      const values = await facetService.getFacetValues(facetName, query, limit);

      res.json({
        success: true,
        facetName,
        values
      });

    } catch (error) {
      logger.error('Facet values error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get facet values',
        values: []
      });
    }
  }
);

// GET /api/v1/facets/config - Get all facet configurations
router.get('/config',
  async (req: Request, res: Response) => {
    try {
      const { facetService } = req.app.locals.services;
      
      const configs = facetService.getAllFacetConfigs();

      res.json({
        success: true,
        configs
      });

    } catch (error) {
      logger.error('Facet config error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get facet configurations'
      });
    }
  }
);

// GET /api/v1/facets/config/:facetName - Get specific facet configuration
router.get('/config/:facetName',
  async (req: Request, res: Response) => {
    try {
      const { facetService } = req.app.locals.services;
      
      const facetName = req.params.facetName;
      const config = facetService.getFacetConfig(facetName);

      if (!config) {
        return res.status(404).json({
          success: false,
          error: `Facet configuration not found: ${facetName}`
        });
      }

      res.json({
        success: true,
        facetName,
        config
      });

    } catch (error) {
      logger.error('Facet config error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get facet configuration'
      });
    }
  }
);

// POST /api/v1/facets/config/:facetName - Add or update facet configuration
router.post('/config/:facetName',
  body('field').isString().notEmpty(),
  body('type').isIn(['terms', 'range', 'date_range', 'histogram']),
  body('displayName').isString().notEmpty(),
  body('size').optional().isInt({ min: 1 }),
  body('ranges').optional().isArray(),
  body('interval').optional().isString(),
  body('order').optional().isIn(['count', 'key']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // This endpoint should be restricted to admin users
      const userRole = (req as any).user?.role;
      if (userRole !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Admin access required'
        });
      }

      const { facetService } = req.app.locals.services;
      
      const facetName = req.params.facetName;
      const config = {
        field: req.body.field,
        type: req.body.type,
        displayName: req.body.displayName,
        size: req.body.size,
        ranges: req.body.ranges,
        interval: req.body.interval,
        order: req.body.order || 'count'
      };

      facetService.addFacetConfig(facetName, config);

      res.json({
        success: true,
        message: `Facet configuration ${facetName} added/updated`,
        facetName,
        config
      });

    } catch (error) {
      logger.error('Facet config update error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to update facet configuration'
      });
    }
  }
);

// DELETE /api/v1/facets/config/:facetName - Remove facet configuration
router.delete('/config/:facetName',
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

      const { facetService } = req.app.locals.services;
      
      const facetName = req.params.facetName;
      const removed = facetService.removeFacetConfig(facetName);

      if (!removed) {
        return res.status(404).json({
          success: false,
          error: `Facet configuration not found: ${facetName}`
        });
      }

      res.json({
        success: true,
        message: `Facet configuration ${facetName} removed`,
        facetName
      });

    } catch (error) {
      logger.error('Facet config removal error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to remove facet configuration'
      });
    }
  }
);

export default router;