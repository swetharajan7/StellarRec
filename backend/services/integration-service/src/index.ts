import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware } from './middleware/auth';

// Import routes
import healthRoutes from './routes/health';
import integrationRoutes from './routes/integrations';
import submissionRoutes from './routes/submissions';
import credentialRoutes from './routes/credentials';

// Import services
import { IntegrationService } from './services/integrationService';
import { SubmissionService } from './services/submissionService';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3004;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize services
const integrationService = new IntegrationService(prisma);
const submissionService = new SubmissionService(prisma);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Higher limit for integration service
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/integrations', authMiddleware, integrationRoutes);
app.use('/api/v1/submissions', authMiddleware, submissionRoutes);
app.use('/api/v1/credentials', authMiddleware, credentialRoutes);

// Error handling
app.use(errorHandler);

// Cron jobs for submission monitoring
cron.schedule('*/5 * * * *', async () => {
  logger.info('Running submission status check');
  try {
    await submissionService.checkSubmissionStatus();
    logger.info('Submission status check completed');
  } catch (error) {
    logger.error('Submission status check failed:', error);
  }
});

// Cron job for retry failed submissions
cron.schedule('0 */2 * * *', async () => {
  logger.info('Running failed submission retry');
  try {
    await submissionService.retryFailedSubmissions();
    logger.info('Failed submission retry completed');
  } catch (error) {
    logger.error('Failed submission retry failed:', error);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  logger.info(`Integration Service running on port ${port}`);
});

export default app;