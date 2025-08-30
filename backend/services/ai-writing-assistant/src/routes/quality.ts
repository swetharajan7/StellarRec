import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { QualityAssessmentService } from '../services/qualityAssessmentService';

const router = Router();
const prisma = new PrismaClient();
const qualityService = new QualityAssessmentService(prisma);

// POST /api/v1/quality/assess - Assess document quality
router.post('/assess',
  body('text').isLength({ min: 50, max: 10000 }),
  body('document_type').isIn(['letter', 'essay', 'personal_statement', 'cover_letter']),
  body('context').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const { text, document_type, context } = req.body;
      
      const assessment = await qualityService.assessQuality(text, document_type, context, userId);
      
      res.json({ assessment });
    } catch (error) {
      logger.error('Error in quality assessment:', error);
      res.status(500).json({ error: 'Quality assessment failed' });
    }
  }
);

export default router;