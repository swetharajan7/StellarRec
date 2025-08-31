export interface CacheConfig {
  redis: RedisConfig;
  cdn: CdnConfig;
  applicationCache: ApplicationCacheConfig;
  warming: WarmingConfig;
  invalidation: InvalidationConfig;
  analytics: AnalyticsConfig;
}

export interface RedisConfig {
  url: string;
  cluster?: boolean;
  ttl: number;
  maxMemory?: string;
  keyPrefix?: string;
  compression?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface CdnConfig {
  provider: 'cloudflare' | 'aws' | 'gcp' | 'azure';
  apiKey: string;
  zoneId?: string;
  distributionId?: string;
  defaultTtl: number;
  enabled: boolean;
}

export interface ApplicationCacheConfig {
  maxSize: string;
  ttl: number;
  algorithm: 'lru' | 'lfu' | 'fifo';
  enabled: boolean;
}

export interface WarmingConfig {
  enabled: boolean;
  schedule?: string;
  predictive: boolean;
  patterns: string[];
  threshold: number;
  lookahead: number;
}

export interface InvalidationConfig {
  enabled: boolean;
  strategies: ('tag-based' | 'event-driven' | 'time-based')[];
  cascadeDepth: number;
  batchSize: number;
}

export interface AnalyticsConfig {
  enabled: boolean;
  retentionDays: number;
  metricsInterval: number;
  alertThresholds: {
    hitRate: number;
    memoryUsage: number;
    errorRate: number;
  };
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  ttl: number;
  tags: string[];
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
  compressed: boolean;
}

export interface CacheMetrics {
  timestamp: Date;
  levels: {
    cdn: LevelMetrics;
    redis: LevelMetrics;
    application: LevelMetrics;
  };
  overall: {
    hitRate: number;
    missRate: number;
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
  };
  memory: {
    used: number;
    available: number;
    usage: number;
  };
  performance: {
    topKeys: Array<{ key: string; hits: number; misses: number }>;
    slowQueries: Array<{ key: string; avgTime: number }>;
    hotspots: Array<{ pattern: string; frequency: number }>;
  };
}

export interface LevelMetrics {
  hitRate: number;
  missRate: number;
  requests: number;
  avgResponseTime: number;
  memoryUsage: number;
  evictions: number;
}

export interface CachePattern {
  pattern: string;
  ttl: number;
  tags: string[];
  strategy: CacheStrategy;
  warming: boolean;
  compression: boolean;
}

export interface WarmingJob {
  id: string;
  pattern: string;
  schedule: string;
  query: () => Promise<any>;
  lastRun?: Date;
  nextRun: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  error?: string;
}

export interface InvalidationEvent {
  type: 'create' | 'update' | 'delete';
  entity: string;
  entityId: string;
  tags: string[];
  timestamp: Date;
  cascadeRules?: string[];
}

export interface CacheStrategy {
  type: 'cache-aside' | 'write-through' | 'write-behind' | 'refresh-ahead';
  levels: CacheLevel[];
  fallback: boolean;
  errorHandling: 'fail-fast' | 'fail-safe' | 'retry';
}

export interface CacheLevel {
  name: 'cdn' | 'redis' | 'application';
  ttl: number;
  enabled: boolean;
  priority: number;
}

export interface CacheOperation {
  operation: 'get' | 'set' | 'delete' | 'invalidate';
  key: string;
  level: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  size?: number;
  error?: string;
}

export interface CacheAlert {
  id: string;
  type: 'hit-rate' | 'memory' | 'error-rate' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface CdnPurgeRequest {
  urls: string[];
  tags?: string[];
  everything?: boolean;
}

export interface CdnCacheRule {
  pattern: string;
  ttl: number;
  headers: Record<string, string>;
  conditions?: {
    fileExtensions?: string[];
    paths?: string[];
    queryParams?: string[];
  };
}

export interface WarmingStrategy {
  type: 'scheduled' | 'predictive' | 'reactive';
  config: {
    schedule?: string;
    threshold?: number;
    patterns?: string[];
    lookahead?: number;
  };
}

export interface CacheStats {
  totalKeys: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  evictionRate: number;
  avgTtl: number;
  topKeys: Array<{
    key: string;
    hits: number;
    size: number;
    lastAccessed: Date;
  }>;
}

export interface CompressionConfig {
  enabled: boolean;
  algorithm: 'gzip' | 'brotli' | 'lz4';
  threshold: number; // Minimum size to compress
  level: number; // Compression level
}

export interface CacheHealthCheck {
  level: string;
  healthy: boolean;
  latency: number;
  errorRate: number;
  memoryUsage: number;
  lastCheck: Date;
  issues: string[];
}