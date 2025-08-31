import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from 'dotenv';

// Import routes
import suggestionsRoutes from './routes/suggestions';
import templatesRoutes from './routes/templates';

// Import services
import { WritingAnalysisService } from './services/writingAnalysisService';
import { TemplateGenerationService } from './services/templateGenerationService';
import { SuggestionService } from './services/suggestionService';
import { QualityAssessmentService } from './services/qualityAssessmentService';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3015;

// Initialize services
const analysisService = new WritingAnalysisService();
const templateService = new TemplateGenerationService();
const suggestionService = new SuggestionService();
const qualityService = new QualityAssessmentService();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ai-writing-assistant',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Analysis endpoints
app.post('/api/v1/analysis/analyze', async (req, res) => {
  try {
    const { content, type, requirements, userId } = req.body;
    
    if (!content || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Content and userId are required'
      });
    }

    const analysis = await analysisService.analyzeContent({
      content,
      type: type || 'personal_statement',
      requirements,
      userId
    });

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Error analyzing content:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze content'
    });
  }
});

app.post('/api/v1/analysis/grammar', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const grammarCheck = await analysisService.checkGrammar(content);

    res.json({
      success: true,
      data: grammarCheck
    });

  } catch (error) {
    console.error('Error checking grammar:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check grammar'
    });
  }
});

app.post('/api/v1/analysis/style', async (req, res) => {
  try {
    const { content, essayType } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const styleAnalysis = await analysisService.analyzeStyle(content, essayType || 'personal_statement');

    res.json({
      success: true,
      data: styleAnalysis
    });

  } catch (error) {
    console.error('Error analyzing style:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze style'
    });
  }
});

app.post('/api/v1/analysis/readability', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const readabilityAssessment = await analysisService.assessReadability(content);

    res.json({
      success: true,
      data: readabilityAssessment
    });

  } catch (error) {
    console.error('Error assessing readability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assess readability'
    });
  }
});

// Quality assessment endpoints
app.post('/api/v1/quality/score', async (req, res) => {
  try {
    const { content, essayType, requirements, userId } = req.body;
    
    if (!content || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Content and userId are required'
      });
    }

    const assessment = await qualityService.assessQuality({
      content,
      essayType: essayType || 'personal_statement',
      requirements,
      userId
    });

    res.json({
      success: true,
      data: assessment
    });

  } catch (error) {
    console.error('Error assessing quality:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assess quality'
    });
  }
});

app.post('/api/v1/quality/readiness', async (req, res) => {
  try {
    const { content, essayType, requirements, userId } = req.body;
    
    if (!content || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Content and userId are required'
      });
    }

    const readinessCheck = await qualityService.checkReadiness({
      content,
      essayType: essayType || 'personal_statement',
      requirements,
      userId
    });

    res.json({
      success: true,
      data: readinessCheck
    });

  } catch (error) {
    console.error('Error checking readiness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check readiness'
    });
  }
});

app.post('/api/v1/quality/compare', async (req, res) => {
  try {
    const { essay1, essay2, essayType, userId } = req.body;
    
    if (!essay1 || !essay2 || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Both essays and userId are required'
      });
    }

    const comparison = await qualityService.compareEssays(
      essay1,
      essay2,
      essayType || 'personal_statement',
      userId
    );

    res.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error('Error comparing essays:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to compare essays'
    });
  }
});

app.get('/api/v1/quality/criteria', (req, res) => {
  res.json({
    success: true,
    data: {
      categories: [
        {
          name: 'Content Quality',
          weight: 25,
          description: 'Relevance, depth, and originality of content'
        },
        {
          name: 'Writing Mechanics',
          weight: 20,
          description: 'Grammar, spelling, and punctuation'
        },
        {
          name: 'Structure & Organization',
          weight: 20,
          description: 'Logical flow and essay structure'
        },
        {
          name: 'Clarity & Style',
          weight: 15,
          description: 'Readability and writing style'
        },
        {
          name: 'Impact & Engagement',
          weight: 10,
          description: 'Persuasiveness and reader engagement'
        },
        {
          name: 'Requirements Compliance',
          weight: 10,
          description: 'Adherence to specified requirements'
        }
      ],
      scoringScale: {
        'excellent': { min: 90, max: 100 },
        'good': { min: 75, max: 89 },
        'needs_improvement': { min: 60, max: 74 },
        'not_ready': { min: 0, max: 59 }
      }
    }
  });
});

// Mount route modules
app.use('/api/v1/suggestions', suggestionsRoutes);
app.use('/api/v1/templates', templatesRoutes);

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Writing Assistant service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;