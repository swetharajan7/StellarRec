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
import { authMiddleware } from './middleware/auth';

// Import routes
import healthRoutes from './routes/health';
import letterRoutes from './routes/letters';
import templateRoutes from './routes/templates';
import invitationRoutes from './routes/invitations';
import collaborationRoutes from './routes/collaboration';
import deliveryRoutes from './routes/delivery';

// Import services
import { LetterService } from './services/letterService';
import { TemplateService } from './services/templateService';
import { InvitationService } from './services/invitationService';
import { CollaborationService } from './services/collaborationService';
import { DeliveryService } from './services/deliveryService';

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

const port = process.env.PORT || 3006;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize services
const letterService = new LetterService(prisma);
const templateService = new TemplateService(prisma);
const invitationService = new InvitationService(prisma);
const collaborationService = new CollaborationService(prisma, io);
const deliveryService = new DeliveryService(prisma);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(limiter);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/letters', authMiddleware, letterRoutes);
app.use('/api/v1/templates', authMiddleware, templateRoutes);
app.use('/api/v1/invitations', invitationRoutes); // Some endpoints don't require auth
app.use('/api/v1/collaboration', authMiddleware, collaborationRoutes);
app.use('/api/v1/delivery', authMiddleware, deliveryRoutes);

// Error handling
app.use(errorHandler);

// Socket.IO for real-time collaboration
io.use((socket, next) => {
  // Add authentication middleware for socket connections
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  try {
    // Verify JWT token (simplified)
    socket.userId = 'user-id'; // Extract from token
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.userId}`);
  
  socket.on('join-letter', (letterId) => {
    socket.join(`letter-${letterId}`);
    logger.info(`User ${socket.userId} joined letter ${letterId}`);
  });

  socket.on('leave-letter', (letterId) => {
    socket.leave(`letter-${letterId}`);
    logger.info(`User ${socket.userId} left letter ${letterId}`);
  });

  socket.on('letter-edit', async (data) => {
    try {
      await collaborationService.handleLetterEdit(socket.userId, data);
      socket.to(`letter-${data.letterId}`).emit('letter-updated', data);
    } catch (error) {
      logger.error('Error handling letter edit:', error);
      socket.emit('error', { message: 'Failed to process edit' });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.userId}`);
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
  logger.info(`Letter Service running on port ${port}`);
});

export default app;