import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware, socketAuthMiddleware } from './middleware/auth';

// Import routes
import healthRoutes from './routes/health';
import analysisRoutes from './routes/analysis';
import suggestionsRoutes from './routes/suggestions';
import templatesRoutes from './routes/templates';
import qualityRoutes from './routes/quality';

// Import services
import { WritingAnalysisService } from './services/writingAnalysisService';
import { SuggestionService } from './services/suggestionService';
import { TemplateGenerationService } from './services/templateGenerationService';
import { QualityAssessmentService } from './services/qualityAssessmentService';

// Load environment variables
config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
  }
});

const port = process.env.PORT || 3008;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize services
const analysisService = new WritingAnalysisService(prisma);
const suggestionService = new SuggestionService(prisma, io);
const templateService = new TemplateGenerationService(prisma);
const qualityService = new QualityAssessmentService(prisma);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // AI operations are resource intensive
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/analysis', authMiddleware, analysisRoutes);
app.use('/api/v1/suggestions', authMiddleware, suggestionsRoutes);
app.use('/api/v1/templates', authMiddleware, templatesRoutes);
app.use('/api/v1/quality', authMiddleware, qualityRoutes);

// Error handling
app.use(errorHandler);

// Socket.IO for real-time suggestions
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  logger.info(`User connected to AI Writing Assistant: ${socket.userId}`);

  socket.on('analyze-text', async (data) => {
    try {
      const analysis = await analysisService.analyzeText(data.text, data.context);
      socket.emit('analysis-result', analysis);
    } catch (error) {
      socket.emit('error', { message: 'Analysis failed' });
    }
  });

  socket.on('get-suggestions', async (data) => {
    try {
      const suggestions = await suggestionService.generateSuggestions(
        data.text, 
        data.position, 
        data.context,
        socket.userId
      );
      socket.emit('suggestions-result', suggestions);
    } catch (error) {
      socket.emit('error', { message: 'Suggestion generation failed' });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected from AI Writing Assistant: ${socket.userId}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    prisma.$disconnect();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    prisma.$disconnect();
    process.exit(0);
  });
});

// Start server
server.listen(port, () => {
  logger.info(`AI Writing Assistant Service running on port ${port}`);
});

export default app;