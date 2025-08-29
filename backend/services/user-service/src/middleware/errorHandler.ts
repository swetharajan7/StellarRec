import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { APIError, ErrorCodes, APIResponse } from '@stellarrec/types';
import { logger } from '../utils/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log the error
  logger.error('User Service Error:', {
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

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let apiError: APIError;

    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        apiError = new APIError(
          ErrorCodes.INVALID_INPUT,
          'A record with this information already exists',
          409,
          { field: error.meta?.target }
        );
        break;
      case 'P2025':
        // Record not found
        apiError = new APIError(
          ErrorCodes.INVALID_INPUT,
          'Record not found',
          404
        );
        break;
      case 'P2003':
        // Foreign key constraint violation
        apiError = new APIError(
          ErrorCodes.INVALID_INPUT,
          'Referenced record does not exist',
          400
        );
        break;
      default:
        apiError = new APIError(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Database operation failed',
          500
        );
    }

    const response: APIResponse = {
      success: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] as string || 'unknown',
      },
    };

    res.status(apiError.statusCode).json(response);
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