import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Logger } from './services/logger';

// Import route modules
import universityIntegrationRoutes from './routes/universityIntegration';
import aiIntelligenceRoutes from './routes/aiIntelligence';
import authRoutes from './routes/auth';

const app = express();
const server = createServer(app);
const logger = new Logger('Server');

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      authentication: 'active',
      universityIntegration: 'active',
      aiIntelligence: 'active'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/university-integration', universityIntegrationRoutes);
app.use('/api/ai-intelligence', aiIntelligenceRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'StellarRec API',
    version: '1.0.0',
    description: 'Intelligent University Application Platform',
    endpoints: {
      authentication: '/api/auth',
      universityIntegration: '/api/university-integration',
      aiIntelligence: '/api/ai-intelligence',
      health: '/health',
      documentation: '/api/docs'
    },
    features: [
      'University Integration Hub',
      'AI-Powered University Matching',
      'Intelligent Content Optimization',
      'Predictive Analytics',
      'Automated Workflow Management',
      'Real-time Insights'
    ]
  });
});

// Swagger/OpenAPI documentation (if available)
app.get('/api/docs', (req, res) => {
  res.json({
    message: 'API Documentation',
    swagger: '/api/swagger.json',
    postman: '/postman_collection.json'
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist`,
    availableEndpoints: [
      '/api/auth',
      '/api/university-integration',
      '/api/ai-intelligence',
      '/health',
      '/api'
    ]
  });
});

// Start server
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  logger.info(`🚀 StellarRec Server running on port ${PORT}`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api`);
  logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
  logger.info(`🤖 AI Intelligence: http://localhost:${PORT}/api/ai-intelligence`);
  logger.info(`🏫 University Integration: http://localhost:${PORT}/api/university-integration`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export default app;