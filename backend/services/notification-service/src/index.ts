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
import emailRoutes from './routes/email';
import smsRoutes from './routes/sms';
import pushRoutes from './routes/push';
import preferencesRoutes from './routes/preferences';
import templatesRoutes from './routes/templates';
import deliveryRoutes from './routes/delivery';
import webhooksRoutes from './routes/webhooks';

// Import services
import { EmailService } from './services/emailService';
import { SMSService } from './services/smsService';
import { PushNotificationService } from './services/pushNotificationService';
import { NotificationPreferenceService } from './services/notificationPreferenceService';
import { TemplateService } from './services/templateService';
import { DeliveryTrackingService } from './services/deliveryTrackingService';
import { NotificationQueueService } from './services/notificationQueueService';
import { WebhookService } from './services/webhookService';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3009;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '1000'),
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
const emailService = new EmailService();
const smsService = new SMSService();
const pushNotificationService = new PushNotificationService();
const notificationPreferenceService = new NotificationPreferenceService();
const templateService = new TemplateService();
const deliveryTrackingService = new DeliveryTrackingService();
const notificationQueueService = new NotificationQueueService();
const webhookService = new WebhookService();

// Make services available to routes
app.locals.services = {
  emailService,
  smsService,
  pushNotificationService,
  notificationPreferenceService,
  templateService,
  deliveryTrackingService,
  notificationQueueService,
  webhookService
};

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/sms', smsRoutes);
app.use('/api/v1/push', pushRoutes);
app.use('/api/v1/preferences', preferencesRoutes);
app.use('/api/v1/templates', templatesRoutes);
app.use('/api/v1/delivery', deliveryRoutes);
app.use('/api/v1/webhooks', webhooksRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Notification Service running on port ${PORT}`);
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