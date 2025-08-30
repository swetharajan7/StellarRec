import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/v1/dashboard/executive - Get executive dashboard
router.get('/executive',
  async (req: Request, res: Response) => {
    try {
      const { dashboardService } = req.app.locals.services;
      const dashboard = await dashboardService.getExecutiveDashboard();

      res.json({
        success: true,
        dashboard
      });

    } catch (error) {
      logger.error('Executive dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get executive dashboard'
      });
    }
  }
);

// GET /api/v1/dashboard/operational - Get operational dashboard
router.get('/operational',
  async (req: Request, res: Response) => {
    try {
      const { dashboardService } = req.app.locals.services;
      const dashboard = await dashboardService.getOperationalDashboard();

      res.json({
        success: true,
        dashboard
      });

    } catch (error) {
      logger.error('Operational dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get operational dashboard'
      });
    }
  }
);

// POST /api/v1/dashboard - Create custom dashboard
router.post('/',
  authMiddleware,
  body('name').isString().notEmpty(),
  body('description').optional().isString(),
  body('widgets').isArray(),
  body('isPublic').optional().isBoolean(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { dashboardService } = req.app.locals.services;
      const userId = (req as any).user.id;

      const dashboardId = await dashboardService.createDashboard({
        name: req.body.name,
        description: req.body.description || '',
        userId,
        isPublic: req.body.isPublic || false,
        widgets: req.body.widgets,
        layout: req.body.layout || {}
      });

      res.json({
        success: true,
        dashboardId,
        message: 'Dashboard created successfully'
      });

    } catch (error) {
      logger.error('Dashboard creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create dashboard'
      });
    }
  }
);

// GET /api/v1/dashboard/:id - Get specific dashboard
router.get('/:id',
  param('id').isString().notEmpty(),
  optionalAuthMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { dashboardService } = req.app.locals.services;
      const dashboardId = req.params.id;
      const userId = (req as any).user?.id;

      const dashboard = await dashboardService.getDashboard(dashboardId, userId);

      if (!dashboard) {
        return res.status(404).json({
          success: false,
          error: 'Dashboard not found'
        });
      }

      res.json({
        success: true,
        dashboard
      });

    } catch (error) {
      logger.error('Get dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard'
      });
    }
  }
);

// GET /api/v1/dashboard/user/:userId - Get user dashboards
router.get('/user/:userId',
  param('userId').isString().notEmpty(),
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { dashboardService } = req.app.locals.services;
      const userId = req.params.userId;
      const requestingUserId = (req as any).user.id;

      // Only allow users to see their own dashboards
      if (userId !== requestingUserId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const dashboards = await dashboardService.getUserDashboards(userId);

      res.json({
        success: true,
        dashboards,
        count: dashboards.length
      });

    } catch (error) {
      logger.error('Get user dashboards error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user dashboards'
      });
    }
  }
);

// GET /api/v1/dashboard/public - Get public dashboards
router.get('/public',
  async (req: Request, res: Response) => {
    try {
      const { dashboardService } = req.app.locals.services;
      const dashboards = await dashboardService.getPublicDashboards();

      res.json({
        success: true,
        dashboards,
        count: dashboards.length
      });

    } catch (error) {
      logger.error('Get public dashboards error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get public dashboards'
      });
    }
  }
);

export default router;