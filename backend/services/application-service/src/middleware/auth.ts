import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    user_id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token missing' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
    req.user = {
      user_id: decoded.sub || decoded.user_id,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};