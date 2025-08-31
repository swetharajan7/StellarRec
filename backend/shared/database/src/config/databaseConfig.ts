import { DatabaseConfig } from '../types';

export function createDatabaseConfig(): DatabaseConfig {
  return {
    primaryUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/stellarrec',
    readReplicaUrls: process.env.DATABASE_READ_URLS?.split(',') || [],
    
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '5', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '5000', 10),
      acquireTimeoutMillis: parseInt(process.env.DB_POOL_ACQUIRE_TIMEOUT || '10000', 10),
      createTimeoutMillis: parseInt(process.env.DB_POOL_CREATE_TIMEOUT || '5000', 10),
      destroyTimeoutMillis: parseInt(process.env.DB_POOL_DESTROY_TIMEOUT || '5000', 10),
      reapIntervalMillis: parseInt(process.env.DB_POOL_REAP_INTERVAL || '1000', 10),
      createRetryIntervalMillis: parseInt(process.env.DB_POOL_CREATE_RETRY_INTERVAL || '200', 10)
    },

    cache: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutes default
      maxMemory: process.env.CACHE_MAX_MEMORY || '100mb',
      keyPrefix: process.env.CACHE_KEY_PREFIX || 'stellarrec:',
      enableCompression: process.env.CACHE_ENABLE_COMPRESSION === 'true',
      enableCacheWarming: process.env.CACHE_ENABLE_WARMING === 'true'
    },

    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10), // 1 second
      metricsRetention: parseInt(process.env.METRICS_RETENTION_DAYS || '7', 10),
      alertThresholds: {
        connectionPoolUsage: parseInt(process.env.ALERT_POOL_USAGE || '80', 10),
        cacheHitRate: parseInt(process.env.ALERT_CACHE_HIT_RATE || '70', 10),
        queryTime: parseInt(process.env.ALERT_QUERY_TIME || '2000', 10),
        errorRate: parseInt(process.env.ALERT_ERROR_RATE || '5', 10)
      }
    },

    partitioning: {
      enabled: process.env.PARTITIONING_ENABLED === 'true',
      tables: {
        audit_logs: {
          type: 'range',
          column: 'created_at',
          interval: '1 month'
        },
        notifications: {
          type: 'range',
          column: 'created_at',
          interval: '1 month'
        },
        essay_analyses: {
          type: 'range',
          column: 'created_at',
          interval: '1 month'
        }
      },
      maintenanceSchedule: process.env.PARTITION_MAINTENANCE_SCHEDULE || '0 2 * * *' // Daily at 2 AM
    }
  };
}

export function validateDatabaseConfig(config: DatabaseConfig): void {
  if (!config.primaryUrl) {
    throw new Error('Primary database URL is required');
  }

  if (config.pool.min < 0 || config.pool.max < config.pool.min) {
    throw new Error('Invalid connection pool configuration');
  }

  if (config.cache.ttl < 0) {
    throw new Error('Cache TTL must be positive');
  }

  if (config.monitoring.slowQueryThreshold < 0) {
    throw new Error('Slow query threshold must be positive');
  }

  console.log('✅ Database configuration validated');
}

// Environment-specific configurations
export const developmentConfig: Partial<DatabaseConfig> = {
  monitoring: {
    enabled: true,
    slowQueryThreshold: 500, // More sensitive in development
    metricsRetention: 1,
    alertThresholds: {
      connectionPoolUsage: 90,
      cacheHitRate: 50,
      queryTime: 1000,
      errorRate: 10
    }
  },
  cache: {
    ttl: 60, // Shorter TTL in development
    enableCacheWarming: false
  }
};

export const productionConfig: Partial<DatabaseConfig> = {
  pool: {
    min: 10,
    max: 50,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000
  },
  monitoring: {
    enabled: true,
    slowQueryThreshold: 2000,
    metricsRetention: 30,
    alertThresholds: {
      connectionPoolUsage: 75,
      cacheHitRate: 80,
      queryTime: 3000,
      errorRate: 2
    }
  },
  cache: {
    ttl: 600, // 10 minutes
    maxMemory: '500mb',
    enableCompression: true,
    enableCacheWarming: true
  },
  partitioning: {
    enabled: true
  }
};

export const testConfig: Partial<DatabaseConfig> = {
  pool: {
    min: 1,
    max: 5
  },
  monitoring: {
    enabled: false
  },
  cache: {
    ttl: 10,
    enableCacheWarming: false
  },
  partitioning: {
    enabled: false
  }
};

export function getEnvironmentConfig(): Partial<DatabaseConfig> {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return productionConfig;
    case 'test':
      return testConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}