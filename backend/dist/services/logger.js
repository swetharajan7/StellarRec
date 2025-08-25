"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLogger = exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
class Logger {
    constructor(context = 'Application') {
        this.context = context;
        this.winston = this.createLogger();
    }
    createLogger() {
        const logLevel = process.env.LOG_LEVEL || 'info';
        const logFormat = winston_1.default.format.combine(winston_1.default.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, context, ...meta }) => {
            const logEntry = {
                timestamp,
                level: level.toUpperCase(),
                context: context || this.context,
                message,
                ...meta
            };
            return JSON.stringify(logEntry);
        }));
        const transports = [
            new winston_1.default.transports.Console({
                level: logLevel,
                format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({
                    format: 'HH:mm:ss.SSS'
                }), winston_1.default.format.printf(({ timestamp, level, message, context, ...meta }) => {
                    const ctx = context || this.context;
                    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
                    return `${timestamp} [${level}] [${ctx}] ${message}${metaStr}`;
                }))
            })
        ];
        if (process.env.NODE_ENV === 'production') {
            const logDir = process.env.LOG_DIR || './logs';
            transports.push(new winston_1.default.transports.File({
                filename: path_1.default.join(logDir, 'combined.log'),
                level: 'info',
                format: logFormat,
                maxsize: 10 * 1024 * 1024,
                maxFiles: 5,
                tailable: true
            }));
            transports.push(new winston_1.default.transports.File({
                filename: path_1.default.join(logDir, 'error.log'),
                level: 'error',
                format: logFormat,
                maxsize: 10 * 1024 * 1024,
                maxFiles: 5,
                tailable: true
            }));
            transports.push(new winston_1.default.transports.File({
                filename: path_1.default.join(logDir, 'auth.log'),
                level: 'info',
                format: logFormat,
                maxsize: 10 * 1024 * 1024,
                maxFiles: 10,
                tailable: true,
                filter: (info) => {
                    return info.context && (info.context.includes('Auth') ||
                        info.context.includes('Security') ||
                        info.message.toLowerCase().includes('auth') ||
                        info.message.toLowerCase().includes('login') ||
                        info.message.toLowerCase().includes('register'));
                }
            }));
        }
        return winston_1.default.createLogger({
            level: logLevel,
            format: logFormat,
            transports,
            exitOnError: false,
            exceptionHandlers: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                })
            ],
            rejectionHandlers: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                })
            ]
        });
    }
    debug(message, context) {
        this.winston.debug(message, { context: this.context, ...context });
    }
    info(message, context) {
        this.winston.info(message, { context: this.context, ...context });
    }
    warn(message, context) {
        this.winston.warn(message, { context: this.context, ...context });
    }
    error(message, error, context) {
        if (error instanceof Error) {
            this.winston.error(message, {
                context: this.context,
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                },
                ...context
            });
        }
        else {
            this.winston.error(message, { context: this.context, ...error });
        }
    }
    fatal(message, error, context) {
        if (error instanceof Error) {
            this.winston.error(message, {
                context: this.context,
                level: 'FATAL',
                error: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                },
                ...context
            });
        }
        else {
            this.winston.error(message, { context: this.context, level: 'FATAL', ...error });
        }
    }
    http(message, context) {
        this.winston.http(message, { context: this.context, ...context });
    }
    log(level, message, context) {
        this.winston.log(level, message, { context: this.context, ...context });
    }
    child(additionalContext) {
        const childLogger = new Logger(this.context);
        const originalLog = childLogger.winston.log.bind(childLogger.winston);
        childLogger.winston.log = (level, message, meta = {}) => {
            return originalLog(level, message, { ...additionalContext, ...meta });
        };
        return childLogger;
    }
    performance(operation, duration, context) {
        this.info(`Performance: ${operation}`, {
            operation,
            duration: `${duration}ms`,
            performance: true,
            ...context
        });
    }
    security(event, context) {
        this.warn(`Security Event: ${event}`, {
            event,
            security: true,
            timestamp: new Date().toISOString(),
            ...context
        });
    }
    audit(action, userId, context) {
        this.info(`Audit: ${action}`, {
            action,
            userId,
            audit: true,
            timestamp: new Date().toISOString(),
            ...context
        });
    }
    startTimer(label) {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.performance(label, duration);
        };
    }
    structured(level, message, data) {
        this.winston.log(level, message, {
            context: this.context,
            structured: true,
            data
        });
    }
}
exports.Logger = Logger;
exports.defaultLogger = new Logger('StellarRec');
exports.default = Logger;
//# sourceMappingURL=logger.js.map