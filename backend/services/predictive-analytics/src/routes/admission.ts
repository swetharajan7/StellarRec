import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AdmissionPredictionService } from '../services/admissionPredictionService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Predict admission probability for a single university
router.post('/predict',
  [
    body('universityId').isString().notEmpty().withMessage('University ID is required'),
    body('programId').optional().isString(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { universityId, programId } = req.body;
    const userId = req.user!.id;

    const admissionPredictionService: AdmissionPredictionService = req.app.locals.services.admissionPredictionService;
    const prediction = await admissionPredictionService.predictAdmissionProbability(
      userId,
      universityId,
      programId
    );

    res.status(200).json({
      success: true,
      data: prediction
    });
  })
);

// Batch predict admission probabilities for multiple universities
router.post('/predict/batch',
  [
    body('universities').isArray().withMessage('Universities must be an array'),
    body('universities.*.universityId').isString().notEmpty().withMessage('University ID is required'),
    body('universities.*.programId').optional().isString(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { universities } = req.body;
    const userId = req.user!.id;

    const admissionPredictionService: AdmissionPredictionService = req.app.locals.services.admissionPredictionService;
    const predictions = await admissionPredictionService.batchPredictAdmissions(userId, universities);

    res.status(200).json({
      success: true,
      data: predictions
    });
  })
);

// Get admission trends for a university
router.get('/trends/:universityId',
  [
    param('universityId').isString().notEmpty().withMessage('University ID is required'),
    query('timeframe').optional().isIn(['year', 'semester']).withMessage('Invalid timeframe'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const { universityId } = req.params;
    const { timeframe } = req.query;

    const admissionPredictionService: AdmissionPredictionService = req.app.locals.services.admissionPredictionService;
    const trends = await admissionPredictionService.getAdmissionTrends(
      universityId,
      timeframe as 'year' | 'semester'
    );

    res.status(200).json({
      success: true,
      data: trends
    });
  })
);

// Update admission prediction model (admin only)
router.post('/model/update',
  [
    body('trainingData').isArray().withMessage('Training data must be an array'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    // Check if user has admin role (simplified check)
    if (req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Admin access required' }
      });
    }

    const { trainingData } = req.body;

    const admissionPredictionService: AdmissionPredictionService = req.app.locals.services.admissionPredictionService;
    const success = await admissionPredictionService.updateAdmissionModel(trainingData);

    res.status(200).json({
      success: true,
      data: { modelUpdated: success }
    });
  })
);

export default router;