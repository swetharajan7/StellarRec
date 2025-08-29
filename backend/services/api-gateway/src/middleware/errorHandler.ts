import { Request, Response, NextFunction } from 'express';
import { APIError, ErrorCodes, APIResponse } from '@stellarrec/types';
import { logger } from '../utils/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
  });

  // Handle known API errors
  if (error instanceof APIError) {
    const response: APIResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    };

    res.status(error.statusCode).json(response);
    return;
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    const response: APIResponse = {
      success: false,
      error: {
        code: ErrorCodes.INVALID_INPUT,
        message: 'Validation failed',
        details: error.message,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    };

    res.status(400).json(response);
    return;
  }

  // Handle unexpected errors
  const response: APIResponse = {
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] as string || 'unknown',
    },
  };

  res.status(500).json(response);
};