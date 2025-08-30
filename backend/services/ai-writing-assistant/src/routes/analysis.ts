import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { WritingAnalysisService } from '../services/writingAnalysisService';

const router = Router();
const prisma = new PrismaClient();
const analysisService = new WritingAnalysisService(prisma);

// POST /api/v1/analysis/text - Analyze text
router.post('/text',
  body('text').isLength({ min: 10, max: 10000 }).withMessage('Text must be between 10 and 10000 characters'),
  body('context').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { text, context } = req.body;
      const analysis = await analysisService.analyzeText(text, context);
      
      res.json({ analysis });
    } catch (error) {
      logger.error('Error in text analysis:', error);
      res.status(500).json({ error: 'Analysis failed' });
    }
  }
);

export default router;