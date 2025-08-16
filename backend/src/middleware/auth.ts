import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService, User } from '../services/auth/AuthService';
import { Logger } from '../services/logger';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
      userId?: string;
    }
  }
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

const logger = new Logger('AuthMiddleware');
const authService = new AuthService();

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'stellarrec-jwt-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Get user from database to ensure they still exist and are active
    const user = await authService.getUserById(decoded.userId);
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;

    next();

  } catch (error) {
    logger.error('Token authentication failed:', error);

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        code: 'TOKEN_INVALID'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_ERROR'
      });
    }
  }
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: req.user.role
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to check if user's email is verified
 */
export const requireEmailVerification = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  if (!req.user.emailVerified) {
    res.status(403).json({
      success: false,
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email address to access this feature'
    });
    return;
  }

  next();
};

/**
 * Middleware to check if user's profile is complete
 */
export const requireCompleteProfile = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  if (!req.user.profileComplete) {
    res.status(403).json({
      success: false,
      error: 'Complete profile required',
      code: 'PROFILE_INCOMPLETE',
      message: 'Please complete your profile to access AI features'
    });
    return;
  }

  next();
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    // Verify JWT token
    const jwtSecret = process.env.JWT_SECRET || 'stellarrec-jwt-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // Get user from database
    const user = await authService.getUserById(decoded.userId);
    
    if (user) {
      req.user = user;
      req.userId = user.id;
    }

    next();

  } catch (error) {
    // Log error but don't fail the request
    logger.warn('Optional auth failed:', error);
    next();
  }
};

/**
 * Middleware to validate user owns resource
 */
export const requireResourceOwnership = (resourceUserIdField: string = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Allow admins to access any resource
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // Get resource user ID from params, body, or query
    const resourceUserId = req.params[resourceUserIdField] || 
                          req.body[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    if (!resourceUserId) {
      res.status(400).json({
        success: false,
        error: 'Resource user ID required',
        code: 'RESOURCE_USER_ID_MISSING'
      });
      return;
    }

    if (req.user.id !== resourceUserId) {
      res.status(403).json({
        success: false,
        error: 'Access denied - resource ownership required',
        code: 'RESOURCE_ACCESS_DENIED'
      });
      return;
    }

    next();
  };
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    // Clean up expired entries
    for (const [key, value] of attempts.entries()) {
      if (now > value.resetTime) {
        attempts.delete(key);
      }
    }

    const clientAttempts = attempts.get(clientId);
    
    if (!clientAttempts) {
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (clientAttempts.count >= maxAttempts) {
      const remainingTime = Math.ceil((clientAttempts.resetTime - now) / 1000);
      
      res.status(429).json({
        success: false,
        error: 'Too many authentication attempts',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: remainingTime
      });
      return;
    }

    clientAttempts.count++;
    next();
  };
};

/**
 * Middleware to log authentication events
 */
export const logAuthEvent = (event: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    
    res.send = function(data) {
      const responseData = typeof data === 'string' ? JSON.parse(data) : data;
      
      logger.info(`Auth Event: ${event}`, {
        userId: req.user?.id,
        email: req.user?.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: responseData.success,
        timestamp: new Date().toISOString()
      });

      return originalSend.call(this, data);
    };

    next();
  };
};