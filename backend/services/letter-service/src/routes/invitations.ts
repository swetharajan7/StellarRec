import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { InvitationService } from '../services/invitationService';

const router = Router();
const prisma = new PrismaClient();
const invitationService = new InvitationService(prisma);

// POST /api/v1/invitations - Create invitation
router.post('/',
  body('recommender_email').isEmail(),
  body('recommender_name').optional().isString(),
  body('message').optional().isString(),
  body('university_id').optional().isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const studentId = (req as any).user?.id;
      if (!studentId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const invitation = await invitationService.createInvitation({
        student_id: studentId,
        ...req.body
      });

      res.status(201).json(invitation);
    } catch (error) {
      logger.error('Error creating invitation:', error);
      res.status(500).json({ error: 'Failed to create invitation' });
    }
  }
);

// GET /api/v1/invitations/token/:token - Get invitation by token (no auth required)
router.get('/token/:token',
  param('token').isLength({ min: 32, max: 64 }),
  async (req: Request, res: Response) => {
    try {
      const invitation = await invitationService.getInvitationByToken(req.params.token);
      res.json(invitation);
    } catch (error) {
      logger.error('Error fetching invitation:', error);
      res.status(404).json({ error: 'Invalid or expired invitation' });
    }
  }
);

// POST /api/v1/invitations/accept/:token - Accept invitation (no auth required)
router.post('/accept/:token',
  param('token').isLength({ min: 32, max: 64 }),
  body('first_name').isLength({ min: 1, max: 50 }),
  body('last_name').isLength({ min: 1, max: 50 }),
  body('title').optional().isString(),
  body('organization').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await invitationService.acceptInvitation(req.params.token, req.body);
      res.json(result);
    } catch (error) {
      logger.error('Error accepting invitation:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;