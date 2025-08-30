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
import recommendationsRoutes from './routes/recommendations';
import trendingRoutes from './routes/trending';
import discoveryRoutes from './routes/discovery';
import behaviorRoutes from './routes/behavior';

// Import services
import { RecommendationService } from './services/recommendationService';
import { TrendingService } from './services/trendingService';
import { DiscoveryService } from './services/discoveryService';
import { BehaviorTrackingService } from './services/behaviorTrackingService';
import { PersonalizationService } from './services/personalizationService';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3005;

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
const recommendationService = new RecommendationService();
const trendingService = new TrendingService();
const discoveryService = new DiscoveryService();
const behaviorTrackingService = new BehaviorTrackingService();
const personalizationService = new PersonalizationService();

// Make services available to routes
app.locals.services = {
  recommendationService,
  trendingService,
  discoveryService,
  behaviorTrackingService,
  personalizationService
};

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/recommendations', recommendationsRoutes);
app.use('/api/v1/trending', trendingRoutes);
app.use('/api/v1/discovery', discoveryRoutes);
app.use('/api/v1/behavior', behaviorRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Content Discovery Service running on port ${PORT}`);
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