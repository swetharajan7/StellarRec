import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from 'redis';
import { logger } from '../utils/logger';
import { APIError, ErrorCodes } from '@stellarrec/types';

interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

// Redis client for token blacklist
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  logger.error('Redis client error:', err);
});

redisClient.connect().catch((err) => {
  logger.error('Failed to connect to Redis:', err);
});

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new APIError(
        ErrorCodes.INVALID_CREDENTIALS,
        'Authorization token is required',
        401
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new APIError(
        ErrorCodes.TOKEN_EXPIRED,
        'Token has been revoked',
        401
      );
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    ) as JWTPayload;

    // Check token expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp < currentTime) {
      throw new APIError(
        ErrorCodes.TOKEN_EXPIRED,
        'Token has expired',
        401
      );
    }

    // Attach user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(
        new APIError(
          ErrorCodes.INVALID_CREDENTIALS,
          'Invalid token',
          401
        )
      );
    }

    if (error instanceof jwt.TokenExpiredError) {
      return next(
        new APIError(
          ErrorCodes.TOKEN_EXPIRED,
          'Token has expired',
          401
        )
      );
    }

    next(error);
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new APIError(
          ErrorCodes.INSUFFICIENT_PERMISSIONS,
          'Authentication required',
          401
        )
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new APIError(
          ErrorCodes.INSUFFICIENT_PERMISSIONS,
          'Insufficient permissions for this resource',
          403
        )
      );
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);

    // Check if token is blacklisted
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(); // Continue without authentication
    }

    // Verify JWT token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    ) as JWTPayload;

    // Check token expiration
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp < currentTime) {
      return next(); // Continue without authentication
    }

    // Attach user information to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    // If token verification fails, continue without authentication
    next();
  }
};

export const blacklistToken = async (token: string): Promise<void> => {
  try {
    // Decode token to get expiration time
    const decoded = jwt.decode(token) as JWTPayload;
    if (decoded && decoded.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await redisClient.setEx(`blacklist:${token}`, ttl, 'true');
      }
    }
  } catch (error) {
    logger.error('Error blacklisting token:', error);
  }
};