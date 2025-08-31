import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { ModelTrainingService } from '../services/modelTrainingService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Train admission prediction model (admin only)
router.post('/train/admission',
  requireRole(['admin']),
  [
    body('config').optional().isObject().withMessage('Config must be an object'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { config } = req.body;

    const modelTrainingService: ModelTrainingService = req.app.locals.services.modelTrainingService;
    const result = await modelTrainingService.trainAdmissionPredictionModel(config);

    res.status(200).json({
      success: true,
      data: result
    });
  })
);

// Train success factor model (admin only)
router.post('/train/success',
  requireRole(['admin']),
  [
    body('config').optional().isObject().withMessage('Config must be an object'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { config } = req.body;

    const modelTrainingService: ModelTrainingService = req.app.locals.services.modelTrainingService;
    const result = await modelTrainingService.trainSuccessFactorModel(config);

    res.status(200).json({
      success: true,
      data: result
    });
  })
);

// Retrain all models (admin only)
router.post('/retrain',
  requireRole(['admin']),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const modelTrainingService: ModelTrainingService = req.app.locals.services.modelTrainingService;
    const results = await modelTrainingService.retrainModels();

    res.status(200).json({
      success: true,
      data: results
    });
  })
);

// Get model performance
router.get('/performance/:modelType',
  requireRole(['admin', 'analyst']),
  [
    param('modelType').isIn(['admission_prediction', 'success_factor', 'timeline_optimization', 'early_warning'])
      .withMessage('Invalid model type'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { modelType } = req.params;

    const modelTrainingService: ModelTrainingService = req.app.locals.services.modelTrainingService;
    const performance = await modelTrainingService.getModelPerformance(modelType);

    res.status(200).json({
      success: true,
      data: performance
    });
  })
);

// Schedule model retraining (admin only)
router.post('/schedule/:modelType',
  requireRole(['admin']),
  [
    param('modelType').isIn(['admission_prediction', 'success_factor', 'timeline_optimization', 'early_warning'])
      .withMessage('Invalid model type'),
    body('schedule').isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid schedule'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { modelType } = req.params;
    const { schedule } = req.body;

    const modelTrainingService: ModelTrainingService = req.app.locals.services.modelTrainingService;
    await modelTrainingService.scheduleModelRetraining(modelType, schedule);

    res.status(200).json({
      success: true,
      data: { message: 'Model retraining scheduled successfully' }
    });
  })
);

export default router;