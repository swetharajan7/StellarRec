import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { LetterService } from '../services/letterService';

const router = Router();
const prisma = new PrismaClient();
const letterService = new LetterService(prisma);

// GET /api/v1/letters - Get user's letters
router.get('/',
  query('role').optional().isIn(['student', 'recommender']),
  query('status').optional().isIn(['draft', 'in_review', 'approved', 'submitted', 'delivered']),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const role = req.query.role as 'student' | 'recommender' || 'student';
      
      const letters = await letterService.getLettersByUser(userId, role);
      res.json({ letters });
    } catch (error) {
      logger.error('Error fetching letters:', error);
      res.status(500).json({ error: 'Failed to fetch letters' });
    }
  }
);

// POST /api/v1/letters - Create new letter
router.post('/',
  body('student_id').isUUID(),
  body('recommender_id').isUUID(),
  body('title').isLength({ min: 1, max: 200 }),
  body('content').optional().isString(),
  body('university_id').optional().isUUID(),
  body('application_id').optional().isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const letter = await letterService.createLetter(req.body);
      res.status(201).json(letter);
    } catch (error) {
      logger.error('Error creating letter:', error);
      res.status(500).json({ error: 'Failed to create letter' });
    }
  }
);

// GET /api/v1/letters/:id - Get specific letter
router.get('/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const letter = await letterService.getLetter(req.params.id, userId);
      res.json(letter);
    } catch (error) {
      logger.error('Error fetching letter:', error);
      res.status(404).json({ error: 'Letter not found' });
    }
  }
);

// PUT /api/v1/letters/:id - Update letter
router.put('/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const letter = await letterService.updateLetter(req.params.id, req.body, userId);
      res.json(letter);
    } catch (error) {
      logger.error('Error updating letter:', error);
      res.status(500).json({ error: 'Failed to update letter' });
    }
  }
);

// PUT /api/v1/letters/:id/status - Update letter status
router.put('/:id/status',
  param('id').isUUID(),
  body('status').isIn(['draft', 'in_review', 'approved', 'submitted', 'delivered']),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const letter = await letterService.updateLetterStatus(req.params.id, req.body.status, userId);
      res.json(letter);
    } catch (error) {
      logger.error('Error updating letter status:', error);
      res.status(500).json({ error: 'Failed to update letter status' });
    }
  }
);

export default router;