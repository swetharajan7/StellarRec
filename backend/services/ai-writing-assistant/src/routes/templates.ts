import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { TemplateGenerationService } from '../services/templateGenerationService';

const router = Router();
const templateService = new TemplateGenerationService();

// Generate essay template
router.post('/generate', [
  body('essayType').isIn(['personal_statement', 'supplemental_essay', 'scholarship_essay', 'cover_letter']),
  body('userProfile').isObject(),
  body('requirements').isObject(),
  body('userId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const template = await templateService.generateTemplate(req.body);

    res.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Error generating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate template'
    });
  }
});

// Customize existing template
router.post('/:templateId/customize', [
  body('customizations').isObject(),
  body('userPreferences').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { templateId } = req.params;
    const customizedTemplate = await templateService.customizeTemplate(templateId, {
      templateId,
      customizations: req.body.customizations,
      userPreferences: req.body.userPreferences || {}
    });

    res.json({
      success: true,
      data: customizedTemplate
    });

  } catch (error) {
    console.error('Error customizing template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to customize template'
    });
  }
});

// Get template categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await templateService.getTemplateCategories();

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Error getting template categories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template categories'
    });
  }
});

// Get specific template
router.get('/:templateId', async (req, res) => {
  try {
    // This would typically fetch from database
    res.json({
      success: true,
      message: 'Template retrieval endpoint - implementation depends on storage strategy'
    });

  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template'
    });
  }
});

// Generate quick template for specific prompt
router.post('/quick', [
  body('prompt').isString().notEmpty(),
  body('essayType').isIn(['personal_statement', 'supplemental_essay', 'scholarship_essay', 'cover_letter']),
  body('wordLimit').optional().isInt({ min: 100, max: 2000 }),
  body('userId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Generate a quick template based on prompt
    const template = await templateService.generateTemplate({
      essayType: req.body.essayType,
      userProfile: {
        interests: [],
        experiences: [],
        achievements: []
      },
      requirements: {
        wordLimit: req.body.wordLimit,
        prompts: [req.body.prompt],
        tone: 'professional'
      },
      userId: req.body.userId
    });

    res.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Error generating quick template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate quick template'
    });
  }
});

// Get template suggestions based on user profile
router.post('/suggestions', [
  body('userProfile').isObject(),
  body('essayType').optional().isString(),
  body('userId').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Generate template suggestions
    const suggestions = [
      {
        id: 'template_1',
        title: 'Academic Journey Template',
        description: 'Focus on your academic interests and research experiences',
        difficulty: 'intermediate',
        estimatedTime: 120,
        tags: ['academic', 'research', 'personal_growth']
      },
      {
        id: 'template_2',
        title: 'Leadership Experience Template',
        description: 'Highlight your leadership roles and impact',
        difficulty: 'beginner',
        estimatedTime: 90,
        tags: ['leadership', 'impact', 'community']
      },
      {
        id: 'template_3',
        title: 'Overcoming Challenges Template',
        description: 'Share how you overcame significant obstacles',
        difficulty: 'advanced',
        estimatedTime: 150,
        tags: ['resilience', 'growth', 'personal']
      }
    ];

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length
      }
    });

  } catch (error) {
    console.error('Error getting template suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get template suggestions'
    });
  }
});

export default router;