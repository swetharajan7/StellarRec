import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware } from './middleware/auth';

// Import routes
import healthRoutes from './routes/health';
import processingRoutes from './routes/processing';
import conversionRoutes from './routes/conversion';
import ocrRoutes from './routes/ocr';
import previewRoutes from './routes/preview';
import metadataRoutes from './routes/metadata';

// Import services
import { DocumentProcessingService } from './services/documentProcessingService';
import { ConversionService } from './services/conversionService';
import { OCRService } from './services/ocrService';
import { PreviewService } from './services/previewService';
import { MetadataExtractionService } from './services/metadataExtractionService';
import { IndexingService } from './services/indexingService';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3010;

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize services
const documentProcessingService = new DocumentProcessingService(prisma);
const conversionService = new ConversionService();
const ocrService = new OCRService();
const previewService = new PreviewService();
const metadataExtractionService = new MetadataExtractionService();
const indexingService = new IndexingService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for document processing
    files: 5 // Max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow document and image types for processing
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/rtf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/tiff',
      'image/bmp',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported for processing'), false);
    }
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting - more generous for document processing
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Lower limit for processing operations
  message: 'Too many processing requests from this IP, please try again later.'
});
app.use(limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging
app.use(requestLogger);

// Routes
app.use('/health', healthRoutes);
app.use('/api/v1/processing', authMiddleware, upload.array('files', 5), processingRoutes);
app.use('/api/v1/conversion', authMiddleware, conversionRoutes);
app.use('/api/v1/ocr', authMiddleware, ocrRoutes);
app.use('/api/v1/preview', authMiddleware, previewRoutes);
app.use('/api/v1/metadata', authMiddleware, metadataRoutes);

// Make services available to routes
app.locals.services = {
  documentProcessingService,
  conversionService,
  ocrService,
  previewService,
  metadataExtractionService,
  indexingService
};

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  logger.info(`Document Processing Service running on port ${port}`);
});

export default app;