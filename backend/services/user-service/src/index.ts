import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware } from './middleware/auth';
import userRoutes from './routes/users';
import profileRoutes from './routes/profiles';
import healthRoutes from './routes/health';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Prisma client
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check routes (no auth required)
app.use('/health', healthRoutes);
app.use('/ready', healthRoutes);

// API routes
app.use('/api/v1/users', authMiddleware, userRoutes);
app.use('/api/v1/profiles', authMiddleware, profileRoutes);

// Catch-all route for undefined endpoints
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ENDPOINT_NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
});

// Error handling middleware
app.use(errorHandler);

// Database connection and server startup
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Connected to database');

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`🚀 StellarRec User Service running on port ${PORT}`);
      logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      server.close(async () => {
        try {
          await prisma.$disconnect();
          logger.info('Database connection closed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;