import { PrismaClient } from '@prisma/client';
import { CacheManager } from './cache/cacheManager';
import { ConnectionPoolManager } from './pool/connectionPoolManager';
import { ReadReplicaManager } from './replicas/readReplicaManager';
import { PartitionManager } from './partitioning/partitionManager';
import { PerformanceMonitor } from './monitoring/performanceMonitor';
import { QueryOptimizer } from './optimization/queryOptimizer';
import { DatabaseConfig, PerformanceMetrics, SlowQuery, CacheStats, PoolStatus, DatabaseHealth } from './types';

export class OptimizedDatabaseClient {
  private primaryClient: PrismaClient;
  private cacheManager: CacheManager;
  private poolManager: ConnectionPoolManager;
  private replicaManager: ReadReplicaManager;
  private partitionManager: PartitionManager;
  private performanceMonitor: PerformanceMonitor;
  private queryOptimizer: QueryOptimizer;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    
    // Initialize primary database client with connection pooling
    this.primaryClient = new PrismaClient({
      datasources: {
        db: {
          url: config.primaryUrl
        }
      }
    });

    // Initialize managers
    this.cacheManager = new CacheManager(config.cache);
    this.poolManager = new ConnectionPoolManager(config.pool);
    this.replicaManager = new ReadReplicaManager(config.readReplicaUrls || [], {
      urls: config.readReplicaUrls || [],
      loadBalancing: 'round-robin',
      healthCheckInterval: 30000,
      maxRetries: 3,
      retryDelay: 1000
    });
    this.partitionManager = new PartitionManager(config.partitioning);
    this.performanceMonitor = new PerformanceMonitor(config.monitoring);
    this.queryOptimizer = new QueryOptimizer();

    this.setupMiddleware();
    this.startBackgroundTasks();
  }

  private setupMiddleware() {
    // Performance monitoring middleware
    this.primaryClient.$use(async (params, next) => {
      const start = Date.now();
      
      try {
        const result = await next(params);
        const duration = Date.now() - start;
        
        // Record query performance
        await this.performanceMonitor.recordQuery({
          action: params.action,
          model: params.model,
          duration,
          success: true
        });

        // Check for slow queries
        if (duration > this.config.monitoring.slowQueryThreshold) {
          await this.performanceMonitor.recordSlowQuery({
            query: `${params.model}.${params.action}`,
            duration,
            timestamp: new Date(),
            parameters: params.args
          });
        }

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        
        // Record query error
        await this.performanceMonitor.recordQuery({
          action: params.action,
          model: params.model,
          duration,
          success: false,
          error: error.message
        });

        throw error;
      }
    });

    // Caching middleware
    this.primaryClient.$use(async (params, next) => {
      // Only cache read operations
      if (!['findMany', 'findUnique', 'findFirst', 'count', 'aggregate'].includes(params.action)) {
        return next(params);
      }

      const cacheKey = this.cacheManager.generateKey(params);
      
      // Try to get from cache first
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) {
        return cached;
      }

      // Execute query and cache result
      const result = await next(params);
      await this.cacheManager.set(cacheKey, result, {
        ttl: this.config.cache.ttl,
        tags: [params.model || 'unknown']
      });

      return result;
    });
  }

  private startBackgroundTasks() {
    // Start performance monitoring
    this.performanceMonitor.start();

    // Start partition maintenance
    this.partitionManager.startMaintenance();

    // Start cache warming
    if (this.config.cache.enableCacheWarming) {
      this.cacheManager.startCacheWarming();
    }

    // Start replica health checks
    this.replicaManager.startHealthChecks();
  }

  // Primary database access (for writes)
  get primary() {
    return this.primaryClient;
  }

  // Read replica access (for reads)
  get read() {
    return this.replicaManager.getClient();
  }

  // Cached query access
  get cached() {
    return new Proxy(this.primaryClient, {
      get: (target, prop) => {
        if (typeof target[prop] === 'object' && target[prop] !== null) {
          return new Proxy(target[prop], {
            get: (modelTarget, modelProp) => {
              if (typeof modelTarget[modelProp] === 'function') {
                return async (...args: any[]) => {
                  const cacheKey = this.cacheManager.generateKey({
                    model: prop as string,
                    action: modelProp as string,
                    args: args[0]
                  });

                  const cached = await this.cacheManager.get(cacheKey);
                  if (cached) {
                    return cached;
                  }

                  const result = await modelTarget[modelProp](...args);
                  await this.cacheManager.set(cacheKey, result, {
                    ttl: this.config.cache.ttl,
                    tags: [prop as string]
                  });

                  return result;
                };
              }
              return modelTarget[modelProp];
            }
          });
        }
        return target[prop];
      }
    });
  }

  // Performance monitoring methods
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    return this.performanceMonitor.getMetrics();
  }

  async getSlowQueries(limit = 10): Promise<SlowQuery[]> {
    return this.performanceMonitor.getSlowQueries(limit);
  }

  async getCacheStats(): Promise<CacheStats> {
    return this.cacheManager.getStats();
  }

  async getPoolStatus(): Promise<PoolStatus> {
    return this.poolManager.getStatus();
  }

  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const metrics = await this.getPerformanceMetrics();
    const poolStatus = await this.getPoolStatus();
    const cacheStats = await this.getCacheStats();

    const checks = {
      connectivity: await this.checkConnectivity(),
      replication: await this.checkReplication(),
      diskSpace: await this.checkDiskSpace(),
      performance: await this.checkPerformance()
    };

    const alerts: string[] = [];
    
    if (poolStatus.usage > this.config.monitoring.alertThresholds.connectionPoolUsage) {
      alerts.push(`High connection pool usage: ${poolStatus.usage}%`);
    }
    
    if (cacheStats.hitRate < this.config.monitoring.alertThresholds.cacheHitRate) {
      alerts.push(`Low cache hit rate: ${cacheStats.hitRate}%`);
    }
    
    if (metrics.queries.avgTime > this.config.monitoring.alertThresholds.queryTime) {
      alerts.push(`High average query time: ${metrics.queries.avgTime}ms`);
    }

    const status = alerts.length === 0 ? 'healthy' : 
                  alerts.length <= 2 ? 'degraded' : 'unhealthy';

    return {
      status,
      checks,
      metrics,
      alerts
    };
  }

  // Maintenance methods
  async runMaintenance(): Promise<void> {
    console.log('🔧 Starting database maintenance...');
    
    // Run VACUUM ANALYZE
    await this.primaryClient.$executeRaw`VACUUM ANALYZE;`;
    
    // Update table statistics
    await this.primaryClient.$executeRaw`ANALYZE;`;
    
    // Clean up old partitions
    await this.partitionManager.cleanupOldPartitions();
    
    // Clear expired cache entries
    await this.cacheManager.clearExpired();
    
    // Optimize slow queries
    await this.queryOptimizer.optimizeSlowQueries();
    
    console.log('✅ Database maintenance completed');
  }

  async warmCache(): Promise<void> {
    console.log('🔥 Starting cache warming...');
    await this.cacheManager.warmCache();
    console.log('✅ Cache warming completed');
  }

  async analyzePerformance(): Promise<void> {
    console.log('📊 Analyzing database performance...');
    
    const metrics = await this.getPerformanceMetrics();
    const slowQueries = await this.getSlowQueries(20);
    
    console.log('Performance Metrics:', {
      connectionPoolUsage: `${metrics.connections.poolUsage}%`,
      avgQueryTime: `${metrics.queries.avgTime}ms`,
      cacheHitRate: `${metrics.cache.hitRate}%`,
      slowQueries: slowQueries.length
    });
    
    if (slowQueries.length > 0) {
      console.log('Top Slow Queries:');
      slowQueries.slice(0, 5).forEach((query, index) => {
        console.log(`${index + 1}. ${query.query} (${query.duration}ms)`);
      });
    }
    
    console.log('✅ Performance analysis completed');
  }

  async cleanupPartitions(): Promise<void> {
    await this.partitionManager.cleanupOldPartitions();
  }

  // Cache management
  async invalidateCache(tags: string[]): Promise<void> {
    await this.cacheManager.invalidateByTags(tags);
  }

  async clearCache(): Promise<void> {
    await this.cacheManager.clear();
  }

  // Connection management
  async connect(): Promise<void> {
    await this.primaryClient.$connect();
    await this.replicaManager.connect();
    await this.cacheManager.connect();
    console.log('✅ Database connections established');
  }

  async disconnect(): Promise<void> {
    await this.primaryClient.$disconnect();
    await this.replicaManager.disconnect();
    await this.cacheManager.disconnect();
    this.performanceMonitor.stop();
    this.partitionManager.stopMaintenance();
    console.log('✅ Database connections closed');
  }

  // Health check methods
  private async checkConnectivity(): Promise<boolean> {
    try {
      await this.primaryClient.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkReplication(): Promise<boolean> {
    if (!this.config.readReplicaUrls?.length) {
      return true; // No replicas configured
    }
    
    return this.replicaManager.areReplicasHealthy();
  }

  private async checkDiskSpace(): Promise<boolean> {
    try {
      const result = await this.primaryClient.$queryRaw<Array<{ available_space: number }>>`
        SELECT 
          (SELECT setting::int FROM pg_settings WHERE name = 'shared_buffers') * 8192 as available_space
      `;
      
      return result[0]?.available_space > 1000000; // At least 1MB available
    } catch {
      return false;
    }
  }

  private async checkPerformance(): Promise<boolean> {
    const metrics = await this.getPerformanceMetrics();
    return metrics.queries.avgTime < this.config.monitoring.alertThresholds.queryTime;
  }
}