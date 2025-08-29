import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import dotenv from 'dotenv';
import path from 'path';

import { logger } from './utils/logger';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { validateRequest } from './middleware/validation';
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// API Documentation
const swaggerDocument = YAML.load(path.join(__dirname, '../docs/swagger.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check routes
app.use('/health', healthRoutes);
app.use('/ready', healthRoutes);

// Authentication routes
app.use('/api/v1/auth', authRoutes);

// Service proxy configurations
const services = {
  user: {
    target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    pathRewrite: { '^/api/v1/users': '' },
  },
  ai: {
    target: process.env.AI_SERVICE_URL || 'http://ai-service:3002',
    pathRewrite: { '^/api/v1/ai': '' },
  },
  application: {
    target: process.env.APPLICATION_SERVICE_URL || 'http://application-service:3003',
    pathRewrite: { '^/api/v1/applications': '' },
  },
  letter: {
    target: process.env.LETTER_SERVICE_URL || 'http://letter-service:3004',
    pathRewrite: { '^/api/v1/letters': '' },
  },
  notification: {
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3005',
    pathRewrite: { '^/api/v1/notifications': '' },
  },
  analytics: {
    target: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3006',
    pathRewrite: { '^/api/v1/analytics': '' },
  },
  file: {
    target: process.env.FILE_SERVICE_URL || 'http://file-service:3007',
    pathRewrite: { '^/api/v1/files': '' },
  },
};

// Protected routes that require authentication
const protectedPaths = [
  '/api/v1/users',
  '/api/v1/applications',
  '/api/v1/letters',
  '/api/v1/notifications',
  '/api/v1/analytics',
  '/api/v1/files',
];

// Public routes that don't require authentication
const publicPaths = [
  '/api/v1/ai/university-matches',
  '/api/v1/ai/essay-analysis',
];

// Apply authentication middleware to protected routes
protectedPaths.forEach(path => {
  app.use(path, authMiddleware);
});

// Set up service proxies
Object.entries(services).forEach(([serviceName, config]) => {
  const routePath = `/api/v1/${serviceName === 'user' ? 'users' : 
                                serviceName === 'ai' ? 'ai' :
                                serviceName === 'application' ? 'applications' :
                                serviceName === 'letter' ? 'letters' :
                                serviceName === 'notification' ? 'notifications' :
                                serviceName === 'analytics' ? 'analytics' :
                                serviceName === 'file' ? 'files' : serviceName}`;

  app.use(routePath, createProxyMiddleware({
    target: config.target,
    changeOrigin: true,
    pathRewrite: config.pathRewrite,
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${serviceName}:`, err);
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `${serviceName} service is currently unavailable`,
        },
      });
    },
    onProxyReq: (proxyReq, req) => {
      // Forward user information to downstream services
      if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
        proxyReq.setHeader('X-User-Email', req.user.email);
      }
    },
  }));
});

// Catch-all route for undefined endpoints
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 StellarRec API Gateway running on port ${PORT}`);
  logger.info(`📚 API Documentation available at http://localhost:${PORT}/docs`);
  logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
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