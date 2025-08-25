import { Request, Response, NextFunction } from 'express';
import { User } from '../services/auth/AuthService';
declare global {
    namespace Express {
        interface Request {
            user?: User;
            userId?: string;
        }
    }
}
export declare const authenticateToken: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireRole: (roles: string | string[]) => (req: Request, res: Response, next: NextFunction) => void;
export declare const requireEmailVerification: (req: Request, res: Response, next: NextFunction) => void;
export declare const requireCompleteProfile: (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const requireResourceOwnership: (resourceUserIdField?: string) => (req: Request, res: Response, next: NextFunction) => void;
export declare const authRateLimit: (maxAttempts?: number, windowMs?: number) => (req: Request, res: Response, next: NextFunction) => void;
export declare const logAuthEvent: (event: string) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map