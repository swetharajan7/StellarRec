import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware } from './middleware/auth';

// Import routes
import healthRoutes from './routes/health';
import searchRoutes from './routes/search';
import autocompleteRoutes from './routes/autocomplete';
import analyticsRoutes from './routes/analytics';
import indexingRoutes from './routes/indexing';
import facetsRoutes from './routes/facets';

// Import services
import { SearchService } from './services/searchService';
import { IndexingService } from './services/indexingService';
import { AnalyticsService } from './services/analyticsService';
import { AutocompleteService } from './services/autocompleteService';
import { FacetService } from './services/facetService';
import { RankingService } from './services/rankingService';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3011;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize services
const searchService = new SearchService();
const indexingService = new IndexingService();
const analyticsService = new AnalyticsService(prisma);
const autocompleteService = new AutocompleteService();
const facetService = new FacetService();
const rankingService = new RankingService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting - more generous for search operations
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for search operations
  message: 'Too many search requests from this IP, please try again later.'
});
app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/autocomplete', autocompleteRoutes);
app.use('/api/v1/analytics', authMiddleware, analyticsRoutes);
app.use('/api/v1/indexing', authMiddleware, indexingRoutes);
app.use('/api/v1/facets', facetsRoutes);

// Make services available to routes
app.locals.services = {
  searchService,
  indexingService,
  analyticsService,
  autocompleteService,
  facetService,
  rankingService
};

// Error handling
app.use(errorHandler);

// Initialize search indices on startup
async function initializeSearchIndices() {
  try {
    await indexingService.initializeIndices();
    logger.info('Search indices initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize search indices:', error);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await searchService.cleanup();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await searchService.cleanup();
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(port, async () => {
  logger.info(`Search Service running on port ${port}`);
  await initializeSearchIndices();
});

export default app;