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
import admissionRoutes from './routes/admission';
import successRoutes from './routes/success';
import benchmarkRoutes from './routes/benchmark';
import timelineRoutes from './routes/timeline';
import warningRoutes from './routes/warning';
import modelsRoutes from './routes/models';

// Import services
import { AdmissionPredictionService } from './services/admissionPredictionService';
import { SuccessFactorService } from './services/successFactorService';
import { BenchmarkAnalysisService } from './services/benchmarkAnalysisService';
import { TimelineOptimizationService } from './services/timelineOptimizationService';
import { EarlyWarningService } from './services/earlyWarningService';
import { ModelTrainingService } from './services/modelTrainingService';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3008;

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
const admissionPredictionService = new AdmissionPredictionService();
const successFactorService = new SuccessFactorService();
const benchmarkAnalysisService = new BenchmarkAnalysisService();
const timelineOptimizationService = new TimelineOptimizationService();
const earlyWarningService = new EarlyWarningService();
const modelTrainingService = new ModelTrainingService();

// Make services available to routes
app.locals.services = {
  admissionPredictionService,
  successFactorService,
  benchmarkAnalysisService,
  timelineOptimizationService,
  earlyWarningService,
  modelTrainingService
};

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/admission', admissionRoutes);
app.use('/api/v1/success', successRoutes);
app.use('/api/v1/benchmark', benchmarkRoutes);
app.use('/api/v1/timeline', timelineRoutes);
app.use('/api/v1/warning', warningRoutes);
app.use('/api/v1/models', modelsRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Predictive Analytics Engine running on port ${PORT}`);
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