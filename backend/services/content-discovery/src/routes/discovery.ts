import { Router, Request, Response } from 'express';
import { query, body, param, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { optionalAuthMiddleware, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/v1/discovery/opportunities - Discover opportunities
router.get('/opportunities',
  optionalAuthMiddleware,
  query('type').optional().isArray(),
  query('category').optional().isArray(),
  query('location').optional().isArray(),
  query('academicLevel').optional().isArray(),
  query('fieldOfStudy').optional().isArray(),
  query('minAmount').optional().isInt({ min: 0 }),
  query('maxAmount').optional().isInt({ min: 0 }),
  query('deadlineFrom').optional().isISO8601(),
  query('deadlineTo').optional().isISO8601(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;

      const filters = {
        type: req.query.type as string[],
        category: req.query.category as string[],
        location: req.query.location as string[],
        academicLevel: req.query.academicLevel as string[],
        fieldOfStudy: req.query.fieldOfStudy as string[],
        amount: {
          min: req.query.minAmount ? parseInt(req.query.minAmount as string) : undefined,
          max: req.query.maxAmount ? parseInt(req.query.maxAmount as string) : undefined
        },
        deadline: {
          from: req.query.deadlineFrom ? new Date(req.query.deadlineFrom as string) : undefined,
          to: req.query.deadlineTo ? new Date(req.query.deadlineTo as string) : undefined
        }
      };

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const discovery = await discoveryService.discoverOpportunities(userId, filters, limit, offset);

      res.json({
        success: true,
        ...discovery
      });

    } catch (error) {
      logger.error('Opportunity discovery error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to discover opportunities',
        opportunities: [],
        totalCount: 0
      });
    }
  }
);

// GET /api/v1/discovery/scholarships - Discover scholarships
router.get('/scholarships',
  optionalAuthMiddleware,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        type: ['scholarship'],
        category: req.query.category as string[],
        location: req.query.location as string[],
        academicLevel: req.query.academicLevel as string[],
        fieldOfStudy: req.query.fieldOfStudy as string[]
      };

      const scholarships = await discoveryService.getScholarshipOpportunities(userId, filters, limit);

      res.json({
        success: true,
        scholarships,
        totalCount: scholarships.length
      });

    } catch (error) {
      logger.error('Scholarship discovery error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to discover scholarships',
        scholarships: []
      });
    }
  }
);

// GET /api/v1/discovery/grants - Discover grants and fellowships
router.get('/grants',
  optionalAuthMiddleware,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        type: ['grant', 'fellowship'],
        category: req.query.category as string[],
        location: req.query.location as string[],
        academicLevel: req.query.academicLevel as string[],
        fieldOfStudy: req.query.fieldOfStudy as string[]
      };

      const grants = await discoveryService.getGrantOpportunities(userId, filters, limit);

      res.json({
        success: true,
        grants,
        totalCount: grants.length
      });

    } catch (error) {
      logger.error('Grant discovery error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to discover grants',
        grants: []
      });
    }
  }
);

// GET /api/v1/discovery/internships - Discover internships
router.get('/internships',
  optionalAuthMiddleware,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        type: ['internship'],
        category: req.query.category as string[],
        location: req.query.location as string[],
        academicLevel: req.query.academicLevel as string[],
        fieldOfStudy: req.query.fieldOfStudy as string[]
      };

      const internships = await discoveryService.getInternshipOpportunities(userId, filters, limit);

      res.json({
        success: true,
        internships,
        totalCount: internships.length
      });

    } catch (error) {
      logger.error('Internship discovery error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to discover internships',
        internships: []
      });
    }
  }
);

// GET /api/v1/discovery/competitions - Discover competitions
router.get('/competitions',
  optionalAuthMiddleware,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        type: ['competition'],
        category: req.query.category as string[],
        location: req.query.location as string[],
        academicLevel: req.query.academicLevel as string[],
        fieldOfStudy: req.query.fieldOfStudy as string[]
      };

      const competitions = await discoveryService.getCompetitionOpportunities(userId, filters, limit);

      res.json({
        success: true,
        competitions,
        totalCount: competitions.length
      });

    } catch (error) {
      logger.error('Competition discovery error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to discover competitions',
        competitions: []
      });
    }
  }
);

// GET /api/v1/discovery/urgent - Get urgent opportunities (deadline soon)
router.get('/urgent',
  optionalAuthMiddleware,
  query('days').optional().isInt({ min: 1, max: 90 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;
      const days = parseInt(req.query.days as string) || 30;
      const limit = parseInt(req.query.limit as string) || 10;

      const urgent = await discoveryService.getUrgentOpportunities(userId, days, limit);

      res.json({
        success: true,
        urgent,
        daysUntilDeadline: days,
        totalCount: urgent.length
      });

    } catch (error) {
      logger.error('Urgent opportunities error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get urgent opportunities',
        urgent: []
      });
    }
  }
);

// GET /api/v1/discovery/high-value - Get high-value opportunities
router.get('/high-value',
  optionalAuthMiddleware,
  query('minAmount').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;
      const minAmount = parseInt(req.query.minAmount as string) || 5000;
      const limit = parseInt(req.query.limit as string) || 10;

      const highValue = await discoveryService.getHighValueOpportunities(userId, minAmount, limit);

      res.json({
        success: true,
        highValue,
        minAmount,
        totalCount: highValue.length
      });

    } catch (error) {
      logger.error('High-value opportunities error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get high-value opportunities',
        highValue: []
      });
    }
  }
);

// GET /api/v1/discovery/search - Search opportunities
router.get('/search',
  query('q').isString().notEmpty(),
  optionalAuthMiddleware,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 20;

      const filters = {
        type: req.query.type as string[],
        category: req.query.category as string[],
        location: req.query.location as string[],
        academicLevel: req.query.academicLevel as string[],
        fieldOfStudy: req.query.fieldOfStudy as string[]
      };

      const results = await discoveryService.searchOpportunities(query, userId, filters, limit);

      res.json({
        success: true,
        results,
        query,
        totalCount: results.length
      });

    } catch (error) {
      logger.error('Opportunity search error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search opportunities',
        results: []
      });
    }
  }
);

// GET /api/v1/discovery/opportunity/:id - Get specific opportunity
router.get('/opportunity/:id',
  param('id').isString().notEmpty(),
  optionalAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;
      const opportunityId = req.params.id;

      const opportunity = await discoveryService.getOpportunityById(opportunityId, userId);

      if (!opportunity) {
        return res.status(404).json({
          success: false,
          error: 'Opportunity not found'
        });
      }

      res.json({
        success: true,
        opportunity
      });

    } catch (error) {
      logger.error('Get opportunity error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get opportunity'
      });
    }
  }
);

// GET /api/v1/discovery/opportunity/:id/similar - Get similar opportunities
router.get('/opportunity/:id/similar',
  param('id').isString().notEmpty(),
  optionalAuthMiddleware,
  query('limit').optional().isInt({ min: 1, max: 20 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { discoveryService } = req.app.locals.services;
      const userId = (req as any).user?.id;
      const opportunityId = req.params.id;
      const limit = parseInt(req.query.limit as string) || 5;

      const similar = await discoveryService.getSimilarOpportunities(opportunityId, userId, limit);

      res.json({
        success: true,
        similar,
        opportunityId,
        totalCount: similar.length
      });

    } catch (error) {
      logger.error('Similar opportunities error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get similar opportunities',
        similar: []
      });
    }
  }
);

export default router;