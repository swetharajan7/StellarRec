import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/v1/conversion/convert - Convert document format
router.post('/convert',
  body('targetFormat').isString().notEmpty(),
  body('options').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { targetFormat, options = {} } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for conversion' });
      }

      const { conversionService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const result = await conversionService.convertDocument(
            file.buffer,
            file.mimetype,
            targetFormat,
            options
          );

          if (result.success && result.outputBuffer) {
            // Convert buffer to base64 for response
            const base64Output = result.outputBuffer.toString('base64');
            
            results.push({
              filename: file.originalname,
              success: true,
              outputFormat: result.outputFormat,
              originalSize: result.originalSize,
              convertedSize: result.convertedSize,
              data: `data:${result.outputFormat};base64,${base64Output}`,
              metadata: result.metadata
            });
          } else {
            results.push({
              filename: file.originalname,
              success: false,
              error: result.error
            });
          }

        } catch (error) {
          logger.error(`Conversion failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        targetFormat,
        results,
        converted: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Conversion endpoint error:', error);
      res.status(500).json({ error: 'Conversion failed' });
    }
  }
);

// POST /api/v1/conversion/optimize - Optimize document
router.post('/optimize',
  body('options').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { options = {} } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for optimization' });
      }

      const { conversionService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const result = await conversionService.optimizeDocument(
            file.buffer,
            file.mimetype,
            options
          );

          if (result.success && result.outputBuffer) {
            const base64Output = result.outputBuffer.toString('base64');
            const compressionRatio = ((result.originalSize - result.convertedSize!) / result.originalSize * 100).toFixed(2);
            
            results.push({
              filename: file.originalname,
              success: true,
              originalSize: result.originalSize,
              optimizedSize: result.convertedSize,
              compressionRatio: `${compressionRatio}%`,
              data: `data:${result.outputFormat};base64,${base64Output}`,
              metadata: result.metadata
            });
          } else {
            results.push({
              filename: file.originalname,
              success: false,
              error: result.error
            });
          }

        } catch (error) {
          logger.error(`Optimization failed for ${file.originalname}:`, error);
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
        optimized: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Optimization endpoint error:', error);
      res.status(500).json({ error: 'Optimization failed' });
    }
  }
);

// GET /api/v1/conversion/formats - Get supported conversion formats
router.get('/formats',
  async (req: Request, res: Response) => {
    try {
      const { conversionService } = req.app.locals.services;
      const supportedFormats = await conversionService.getSupportedConversions();

      res.json({
        success: true,
        supportedFormats
      });

    } catch (error) {
      logger.error('Error fetching supported formats:', error);
      res.status(500).json({ error: 'Failed to fetch supported formats' });
    }
  }
);

// POST /api/v1/conversion/batch-convert - Batch convert multiple files
router.post('/batch-convert',
  body('conversions').isArray().notEmpty(),
  body('conversions.*.targetFormat').isString().notEmpty(),
  body('conversions.*.options').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { conversions } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for batch conversion' });
      }

      if (files.length !== conversions.length) {
        return res.status(400).json({ 
          error: 'Number of files must match number of conversion specifications' 
        });
      }

      const { conversionService } = req.app.locals.services;
      const results = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const conversion = conversions[i];

        try {
          const result = await conversionService.convertDocument(
            file.buffer,
            file.mimetype,
            conversion.targetFormat,
            conversion.options || {}
          );

          if (result.success && result.outputBuffer) {
            const base64Output = result.outputBuffer.toString('base64');
            
            results.push({
              filename: file.originalname,
              targetFormat: conversion.targetFormat,
              success: true,
              outputFormat: result.outputFormat,
              originalSize: result.originalSize,
              convertedSize: result.convertedSize,
              data: `data:${result.outputFormat};base64,${base64Output}`,
              metadata: result.metadata
            });
          } else {
            results.push({
              filename: file.originalname,
              targetFormat: conversion.targetFormat,
              success: false,
              error: result.error
            });
          }

        } catch (error) {
          logger.error(`Batch conversion failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            targetFormat: conversion.targetFormat,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        results,
        converted: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Batch conversion endpoint error:', error);
      res.status(500).json({ error: 'Batch conversion failed' });
    }
  }
);

// POST /api/v1/conversion/multi-format - Convert single file to multiple formats
router.post('/multi-format',
  body('targetFormats').isArray().notEmpty(),
  body('options').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const files = (req as any).files as Express.Multer.File[];
      const { targetFormats, options = {} } = req.body;

      if (!files || files.length !== 1) {
        return res.status(400).json({ error: 'Exactly one file must be provided for multi-format conversion' });
      }

      const file = files[0];
      const { conversionService } = req.app.locals.services;
      const results = [];

      for (const targetFormat of targetFormats) {
        try {
          const result = await conversionService.convertDocument(
            file.buffer,
            file.mimetype,
            targetFormat,
            options
          );

          if (result.success && result.outputBuffer) {
            const base64Output = result.outputBuffer.toString('base64');
            
            results.push({
              targetFormat,
              success: true,
              outputFormat: result.outputFormat,
              originalSize: result.originalSize,
              convertedSize: result.convertedSize,
              data: `data:${result.outputFormat};base64,${base64Output}`,
              metadata: result.metadata
            });
          } else {
            results.push({
              targetFormat,
              success: false,
              error: result.error
            });
          }

        } catch (error) {
          logger.error(`Multi-format conversion failed for ${targetFormat}:`, error);
          results.push({
            targetFormat,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        filename: file.originalname,
        originalFormat: file.mimetype,
        results,
        converted: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Multi-format conversion endpoint error:', error);
      res.status(500).json({ error: 'Multi-format conversion failed' });
    }
  }
);

export default router;