import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate unique request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = uuidv4();
  }

  // Log request
  const startTime = Date.now();
  
  logger.info('Incoming request', {
    requestId: req.headers['x-request-id'],
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.headers['x-user-id'],
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      requestId: req.headers['x-request-id'],
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.headers['x-user-id'],
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};