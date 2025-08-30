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
import timelineRoutes from './routes/timelines';
import deadlineRoutes from './routes/deadlines';
import reminderRoutes from './routes/reminders';
import calendarRoutes from './routes/calendar';

// Import services
import { TimelineService } from './services/timelineService';
import { DeadlineService } from './services/deadlineService';
import { ReminderService } from './services/reminderService';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3005;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize services
const timelineService = new TimelineService(prisma);
const deadlineService = new DeadlineService(prisma);
const reminderService = new ReminderService(prisma);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/timelines', authMiddleware, timelineRoutes);
app.use('/api/v1/deadlines', authMiddleware, deadlineRoutes);
app.use('/api/v1/reminders', authMiddleware, reminderRoutes);
app.use('/api/v1/calendar', authMiddleware, calendarRoutes);

// Error handling
app.use(errorHandler);

// Cron jobs for reminder processing
cron.schedule('*/5 * * * *', async () => {
  logger.info('Processing due reminders');
  try {
    await reminderService.processDueReminders();
    logger.info('Reminder processing completed');
  } catch (error) {
    logger.error('Reminder processing failed:', error);
  }
});

// Cron job for deadline monitoring
cron.schedule('0 */6 * * *', async () => {
  logger.info('Running deadline monitoring');
  try {
    await deadlineService.monitorUpcomingDeadlines();
    logger.info('Deadline monitoring completed');
  } catch (error) {
    logger.error('Deadline monitoring failed:', error);
  }
});

// Cron job for timeline optimization
cron.schedule('0 2 * * *', async () => {
  logger.info('Running timeline optimization');
  try {
    await timelineService.optimizeAllTimelines();
    logger.info('Timeline optimization completed');
  } catch (error) {
    logger.error('Timeline optimization failed:', error);
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
  logger.info(`Timeline Service running on port ${port}`);
});

export default app;