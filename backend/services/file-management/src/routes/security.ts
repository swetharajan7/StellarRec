import { Router, Request, Response } from 'express';
import { param, body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { SecurityService } from '../services/securityService';
import { MetadataService } from '../services/metadataService';
import { FileStorageService } from '../services/fileStorageService';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const securityService = new SecurityService();
const metadataService = new MetadataService(prisma);
const storageService = new FileStorageService();

// POST /api/v1/security/scan/:fileId - Scan file for security threats
router.post('/scan/:fileId',
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

      // Get file from storage
      const fileBuffer = await storageService.getFile(file.storage_key);

      // Perform security scan
      const scanResult = await securityService.scanFileForMalware(fileBuffer, file.original_name);

      // Update file record with scan results
      await metadataService.updateFileMetadata(
        fileId,
        {
          security_scan_results: {
            ...scanResult,
            scannedAt: new Date().toISOString()
          }
        },
        userId
      );

      res.json({
        success: true,
        fileId,
        filename: file.original_name,
        scanResult: {
          isClean: scanResult.isClean,
          threats: scanResult.threats,
          scanTime: scanResult.scanTime,
          scanEngine: scanResult.scanEngine,
          scannedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error scanning file:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Security scan failed' });
      }
    }
  }
);

// POST /api/v1/security/validate/:fileId - Validate file structure and content
router.post('/validate/:fileId',
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

      // Get file from storage
      const fileBuffer = await storageService.getFile(file.storage_key);

      // Validate file
      const validationResult = await securityService.validateFile(
        fileBuffer,
        file.original_name,
        file.mime_type
      );

      res.json({
        success: true,
        fileId,
        filename: file.original_name,
        validation: {
          isValid: validationResult.isValid,
          issues: validationResult.issues,
          fileType: validationResult.fileType,
          actualMimeType: validationResult.actualMimeType,
          validatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error validating file:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'File validation failed' });
      }
    }
  }
);

// POST /api/v1/security/encrypt/:fileId - Encrypt file
router.post('/encrypt/:fileId',
  param('fileId').isUUID(),
  body('password').optional().isString().isLength({ min: 8 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;
      const { password } = req.body;

      // Verify user has access to the file
      const file = await metadataService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Get file from storage
      const fileBuffer = await storageService.getFile(file.storage_key);

      // Encrypt file
      const encryptionResult = await securityService.encryptFile(fileBuffer, password);

      // Generate new storage key for encrypted file
      const encryptedStorageKey = `${file.storage_key}.encrypted`;

      // Upload encrypted file
      await storageService.uploadFile(
        encryptionResult.encrypted,
        `${file.original_name}.encrypted`,
        'application/octet-stream',
        userId,
        {
          encrypted: 'true',
          originalFileId: fileId,
          encryptionKey: encryptionResult.key,
          encryptionIv: encryptionResult.iv
        }
      );

      // Create new file record for encrypted version
      const encryptedFileRecord = await metadataService.createFileRecord({
        user_id: userId,
        original_name: `${file.original_name}.encrypted`,
        sanitized_name: `${file.sanitized_name}.encrypted`,
        mime_type: 'application/octet-stream',
        file_size: encryptionResult.encrypted.length,
        storage_key: encryptedStorageKey,
        checksum: securityService.generateFileHash(encryptionResult.encrypted),
        status: 'ready',
        tags: [...file.tags, 'encrypted'],
        description: `Encrypted version of ${file.original_name}`,
        category: file.category,
        is_public: false,
        access_permissions: {}
      });

      res.json({
        success: true,
        originalFileId: fileId,
        encryptedFileId: encryptedFileRecord.id,
        message: 'File encrypted successfully',
        encryptionKey: encryptionResult.key, // In production, this should be handled more securely
        encryptionIv: encryptionResult.iv
      });

    } catch (error) {
      logger.error('Error encrypting file:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'File encryption failed' });
      }
    }
  }
);

// POST /api/v1/security/decrypt/:fileId - Decrypt file
router.post('/decrypt/:fileId',
  param('fileId').isUUID(),
  body('key').isString().notEmpty(),
  body('iv').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const fileId = req.params.fileId;
      const { key, iv } = req.body;

      // Verify user has access to the file
      const file = await metadataService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Check if file is encrypted
      if (!file.original_name.endsWith('.encrypted')) {
        return res.status(400).json({ error: 'File is not encrypted' });
      }

      // Get encrypted file from storage
      const encryptedBuffer = await storageService.getFile(file.storage_key);

      // Decrypt file
      const decryptedBuffer = await securityService.decryptFile(encryptedBuffer, key, iv);

      // Generate storage key for decrypted file
      const originalName = file.original_name.replace('.encrypted', '');
      const decryptedStorageKey = file.storage_key.replace('.encrypted', '.decrypted');

      // Upload decrypted file
      await storageService.uploadFile(
        decryptedBuffer,
        originalName,
        'application/octet-stream', // Would need to detect original mime type
        userId,
        {
          decrypted: 'true',
          originalEncryptedFileId: fileId
        }
      );

      // Create new file record for decrypted version
      const decryptedFileRecord = await metadataService.createFileRecord({
        user_id: userId,
        original_name: originalName,
        sanitized_name: originalName,
        mime_type: 'application/octet-stream', // Would need to detect original mime type
        file_size: decryptedBuffer.length,
        storage_key: decryptedStorageKey,
        checksum: securityService.generateFileHash(decryptedBuffer),
        status: 'ready',
        tags: file.tags.filter(tag => tag !== 'encrypted'),
        description: `Decrypted version of ${originalName}`,
        category: file.category,
        is_public: false,
        access_permissions: {}
      });

      res.json({
        success: true,
        encryptedFileId: fileId,
        decryptedFileId: decryptedFileRecord.id,
        message: 'File decrypted successfully'
      });

    } catch (error) {
      logger.error('Error decrypting file:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'File decryption failed' });
      }
    }
  }
);

// POST /api/v1/security/sanitize-filename - Sanitize filename
router.post('/sanitize-filename',
  body('filename').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { filename } = req.body;
      const sanitizedFilename = await securityService.sanitizeFilename(filename);

      res.json({
        success: true,
        original: filename,
        sanitized: sanitizedFilename,
        changed: filename !== sanitizedFilename
      });

    } catch (error) {
      logger.error('Error sanitizing filename:', error);
      res.status(500).json({ error: 'Filename sanitization failed' });
    }
  }
);

// POST /api/v1/security/generate-token - Generate secure token
router.post('/generate-token',
  async (req: Request, res: Response) => {
    try {
      const token = await securityService.generateSecureToken();

      res.json({
        success: true,
        token,
        length: token.length,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error generating secure token:', error);
      res.status(500).json({ error: 'Token generation failed' });
    }
  }
);

// GET /api/v1/security/file-hash/:fileId - Get file hash
router.get('/file-hash/:fileId',
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

      // Get file from storage
      const fileBuffer = await storageService.getFile(file.storage_key);

      // Generate different hash algorithms
      const hashes = {
        md5: securityService.generateFileHash(fileBuffer, 'md5'),
        sha1: securityService.generateFileHash(fileBuffer, 'sha1'),
        sha256: securityService.generateFileHash(fileBuffer, 'sha256'),
        sha512: securityService.generateFileHash(fileBuffer, 'sha512')
      };

      res.json({
        success: true,
        fileId,
        filename: file.original_name,
        size: file.file_size,
        storedChecksum: file.checksum,
        hashes,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error generating file hash:', error);
      if (error.message === 'Access denied') {
        res.status(403).json({ error: 'Access denied' });
      } else {
        res.status(500).json({ error: 'Hash generation failed' });
      }
    }
  }
);

export default router;