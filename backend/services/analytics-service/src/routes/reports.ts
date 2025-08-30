import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/v1/reports/generate - Generate a report
router.post('/generate',
  authMiddleware,
  body('name').isString().notEmpty(),
  body('type').isIn(['user_activity', 'application_performance', 'search_analytics', 'engagement', 'custom']),
  body('schedule').optional().isIn(['daily', 'weekly', 'monthly', 'on_demand']),
  body('parameters').optional().isObject(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reportingService } = req.app.locals.services;

      const reportConfig = {
        name: req.body.name,
        description: req.body.description || '',
        type: req.body.type,
        schedule: req.body.schedule || 'on_demand',
        recipients: req.body.recipients || [],
        parameters: req.body.parameters || {},
        isActive: true
      };

      const report = await reportingService.generateReport(
        reportConfig,
        req.body.startDate ? new Date(req.body.startDate) : undefined,
        req.body.endDate ? new Date(req.body.endDate) : undefined
      );

      res.json({
        success: true,
        report
      });

    } catch (error) {
      logger.error('Report generation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report'
      });
    }
  }
);

// GET /api/v1/reports/performance - Get performance report
router.get('/performance',
  query('period').optional().isIn(['day', 'week', 'month']),
  async (req: Request, res: Response) => {
    try {
      const { reportingService } = req.app.locals.services;
      const period = req.query.period as 'day' | 'week' | 'month' || 'week';

      const performanceReport = await reportingService.generatePerformanceReport(period);

      res.json({
        success: true,
        report: performanceReport
      });

    } catch (error) {
      logger.error('Performance report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate performance report'
      });
    }
  }
);

// GET /api/v1/reports/history - Get report history
router.get('/history',
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const { reportingService } = req.app.locals.services;
      const limit = parseInt(req.query.limit as string) || 50;

      const reports = await reportingService.getReportHistory(limit);

      res.json({
        success: true,
        reports,
        count: reports.length
      });

    } catch (error) {
      logger.error('Report history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get report history'
      });
    }
  }
);

// GET /api/v1/reports/:id - Get specific report
router.get('/:id',
  param('id').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const { reportingService } = req.app.locals.services;
      const reportId = req.params.id;

      const report = await reportingService.getReportById(reportId);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found'
        });
      }

      res.json({
        success: true,
        report
      });

    } catch (error) {
      logger.error('Get report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get report'
      });
    }
  }
);

// GET /api/v1/reports/:id/export - Export report
router.get('/:id/export',
  param('id').isString().notEmpty(),
  query('format').optional().isIn(['json', 'csv', 'pdf']),
  async (req: Request, res: Response) => {
    try {
      const { reportingService } = req.app.locals.services;
      const reportId = req.params.id;
      const format = req.query.format as 'json' | 'csv' | 'pdf' || 'json';

      const exportedData = await reportingService.exportReport(reportId, format);

      // Set appropriate headers based on format
      switch (format) {
        case 'csv':
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.csv"`);
          break;
        case 'pdf':
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.pdf"`);
          break;
        default:
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="report-${reportId}.json"`);
      }

      res.send(exportedData);

    } catch (error) {
      logger.error('Report export error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export report'
      });
    }
  }
);

// POST /api/v1/reports/schedule - Schedule a report
router.post('/schedule',
  authMiddleware,
  body('name').isString().notEmpty(),
  body('type').isIn(['user_activity', 'application_performance', 'search_analytics', 'engagement', 'custom']),
  body('schedule').isIn(['daily', 'weekly', 'monthly']),
  body('recipients').isArray().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { reportingService } = req.app.locals.services;

      const reportConfig = {
        name: req.body.name,
        description: req.body.description || '',
        type: req.body.type,
        schedule: req.body.schedule,
        recipients: req.body.recipients,
        parameters: req.body.parameters || {},
        isActive: true
      };

      const scheduledReportId = await reportingService.scheduleReport(reportConfig);

      res.json({
        success: true,
        scheduledReportId,
        message: 'Report scheduled successfully'
      });

    } catch (error) {
      logger.error('Report scheduling error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule report'
      });
    }
  }
);

export default router;