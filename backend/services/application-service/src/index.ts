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
import applicationRoutes from './routes/applications';
import timelineRoutes from './routes/timeline';
import deadlineRoutes from './routes/deadlines';

// Import services
import { DeadlineService } from './services/deadlineService';
import { NotificationService } from './services/notificationService';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3003;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize services
const deadlineService = new DeadlineService(prisma);
const notificationService = new NotificationService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/applications', authMiddleware, applicationRoutes);
app.use('/api/v1/timeline', authMiddleware, timelineRoutes);
app.use('/api/v1/deadlines', authMiddleware, deadlineRoutes);

// Error handling
app.use(errorHandler);

// Cron jobs for deadline monitoring
cron.schedule('0 9 * * *', async () => {
  logger.info('Running daily deadline check');
  try {
    await deadlineService.checkUpcomingDeadlines();
    logger.info('Daily deadline check completed');
  } catch (error) {
    logger.error('Daily deadline check failed:', error);
  }
});

// Cron job for progress updates
cron.schedule('0 */6 * * *', async () => {
  logger.info('Running progress update check');
  try {
    await deadlineService.updateApplicationProgress();
    logger.info('Progress update check completed');
  } catch (error) {
    logger.error('Progress update check failed:', error);
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
  logger.info(`Application Service running on port ${port}`);
});

export default app;