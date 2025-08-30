import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/v1/processing/process - Process uploaded documents
router.post('/process',
  body('jobType').isIn(['conversion', 'ocr', 'preview', 'metadata', 'indexing', 'full']),
  body('parameters').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const files = (req as any).files as Express.Multer.File[];
      const { jobType, parameters = {} } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for processing' });
      }

      const { documentProcessingService } = req.app.locals.services;
      const results = [];

      for (const file of files) {
        try {
          const result = await documentProcessingService.processDocument(
            file.buffer,
            file.originalname,
            file.mimetype,
            jobType,
            parameters
          );

          results.push({
            filename: file.originalname,
            ...result
          });

        } catch (error) {
          logger.error(`Processing failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            success: false,
            error: error.message,
            processingTime: 0
          });
        }
      }

      res.json({
        success: true,
        jobType,
        results,
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

    } catch (error) {
      logger.error('Processing endpoint error:', error);
      res.status(500).json({ error: 'Processing failed' });
    }
  }
);

// POST /api/v1/processing/jobs - Create processing job
router.post('/jobs',
  body('fileId').isUUID(),
  body('jobType').isIn(['conversion', 'ocr', 'preview', 'metadata', 'indexing', 'full']),
  body('inputFormat').isString(),
  body('outputFormat').optional().isString(),
  body('parameters').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const { fileId, jobType, inputFormat, outputFormat, parameters = {} } = req.body;

      const { documentProcessingService } = req.app.locals.services;

      const job = await documentProcessingService.createProcessingJob(
        fileId,
        userId,
        jobType,
        inputFormat,
        parameters,
        outputFormat
      );

      res.json({
        success: true,
        job
      });

    } catch (error) {
      logger.error('Job creation error:', error);
      res.status(500).json({ error: 'Failed to create processing job' });
    }
  }
);

// GET /api/v1/processing/jobs - List user's processing jobs
router.get('/jobs',
  query('jobType').optional().isString(),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
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
        jobType: req.query.jobType as string,
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0
      };

      const { documentProcessingService } = req.app.locals.services;
      const result = await documentProcessingService.getUserProcessingJobs(userId, filters);

      res.json({
        success: true,
        jobs: result.jobs,
        total: result.total,
        limit: filters.limit,
        offset: filters.offset
      });

    } catch (error) {
      logger.error('Error fetching processing jobs:', error);
      res.status(500).json({ error: 'Failed to fetch processing jobs' });
    }
  }
);

// GET /api/v1/processing/jobs/:jobId - Get processing job details
router.get('/jobs/:jobId',
  param('jobId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const jobId = req.params.jobId;

      const { documentProcessingService } = req.app.locals.services;
      const job = await documentProcessingService.getProcessingJob(jobId, userId);

      if (!job) {
        return res.status(404).json({ error: 'Processing job not found' });
      }

      res.json({
        success: true,
        job
      });

    } catch (error) {
      logger.error('Error fetching processing job:', error);
      res.status(500).json({ error: 'Failed to fetch processing job' });
    }
  }
);

// DELETE /api/v1/processing/jobs/:jobId - Delete processing job
router.delete('/jobs/:jobId',
  param('jobId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const jobId = req.params.jobId;

      const { documentProcessingService } = req.app.locals.services;
      const success = await documentProcessingService.deleteProcessingJob(jobId, userId);

      if (!success) {
        return res.status(404).json({ error: 'Processing job not found' });
      }

      res.json({
        success: true,
        message: 'Processing job deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting processing job:', error);
      res.status(500).json({ error: 'Failed to delete processing job' });
    }
  }
);

// GET /api/v1/processing/stats - Get processing statistics
router.get('/stats',
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { documentProcessingService } = req.app.locals.services;
      
      const stats = await documentProcessingService.getProcessingStats(userId);

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Error fetching processing stats:', error);
      res.status(500).json({ error: 'Failed to fetch processing statistics' });
    }
  }
);

// POST /api/v1/processing/batch - Batch process multiple documents
router.post('/batch',
  body('jobType').isIn(['conversion', 'ocr', 'preview', 'metadata', 'indexing', 'full']),
  body('parameters').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = (req as any).user.id;
      const files = (req as any).files as Express.Multer.File[];
      const { jobType, parameters = {} } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided for batch processing' });
      }

      if (files.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 files allowed for batch processing' });
      }

      const { documentProcessingService } = req.app.locals.services;
      const batchId = require('uuid').v4();
      const results = [];

      logger.info(`Starting batch processing: ${batchId} (${files.length} files)`);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        logger.info(`Processing file ${i + 1}/${files.length}: ${file.originalname}`);

        try {
          const result = await documentProcessingService.processDocument(
            file.buffer,
            file.originalname,
            file.mimetype,
            jobType,
            { ...parameters, batchId, fileIndex: i + 1 }
          );

          results.push({
            filename: file.originalname,
            fileIndex: i + 1,
            ...result
          });

        } catch (error) {
          logger.error(`Batch processing failed for ${file.originalname}:`, error);
          results.push({
            filename: file.originalname,
            fileIndex: i + 1,
            success: false,
            error: error.message,
            processingTime: 0
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info(`Batch processing completed: ${batchId} (${successful} successful, ${failed} failed)`);

      res.json({
        success: true,
        batchId,
        jobType,
        results,
        summary: {
          total: files.length,
          successful,
          failed,
          successRate: Math.round((successful / files.length) * 100)
        }
      });

    } catch (error) {
      logger.error('Batch processing endpoint error:', error);
      res.status(500).json({ error: 'Batch processing failed' });
    }
  }
);

export default router;