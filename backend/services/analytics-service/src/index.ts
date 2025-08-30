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
import metricsRoutes from './routes/metrics';
import reportsRoutes from './routes/reports';
import dashboardRoutes from './routes/dashboard';
import insightsRoutes from './routes/insights';
import predictionsRoutes from './routes/predictions';

// Import services
import { MetricsCollectionService } from './services/metricsCollectionService';
import { ReportingService } from './services/reportingService';
import { DashboardService } from './services/dashboardService';
import { InsightGenerationService } from './services/insightGenerationService';
import { PredictiveAnalyticsService } from './services/predictiveAnalyticsService';
import { DataAggregationService } from './services/dataAggregationService';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3006;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
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
const metricsCollectionService = new MetricsCollectionService();
const reportingService = new ReportingService();
const dashboardService = new DashboardService();
const insightGenerationService = new InsightGenerationService();
const predictiveAnalyticsService = new PredictiveAnalyticsService();
const dataAggregationService = new DataAggregationService();

// Make services available to routes
app.locals.services = {
  metricsCollectionService,
  reportingService,
  dashboardService,
  insightGenerationService,
  predictiveAnalyticsService,
  dataAggregationService
};

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/insights', insightsRoutes);
app.use('/api/v1/predictions', predictionsRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Analytics Service running on port ${PORT}`);
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