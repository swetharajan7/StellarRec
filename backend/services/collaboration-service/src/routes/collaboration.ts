import { Router, Request, Response } from 'express';
import { param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { CollaborationService } from '../services/collaborationService';

const router = Router();
const prisma = new PrismaClient();

// This will be injected by the main app
let collaborationService: CollaborationService;

export const setCollaborationService = (service: CollaborationService) => {
  collaborationService = service;
};

// GET /api/v1/collaboration/documents/:documentId/comments - Get document comments
router.get('/documents/:documentId/comments',
  param('documentId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const documentId = req.params.documentId;

      const comments = await collaborationService.getDocumentComments(documentId, userId);
      res.json({ comments });
    } catch (error) {
      logger.error('Error fetching document comments:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to fetch comments' });
      }
    }
  }
);

// GET /api/v1/collaboration/documents/:documentId/history - Get collaboration history
router.get('/documents/:documentId/history',
  param('documentId').isUUID(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const documentId = req.params.documentId;

      const history = await collaborationService.getCollaborationHistory(documentId, userId);
      res.json({ history });
    } catch (error) {
      logger.error('Error fetching collaboration history:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to fetch history' });
      }
    }
  }
);

// GET /api/v1/collaboration/documents/:documentId/presence - Get current user presence
router.get('/documents/:documentId/presence',
  param('documentId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const documentId = req.params.documentId;
      
      // Get active presence from memory (this would be enhanced with Redis in production)
      const presence = await prisma.user_presence.findMany({
        where: {
          document_id: documentId,
          last_seen: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Active in last 5 minutes
          }
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true
            }
          }
        }
      });

      res.json({ presence });
    } catch (error) {
      logger.error('Error fetching user presence:', error);
      res.status(500).json({ error: 'Failed to fetch presence' });
    }
  }
);

// POST /api/v1/collaboration/documents/:documentId/comments - Add comment (via HTTP as fallback)
router.post('/documents/:documentId/comments',
  param('documentId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const documentId = req.params.documentId;
      const { content, position, threadId } = req.body;

      const comment = await prisma.comments.create({
        data: {
          document_id: documentId,
          user_id: userId,
          content,
          position,
          thread_id: threadId,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true
            }
          }
        }
      });

      res.status(201).json({ comment });
    } catch (error) {
      logger.error('Error adding comment:', error);
      res.status(500).json({ error: 'Failed to add comment' });
    }
  }
);

// PUT /api/v1/collaboration/comments/:commentId/resolve - Resolve comment
router.put('/comments/:commentId/resolve',
  param('commentId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const commentId = req.params.commentId;

      const comment = await prisma.comments.update({
        where: { id: commentId },
        data: {
          status: 'resolved',
          updated_at: new Date()
        }
      });

      res.json({ comment });
    } catch (error) {
      logger.error('Error resolving comment:', error);
      res.status(500).json({ error: 'Failed to resolve comment' });
    }
  }
);

// GET /api/v1/collaboration/stats - Get collaboration statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const [totalComments, activeComments, resolvedComments, documentsCollaborated] = await Promise.all([
      prisma.comments.count({
        where: { user_id: userId }
      }),
      prisma.comments.count({
        where: { user_id: userId, status: 'active' }
      }),
      prisma.comments.count({
        where: { user_id: userId, status: 'resolved' }
      }),
      prisma.document_operations.groupBy({
        by: ['document_id'],
        where: { user_id: userId },
        _count: { document_id: true }
      })
    ]);

    const stats = {
      total_comments: totalComments,
      active_comments: activeComments,
      resolved_comments: resolvedComments,
      documents_collaborated: documentsCollaborated.length,
      collaboration_score: Math.min(100, Math.round((resolvedComments / Math.max(totalComments, 1)) * 100))
    };

    res.json({ stats });
  } catch (error) {
    logger.error('Error fetching collaboration stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;