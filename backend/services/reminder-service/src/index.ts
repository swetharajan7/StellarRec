import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import healthRoutes from './routes/health';
import remindersRoutes from './routes/reminders';
import schedulingRoutes from './routes/scheduling';
import escalationRoutes from './routes/escalation';
import analyticsRoutes from './routes/analytics';
import preferencesRoutes from './routes/preferences';

// Import services
import { ReminderSchedulingService } from './services/reminderSchedulingService';
import { SmartTimingService } from './services/smartTimingService';
import { EscalationWorkflowService } from './services/escalationWorkflowService';
import { PersonalizationService } from './services/personalizationService';
import { EffectivenessTrackingService } from './services/effectivenessTrackingService';
import { ReminderDeliveryService } from './services/reminderDeliveryService';
import { BehaviorAnalysisService } from './services/behaviorAnalysisService';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3010;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Initialize services
const reminderSchedulingService = new ReminderSchedulingService();
const smartTimingService = new SmartTimingService();
const escalationWorkflowService = new EscalationWorkflowService();
const personalizationService = new PersonalizationService();
const effectivenessTrackingService = new EffectivenessTrackingService();
const reminderDeliveryService = new ReminderDeliveryService();
const behaviorAnalysisService = new BehaviorAnalysisService();

// Make services available to routes
app.locals.services = {
  reminderSchedulingService,
  smartTimingService,
  escalationWorkflowService,
  personalizationService,
  effectivenessTrackingService,
  reminderDeliveryService,
  behaviorAnalysisService
};

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/reminders', remindersRoutes);
app.use('/api/v1/scheduling', schedulingRoutes);
app.use('/api/v1/escalation', escalationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/preferences', preferencesRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Reminder Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;