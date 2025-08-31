import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import responseTime from 'response-time';
import { config } from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { metricsMiddleware } from './middleware/metricsMiddleware';

// Import routes
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';
import logsRoutes from './routes/logs';
import alertsRoutes from './routes/alerts';
import dashboardRoutes from './routes/dashboard';
import systemRoutes from './routes/system';

// Import services
import { LoggingService } from './services/loggingService';
import { MetricsCollectionService } from './services/metricsCollectionService';
import { AlertingService } from './services/alertingService';
import { HealthCheckService } from './services/healthCheckService';
import { PerformanceMonitoringService } from './services/performanceMonitoringService';
import { SystemMonitoringService } from './services/systemMonitoringService';
import { DashboardService } from './services/dashboardService';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3011;

// Security and performance middleware
app.use(helmet());
app.use(compression());
app.use(responseTime());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Monitoring middleware
app.use(metricsMiddleware);
app.use(requestLogger);

// Initialize services
const loggingService = new LoggingService();
const metricsCollectionService = new MetricsCollectionService();
const alertingService = new AlertingService();
const healthCheckService = new HealthCheckService();
const performanceMonitoringService = new PerformanceMonitoringService();
const systemMonitoringService = new SystemMonitoringService();
const dashboardService = new DashboardService();

// Make services available to routes
app.locals.services = {
  loggingService,
  metricsCollectionService,
  alertingService,
  healthCheckService,
  performanceMonitoringService,
  systemMonitoringService,
  dashboardService
};

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/metrics', metricsRoutes);
app.use('/api/v1/logs', logsRoutes);
app.use('/api/v1/alerts', alertsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/system', systemRoutes);

// Prometheus metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', metricsCollectionService.getContentType());
  res.end(metricsCollectionService.getMetrics());
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Monitoring Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('Prometheus metrics available at /metrics');
});

// Start monitoring services
performanceMonitoringService.startMonitoring();
systemMonitoringService.startMonitoring();
healthCheckService.startHealthChecks();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  performanceMonitoringService.stopMonitoring();
  systemMonitoringService.stopMonitoring();
  healthCheckService.stopHealthChecks();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  performanceMonitoringService.stopMonitoring();
  systemMonitoringService.stopMonitoring();
  healthCheckService.stopHealthChecks();
  process.exit(0);
});

export default app;