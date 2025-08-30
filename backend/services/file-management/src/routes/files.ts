import { Router, Request, Response } from 'express';
import { param, query, body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { FileStorageService } from '../services/fileStorageService';
import { MetadataService } from '../services/metadataService';
import { ProcessingService } from '../services/processingService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const storageService = new FileStorageService();
const metadataService = new MetadataService(prisma);
const processingService = new ProcessingService(prisma);

// GET /api/v1/files - List user files
router.get('/',
  query('category').optional().isString(),
  query('mimeType').optional().isString(),
  query('tags').optional().isString(),
  query('status').optional().isIn(['uploading', 'processing', 'ready', 'error']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const filters = {
        category: req.query.category as string,
        mimeType: req.query.mimeType as string,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0
      };

      const result = await metadataService.getUserFiles(userId, filters);

      res.json({
        success: true,
        files: result.files,
        total: result.total,
        limit: filters.limit,
        offset: filters.offset
      });

    } catch (error) {
      logger.error('Error fetching files:', error);
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  }
);

// GET /api/v1/files/search - Search files
router.get('/search',
  query('q').isString().notEmpty(),
  query('category').optional().isString(),
  query('mimeType').optional().isString(),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const query = req.query.q as string;
      const filters = {
        category: req.query.category as string,
        mimeType: req.query.mimeType as string,
        limit: parseInt(req.query.limit as string) || 20
      };

      const files = await metadataService.searchFiles(userId, query, filters);

      res.json({
        success: true,
        files,
        query,
        total: files.length
      });

    } catch (error) {
      logger.error('Error searching files:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }
);

// GET /api/v1/files/:fileId - Get file metadata
router.get('/:fileId',
  param('fileId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;

      const file = await metadataService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({
        success: true,
        file
      });

    } catch (error) {
      logger.error('Error fetching file metadata:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to fetch file' });
      }
    }
  }
);

// PUT /api/v1/files/:fileId - Update file metadata
router.put('/:fileId',
  param('fileId').isUUID(),
  body('description').optional().isString(),
  body('tags').optional().isArray(),
  body('category').optional().isString(),
  body('isPublic').optional().isBoolean(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;
      const updates = req.body;

      const updatedFile = await metadataService.updateFileMetadata(fileId, updates, userId);

      res.json({
        success: true,
        file: updatedFile
      });

    } catch (error) {
      logger.error('Error updating file metadata:', error);
      if (error.message === 'File not found') {
        res.status(404).json({ error: 'File not found' });
      } else if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to update file' });
      }
    }
  }
);

// DELETE /api/v1/files/:fileId - Delete file
router.delete('/:fileId',
  param('fileId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;

      const success = await metadataService.deleteFileRecord(fileId, userId);
      if (!success) {
        return res.status(404).json({ error: 'File not found or access denied' });
      }

      res.json({
        success: true,
        message: 'File deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }
);

// GET /api/v1/files/:fileId/download - Download file
router.get('/:fileId/download',
  param('fileId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;

      const file = await metadataService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Generate presigned download URL
      const downloadUrl = await storageService.generatePresignedDownloadUrl(file.storage_key, 3600);

      // Log download access
      await metadataService.logFileAccess(fileId, userId, 'download', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        downloadUrl,
        filename: file.original_name,
        mimeType: file.mime_type,
        size: file.file_size,
        expiresIn: 3600
      });

    } catch (error) {
      logger.error('Error generating download URL:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to generate download URL' });
      }
    }
  }
);

// GET /api/v1/files/:fileId/preview - Get file preview
router.get('/:fileId/preview',
  param('fileId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;

      const file = await metadataService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Get file from storage
      const fileBuffer = await storageService.getFile(file.storage_key);
      
      // Generate preview
      const preview = await processingService.generateDocumentPreview(fileBuffer, file.mime_type);

      res.json({
        success: true,
        preview,
        fileId,
        filename: file.original_name,
        mimeType: file.mime_type
      });

    } catch (error) {
      logger.error('Error generating preview:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to generate preview' });
      }
    }
  }
);

// GET /api/v1/files/:fileId/versions - Get file versions
router.get('/:fileId/versions',
  param('fileId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;

      const versions = await metadataService.getFileVersions(fileId, userId);

      res.json({
        success: true,
        versions,
        total: versions.length
      });

    } catch (error) {
      logger.error('Error fetching file versions:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to fetch versions' });
      }
    }
  }
);

// GET /api/v1/files/:fileId/access-logs - Get file access logs
router.get('/:fileId/access-logs',
  param('fileId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;

      const logs = await metadataService.getFileAccessLogs(fileId, userId);

      res.json({
        success: true,
        logs,
        total: logs.length
      });

    } catch (error) {
      logger.error('Error fetching access logs:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to fetch access logs' });
      }
    }
  }
);

// GET /api/v1/files/stats - Get file statistics
router.get('/stats',
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const stats = await metadataService.getFileStats(userId);

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Error fetching file stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
);

export default router;