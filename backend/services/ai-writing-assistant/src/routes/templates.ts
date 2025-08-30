import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { TemplateGenerationService } from '../services/templateGenerationService';

const router = Router();
const prisma = new PrismaClient();
const templateService = new TemplateGenerationService(prisma);

// POST /api/v1/templates/generate - Generate template
router.post('/generate',
  body('document_type').isIn(['letter', 'essay', 'personal_statement', 'cover_letter']),
  body('purpose').isLength({ min: 10, max: 500 }),
  body('target_audience').isLength({ min: 3, max: 100 }),
  body('key_points').isArray({ min: 1, max: 10 }),
  body('tone').isIn(['formal', 'professional', 'personal', 'academic']),
  body('length').isIn(['short', 'medium', 'long']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const template = await templateService.generateTemplate(req.body, userId);
      
      res.json({ template });
    } catch (error) {
      logger.error('Error generating template:', error);
      res.status(500).json({ error: 'Failed to generate template' });
    }
  }
);

// GET /api/v1/templates/library - Get template library
router.get('/library',
  query('document_type').optional().isString(),
  query('category').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { document_type, category } = req.query;
      
      const templates = await templateService.getTemplateLibrary(
        document_type as string, 
        category as string, 
        userId
      );
      
      res.json({ templates });
    } catch (error) {
      logger.error('Error fetching template library:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  }
);

export default router;