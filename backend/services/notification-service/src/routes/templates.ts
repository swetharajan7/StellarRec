import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { TemplateService } from '../services/templateService';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get templates
router.get('/',
  [
    query('channel').optional().isIn(['email', 'sms', 'push']),
    query('category').optional().isString(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateService: TemplateService = req.app.locals.services.templateService;
    
    let templates;
    if (req.query.channel) {
      templates = await templateService.getTemplatesByChannel(req.query.channel as any);
    } else if (req.query.category) {
      templates = await templateService.getTemplatesByCategory(req.query.category as string);
    } else {
      // Get all templates - this would need to be implemented
      templates = [];
    }

    res.status(200).json({
      success: true,
      data: templates
    });
  })
);

// Create template (admin only)
router.post('/',
  requireRole(['admin']),
  [
    body('name').isString().notEmpty().withMessage('Template name is required'),
    body('channel').isIn(['email', 'sms', 'push']).withMessage('Valid channel is required'),
    body('content').isString().notEmpty().withMessage('Template content is required'),
    body('subject').optional().isString(),
    body('title').optional().isString(),
    body('htmlContent').optional().isString(),
    body('textContent').optional().isString(),
    body('category').optional().isString(),
    body('variables').optional().isArray(),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Validation failed', details: errors.array() }
      });
    }

    const templateService: TemplateService = req.app.locals.services.templateService;
    const templateId = await templateService.createTemplate({
      ...req.body,
      createdBy: req.user!.id
    });

    res.status(201).json({
      success: true,
      data: { templateId }
    });
  })
);

// Get template by ID
router.get('/:templateId',
  [
    param('templateId').isString().notEmpty().withMessage('Template ID is required'),
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const templateService: TemplateService = req.app.locals.services.templateService;
    const template = await templateService.getTemplate(req.params.templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: { message: 'Template not found' }
      });
    }

    res.status(200).json({
      success: true,
      data: template
    });
  })
);

export default router;