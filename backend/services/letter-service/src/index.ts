import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Import routes
import healthRoutes from './routes/health';
import letterRoutes from './routes/letters';
import collaborationRoutes from './routes/collaboration';
import templateRoutes from './routes/templates';

// Import services
import { CollaborationService } from './services/collaborationService';
import { LetterService } from './services/letterService';

config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

const port = process.env.PORT || 3005;
const prisma = new PrismaClient();

// Initialize services
const letterService = new LetterService(prisma);
const collaborationService = new CollaborationService(prisma, io);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/letters', authMiddleware, letterRoutes);
app.use('/api/v1/collaboration', authMiddleware, collaborationRoutes);
app.use('/api/v1/templates', authMiddleware, templateRoutes);

app.use(errorHandler);

// Socket.IO for real-time collaboration
io.use((socket, next) => {
  // Authentication middleware for socket connections
  const token = socket.handshake.auth.token;
  if (token) {
    // Verify JWT token here
    next();
  } else {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.id}`);
  
  socket.on('join-letter', (letterId) => {
    socket.join(`letter-${letterId}`);
    collaborationService.handleUserJoin(socket, letterId);
  });

  socket.on('leave-letter', (letterId) => {
    socket.leave(`letter-${letterId}`);
    collaborationService.handleUserLeave(socket, letterId);
  });

  socket.on('letter-edit', (data) => {
    collaborationService.handleLetterEdit(socket, data);
  });

  socket.on('cursor-position', (data) => {
    collaborationService.handleCursorPosition(socket, data);
  });

  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.id}`);
    collaborationService.handleUserDisconnect(socket);
  });
});

server.listen(port, () => {
  logger.info(`Letter Service running on port ${port}`);
});

export default app;