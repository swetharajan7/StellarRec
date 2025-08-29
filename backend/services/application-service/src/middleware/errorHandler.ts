import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'Something went wrong',
    ...(isDevelopment && { stack: error.stack })
  });
};