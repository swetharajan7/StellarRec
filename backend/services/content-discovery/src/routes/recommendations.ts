import { Router, Request, Response } from 'express';
import { query, body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/v1/recommendations - Get personalized recommendations
router.get('/',
  optionalAuthMiddleware,
  query('contentType').optional().isIn(['university', 'program', 'scholarship', 'opportunity']),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('excludeIds').optional().isArray(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { recommendationService } = req.app.locals.services;
      const userId = (req as any).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required for personalized recommendations'
        });
      }

      const request = {
        userId,
        userType: (req as any).user?.type || 'student',
        contentType: req.query.contentType as any,
        limit: parseInt(req.query.limit as string) || 10,
        excludeIds: req.query.excludeIds as string[] || [],
        context: {
          academicLevel: req.query.academicLevel as string,
          fieldOfStudy: req.query.fieldOfStudy as string,
          location: req.query.location as string,
          budget: req.query.budget ? parseInt(req.query.budget as string) : undefined,
          gpa: req.query.gpa ? parseFloat(req.query.gpa as string) : undefined,
          interests: req.query.interests as string[],
          preferences: req.query.preferences ? JSON.parse(req.query.preferences as string) : undefined
        }
      };

      const recommendations = await recommendationService.getPersonalizedRecommendations(request);

      res.json({
        success: true,
        ...recommendations
      });

    } catch (error) {
      logger.error('Recommendations endpoint error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recommendations',
        recommendations: [],
        totalCount: 0
      });
    }
  }
);

// GET /api/v1/recommendations/universities - Get university recommendations
router.get('/universities',
  authMiddleware,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('excludeIds').optional().isArray(),
  async (req: Request, res: Response) => {
    try {
      const { recommendationService } = req.app.locals.services;
      const userId = (req as any).user.id;

      const request = {
        userId,
        userType: (req as any).user.type || 'student',
        contentType: 'university' as const,
        limit: parseInt(req.query.limit as string) || 10,
        excludeIds: req.query.excludeIds as string[] || [],
        context: {
          academicLevel: req.query.academicLevel as string,
          fieldOfStudy: req.query.fieldOfStudy as string,
          location: req.query.location as string,
          gpa: req.query.gpa ? parseFloat(req.query.gpa as string) : undefined,
          testScores: req.query.testScores ? JSON.parse(req.query.testScores as string) : undefined,
          interests: req.query.interests as string[]
        }
      };

      const recommendations = await recommendationService.getUniversityRecommendations(request);

      res.json({
        success: true,
        ...recommendations
      });

    } catch (error) {
      logger.error('University recommendations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get university recommendations',
        recommendations: []
      });
    }
  }
);

// GET /api/v1/recommendations/programs - Get program recommendations
router.get('/programs',
  authMiddleware,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { recommendationService } = req.app.locals.services;
      const userId = (req as any).user.id;

      const request = {
        userId,
        userType: (req as any).user.type || 'student',
        contentType: 'program' as const,
        limit: parseInt(req.query.limit as string) || 10,
        excludeIds: req.query.excludeIds as string[] || [],
        context: {
          academicLevel: req.query.academicLevel as string,
          fieldOfStudy: req.query.fieldOfStudy as string,
          location: req.query.location as string,
          interests: req.query.interests as string[]
        }
      };

      const recommendations = await recommendationService.getProgramRecommendations(request);

      res.json({
        success: true,
        ...recommendations
      });

    } catch (error) {
      logger.error('Program recommendations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get program recommendations',
        recommendations: []
      });
    }
  }
);

// GET /api/v1/recommendations/scholarships - Get scholarship recommendations
router.get('/scholarships',
  authMiddleware,
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const { recommendationService } = req.app.locals.services;
      const userId = (req as any).user.id;

      const request = {
        userId,
        userType: (req as any).user.type || 'student',
        contentType: 'scholarship' as const,
        limit: parseInt(req.query.limit as string) || 10,
        excludeIds: req.query.excludeIds as string[] || [],
        context: {
          academicLevel: req.query.academicLevel as string,
          fieldOfStudy: req.query.fieldOfStudy as string,
          location: req.query.location as string,
          gpa: req.query.gpa ? parseFloat(req.query.gpa as string) : undefined,
          budget: req.query.budget ? parseInt(req.query.budget as string) : undefined,
          interests: req.query.interests as string[]
        }
      };

      const recommendations = await recommendationService.getScholarshipRecommendations(request);

      res.json({
        success: true,
        ...recommendations
      });

    } catch (error) {
      logger.error('Scholarship recommendations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scholarship recommendations',
        recommendations: []
      });
    }
  }
);

// GET /api/v1/recommendations/similar/:contentId - Get similar content recommendations
router.get('/similar/:contentId',
  optionalAuthMiddleware,
  query('contentType').isString().notEmpty(),
  query('limit').optional().isInt({ min: 1, max: 20 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { recommendationService } = req.app.locals.services;
      const contentId = req.params.contentId;
      const contentType = req.query.contentType as string;
      const limit = parseInt(req.query.limit as string) || 5;

      const similarContent = await recommendationService.getSimilarContent(contentId, contentType, limit);

      res.json({
        success: true,
        recommendations: similarContent,
        contentId,
        contentType
      });

    } catch (error) {
      logger.error('Similar content recommendations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get similar content recommendations',
        recommendations: []
      });
    }
  }
);

// POST /api/v1/recommendations/feedback - Provide feedback on recommendations
router.post('/feedback',
  authMiddleware,
  body('recommendationId').isString().notEmpty(),
  body('feedback').isIn(['like', 'dislike', 'not_relevant', 'helpful']),
  body('reason').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { behaviorTrackingService } = req.app.locals.services;
      const userId = (req as any).user.id;

      // Track feedback as behavior
      await behaviorTrackingService.trackBehavior({
        userId,
        action: req.body.feedback === 'like' ? 'like' : 'dislike',
        contentType: 'recommendation',
        contentId: req.body.recommendationId,
        metadata: {
          feedback: req.body.feedback,
          reason: req.body.reason
        }
      });

      res.json({
        success: true,
        message: 'Feedback recorded successfully'
      });

    } catch (error) {
      logger.error('Recommendation feedback error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record feedback'
      });
    }
  }
);

export default router;