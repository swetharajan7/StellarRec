import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { FileStorageService } from '../services/fileStorageService';
import { SecurityService } from '../services/securityService';
import { ProcessingService } from '../services/processingService';
import { MetadataService } from '../services/metadataService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const storageService = new FileStorageService();
const securityService = new SecurityService();
const processingService = new ProcessingService(prisma);
const metadataService = new MetadataService(prisma);

// POST /api/v1/upload - Upload files
router.post('/',
  body('category').optional().isString(),
  body('description').optional().isString(),
  body('tags').optional().isArray(),
  body('isPublic').optional().isBoolean(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const files = (req as any).files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const uploadResults = [];

      for (const file of files) {
        try {
          // Security validation
          const securityScan = await securityService.scanFileForMalware(file.buffer, file.originalname);
          if (!securityScan.isClean) {
            uploadResults.push({
              filename: file.originalname,
              success: false,
              error: `Security threat detected: ${securityScan.threats.join(', ')}`
            });
            continue;
          }

          const fileValidation = await securityService.validateFile(
            file.buffer, 
            file.originalname, 
            file.mimetype
          );
          if (!fileValidation.isValid) {
            uploadResults.push({
              filename: file.originalname,
              success: false,
              error: `File validation failed: ${fileValidation.issues.join(', ')}`
            });
            continue;
          }

          // Sanitize filename
          const sanitizedName = await securityService.sanitizeFilename(file.originalname);

          // Upload to storage
          const uploadResult = await storageService.uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype,
            userId,
            {
              category: req.body.category,
              description: req.body.description
            }
          );

          // Create file record
          const fileRecord = await metadataService.createFileRecord({
            user_id: userId,
            original_name: file.originalname,
            sanitized_name: sanitizedName,
            mime_type: file.mimetype,
            file_size: file.size,
            storage_key: uploadResult.storageKey,
            checksum: uploadResult.checksum,
            status: 'processing',
            tags: req.body.tags || [],
            description: req.body.description,
            category: req.body.category,
            is_public: req.body.isPublic || false,
            access_permissions: {}
          });

          // Process file asynchronously
          processingService.processFile(
            file.buffer,
            file.mimetype,
            file.originalname,
            { generateThumbnail: true, optimize: true }
          ).then(async (processingResult) => {
            await metadataService.updateFileMetadata(
              fileRecord.id,
              {
                processing_results: processingResult,
                status: processingResult.success ? 'ready' : 'error'
              },
              userId
            );
          }).catch(error => {
            logger.error('File processing failed:', error);
            metadataService.updateFileMetadata(
              fileRecord.id,
              { status: 'error' },
              userId
            );
          });

          uploadResults.push({
            filename: file.originalname,
            success: true,
            fileId: fileRecord.id,
            size: file.size,
            mimeType: file.mimetype,
            checksum: uploadResult.checksum
          });

        } catch (error) {
          logger.error(`Error uploading file ${file.originalname}:`, error);
          uploadResults.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        results: uploadResults,
        uploaded: uploadResults.filter(r => r.success).length,
        failed: uploadResults.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Upload endpoint error:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

// POST /api/v1/upload/presigned - Generate presigned upload URL
router.post('/presigned',
  body('filename').isString().notEmpty(),
  body('mimeType').isString().notEmpty(),
  body('size').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const { filename, mimeType, size } = req.body;

      // Validate file type and size
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (size > maxSize) {
        return res.status(400).json({ error: 'File size exceeds maximum allowed' });
      }

      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/gif'
      ];

      if (!allowedTypes.includes(mimeType)) {
        return res.status(400).json({ error: 'File type not allowed' });
      }

      // Generate storage key
      const fileId = require('uuid').v4();
      const extension = filename.substring(filename.lastIndexOf('.'));
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const storageKey = `users/${userId}/${year}/${month}/${day}/${fileId}${extension}`;

      // Generate presigned URL
      const uploadUrl = await storageService.generatePresignedUploadUrl(storageKey, mimeType, 3600);

      res.json({
        success: true,
        uploadUrl,
        fileId,
        storageKey,
        expiresIn: 3600
      });

    } catch (error) {
      logger.error('Presigned URL generation error:', error);
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  }
);

export default router;