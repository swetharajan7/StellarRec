import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { SuccessFactorService } from '../services/successFactorService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Analyze success factors for a user
router.get('/analyze',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const successFactorService: SuccessFactorService = req.app.locals.services.successFactorService;
    const analysis = await successFactorService.analyzeSuccessFactors(userId);

    res.status(200).json({
      success: true,
      data: analysis
    });
  })
);

// Identify success patterns for a user segment
router.get('/patterns',
  [
    query('userSegment').optional().isString(),
    query('sampleSize').optional().isInt({ min: 50, max: 5000 }).toInt(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { userSegment, sampleSize } = req.query;

    const successFactorService: SuccessFactorService = req.app.locals.services.successFactorService;
    const patterns = await successFactorService.identifySuccessPatterns(
      userSegment as string,
      sampleSize as number
    );

    res.status(200).json({
      success: true,
      data: patterns
    });
  })
);

// Get recommendations for improving a specific factor
router.get('/recommendations/:factor',
  [
    param('factor').isString().notEmpty().withMessage('Factor is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { factor } = req.params;
    const userId = req.user!.id;

    const successFactorService: SuccessFactorService = req.app.locals.services.successFactorService;
    const recommendations = await successFactorService.getFactorRecommendations(userId, factor);

    res.status(200).json({
      success: true,
      data: { factor, recommendations }
    });
  })
);

// Track progress for a specific factor
router.post('/progress',
  [
    body('factor').isString().notEmpty().withMessage('Factor is required'),
    body('value').isNumeric().withMessage('Value must be numeric'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { factor, value } = req.body;
    const userId = req.user!.id;

    const successFactorService: SuccessFactorService = req.app.locals.services.successFactorService;
    await successFactorService.trackFactorProgress(userId, factor, parseFloat(value));

    res.status(200).json({
      success: true,
      data: { message: 'Progress tracked successfully' }
    });
  })
);

export default router;