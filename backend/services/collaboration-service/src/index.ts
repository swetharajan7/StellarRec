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
import collaborationRoutes, { setCollaborationService } from './routes/collaboration';

// Import services
import { CollaborationService } from './services/collaborationService';

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

const port = process.env.PORT || 3007;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize services
const collaborationService = new CollaborationService(prisma, io);

// Set collaboration service for routes
setCollaborationService(collaborationService);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for real-time collaboration
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/collaboration', authMiddleware, collaborationRoutes);

// Error handling
app.use(errorHandler);

// Socket.IO authentication
io.use(socketAuthMiddleware);

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
  logger.info(`Collaboration Service running on port ${port}`);
});

export default app;