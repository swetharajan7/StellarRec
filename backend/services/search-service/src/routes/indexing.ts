import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/v1/indexing/document - Index a single document
router.post('/document',
  body('id').isString().notEmpty(),
  body('type').isString().notEmpty(),
  body('title').isString().notEmpty(),
  body('tags').isArray(),
  body('category').isString().notEmpty(),
  body('description').optional().isString(),
  body('content').optional().isString(),
  body('author').optional().isString(),
  body('metadata').optional().isObject(),
  body('url').optional().isURL(),
  body('imageUrl').optional().isURL(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { indexingService } = req.app.locals.services;

      const document = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const success = await indexingService.indexDocument(document);

      if (success) {
        res.json({
          success: true,
          message: 'Document indexed successfully',
          documentId: document.id
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to index document'
        });
      }

    } catch (error) {
      logger.error('Document indexing error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Document indexing failed'
      });
    }
  }
);

// POST /api/v1/indexing/bulk - Bulk index multiple documents
router.post('/bulk',
  body('documents').isArray().notEmpty(),
  body('indexType').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { indexingService } = req.app.locals.services;

      const documents = req.body.documents.map((doc: any) => ({
        ...doc,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        updatedAt: new Date()
      }));

      const result = await indexingService.bulkIndex(documents, req.body.indexType);

      res.json({
        success: true,
        message: 'Bulk indexing completed',
        ...result
      });

    } catch (error) {
      logger.error('Bulk indexing error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Bulk indexing failed',
        success: 0,
        failed: req.body.documents?.length || 0
      });
    }
  }
);

// PUT /api/v1/indexing/document/:id - Update indexed document
router.put('/document/:id',
  param('id').isString().notEmpty(),
  body('indexType').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { indexingService } = req.app.locals.services;

      const documentId = req.params.id;
      const updates = {
        ...req.body,
        updatedAt: new Date()
      };
      delete updates.indexType; // Remove from updates

      const success = await indexingService.updateDocument(documentId, updates, req.body.indexType);

      if (success) {
        res.json({
          success: true,
          message: 'Document updated successfully',
          documentId
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Document not found or update failed'
        });
      }

    } catch (error) {
      logger.error('Document update error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Document update failed'
      });
    }
  }
);

// DELETE /api/v1/indexing/document/:id - Delete indexed document
router.delete('/document/:id',
  param('id').isString().notEmpty(),
  query('indexType').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { indexingService } = req.app.locals.services;

      const documentId = req.params.id;
      const indexType = req.query.indexType as string;

      const success = await indexingService.deleteDocument(documentId, indexType);

      if (success) {
        res.json({
          success: true,
          message: 'Document deleted successfully',
          documentId
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Document not found or deletion failed'
        });
      }

    } catch (error) {
      logger.error('Document deletion error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Document deletion failed'
      });
    }
  }
);

// POST /api/v1/indexing/reindex - Reindex from source to target
router.post('/reindex',
  body('sourceIndex').isString().notEmpty(),
  body('targetIndex').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // This endpoint should be restricted to admin users
      const userRole = (req as any).user?.role;
      if (userRole !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Admin access required'
        });
      }

      const { indexingService } = req.app.locals.services;

      const success = await indexingService.reindexAll(req.body.sourceIndex, req.body.targetIndex);

      if (success) {
        res.json({
          success: true,
          message: `Reindexing completed from ${req.body.sourceIndex} to ${req.body.targetIndex}`
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Reindexing failed'
        });
      }

    } catch (error) {
      logger.error('Reindexing error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Reindexing failed'
      });
    }
  }
);

// GET /api/v1/indexing/stats - Get indexing statistics
router.get('/stats',
  async (req: Request, res: Response) => {
    try {
      const { indexingService } = req.app.locals.services;

      const stats = await indexingService.getIndexStats();

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Indexing stats error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get indexing statistics'
      });
    }
  }
);

// POST /api/v1/indexing/optimize - Optimize indices
router.post('/optimize',
  async (req: Request, res: Response) => {
    try {
      // This endpoint should be restricted to admin users
      const userRole = (req as any).user?.role;
      if (userRole !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Admin access required'
        });
      }

      const { indexingService } = req.app.locals.services;

      await indexingService.optimizeIndices();

      res.json({
        success: true,
        message: 'Index optimization completed'
      });

    } catch (error) {
      logger.error('Index optimization error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Index optimization failed'
      });
    }
  }
);

// DELETE /api/v1/indexing/clear/:indexType - Clear specific index
router.delete('/clear/:indexType',
  param('indexType').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // This endpoint should be restricted to admin users
      const userRole = (req as any).user?.role;
      if (userRole !== 'admin') {
        return res.status(403).json({ 
          success: false,
          error: 'Admin access required'
        });
      }

      const { indexingService } = req.app.locals.services;

      const indexType = req.params.indexType;
      const success = await indexingService.clearIndex(indexType);

      if (success) {
        res.json({
          success: true,
          message: `Index ${indexType} cleared successfully`
        });
      } else {
        res.status(404).json({
          success: false,
          error: `Index type not found: ${indexType}`
        });
      }

    } catch (error) {
      logger.error('Index clearing error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Index clearing failed'
      });
    }
  }
);

export default router;