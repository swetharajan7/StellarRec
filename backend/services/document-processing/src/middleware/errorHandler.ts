import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  logger.error('Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error values
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal Server Error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'MulterError') {
    statusCode = 400;
    if (error.message.includes('File too large')) {
      message = 'File size exceeds maximum allowed limit';
    } else if (error.message.includes('Unexpected field')) {
      message = 'Unexpected file field';
    } else {
      message = 'File upload error';
    }
  } else if (error.message.includes('ENOENT')) {
    statusCode = 404;
    message = 'File not found';
  } else if (error.message.includes('EACCES')) {
    statusCode = 403;
    message = 'Access denied';
  } else if (error.message.includes('ENOSPC')) {
    statusCode = 507;
    message = 'Insufficient storage space';
  } else if (error.message.includes('OCR')) {
    statusCode = 422;
    message = 'OCR processing failed';
  } else if (error.message.includes('conversion')) {
    statusCode = 422;
    message = 'Document conversion failed';
  } else if (error.message.includes('preview')) {
    statusCode = 422;
    message = 'Preview generation failed';
  } else if (error.message.includes('metadata')) {
    statusCode = 422;
    message = 'Metadata extraction failed';
  } else if (error.message.includes('indexing')) {
    statusCode = 422;
    message = 'Document indexing failed';
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal Server Error';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      details: error
    })
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};