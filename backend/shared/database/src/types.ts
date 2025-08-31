export interface DatabaseConfig {
  primaryUrl: string;
  readReplicaUrls?: string[];
  pool: PoolConfig;
  cache: CacheConfig;
  monitoring: MonitoringConfig;
  partitioning: PartitionConfig;
}

export interface PoolConfig {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
}

export interface CacheConfig {
  url: string;
  ttl: number;
  maxMemory: string;
  keyPrefix: string;
  enableCompression: boolean;
  enableCacheWarming: boolean;
}

export interface ReplicaConfig {
  urls: string[];
  loadBalancing: 'round-robin' | 'random' | 'least-connections';
  healthCheckInterval: number;
  maxRetries: number;
  retryDelay: number;
}

export interface PartitionConfig {
  enabled: boolean;
  tables: {
    [tableName: string]: {
      type: 'range' | 'hash';
      column: string;
      interval?: string; // For range partitioning (e.g., '1 month')
      partitions?: number; // For hash partitioning
    };
  };
  maintenanceSchedule: string; // Cron expression
}

export interface MonitoringConfig {
  enabled: boolean;
  slowQueryThreshold: number; // milliseconds
  metricsRetention: number; // days
  alertThresholds: {
    connectionPoolUsage: number; // percentage
    cacheHitRate: number; // percentage
    queryTime: number; // milliseconds
    errorRate: number; // percentage
  };
}

export interface PerformanceMetrics {
  timestamp: Date;
  connections: {
    active: number;
    idle: number;
    total: number;
    poolUsage: number; // percentage
  };
  queries: {
    total: number;
    slow: number;
    avgTime: number;
    errorRate: number;
  };
  cache: {
    hitRate: number;
    missRate: number;
    evictions: number;
    memoryUsage: number;
  };
  database: {
    size: number;
    tableStats: Array<{
      name: string;
      rows: number;
      size: number;
    }>;
  };
}

export interface SlowQuery {
  query: string;
  duration: number;
  timestamp: Date;
  parameters?: any[];
  executionPlan?: string;
  frequency: number;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryUsage: number;
  keyCount: number;
  avgTtl: number;
}

export interface PoolStatus {
  active: number;
  idle: number;
  waiting: number;
  total: number;
  usage: number; // percentage
  health: 'healthy' | 'warning' | 'critical';
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

export interface QueryCacheOptions {
  ttl?: number;
  tags?: string[];
  invalidateOn?: string[];
  compress?: boolean;
}

export interface PartitionInfo {
  tableName: string;
  partitionName: string;
  partitionType: 'range' | 'hash';
  bounds: string;
  rowCount: number;
  size: number;
  createdAt: Date;
}

export interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    connectivity: boolean;
    replication: boolean;
    diskSpace: boolean;
    performance: boolean;
  };
  metrics: PerformanceMetrics;
  alerts: string[];
}