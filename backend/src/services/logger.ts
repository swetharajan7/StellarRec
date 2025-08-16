import winston from 'winston';
import path from 'path';

export interface LogContext {
  [key: string]: any;
}

export class Logger {
  private winston: winston.Logger;
  private context: string;

  constructor(context: string = 'Application') {
    this.context = context;
    this.winston = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logLevel = process.env.LOG_LEVEL || 'info';
    const logFormat = winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
        const logEntry = {
          timestamp,
          level: level.toUpperCase(),
          context: context || this.context,
          message,
          ...meta
        };
        
        return JSON.stringify(logEntry);
      })
    );

    const transports: winston.transport[] = [
      // Console transport for development
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({
            format: 'HH:mm:ss.SSS'
          }),
          winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
            const ctx = context || this.context;
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `${timestamp} [${level}] [${ctx}] ${message}${metaStr}`;
          })
        )
      })
    ];

    // File transports for production
    if (process.env.NODE_ENV === 'production') {
      const logDir = process.env.LOG_DIR || './logs';
      
      // Combined log file
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          level: 'info',
          format: logFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        })
      );

      // Error log file
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          format: logFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5,
          tailable: true
        })
      );

      // Auth log file for security events
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'auth.log'),
          level: 'info',
          format: logFormat,
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 10,
          tailable: true,
          // Only log auth-related events
          filter: (info) => {
            return info.context && (
              info.context.includes('Auth') || 
              info.context.includes('Security') ||
              info.message.toLowerCase().includes('auth') ||
              info.message.toLowerCase().includes('login') ||
              info.message.toLowerCase().includes('register')
            );
          }
        })
      );
    }

    return winston.createLogger({
      level: logLevel,
      format: logFormat,
      transports,
      // Don't exit on handled exceptions
      exitOnError: false,
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ],
      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.winston.debug(message, { context: this.context, ...context });
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.winston.info(message, { context: this.context, ...context });
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.winston.warn(message, { context: this.context, ...context });
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error | LogContext, context?: LogContext): void {
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
    } else {
      this.winston.error(message, { context: this.context, ...error });
    }
  }

  /**
   * Log fatal error message
   */
  fatal(message: string, error?: Error | LogContext, context?: LogContext): void {
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
    } else {
      this.winston.error(message, { context: this.context, level: 'FATAL', ...error });
    }
  }

  /**
   * Log HTTP request
   */
  http(message: string, context?: LogContext): void {
    this.winston.http(message, { context: this.context, ...context });
  }

  /**
   * Log with custom level
   */
  log(level: string, message: string, context?: LogContext): void {
    this.winston.log(level, message, { context: this.context, ...context });
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    const childLogger = new Logger(this.context);
    
    // Override the winston logger to include additional context
    const originalLog = childLogger.winston.log.bind(childLogger.winston);
    childLogger.winston.log = (level: any, message: any, meta: any = {}) => {
      return originalLog(level, message, { ...additionalContext, ...meta });
    };

    return childLogger;
  }

  /**
   * Log performance metrics
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      performance: true,
      ...context
    });
  }

  /**
   * Log security event
   */
  security(event: string, context?: LogContext): void {
    this.warn(`Security Event: ${event}`, {
      event,
      security: true,
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  /**
   * Log audit event
   */
  audit(action: string, userId?: string, context?: LogContext): void {
    this.info(`Audit: ${action}`, {
      action,
      userId,
      audit: true,
      timestamp: new Date().toISOString(),
      ...context
    });
  }

  /**
   * Start timing an operation
   */
  startTimer(label: string): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      this.performance(label, duration);
    };
  }

  /**
   * Log with structured data
   */
  structured(level: string, message: string, data: Record<string, any>): void {
    this.winston.log(level, message, {
      context: this.context,
      structured: true,
      data
    });
  }
}

// Create and export default logger instance
export const defaultLogger = new Logger('StellarRec');

// Export logger class for creating context-specific loggers
export default Logger;