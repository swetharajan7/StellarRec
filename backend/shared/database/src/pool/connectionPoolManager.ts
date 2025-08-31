import { Pool, PoolClient, PoolConfig as PgPoolConfig } from 'pg';
import { PoolConfig, PoolStatus } from '../types';

export class ConnectionPoolManager {
  private pool: Pool;
  private config: PoolConfig;
  private stats: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingClients: number;
    totalQueries: number;
    errorCount: number;
  };

  constructor(config: PoolConfig) {
    this.config = config;
    
    const poolConfig: PgPoolConfig = {
      min: config.min,
      max: config.max,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      acquireTimeoutMillis: config.acquireTimeoutMillis,
      createTimeoutMillis: config.createTimeoutMillis,
      destroyTimeoutMillis: config.destroyTimeoutMillis,
      reapIntervalMillis: config.reapIntervalMillis,
      createRetryIntervalMillis: config.createRetryIntervalMillis
    };

    this.pool = new Pool(poolConfig);
    
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      totalQueries: 0,
      errorCount: 0
    };

    this.setupEventHandlers();
    this.startMonitoring();
  }

  private setupEventHandlers() {
    this.pool.on('connect', (client: PoolClient) => {
      this.stats.totalConnections++;
      console.log(`📊 New database connection established. Total: ${this.stats.totalConnections}`);
      
      // Set up client-level event handlers
      client.on('error', (error) => {
        this.stats.errorCount++;
        console.error('Database client error:', error);
      });
    });

    this.pool.on('acquire', (client: PoolClient) => {
      this.stats.activeConnections++;
      this.stats.idleConnections = Math.max(0, this.stats.idleConnections - 1);
    });

    this.pool.on('release', (client: PoolClient) => {
      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1);
      this.stats.idleConnections++;
    });

    this.pool.on('remove', (client: PoolClient) => {
      this.stats.totalConnections = Math.max(0, this.stats.totalConnections - 1);
      console.log(`📊 Database connection removed. Total: ${this.stats.totalConnections}`);
    });

    this.pool.on('error', (error: Error) => {
      this.stats.errorCount++;
      console.error('Connection pool error:', error);
    });
  }

  private startMonitoring() {
    // Monitor pool status every 30 seconds
    setInterval(() => {
      this.logPoolStatus();
    }, 30000);
  }

  private logPoolStatus() {
    const status = this.getStatusSync();
    
    if (status.usage > 80) {
      console.warn(`⚠️  High connection pool usage: ${status.usage}%`);
    }
    
    if (status.waiting > 5) {
      console.warn(`⚠️  High number of waiting clients: ${status.waiting}`);
    }
  }

  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      this.stats.totalQueries++;
      return client;
    } catch (error) {
      this.stats.errorCount++;
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    
    try {
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        console.warn(`🐌 Slow query detected: ${duration}ms - ${text.substring(0, 100)}...`);
      }
      
      return result;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  getStatus(): Promise<PoolStatus> {
    return Promise.resolve(this.getStatusSync());
  }

  private getStatusSync(): PoolStatus {
    const total = this.pool.totalCount;
    const idle = this.pool.idleCount;
    const waiting = this.pool.waitingCount;
    const active = total - idle;
    
    const usage = total > 0 ? Math.round((active / this.config.max) * 100) : 0;
    
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    if (usage > 90 || waiting > 10) {
      health = 'critical';
    } else if (usage > 70 || waiting > 5) {
      health = 'warning';
    }

    return {
      active,
      idle,
      waiting,
      total,
      usage,
      health
    };
  }

  async getDetailedStats() {
    const status = await this.getStatus();
    
    return {
      ...status,
      config: this.config,
      stats: this.stats,
      performance: {
        queriesPerSecond: this.calculateQPS(),
        errorRate: this.calculateErrorRate(),
        avgConnectionTime: this.calculateAvgConnectionTime()
      }
    };
  }

  private calculateQPS(): number {
    // This is a simplified calculation
    // In a real implementation, you'd track queries over time windows
    return this.stats.totalQueries / (Date.now() / 1000);
  }

  private calculateErrorRate(): number {
    const total = this.stats.totalQueries + this.stats.errorCount;
    return total > 0 ? (this.stats.errorCount / total) * 100 : 0;
  }

  private calculateAvgConnectionTime(): number {
    // This would require tracking connection establishment times
    // For now, return a placeholder
    return 50; // milliseconds
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Pool health check failed:', error);
      return false;
    }
  }

  async drain(): Promise<void> {
    console.log('🔄 Draining connection pool...');
    
    return new Promise((resolve, reject) => {
      this.pool.end((error) => {
        if (error) {
          console.error('Error draining pool:', error);
          reject(error);
        } else {
          console.log('✅ Connection pool drained successfully');
          resolve();
        }
      });
    });
  }

  // Advanced pool management methods
  async scaleUp(additionalConnections: number): Promise<void> {
    // This would require dynamic pool reconfiguration
    // For now, log the intent
    console.log(`📈 Scaling up pool by ${additionalConnections} connections`);
    
    // In a real implementation, you might:
    // 1. Create a new pool with higher max connections
    // 2. Gradually migrate connections
    // 3. Update the current pool configuration
  }

  async scaleDown(connectionsToRemove: number): Promise<void> {
    console.log(`📉 Scaling down pool by ${connectionsToRemove} connections`);
    
    // In a real implementation, you might:
    // 1. Wait for idle connections to be released
    // 2. Reduce the max pool size
    // 3. Close excess connections gracefully
  }

  async optimizePool(): Promise<void> {
    const status = await this.getStatus();
    const stats = await this.getDetailedStats();
    
    console.log('🔧 Analyzing pool performance...');
    
    // Suggest optimizations based on current metrics
    if (status.usage > 90) {
      console.log('💡 Suggestion: Increase max pool size');
    }
    
    if (status.waiting > 5) {
      console.log('💡 Suggestion: Increase connection timeout or pool size');
    }
    
    if (stats.performance.errorRate > 5) {
      console.log('💡 Suggestion: Check database connectivity and query performance');
    }
    
    if (stats.performance.avgConnectionTime > 100) {
      console.log('💡 Suggestion: Check network latency to database');
    }
  }

  // Monitoring and alerting
  async checkThresholds(): Promise<string[]> {
    const status = await this.getStatus();
    const alerts: string[] = [];
    
    if (status.usage > 90) {
      alerts.push(`Critical: Connection pool usage at ${status.usage}%`);
    } else if (status.usage > 70) {
      alerts.push(`Warning: Connection pool usage at ${status.usage}%`);
    }
    
    if (status.waiting > 10) {
      alerts.push(`Critical: ${status.waiting} clients waiting for connections`);
    } else if (status.waiting > 5) {
      alerts.push(`Warning: ${status.waiting} clients waiting for connections`);
    }
    
    const errorRate = this.calculateErrorRate();
    if (errorRate > 10) {
      alerts.push(`Critical: High error rate at ${errorRate.toFixed(2)}%`);
    } else if (errorRate > 5) {
      alerts.push(`Warning: Elevated error rate at ${errorRate.toFixed(2)}%`);
    }
    
    return alerts;
  }

  // Graceful shutdown
  async gracefulShutdown(timeoutMs: number = 30000): Promise<void> {
    console.log('🛑 Starting graceful pool shutdown...');
    
    const shutdownPromise = this.drain();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs);
    });
    
    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
    } catch (error) {
      console.error('Graceful shutdown failed, forcing closure:', error);
      // Force close if graceful shutdown fails
      this.pool.end();
    }
  }
}