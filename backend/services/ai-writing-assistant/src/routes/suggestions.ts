import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { SuggestionService } from '../services/suggestionService';

const router = Router();
const prisma = new PrismaClient();
const suggestionService = new SuggestionService(prisma, null as any); // IO will be injected

// POST /api/v1/suggestions/generate - Generate suggestions
router.post('/generate',
  body('text').isLength({ min: 10, max: 10000 }),
  body('position').isInt({ min: 0 }),
  body('context').isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const { text, position, context } = req.body;
      
      const suggestions = await suggestionService.generateSuggestions(text, position, context, userId);
      
      res.json({ suggestions });
    } catch (error) {
      logger.error('Error generating suggestions:', error);
      res.status(500).json({ error: 'Failed to generate suggestions' });
    }
  }
);

// POST /api/v1/suggestions/:id/apply - Apply suggestion
router.post('/:id/apply',
  param('id').isString(),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const suggestionId = req.params.id;
      
      const success = await suggestionService.applySuggestion(suggestionId, userId);
      
      if (success) {
        res.json({ message: 'Suggestion applied successfully' });
      } else {
        res.status(400).json({ error: 'Failed to apply suggestion' });
      }
    } catch (error) {
      logger.error('Error applying suggestion:', error);
      res.status(500).json({ error: 'Failed to apply suggestion' });
    }
  }
);

export default router;