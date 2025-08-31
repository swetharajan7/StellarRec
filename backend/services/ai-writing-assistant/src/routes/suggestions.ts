import { Router } from 'express';
import { body, query, validationResult } from 'express-validator';
import { SuggestionService } from '../services/suggestionService';

const router = Router();
const suggestionService = new SuggestionService();

// Get writing suggestions
router.post('/', [
  body('content').isString().notEmpty().withMessage('Content is required'),
  body('type').optional().isIn(['vocabulary', 'structure', 'tone', 'clarity', 'grammar']),
  body('context.essayType').optional().isString(),
  body('context.audience').optional().isString(),
  body('context.tone').optional().isString(),
  body('userId').isString().notEmpty().withMessage('User ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const suggestions = await suggestionService.getSuggestions(req.body);

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
        highPriority: suggestions.filter(s => s.severity === 'high').length
      }
    });

  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get writing suggestions'
    });
  }
});

// Get vocabulary suggestions
router.post('/vocabulary', [
  body('content').isString().notEmpty(),
  body('context').optional().isObject(),
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

    const suggestions = await suggestionService.getVocabularySuggestions({
      ...req.body,
      type: 'vocabulary'
    });

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length
      }
    });

  } catch (error) {
    console.error('Error getting vocabulary suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get vocabulary suggestions'
    });
  }
});

// Get structure suggestions
router.post('/structure', [
  body('content').isString().notEmpty(),
  body('context').optional().isObject(),
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

    const suggestions = await suggestionService.getStructureSuggestions({
      ...req.body,
      type: 'structure'
    });

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length
      }
    });

  } catch (error) {
    console.error('Error getting structure suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get structure suggestions'
    });
  }
});

// Get tone suggestions
router.post('/tone', [
  body('content').isString().notEmpty(),
  body('context.tone').optional().isString(),
  body('context.audience').optional().isString(),
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

    const suggestions = await suggestionService.getToneSuggestions({
      ...req.body,
      type: 'tone'
    });

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length
      }
    });

  } catch (error) {
    console.error('Error getting tone suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get tone suggestions'
    });
  }
});

// Get clarity suggestions
router.post('/clarity', [
  body('content').isString().notEmpty(),
  body('context').optional().isObject(),
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

    const suggestions = await suggestionService.getClaritySuggestions({
      ...req.body,
      type: 'clarity'
    });

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length
      }
    });

  } catch (error) {
    console.error('Error getting clarity suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get clarity suggestions'
    });
  }
});

// Get grammar suggestions
router.post('/grammar', [
  body('content').isString().notEmpty(),
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

    const suggestions = await suggestionService.getGrammarSuggestions({
      ...req.body,
      type: 'grammar'
    });

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
        errors: suggestions.filter(s => s.severity === 'high').length
      }
    });

  } catch (error) {
    console.error('Error getting grammar suggestions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get grammar suggestions'
    });
  }
});

export default router;