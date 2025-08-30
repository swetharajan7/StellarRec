import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/v1/ocr/extract - Extract text from images using OCR
router.post('/extract',
  body('language').optional().isString(),
  body('options').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { language = 'eng', options = {} } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No image files provided for OCR' });
      }

      // Validate that all files are images
      const nonImageFiles = files.filter(file => !file.mimetype.startsWith('image/'));
      if (nonImageFiles.length > 0) {
        return res.status(400).json({ 
          error: 'All files must be images for OCR processing',
          invalidFiles: nonImageFiles.map(f => f.originalname)
        });
      }

      const { ocrService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          // Validate image for OCR
          const validation = await ocrService.validateImageForOCR(file.buffer);
          
          if (!validation.isValid) {
            results.push({
              filename: file.originalname,
              success: false,
              error: 'Image validation failed',
              issues: validation.issues,
              recommendations: validation.recommendations
            });
            continue;
          }

          const result = await ocrService.extractTextFromImage(
            file.buffer,
            language,
            options
          );

          results.push({
            filename: file.originalname,
            ...result
          });

        } catch (error) {
          logger.error(`OCR failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            success: false,
            text: '',
            confidence: 0,
            processingTime: 0,
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const averageConfidence = successful > 0 
        ? Math.round(results.filter(r => r.success).reduce((sum, r) => sum + r.confidence, 0) / successful)
        : 0;

      res.json({
        success: true,
        language,
        results,
        summary: {
          total: files.length,
          successful,
          failed: files.length - successful,
          averageConfidence
        }
      });

    } catch (error) {
      logger.error('OCR extraction endpoint error:', error);
      res.status(500).json({ error: 'OCR extraction failed' });
    }
  }
);

// POST /api/v1/ocr/batch - Batch OCR processing
router.post('/batch',
  body('language').optional().isString(),
  body('options').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { language = 'eng', options = {} } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No image files provided for batch OCR' });
      }

      if (files.length > 20) {
        return res.status(400).json({ error: 'Maximum 20 files allowed for batch OCR processing' });
      }

      const { ocrService } = req.app.locals.services;
      const batchId = require('uuid').v4();

      logger.info(`Starting batch OCR processing: ${batchId} (${files.length} files)`);

      // Prepare image buffers
      const imageBuffers = files.map(file => file.buffer);
      
      // Process batch
      const results = await ocrService.batchOCR(imageBuffers, language, options);

      // Combine with filenames
      const formattedResults = results.map((result, index) => ({
        filename: files[index].originalname,
        fileIndex: index + 1,
        ...result
      }));

      const successful = formattedResults.filter(r => r.success).length;
      const averageConfidence = successful > 0 
        ? Math.round(formattedResults.filter(r => r.success).reduce((sum, r) => sum + r.confidence, 0) / successful)
        : 0;

      logger.info(`Batch OCR completed: ${batchId} (${successful}/${files.length} successful)`);

      res.json({
        success: true,
        batchId,
        language,
        results: formattedResults,
        summary: {
          total: files.length,
          successful,
          failed: files.length - successful,
          averageConfidence,
          totalProcessingTime: formattedResults.reduce((sum, r) => sum + r.processingTime, 0)
        }
      });

    } catch (error) {
      logger.error('Batch OCR endpoint error:', error);
      res.status(500).json({ error: 'Batch OCR processing failed' });
    }
  }
);

// POST /api/v1/ocr/detect-language - Detect language in image
router.post('/detect-language',
  async (req: Request, res: Response) => {
    try {
      const files = (req as any).files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No image files provided for language detection' });
      }

      const { ocrService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          if (!file.mimetype.startsWith('image/')) {
            results.push({
              filename: file.originalname,
              success: false,
              error: 'File is not an image'
            });
            continue;
          }

          const result = await ocrService.detectLanguage(file.buffer);
          
          results.push({
            filename: file.originalname,
            success: true,
            detectedLanguage: result.language,
            confidence: result.confidence
          });

        } catch (error) {
          logger.error(`Language detection failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        results,
        detected: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Language detection endpoint error:', error);
      res.status(500).json({ error: 'Language detection failed' });
    }
  }
);

// GET /api/v1/ocr/languages - Get supported OCR languages
router.get('/languages',
  async (req: Request, res: Response) => {
    try {
      const { ocrService } = req.app.locals.services;
      const supportedLanguages = await ocrService.getSupportedLanguages();

      res.json({
        success: true,
        supportedLanguages,
        total: supportedLanguages.length
      });

    } catch (error) {
      logger.error('Error fetching supported languages:', error);
      res.status(500).json({ error: 'Failed to fetch supported languages' });
    }
  }
);

// POST /api/v1/ocr/validate - Validate images for OCR processing
router.post('/validate',
  async (req: Request, res: Response) => {
    try {
      const files = (req as any).files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No image files provided for validation' });
      }

      const { ocrService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          if (!file.mimetype.startsWith('image/')) {
            results.push({
              filename: file.originalname,
              isValid: false,
              issues: ['File is not an image'],
              recommendations: ['Upload an image file (JPEG, PNG, TIFF, etc.)']
            });
            continue;
          }

          const validation = await ocrService.validateImageForOCR(file.buffer);
          
          results.push({
            filename: file.originalname,
            ...validation
          });

        } catch (error) {
          logger.error(`Image validation failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            isValid: false,
            issues: ['Validation failed'],
            recommendations: ['Ensure the image file is valid and not corrupted'],
            error: error.message
          });
        }
      }

      const validImages = results.filter(r => r.isValid).length;

      res.json({
        success: true,
        results,
        summary: {
          total: files.length,
          valid: validImages,
          invalid: files.length - validImages
        }
      });

    } catch (error) {
      logger.error('Image validation endpoint error:', error);
      res.status(500).json({ error: 'Image validation failed' });
    }
  }
);

// POST /api/v1/ocr/pdf - Extract text from PDF using OCR
router.post('/pdf',
  body('language').optional().isString(),
  body('options').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { language = 'eng', options = {} } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No PDF files provided for OCR' });
      }

      // Validate that all files are PDFs
      const nonPdfFiles = files.filter(file => file.mimetype !== 'application/pdf');
      if (nonPdfFiles.length > 0) {
        return res.status(400).json({ 
          error: 'All files must be PDF documents',
          invalidFiles: nonPdfFiles.map(f => f.originalname)
        });
      }

      const { ocrService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const result = await ocrService.extractTextFromPDF(
            file.buffer,
            language,
            options
          );

          results.push({
            filename: file.originalname,
            pages: result,
            totalPages: result.length,
            successful: result.filter(page => page.success).length,
            failed: result.filter(page => !page.success).length
          });

        } catch (error) {
          logger.error(`PDF OCR failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        language,
        results,
        processed: results.length
      });

    } catch (error) {
      logger.error('PDF OCR endpoint error:', error);
      res.status(500).json({ error: 'PDF OCR processing failed' });
    }
  }
);

export default router;