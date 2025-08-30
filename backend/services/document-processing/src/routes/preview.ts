import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/v1/preview/generate - Generate document previews
router.post('/generate',
  body('previewType').optional().isIn(['thumbnail', 'page', 'text', 'all']),
  body('options').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { previewType = 'thumbnail', options = {} } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for preview generation' });
      }

      const { previewService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const result = await previewService.generatePreview(
            file.buffer,
            file.mimetype,
            previewType,
            options
          );

          results.push({
            filename: file.originalname,
            mimeType: file.mimetype,
            ...result
          });

        } catch (error) {
          logger.error(`Preview generation failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            mimeType: file.mimetype,
            success: false,
            previews: [],
            error: error.message
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const totalPreviews = results.reduce((sum, r) => sum + (r.previews?.length || 0), 0);

      res.json({
        success: true,
        previewType,
        results,
        summary: {
          total: files.length,
          successful,
          failed: files.length - successful,
          totalPreviews
        }
      });

    } catch (error) {
      logger.error('Preview generation endpoint error:', error);
      res.status(500).json({ error: 'Preview generation failed' });
    }
  }
);

// POST /api/v1/preview/thumbnails - Generate thumbnails specifically
router.post('/thumbnails',
  body('width').optional().isInt({ min: 50, max: 1000 }),
  body('height').optional().isInt({ min: 50, max: 1000 }),
  body('quality').optional().isInt({ min: 1, max: 100 }),
  body('format').optional().isIn(['jpeg', 'png', 'webp']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const options = {
        width: req.body.width || 300,
        height: req.body.height || 300,
        quality: req.body.quality || 85,
        format: req.body.format || 'jpeg'
      };

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for thumbnail generation' });
      }

      const { previewService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const result = await previewService.generatePreview(
            file.buffer,
            file.mimetype,
            'thumbnail',
            options
          );

          if (result.success && result.previews.length > 0) {
            const thumbnail = result.previews[0];
            results.push({
              filename: file.originalname,
              success: true,
              thumbnail: {
                data: thumbnail.data,
                format: thumbnail.format,
                width: thumbnail.width,
                height: thumbnail.height
              },
              metadata: result.metadata
            });
          } else {
            results.push({
              filename: file.originalname,
              success: false,
              error: result.error || 'No thumbnail generated'
            });
          }

        } catch (error) {
          logger.error(`Thumbnail generation failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        options,
        results,
        generated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Thumbnail generation endpoint error:', error);
      res.status(500).json({ error: 'Thumbnail generation failed' });
    }
  }
);

// POST /api/v1/preview/pages - Generate page previews
router.post('/pages',
  body('width').optional().isInt({ min: 100, max: 2000 }),
  body('height').optional().isInt({ min: 100, max: 2000 }),
  body('quality').optional().isInt({ min: 1, max: 100 }),
  body('maxPages').optional().isInt({ min: 1, max: 20 }),
  body('format').optional().isIn(['jpeg', 'png', 'webp']),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const options = {
        width: req.body.width || 600,
        height: req.body.height || 800,
        quality: req.body.quality || 90,
        maxPages: req.body.maxPages || 5,
        format: req.body.format || 'jpeg'
      };

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for page preview generation' });
      }

      const { previewService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const result = await previewService.generatePreview(
            file.buffer,
            file.mimetype,
            'page',
            options
          );

          if (result.success) {
            const pagePreviews = result.previews.filter(p => p.type === 'page');
            results.push({
              filename: file.originalname,
              success: true,
              pages: pagePreviews,
              totalPages: result.metadata?.totalPages,
              metadata: result.metadata
            });
          } else {
            results.push({
              filename: file.originalname,
              success: false,
              error: result.error || 'No page previews generated'
            });
          }

        } catch (error) {
          logger.error(`Page preview generation failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        options,
        results,
        generated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Page preview generation endpoint error:', error);
      res.status(500).json({ error: 'Page preview generation failed' });
    }
  }
);

// POST /api/v1/preview/text - Generate text previews
router.post('/text',
  async (req: Request, res: Response) => {
    try {
      const files = (req as any).files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for text preview generation' });
      }

      const { previewService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const result = await previewService.generatePreview(
            file.buffer,
            file.mimetype,
            'text'
          );

          if (result.success) {
            const textPreviews = result.previews.filter(p => p.type === 'text');
            results.push({
              filename: file.originalname,
              success: true,
              textPreviews,
              metadata: result.metadata
            });
          } else {
            results.push({
              filename: file.originalname,
              success: false,
              error: result.error || 'No text preview generated'
            });
          }

        } catch (error) {
          logger.error(`Text preview generation failed for ${file.originalname}:`, error);
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
        generated: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Text preview generation endpoint error:', error);
      res.status(500).json({ error: 'Text preview generation failed' });
    }
  }
);

// POST /api/v1/preview/multiple-formats - Generate multiple preview formats
router.post('/multiple-formats',
  body('formats').isArray().notEmpty(),
  body('formats.*.type').isIn(['thumbnail', 'page', 'text']),
  body('formats.*.options').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { formats } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for multi-format preview generation' });
      }

      if (files.length > 1) {
        return res.status(400).json({ error: 'Only one file allowed for multi-format preview generation' });
      }

      const file = files[0];
      const { previewService } = req.app.locals.services;

      try {
        const results = await previewService.generateMultipleFormats(
          file.buffer,
          file.mimetype,
          formats
        );

        res.json({
          success: true,
          filename: file.originalname,
          mimeType: file.mimetype,
          formats: results,
          generated: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        });

      } catch (error) {
        logger.error(`Multi-format preview generation failed for ${file.originalname}:`, error);
        res.status(500).json({ error: error.message });
      }

    } catch (error) {
      logger.error('Multi-format preview endpoint error:', error);
      res.status(500).json({ error: 'Multi-format preview generation failed' });
    }
  }
);

// GET /api/v1/preview/formats - Get supported preview formats
router.get('/formats',
  async (req: Request, res: Response) => {
    try {
      const { previewService } = req.app.locals.services;
      const supportedFormats = await previewService.getSupportedFormats();

      res.json({
        success: true,
        supportedFormats
      });

    } catch (error) {
      logger.error('Error fetching supported preview formats:', error);
      res.status(500).json({ error: 'Failed to fetch supported preview formats' });
    }
  }
);

export default router;