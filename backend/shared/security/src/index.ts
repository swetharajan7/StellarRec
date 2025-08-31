// Security middleware exports
export {
  sanitizeInput,
  sqlInjectionProtection,
  xssProtection,
  securityHeaders,
  createRateLimit,
  authRateLimit,
  apiRateLimit,
  uploadRateLimit,
  handleValidationErrors,
  commonValidations
} from './middleware/securityMiddleware';

// WAF exports
export { waf, wafMiddleware } from './utils/wafRules';

// Anomaly detection exports
export { 
  anomalyDetection, 
  anomalyDetectionMiddleware 
} from './utils/anomalyDetection';

// Compliance checker exports
export {
  complianceChecker,
  complianceMiddleware
} from './utils/complianceChecker';

// Configuration exports
export {
  getSecurityConfig,
  securityHeaders,
  validationPatterns,
  fileUploadSecurity,
  databaseSecurity,
  redisSecurity
} from './config/securityConfig';

// Logger exports
export { logger, securityLogger } from './utils/logger';

// Types
export interface SecurityConfig {
  enableWAF: boolean;
  enableAnomalyDetection: boolean;
  enableRateLimit: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  corsOrigins: string[];
  jwtSecret: string;
  redisUrl: string;
}

export interface SecurityAnalysis {
  wafViolations: string[];
  anomalyScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
  reasons: string[];
}

// Security configuration helper
export const createSecurityConfig = (overrides: Partial<SecurityConfig> = {}): SecurityConfig => {
  return {
    enableWAF: true,
    enableAnomalyDetection: true,
    enableRateLimit: true,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100,
    logLevel: 'info',
    corsOrigins: ['http://localhost:3000'],
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    ...overrides
  };
};

// Complete security middleware stack
export const createSecurityStack = (config: Partial<SecurityConfig> = {}) => {
  const securityConfig = createSecurityConfig(config);
  
  return [
    securityHeaders,
    ...(securityConfig.enableRateLimit ? [createRateLimit(securityConfig.rateLimitWindow, securityConfig.rateLimitMax)] : []),
    sanitizeInput,
    sqlInjectionProtection,
    xssProtection,
    ...(securityConfig.enableWAF ? [wafMiddleware] : []),
    ...(securityConfig.enableAnomalyDetection ? [anomalyDetectionMiddleware] : []),
    complianceMiddleware
  ];
};