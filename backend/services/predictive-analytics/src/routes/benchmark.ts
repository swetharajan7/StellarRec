import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { BenchmarkAnalysisService } from '../services/benchmarkAnalysisService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Generate benchmark comparison for current user
router.get('/compare',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const benchmarkAnalysisService: BenchmarkAnalysisService = req.app.locals.services.benchmarkAnalysisService;
    const comparison = await benchmarkAnalysisService.generateBenchmarkComparison(userId);

    res.status(200).json({
      success: true,
      data: comparison
    });
  })
);

// Get peer analysis with optional filters
router.get('/peers',
  [
    query('gpaRange').optional().isString(),
    query('testScoreRange').optional().isString(),
    query('majorCategory').optional().isString(),
    query('extracurricularLevel').optional().isString(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const userId = req.user!.id;
    const filters = req.query;

    const benchmarkAnalysisService: BenchmarkAnalysisService = req.app.locals.services.benchmarkAnalysisService;
    const peerAnalysis = await benchmarkAnalysisService.getPeerAnalysis(userId, filters);

    res.status(200).json({
      success: true,
      data: peerAnalysis
    });
  })
);

export default router;