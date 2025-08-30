import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/v1/behavior/track - Track user behavior
router.post('/track',
  authMiddleware,
  body('action').isIn(['view', 'click', 'search', 'save', 'share', 'apply', 'like', 'dislike', 'bookmark']),
  body('contentType').isIn(['university', 'program', 'scholarship', 'opportunity', 'article', 'guide']),
  body('contentId').isString().notEmpty(),
  body('metadata').optional().isObject(),
  body('context').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { behaviorTrackingService } = req.app.locals.services;
      const userId = (req as any).user.id;

      const behaviorEvent = {
        userId,
        sessionId: req.sessionID,
        action: req.body.action,
        contentType: req.body.contentType,
        contentId: req.body.contentId,
        metadata: req.body.metadata,
        context: {
          ...req.body.context,
          userAgent: req.get('User-Agent'),
          page: req.get('Referer'),
          ipAddress: req.ip
        }
      };

      await behaviorTrackingService.trackBehavior(behaviorEvent);

      res.json({
        success: true,
        message: 'Behavior tracked successfully'
      });

    } catch (error) {
      logger.error('Behavior tracking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track behavior'
      });
    }
  }
);

// POST /api/v1/behavior/track-batch - Track multiple behaviors
router.post('/track-batch',
  authMiddleware,
  body('events').isArray().notEmpty(),
  body('events.*.action').isIn(['view', 'click', 'search', 'save', 'share', 'apply', 'like', 'dislike', 'bookmark']),
  body('events.*.contentType').isIn(['university', 'program', 'scholarship', 'opportunity', 'article', 'guide']),
  body('events.*.contentId').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { behaviorTrackingService } = req.app.locals.services;
      const userId = (req as any).user.id;

      const behaviorEvents = req.body.events.map((event: any) => ({
        userId,
        sessionId: req.sessionID,
        action: event.action,
        contentType: event.contentType,
        contentId: event.contentId,
        metadata: event.metadata,
        context: {
          ...event.context,
          userAgent: req.get('User-Agent'),
          page: req.get('Referer'),
          ipAddress: req.ip
        }
      }));

      await behaviorTrackingService.trackMultipleBehaviors(behaviorEvents);

      res.json({
        success: true,
        message: `${behaviorEvents.length} behaviors tracked successfully`
      });

    } catch (error) {
      logger.error('Batch behavior tracking error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track behaviors'
      });
    }
  }
);

// GET /api/v1/behavior/profile - Get user behavior profile
router.get('/profile',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { behaviorTrackingService } = req.app.locals.services;
      const userId = (req as any).user.id;

      const profile = await behaviorTrackingService.getUserBehaviorProfile(userId);

      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Behavior profile not found'
        });
      }

      res.json({
        success: true,
        profile
      });

    } catch (error) {
      logger.error('Get behavior profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get behavior profile'
      });
    }
  }
);

// GET /api/v1/behavior/insights - Get behavior insights
router.get('/insights',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { behaviorTrackingService } = req.app.locals.services;
      const userId = (req as any).user.id;

      const insights = await behaviorTrackingService.getBehaviorInsights(userId);

      if (!insights) {
        return res.status(404).json({
          success: false,
          error: 'Behavior insights not found'
        });
      }

      res.json({
        success: true,
        insights
      });

    } catch (error) {
      logger.error('Get behavior insights error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get behavior insights'
      });
    }
  }
);

// GET /api/v1/behavior/similar-users - Get similar users
router.get('/similar-users',
  authMiddleware,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { behaviorTrackingService } = req.app.locals.services;
      const userId = (req as any).user.id;
      const limit = parseInt(req.query.limit as string) || 10;

      const similarUsers = await behaviorTrackingService.getUserSimilarities(userId, limit);

      res.json({
        success: true,
        similarUsers,
        totalCount: similarUsers.length
      });

    } catch (error) {
      logger.error('Get similar users error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get similar users',
        similarUsers: []
      });
    }
  }
);

// GET /api/v1/behavior/content-popularity - Get content popularity
router.get('/content-popularity',
  query('contentType').isString().notEmpty(),
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { behaviorTrackingService } = req.app.locals.services;
      const contentType = req.query.contentType as string;
      const timeframe = req.query.timeframe as string || '24h';

      const popularity = await behaviorTrackingService.getContentPopularity(contentType, timeframe);

      res.json({
        success: true,
        popularity,
        contentType,
        timeframe
      });

    } catch (error) {
      logger.error('Get content popularity error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get content popularity',
        popularity: []
      });
    }
  }
);

// GET /api/v1/behavior/engagement-metrics - Get engagement metrics
router.get('/engagement-metrics',
  authMiddleware,
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']),
  async (req: Request, res: Response) => {
    try {
      const { behaviorTrackingService } = req.app.locals.services;
      const userId = (req as any).user.id;
      const timeframe = req.query.timeframe as string || '24h';

      const metrics = await behaviorTrackingService.getEngagementMetrics(userId, timeframe);

      res.json({
        success: true,
        metrics,
        timeframe
      });

    } catch (error) {
      logger.error('Get engagement metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get engagement metrics'
      });
    }
  }
);

// GET /api/v1/behavior/global-engagement - Get global engagement metrics
router.get('/global-engagement',
  query('timeframe').optional().isIn(['1h', '6h', '24h', '7d']),
  async (req: Request, res: Response) => {
    try {
      const { behaviorTrackingService } = req.app.locals.services;
      const timeframe = req.query.timeframe as string || '24h';

      const metrics = await behaviorTrackingService.getEngagementMetrics(undefined, timeframe);

      res.json({
        success: true,
        metrics,
        timeframe
      });

    } catch (error) {
      logger.error('Get global engagement metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get global engagement metrics'
      });
    }
  }
);

export default router;