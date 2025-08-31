import { CdnCacheManager } from './cdn/cdnCacheManager';
import { ApplicationCacheManager } from './application/applicationCacheManager';
import { CacheWarmingEngine } from './warming/cacheWarmingEngine';
import { CacheInvalidationManager } from './invalidation/cacheInvalidationManager';
import { CacheAnalytics } from './analytics/cacheAnalytics';
import { CacheStrategies } from './strategies/cacheStrategies';
import Redis from 'ioredis';
import {
  CacheConfig,
  CacheEntry,
  CacheMetrics,
  CacheStrategy,
  CacheLevel,
  CacheOperation,
  CacheHealthCheck
} from './types';

export class AdvancedCacheManager {
  private redis: Redis;
  private cdnManager: CdnCacheManager;
  private appCacheManager: ApplicationCacheManager;
  private warmingEngine: CacheWarmingEngine;
  private invalidationManager: CacheInvalidationManager;
  private analytics: CacheAnalytics;
  private strategies: CacheStrategies;
  private config: CacheConfig;
  private operations: CacheOperation[] = [];

  constructor(config: CacheConfig) {
    this.config = config;
    
    // Initialize Redis connection
    this.redis = new Redis(config.redis.url, {
      retryDelayOnFailover: config.redis.retryDelay || 100,
      maxRetriesPerRequest: config.redis.retryAttempts || 3,
      keyPrefix: config.redis.keyPrefix || 'stellarrec:'
    });

    // Initialize cache managers
    this.cdnManager = new CdnCacheManager(config.cdn);
    this.appCacheManager = new ApplicationCacheManager(config.applicationCache);
    this.warmingEngine = new CacheWarmingEngine(config.warming, this);
    this.invalidationManager = new CacheInvalidationManager(config.invalidation, this);
    this.analytics = new CacheAnalytics(config.analytics, this);
    this.strategies = new CacheStrategies(this);

    this.setupEventHandlers();
    this.startBackgroundTasks();
  }

  private setupEventHandlers() {
    this.redis.on('connect', () => {
      console.log('✅ Advanced cache manager connected to Redis');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis cache error:', error);
      this.recordOperation({
        operation: 'get',
        key: 'connection',
        level: 'redis',
        timestamp: new Date(),
        duration: 0,
        success: false,
        error: error.message
      });
    });
  }

  private startBackgroundTasks() {
    if (this.config.warming.enabled) {
      this.warmingEngine.start();
    }

    if (this.config.analytics.enabled) {
      this.analytics.start();
    }

    // Clean up operations log every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      this.operations = this.operations.filter(op => op.timestamp > cutoff);
    }, 60 * 60 * 1000);
  }

  // Multi-level caching with fallback
  async get<T>(key: string, fallback?: () => Promise<T>, options?: {
    levels?: CacheLevel[];
    strategy?: CacheStrategy;
    ttl?: number;
  }): Promise<T | null> {
    const startTime = Date.now();
    const levels = options?.levels || [
      { name: 'application', ttl: 60, enabled: true, priority: 1 },
      { name: 'redis', ttl: 300, enabled: true, priority: 2 },
      { name: 'cdn', ttl: 3600, enabled: true, priority: 3 }
    ];

    // Try each cache level in priority order
    for (const level of levels.sort((a, b) => a.priority - b.priority)) {
      if (!level.enabled) continue;

      try {
        let value: T | null = null;

        switch (level.name) {
          case 'application':
            value = await this.appCacheManager.get<T>(key);
            break;
          case 'redis':
            const redisValue = await this.redis.get(key);
            if (redisValue) {
              value = this.deserialize<T>(redisValue);
            }
            break;
          case 'cdn':
            value = await this.cdnManager.get<T>(key);
            break;
        }

        if (value !== null) {
          this.recordOperation({
            operation: 'get',
            key,
            level: level.name,
            timestamp: new Date(),
            duration: Date.now() - startTime,
            success: true
          });

          // Populate higher priority caches
          await this.populateHigherCaches(key, value, levels, level);
          
          return value;
        }
      } catch (error) {
        this.recordOperation({
          operation: 'get',
          key,
          level: level.name,
          timestamp: new Date(),
          duration: Date.now() - startTime,
          success: false,
          error: error.message
        });
      }
    }

    // Cache miss - use fallback if provided
    if (fallback) {
      try {
        const value = await fallback();
        await this.setMultiLevel(key, value, { levels, ttl: options?.ttl });
        return value;
      } catch (error) {
        console.error(`Fallback failed for key ${key}:`, error);
        return null;
      }
    }

    return null;
  }

  async set<T>(key: string, value: T, options?: {
    ttl?: number;
    tags?: string[];
    compress?: boolean;
    levels?: CacheLevel[];
  }): Promise<void> {
    const startTime = Date.now();
    const ttl = options?.ttl || this.config.redis.ttl;
    const tags = options?.tags || [];
    const compress = options?.compress || this.config.redis.compression;

    try {
      const serialized = this.serialize(value, compress);
      const size = Buffer.byteLength(serialized);

      // Set in Redis
      await this.redis.setex(key, ttl, serialized);

      // Set in application cache
      await this.appCacheManager.set(key, value, { ttl: Math.min(ttl, 300) });

      // Add tags for invalidation
      if (tags.length > 0) {
        await this.invalidationManager.addTags(key, tags);
      }

      this.recordOperation({
        operation: 'set',
        key,
        level: 'multi',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: true,
        size
      });
    } catch (error) {
      this.recordOperation({
        operation: 'set',
        key,
        level: 'multi',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async setMultiLevel<T>(key: string, value: T, options?: {
    levels?: CacheLevel[];
    ttl?: number;
    tags?: string[];
  }): Promise<void> {
    const levels = options?.levels || [
      { name: 'application', ttl: 60, enabled: true, priority: 1 },
      { name: 'redis', ttl: 300, enabled: true, priority: 2 }
    ];

    const promises = levels.map(async (level) => {
      if (!level.enabled) return;

      try {
        switch (level.name) {
          case 'application':
            await this.appCacheManager.set(key, value, { ttl: level.ttl });
            break;
          case 'redis':
            const serialized = this.serialize(value);
            await this.redis.setex(key, level.ttl, serialized);
            break;
          case 'cdn':
            await this.cdnManager.set(key, value, { ttl: level.ttl });
            break;
        }
      } catch (error) {
        console.error(`Failed to set cache at level ${level.name}:`, error);
      }
    });

    await Promise.allSettled(promises);

    // Add tags for invalidation
    if (options?.tags) {
      await this.invalidationManager.addTags(key, options.tags);
    }
  }

  async delete(key: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Delete from all levels
      await Promise.allSettled([
        this.redis.del(key),
        this.appCacheManager.delete(key),
        this.cdnManager.delete(key)
      ]);

      // Remove from invalidation tracking
      await this.invalidationManager.removeTags(key);

      this.recordOperation({
        operation: 'delete',
        key,
        level: 'multi',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: true
      });
    } catch (error) {
      this.recordOperation({
        operation: 'delete',
        key,
        level: 'multi',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    const startTime = Date.now();

    try {
      await this.invalidationManager.invalidateByTags(tags);

      this.recordOperation({
        operation: 'invalidate',
        key: `tags:${tags.join(',')}`,
        level: 'multi',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: true
      });
    } catch (error) {
      this.recordOperation({
        operation: 'invalidate',
        key: `tags:${tags.join(',')}`,
        level: 'multi',
        timestamp: new Date(),
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  // Cache strategy implementations
  async cacheAside<T>(key: string, fallback: () => Promise<T>, options?: {
    ttl?: number;
    tags?: string[];
  }): Promise<T> {
    return this.strategies.cacheAside(key, fallback, options);
  }

  async writeThrough<T>(key: string, value: T, writer: (value: T) => Promise<T>, options?: {
    ttl?: number;
    tags?: string[];
  }): Promise<T> {
    return this.strategies.writeThrough(key, value, writer, options);
  }

  async writeBehind<T>(key: string, value: T, options?: {
    ttl?: number;
    tags?: string[];
    batchSize?: number;
    flushInterval?: number;
  }): Promise<void> {
    return this.strategies.writeBehind(key, value, options);
  }

  async refreshAhead<T>(key: string, refresher: () => Promise<T>, options?: {
    ttl?: number;
    refreshThreshold?: number;
  }): Promise<T | null> {
    return this.strategies.refreshAhead(key, refresher, options);
  }

  // Warming operations
  async warmCache(patterns: string[]): Promise<void> {
    await this.warmingEngine.warmPatterns(patterns);
  }

  async scheduleWarming(jobs: Array<{
    pattern: string;
    schedule: string;
    query: () => Promise<any>;
  }>): Promise<void> {
    await this.warmingEngine.scheduleJobs(jobs);
  }

  // Analytics and monitoring
  async getMetrics(): Promise<CacheMetrics> {
    return this.analytics.getMetrics();
  }

  async getHealthCheck(): Promise<CacheHealthCheck[]> {
    const checks: CacheHealthCheck[] = [];

    // Redis health check
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      const info = await this.redis.info('memory');
      const memoryUsage = this.parseMemoryUsage(info);

      checks.push({
        level: 'redis',
        healthy: latency < 100,
        latency,
        errorRate: this.calculateErrorRate('redis'),
        memoryUsage,
        lastCheck: new Date(),
        issues: latency > 100 ? ['High latency'] : []
      });
    } catch (error) {
      checks.push({
        level: 'redis',
        healthy: false,
        latency: -1,
        errorRate: 100,
        memoryUsage: 0,
        lastCheck: new Date(),
        issues: ['Connection failed']
      });
    }

    // Application cache health check
    const appHealth = await this.appCacheManager.getHealthCheck();
    checks.push(appHealth);

    // CDN health check
    const cdnHealth = await this.cdnManager.getHealthCheck();
    checks.push(cdnHealth);

    return checks;
  }

  // Utility methods
  private async populateHigherCaches<T>(
    key: string, 
    value: T, 
    levels: CacheLevel[], 
    currentLevel: CacheLevel
  ): Promise<void> {
    const higherPriorityLevels = levels.filter(l => 
      l.priority < currentLevel.priority && l.enabled
    );

    for (const level of higherPriorityLevels) {
      try {
        switch (level.name) {
          case 'application':
            await this.appCacheManager.set(key, value, { ttl: level.ttl });
            break;
          case 'redis':
            const serialized = this.serialize(value);
            await this.redis.setex(key, level.ttl, serialized);
            break;
        }
      } catch (error) {
        console.error(`Failed to populate ${level.name} cache:`, error);
      }
    }
  }

  private serialize<T>(value: T, compress = false): string {
    let serialized = JSON.stringify(value);
    
    if (compress && serialized.length > 1024) {
      // Implement compression logic here
      // For now, just return the serialized value
    }
    
    return serialized;
  }

  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value);
    } catch (error) {
      console.error('Failed to deserialize cache value:', error);
      throw error;
    }
  }

  private recordOperation(operation: CacheOperation): void {
    this.operations.push(operation);
    
    // Keep only recent operations
    if (this.operations.length > 10000) {
      this.operations = this.operations.slice(-5000);
    }
  }

  private calculateErrorRate(level: string): number {
    const recentOps = this.operations.filter(op => 
      op.level === level && 
      op.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );
    
    if (recentOps.length === 0) return 0;
    
    const errors = recentOps.filter(op => !op.success).length;
    return (errors / recentOps.length) * 100;
  }

  private parseMemoryUsage(info: string): number {
    const match = info.match(/used_memory:(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // CDN access
  get cdn() {
    return this.cdnManager;
  }

  // Warming engine access
  get warming() {
    return this.warmingEngine;
  }

  // Analytics access
  get analytics() {
    return this.analytics;
  }

  // Cleanup
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
    await this.cdnManager.disconnect();
    await this.appCacheManager.disconnect();
    this.warmingEngine.stop();
    this.analytics.stop();
    console.log('✅ Advanced cache manager disconnected');
  }
}