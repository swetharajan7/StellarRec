import { Router, Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { FileStorageService } from '../services/fileStorageService';
import { MetadataService } from '../services/metadataService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const storageService = new FileStorageService();
const metadataService = new MetadataService(prisma);

// GET /api/v1/storage/stats - Get storage statistics
router.get('/stats',
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      
      const [userStats, storageStats] = await Promise.all([
        metadataService.getFileStats(userId),
        storageService.getStorageStats()
      ]);

      res.json({
        success: true,
        user: userStats,
        storage: storageStats
      });

    } catch (error) {
      logger.error('Error fetching storage stats:', error);
      res.status(500).json({ error: 'Failed to fetch storage statistics' });
    }
  }
);

// POST /api/v1/storage/:fileId/backup - Create file backup
router.post('/:fileId/backup',
  param('fileId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;

      // Verify user has access to the file
      const file = await metadataService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Create backup
      const backupKey = await storageService.createFileBackup(file.storage_key);

      // Log the backup creation
      await metadataService.logFileAccess(fileId, userId, 'view', {
        action: 'backup_created',
        backupKey
      });

      res.json({
        success: true,
        message: 'Backup created successfully',
        backupKey,
        originalFile: file.original_name
      });

    } catch (error) {
      logger.error('Error creating backup:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to create backup' });
      }
    }
  }
);

// POST /api/v1/storage/:fileId/copy - Copy file
router.post('/:fileId/copy',
  param('fileId').isUUID(),
  body('newName').optional().isString(),
  body('category').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;
      const { newName, category } = req.body;

      // Verify user has access to the file
      const originalFile = await metadataService.getFileMetadata(fileId, userId);
      if (!originalFile) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Generate new storage key
      const newFileId = require('uuid').v4();
      const extension = originalFile.original_name.substring(originalFile.original_name.lastIndexOf('.'));
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const newStorageKey = `users/${userId}/${year}/${month}/${day}/${newFileId}${extension}`;

      // Copy file in storage
      const copySuccess = await storageService.copyFile(originalFile.storage_key, newStorageKey);
      if (!copySuccess) {
        return res.status(500).json({ error: 'Failed to copy file' });
      }

      // Create new file record
      const copyName = newName || `Copy of ${originalFile.original_name}`;
      const newFileRecord = await metadataService.createFileRecord({
        user_id: userId,
        original_name: copyName,
        sanitized_name: copyName,
        mime_type: originalFile.mime_type,
        file_size: originalFile.file_size,
        storage_key: newStorageKey,
        checksum: originalFile.checksum,
        status: 'ready',
        tags: originalFile.tags,
        description: `Copy of ${originalFile.description || originalFile.original_name}`,
        category: category || originalFile.category,
        is_public: false,
        access_permissions: {},
        processing_results: originalFile.processing_results
      });

      res.json({
        success: true,
        message: 'File copied successfully',
        originalFile: {
          id: originalFile.id,
          name: originalFile.original_name
        },
        copiedFile: {
          id: newFileRecord.id,
          name: copyName
        }
      });

    } catch (error) {
      logger.error('Error copying file:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to copy file' });
      }
    }
  }
);

// POST /api/v1/storage/:fileId/move - Move file
router.post('/:fileId/move',
  param('fileId').isUUID(),
  body('newCategory').optional().isString(),
  body('newPath').optional().isString(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;
      const { newCategory, newPath } = req.body;

      // Verify user has access to the file
      const file = await metadataService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      let updates: any = {};
      
      // Update category if provided
      if (newCategory) {
        updates.category = newCategory;
      }

      // Move file in storage if new path provided
      if (newPath) {
        const newStorageKey = `users/${userId}/${newPath}`;
        const moveSuccess = await storageService.moveFile(file.storage_key, newStorageKey);
        if (!moveSuccess) {
          return res.status(500).json({ error: 'Failed to move file' });
        }
        updates.storage_key = newStorageKey;
      }

      // Update file record
      if (Object.keys(updates).length > 0) {
        await metadataService.updateFileMetadata(fileId, updates, userId);
      }

      res.json({
        success: true,
        message: 'File moved successfully',
        fileId,
        updates
      });

    } catch (error) {
      logger.error('Error moving file:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to move file' });
      }
    }
  }
);

// POST /api/v1/storage/:fileId/validate - Validate file integrity
router.post('/:fileId/validate',
  param('fileId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;

      // Verify user has access to the file
      const file = await metadataService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Validate file integrity
      const isValid = await storageService.validateFileIntegrity(file.storage_key, file.checksum);

      res.json({
        success: true,
        fileId,
        filename: file.original_name,
        isValid,
        checksum: file.checksum,
        message: isValid ? 'File integrity verified' : 'File integrity check failed'
      });

    } catch (error) {
      logger.error('Error validating file integrity:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Failed to validate file' });
      }
    }
  }
);

// DELETE /api/v1/storage/cleanup - Cleanup expired files
router.delete('/cleanup',
  async (req: Request, res: Response) => {
    try {
      // This endpoint should be restricted to admin users or system processes
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;

      if (userRole !== 'admin' && userRole !== 'system') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const cleanedCount = await metadataService.cleanupExpiredFiles();

      res.json({
        success: true,
        message: `Cleaned up ${cleanedCount} expired files`,
        cleanedCount
      });

    } catch (error) {
      logger.error('Error during cleanup:', error);
      res.status(500).json({ error: 'Cleanup failed' });
    }
  }
);

// GET /api/v1/storage/health - Storage health check
router.get('/health',
  async (req: Request, res: Response) => {
    try {
      const storageStats = await storageService.getStorageStats();
      
      res.json({
        success: true,
        status: 'healthy',
        storage: storageStats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Storage health check failed:', error);
      res.status(503).json({ 
        success: false,
        status: 'unhealthy',
        error: 'Storage service unavailable',
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;