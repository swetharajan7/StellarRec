"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuthEvent = exports.authRateLimit = exports.requireResourceOwnership = exports.optionalAuth = exports.requireCompleteProfile = exports.requireEmailVerification = exports.requireRole = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const AuthService_1 = require("../services/auth/AuthService");
const logger_1 = require("../services/logger");
const logger = new logger_1.Logger('AuthMiddleware');
const authService = new AuthService_1.AuthService();
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({
                success: false,
                error: 'Access token required',
                code: 'TOKEN_MISSING'
            });
            return;
        }
        const jwtSecret = process.env.JWT_SECRET || 'stellarrec-jwt-secret-key';
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        const user = await authService.getUserById(decoded.userId);
        if (!user) {
            res.status(401).json({
                success: false,
                error: 'User not found',
                code: 'USER_NOT_FOUND'
            });
            return;
        }
        req.user = user;
        req.userId = user.id;
        next();
    }
    catch (error) {
        logger.error('Token authentication failed:', error);
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                success: false,
                error: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }
        else if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                error: 'Invalid token',
                code: 'TOKEN_INVALID'
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Authentication failed',
                code: 'AUTH_ERROR'
            });
        }
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (roles) => {
    return (req, res, next) => {
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
exports.requireRole = requireRole;
const requireEmailVerification = (req, res, next) => {
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
exports.requireEmailVerification = requireEmailVerification;
const requireCompleteProfile = (req, res, next) => {
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
exports.requireCompleteProfile = requireCompleteProfile;
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            next();
            return;
        }
        const jwtSecret = process.env.JWT_SECRET || 'stellarrec-jwt-secret-key';
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        const user = await authService.getUserById(decoded.userId);
        if (user) {
            req.user = user;
            req.userId = user.id;
        }
        next();
    }
    catch (error) {
        logger.warn('Optional auth failed:', error);
        next();
    }
};
exports.optionalAuth = optionalAuth;
const requireResourceOwnership = (resourceUserIdField = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
            return;
        }
        if (req.user.role === 'admin') {
            next();
            return;
        }
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
exports.requireResourceOwnership = requireResourceOwnership;
const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
    const attempts = new Map();
    return (req, res, next) => {
        const clientId = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
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
exports.authRateLimit = authRateLimit;
const logAuthEvent = (event) => {
    return (req, res, next) => {
        const originalSend = res.send;
        res.send = function (data) {
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
exports.logAuthEvent = logAuthEvent;
//# sourceMappingURL=auth.js.map