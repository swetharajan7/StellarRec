import { SecurityConfig } from '../index';

// Environment-specific security configurations
export const securityConfigs: Record<string, SecurityConfig> = {
  development: {
    enableWAF: true,
    enableAnomalyDetection: true,
    enableRateLimit: true,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 1000, // More lenient for development
    logLevel: 'debug',
    corsOrigins: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ],
    jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_in_production',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379'
  },

  staging: {
    enableWAF: true,
    enableAnomalyDetection: true,
    enableRateLimit: true,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 500,
    logLevel: 'info',
    corsOrigins: [
      'https://staging.stellarrec.com',
      'https://staging-app.stellarrec.com'
    ],
    jwtSecret: process.env.JWT_SECRET || '',
    redisUrl: process.env.REDIS_URL || 'redis://redis:6379'
  },

  production: {
    enableWAF: true,
    enableAnomalyDetection: true,
    enableRateLimit: true,
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100, // Strict rate limiting
    logLevel: 'warn',
    corsOrigins: [
      'https://stellarrec.com',
      'https://app.stellarrec.com',
      'https://www.stellarrec.com'
    ],
    jwtSecret: process.env.JWT_SECRET || '',
    redisUrl: process.env.REDIS_URL || 'redis://redis:6379'
  }
};

// Service-specific security configurations
export const serviceSecurityConfigs = {
  'api-gateway': {
    rateLimitMax: 200, // Higher limit for gateway
    enableWAF: true,
    enableAnomalyDetection: true
  },
  
  'user-service': {
    rateLimitMax: 50,
    enableWAF: true,
    enableAnomalyDetection: true
  },
  
  'ai-service': {
    rateLimitMax: 30, // Lower limit for AI processing
    enableWAF: true,
    enableAnomalyDetection: true
  },
  
  'file-management': {
    rateLimitMax: 20, // Very strict for file uploads
    enableWAF: true,
    enableAnomalyDetection: true
  },
  
  'notification-service': {
    rateLimitMax: 100,
    enableWAF: false, // Less strict for internal notifications
    enableAnomalyDetection: true
  },
  
  'analytics-service': {
    rateLimitMax: 200,
    enableWAF: false, // Analytics might have complex queries
    enableAnomalyDetection: true
  }
};

// Get security configuration for current environment and service
export const getSecurityConfig = (serviceName?: string): SecurityConfig => {
  const environment = process.env.NODE_ENV || 'development';
  const baseConfig = securityConfigs[environment] || securityConfigs.development;
  
  if (serviceName && serviceSecurityConfigs[serviceName as keyof typeof serviceSecurityConfigs]) {
    const serviceConfig = serviceSecurityConfigs[serviceName as keyof typeof serviceSecurityConfigs];
    return {
      ...baseConfig,
      ...serviceConfig
    };
  }
  
  return baseConfig;
};

// Security headers configuration
export const securityHeaders = {
  development: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  },
  
  production: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https://fonts.gstatic.com; connect-src 'self'"
  }
};

// Input validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  alphanumericWithSpaces: /^[a-zA-Z0-9\s]+$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
  strongPassword: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
};

// File upload security settings
export const fileUploadSecurity = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ],
  allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif'],
  virusScanEnabled: process.env.NODE_ENV === 'production',
  quarantineDirectory: '/tmp/quarantine'
};

// Database security settings
export const databaseSecurity = {
  connectionTimeout: 30000,
  queryTimeout: 60000,
  maxConnections: 20,
  enableQueryLogging: process.env.NODE_ENV !== 'production',
  enableSlowQueryLogging: true,
  slowQueryThreshold: 1000, // 1 second
  enableParameterizedQueries: true,
  enableRowLevelSecurity: true
};

// Redis security settings
export const redisSecurity = {
  enableAuth: process.env.NODE_ENV === 'production',
  enableTLS: process.env.NODE_ENV === 'production',
  maxRetries: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  keyPrefix: 'stellarrec:',
  defaultTTL: 3600 // 1 hour
};