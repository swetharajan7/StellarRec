import { MonitoringConfig, PerformanceMetrics, SlowQuery } from '../types';
import { PrismaClient } from '@prisma/client';

interface QueryRecord {
  action: string;
  model?: string;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export class PerformanceMonitor {
  private client: PrismaClient;
  private config: MonitoringConfig;
  private queryRecords: QueryRecord[] = [];
  private slowQueries: SlowQuery[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private metricsHistory: PerformanceMetrics[] = [];

  constructor(config: MonitoringConfig) {
    this.config = config;
    this.client = new PrismaClient();
  }

  start(): void {
    if (!this.config.enabled) {
      console.log('📊 Performance monitoring is disabled');
      return;
    }

    console.log('📊 Starting performance monitoring...');

    // Collect metrics every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
    }, 30000);

    // Clean up old records every hour
    setInterval(() => {
      this.cleanupOldRecords();
    }, 60 * 60 * 1000);

    console.log('✅ Performance monitoring started');
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      console.log('⏹️  Performance monitoring stopped');
    }
  }

  async recordQuery(record: Omit<QueryRecord, 'timestamp'>): Promise<void> {
    const queryRecord: QueryRecord = {
      ...record,
      timestamp: new Date()
    };

    this.queryRecords.push(queryRecord);

    // Keep only recent records in memory
    if (this.queryRecords.length > 10000) {
      this.queryRecords = this.queryRecords.slice(-5000);
    }
  }

  async recordSlowQuery(slowQuery: Omit<SlowQuery, 'frequency'>): Promise<void> {
    // Check if this query pattern already exists
    const existingQuery = this.slowQueries.find(q => 
      q.query === slowQuery.query
    );

    if (existingQuery) {
      existingQuery.frequency++;
      existingQuery.timestamp = slowQuery.timestamp;
      if (slowQuery.duration > existingQuery.duration) {
        existingQuery.duration = slowQuery.duration;
      }
    } else {
      this.slowQueries.push({
        ...slowQuery,
        frequency: 1
      });
    }

    // Keep only the most recent slow queries
    if (this.slowQueries.length > 1000) {
      this.slowQueries.sort((a, b) => b.frequency - a.frequency);
      this.slowQueries = this.slowQueries.slice(0, 500);
    }

    // Log critical slow queries
    if (slowQuery.duration > this.config.slowQueryThreshold * 5) {
      console.warn(`🐌 Critical slow query detected: ${slowQuery.duration}ms - ${slowQuery.query}`);
    }
  }

  async getMetrics(): Promise<PerformanceMetrics> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    // Filter recent queries
    const recentQueries = this.queryRecords.filter(q => q.timestamp >= oneMinuteAgo);
    
    // Calculate query metrics
    const totalQueries = recentQueries.length;
    const slowQueries = recentQueries.filter(q => q.duration > this.config.slowQueryThreshold).length;
    const failedQueries = recentQueries.filter(q => !q.success).length;
    const avgTime = totalQueries > 0 
      ? recentQueries.reduce((sum, q) => sum + q.duration, 0) / totalQueries 
      : 0;
    const errorRate = totalQueries > 0 ? (failedQueries / totalQueries) * 100 : 0;

    // Get database metrics
    const dbStats = await this.getDatabaseStats();
    const connectionStats = await this.getConnectionStats();

    const metrics: PerformanceMetrics = {
      timestamp: now,
      connections: connectionStats,
      queries: {
        total: totalQueries,
        slow: slowQueries,
        avgTime: Math.round(avgTime * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100
      },
      cache: {
        hitRate: 0, // This would be provided by CacheManager
        missRate: 0,
        evictions: 0,
        memoryUsage: 0
      },
      database: dbStats
    };

    // Store metrics history
    this.metricsHistory.push(metrics);
    
    // Keep only recent history
    const retentionTime = this.config.metricsRetention * 24 * 60 * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - retentionTime);
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);

    return metrics;
  }

  async getSlowQueries(limit: number = 10): Promise<SlowQuery[]> {
    return this.slowQueries
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }

  private async getDatabaseStats() {
    try {
      const tableStats = await this.client.$queryRaw<Array<{
        table_name: string;
        row_count: number;
        size_bytes: number;
      }>>(`
        SELECT 
          schemaname || '.' || tablename as table_name,
          n_live_tup as row_count,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 20;
      `);

      const totalSize = await this.client.$queryRaw<Array<{ size: number }>>(`
        SELECT pg_database_size(current_database()) as size;
      `);

      return {
        size: totalSize[0]?.size || 0,
        tableStats: tableStats.map(stat => ({
          name: stat.table_name,
          rows: stat.row_count,
          size: stat.size_bytes
        }))
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return {
        size: 0,
        tableStats: []
      };
    }
  }

  private async getConnectionStats() {
    try {
      const connectionInfo = await this.client.$queryRaw<Array<{
        total_connections: number;
        active_connections: number;
        idle_connections: number;
        max_connections: number;
      }>>(`
        SELECT 
          (SELECT count(*) FROM pg_stat_activity) as total_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections;
      `);

      const info = connectionInfo[0];
      const poolUsage = info ? (info.total_connections / info.max_connections) * 100 : 0;

      return {
        active: info?.active_connections || 0,
        idle: info?.idle_connections || 0,
        total: info?.total_connections || 0,
        poolUsage: Math.round(poolUsage * 100) / 100
      };
    } catch (error) {
      console.error('Error getting connection stats:', error);
      return {
        active: 0,
        idle: 0,
        total: 0,
        poolUsage: 0
      };
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      
      // Check alert thresholds
      await this.checkAlertThresholds(metrics);
      
      // Log performance summary
      this.logPerformanceSummary(metrics);
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private async checkAlertThresholds(metrics: PerformanceMetrics): Promise<void> {
    const alerts: string[] = [];

    if (metrics.connections.poolUsage > this.config.alertThresholds.connectionPoolUsage) {
      alerts.push(`High connection pool usage: ${metrics.connections.poolUsage}%`);
    }

    if (metrics.queries.avgTime > this.config.alertThresholds.queryTime) {
      alerts.push(`High average query time: ${metrics.queries.avgTime}ms`);
    }

    if (metrics.queries.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push(`High query error rate: ${metrics.queries.errorRate}%`);
    }

    if (alerts.length > 0) {
      console.warn('🚨 Performance alerts:', alerts);
      
      // In a real implementation, you might send these alerts to:
      // - Slack/Discord webhooks
      // - Email notifications
      // - PagerDuty/OpsGenie
      // - Monitoring systems like DataDog/New Relic
    }
  }

  private logPerformanceSummary(metrics: PerformanceMetrics): void {
    const summary = {
      timestamp: metrics.timestamp.toISOString(),
      connections: `${metrics.connections.active}/${metrics.connections.total} (${metrics.connections.poolUsage}%)`,
      queries: `${metrics.queries.total} total, ${metrics.queries.slow} slow, ${metrics.queries.avgTime}ms avg`,
      errors: `${metrics.queries.errorRate}%`,
      dbSize: this.formatBytes(metrics.database.size)
    };

    console.log('📊 Performance Summary:', summary);
  }

  private cleanupOldRecords(): void {
    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    
    const initialQueryCount = this.queryRecords.length;
    const initialSlowQueryCount = this.slowQueries.length;
    
    this.queryRecords = this.queryRecords.filter(q => q.timestamp >= cutoffTime);
    
    // Clean up slow queries that haven't been seen recently
    const recentCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    this.slowQueries = this.slowQueries.filter(q => q.timestamp >= recentCutoff);

    const cleanedQueries = initialQueryCount - this.queryRecords.length;
    const cleanedSlowQueries = initialSlowQueryCount - this.slowQueries.length;

    if (cleanedQueries > 0 || cleanedSlowQueries > 0) {
      console.log(`🧹 Cleaned up ${cleanedQueries} query records and ${cleanedSlowQueries} slow query records`);
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Advanced monitoring features
  async getQueryPatterns(): Promise<Array<{ pattern: string; count: number; avgDuration: number }>> {
    const patterns = new Map<string, { count: number; totalDuration: number }>();

    for (const query of this.queryRecords) {
      const pattern = `${query.model || 'unknown'}.${query.action}`;
      const existing = patterns.get(pattern) || { count: 0, totalDuration: 0 };
      
      patterns.set(pattern, {
        count: existing.count + 1,
        totalDuration: existing.totalDuration + query.duration
      });
    }

    return Array.from(patterns.entries()).map(([pattern, stats]) => ({
      pattern,
      count: stats.count,
      avgDuration: Math.round((stats.totalDuration / stats.count) * 100) / 100
    })).sort((a, b) => b.count - a.count);
  }

  async getPerformanceTrends(hours: number = 24): Promise<PerformanceMetrics[]> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
  }

  async generatePerformanceReport(): Promise<string> {
    const metrics = await this.getMetrics();
    const slowQueries = await this.getSlowQueries(10);
    const queryPatterns = await this.getQueryPatterns();
    const trends = await this.getPerformanceTrends(24);

    let report = '# Database Performance Report\n\n';
    
    report += `## Current Metrics (${metrics.timestamp.toISOString()})\n`;
    report += `- **Connections**: ${metrics.connections.active}/${metrics.connections.total} (${metrics.connections.poolUsage}% usage)\n`;
    report += `- **Queries**: ${metrics.queries.total} total, ${metrics.queries.avgTime}ms average\n`;
    report += `- **Slow Queries**: ${metrics.queries.slow} (>${this.config.slowQueryThreshold}ms)\n`;
    report += `- **Error Rate**: ${metrics.queries.errorRate}%\n`;
    report += `- **Database Size**: ${this.formatBytes(metrics.database.size)}\n\n`;

    if (slowQueries.length > 0) {
      report += '## Top Slow Queries\n';
      slowQueries.forEach((query, index) => {
        report += `${index + 1}. **${query.query}** (${query.duration}ms, ${query.frequency}x)\n`;
      });
      report += '\n';
    }

    if (queryPatterns.length > 0) {
      report += '## Query Patterns\n';
      queryPatterns.slice(0, 10).forEach((pattern, index) => {
        report += `${index + 1}. **${pattern.pattern}**: ${pattern.count} queries, ${pattern.avgDuration}ms avg\n`;
      });
      report += '\n';
    }

    if (trends.length > 1) {
      const firstMetric = trends[0];
      const lastMetric = trends[trends.length - 1];
      
      report += '## 24-Hour Trends\n';
      report += `- **Query Volume**: ${firstMetric.queries.total} → ${lastMetric.queries.total}\n`;
      report += `- **Average Response Time**: ${firstMetric.queries.avgTime}ms → ${lastMetric.queries.avgTime}ms\n`;
      report += `- **Connection Usage**: ${firstMetric.connections.poolUsage}% → ${lastMetric.connections.poolUsage}%\n`;
    }

    return report;
  }

  async exportMetrics(format: 'json' | 'csv' = 'json'): Promise<string> {
    const metrics = await this.getPerformanceTrends(24);
    
    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    } else {
      // CSV format
      const headers = 'timestamp,active_connections,total_connections,pool_usage,total_queries,slow_queries,avg_time,error_rate,db_size';
      const rows = metrics.map(m => 
        `${m.timestamp.toISOString()},${m.connections.active},${m.connections.total},${m.connections.poolUsage},${m.queries.total},${m.queries.slow},${m.queries.avgTime},${m.queries.errorRate},${m.database.size}`
      );
      
      return [headers, ...rows].join('\n');
    }
  }
}