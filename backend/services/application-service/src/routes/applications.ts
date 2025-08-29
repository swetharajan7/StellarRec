import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient, ApplicationStatus, ComponentStatus } from '@prisma/client';
import { logger } from '../utils/logger';
import { ApplicationService } from '../services/applicationService';

const router = Router();
const prisma = new PrismaClient();
const applicationService = new ApplicationService(prisma);

// Validation middleware
const validateApplication = [
  body('university_id').isUUID().withMessage('Valid university ID is required'),
  body('program_id').isUUID().withMessage('Valid program ID is required'),
  body('deadline').isISO8601().withMessage('Valid deadline date is required'),
  body('notes').optional().isString().isLength({ max: 1000 })
];

const validateApplicationUpdate = [
  body('status').optional().isIn(['draft', 'in_progress', 'submitted', 'under_review', 'accepted', 'rejected', 'waitlisted']),
  body('notes').optional().isString().isLength({ max: 1000 }),
  body('decision_result').optional().isString().isLength({ max: 500 })
];

const validateComponent = [
  body('component_type').isIn(['personal_info', 'academic_history', 'test_scores', 'essays', 'recommendations', 'portfolio', 'financial_aid']),
  body('status').optional().isIn(['pending', 'in_progress', 'completed', 'approved', 'rejected']),
  body('data').optional().isObject()
];

// GET /api/v1/applications - Get all applications for a student
router.get('/', 
  query('student_id').optional().isUUID(),
  query('status').optional().isIn(['draft', 'in_progress', 'submitted', 'under_review', 'accepted', 'rejected', 'waitlisted']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const studentId = req.query.student_id as string || (req as any).user.user_id;
      const status = req.query.status as ApplicationStatus;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const applications = await applicationService.getApplications(studentId, {
        status,
        page,
        limit
      });

      res.json(applications);
    } catch (error) {
      logger.error('Error fetching applications:', error);
      res.status(500).json({ error: 'Failed to fetch applications' });
    }
  }
);

// GET /api/v1/applications/:id - Get specific application
router.get('/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const applicationId = req.params.id;
      const application = await applicationService.getApplicationById(applicationId);

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      res.json(application);
    } catch (error) {
      logger.error('Error fetching application:', error);
      res.status(500).json({ error: 'Failed to fetch application' });
    }
  }
);

// POST /api/v1/applications - Create new application
router.post('/',
  validateApplication,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const studentId = (req as any).user.user_id;
      const applicationData = {
        student_id: studentId,
        university_id: req.body.university_id,
        program_id: req.body.program_id,
        deadline: new Date(req.body.deadline),
        notes: req.body.notes
      };

      const application = await applicationService.createApplication(applicationData);

      logger.info(`Application created: ${application.id} for student: ${studentId}`);
      res.status(201).json(application);
    } catch (error) {
      logger.error('Error creating application:', error);
      res.status(500).json({ error: 'Failed to create application' });
    }
  }
);

// PUT /api/v1/applications/:id - Update application
router.put('/:id',
  param('id').isUUID(),
  validateApplicationUpdate,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const applicationId = req.params.id;
      const updateData = req.body;

      const application = await applicationService.updateApplication(applicationId, updateData);

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      logger.info(`Application updated: ${applicationId}`);
      res.json(application);
    } catch (error) {
      logger.error('Error updating application:', error);
      res.status(500).json({ error: 'Failed to update application' });
    }
  }
);

// DELETE /api/v1/applications/:id - Delete application (soft delete)
router.delete('/:id',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const applicationId = req.params.id;
      const success = await applicationService.deleteApplication(applicationId);

      if (!success) {
        return res.status(404).json({ error: 'Application not found' });
      }

      logger.info(`Application deleted: ${applicationId}`);
      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting application:', error);
      res.status(500).json({ error: 'Failed to delete application' });
    }
  }
);

// POST /api/v1/applications/:id/submit - Submit application
router.post('/:id/submit',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const applicationId = req.params.id;
      const result = await applicationService.submitApplication(applicationId);

      if (!result.success) {
        return res.status(400).json({ 
          error: 'Cannot submit application', 
          details: result.errors 
        });
      }

      logger.info(`Application submitted: ${applicationId}`);
      res.json(result.application);
    } catch (error) {
      logger.error('Error submitting application:', error);
      res.status(500).json({ error: 'Failed to submit application' });
    }
  }
);

// GET /api/v1/applications/:id/progress - Get application progress
router.get('/:id/progress',
  param('id').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const applicationId = req.params.id;
      const progress = await applicationService.getApplicationProgress(applicationId);

      if (!progress) {
        return res.status(404).json({ error: 'Application not found' });
      }

      res.json(progress);
    } catch (error) {
      logger.error('Error fetching application progress:', error);
      res.status(500).json({ error: 'Failed to fetch application progress' });
    }
  }
);

// POST /api/v1/applications/:id/components - Add application component
router.post('/:id/components',
  param('id').isUUID(),
  validateComponent,
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const applicationId = req.params.id;
      const componentData = {
        application_id: applicationId,
        component_type: req.body.component_type,
        status: req.body.status || 'pending',
        data: req.body.data || {}
      };

      const component = await applicationService.addApplicationComponent(componentData);

      logger.info(`Component added to application: ${applicationId}`);
      res.status(201).json(component);
    } catch (error) {
      logger.error('Error adding application component:', error);
      res.status(500).json({ error: 'Failed to add application component' });
    }
  }
);

// PUT /api/v1/applications/:id/components/:componentId - Update application component
router.put('/:id/components/:componentId',
  param('id').isUUID(),
  param('componentId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const componentId = req.params.componentId;
      const updateData = req.body;

      const component = await applicationService.updateApplicationComponent(componentId, updateData);

      if (!component) {
        return res.status(404).json({ error: 'Component not found' });
      }

      logger.info(`Component updated: ${componentId}`);
      res.json(component);
    } catch (error) {
      logger.error('Error updating application component:', error);
      res.status(500).json({ error: 'Failed to update application component' });
    }
  }
);

// GET /api/v1/applications/stats - Get application statistics
router.get('/stats/overview',
  query('student_id').optional().isUUID(),
  async (req: Request, res: Response) => {
    try {
      const studentId = req.query.student_id as string || (req as any).user.user_id;
      const stats = await applicationService.getApplicationStats(studentId);

      res.json(stats);
    } catch (error) {
      logger.error('Error fetching application stats:', error);
      res.status(500).json({ error: 'Failed to fetch application stats' });
    }
  }
);

export default router;