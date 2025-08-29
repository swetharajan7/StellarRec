import { Request, Response, NextFunction } from 'express';
import { APIError, ErrorCodes } from '@stellarrec/types';

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

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Extract user information from headers (set by API Gateway)
  const userId = req.headers['x-user-id'] as string;
  const userEmail = req.headers['x-user-email'] as string;
  const userRole = req.headers['x-user-role'] as string;

  if (!userId || !userEmail || !userRole) {
    return next(
      new APIError(
        ErrorCodes.INVALID_CREDENTIALS,
        'Authentication required',
        401
      )
    );
  }

  // Attach user information to request
  req.user = {
    id: userId,
    email: userEmail,
    role: userRole,
  };

  next();
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