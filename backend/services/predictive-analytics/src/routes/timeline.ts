import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { TimelineOptimizationService } from '../services/timelineOptimizationService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Optimize timeline for current user
router.post('/optimize',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const timelineOptimizationService: TimelineOptimizationService = req.app.locals.services.timelineOptimizationService;
    const optimizedTimeline = await timelineOptimizationService.optimizeTimeline(userId);

    res.status(200).json({
      success: true,
      data: optimizedTimeline
    });
  })
);

// Detect deadline conflicts
router.get('/conflicts',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const timelineOptimizationService: TimelineOptimizationService = req.app.locals.services.timelineOptimizationService;
    const conflicts = await timelineOptimizationService.detectDeadlineConflicts(userId);

    res.status(200).json({
      success: true,
      data: conflicts
    });
  })
);

// Adjust timeline for delay
router.post('/adjust',
  [
    body('milestoneId').isString().notEmpty().withMessage('Milestone ID is required'),
    body('delayDays').isInt({ min: 1 }).withMessage('Delay days must be a positive integer'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { milestoneId, delayDays } = req.body;
    const userId = req.user!.id;

    const timelineOptimizationService: TimelineOptimizationService = req.app.locals.services.timelineOptimizationService;
    const adjustedTimeline = await timelineOptimizationService.adjustTimelineForDelay(
      userId,
      milestoneId,
      delayDays
    );

    res.status(200).json({
      success: true,
      data: adjustedTimeline
    });
  })
);

// Predict timeline completion
router.get('/completion',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const timelineOptimizationService: TimelineOptimizationService = req.app.locals.services.timelineOptimizationService;
    const prediction = await timelineOptimizationService.predictTimelineCompletion(userId);

    res.status(200).json({
      success: true,
      data: prediction
    });
  })
);

export default router;