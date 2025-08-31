import { AnalyticsConfig, CacheMetrics, CacheAlert, LevelMetrics } from '../types';

interface AdvancedCacheManager {
  redis: any;
  appCacheManager: any;
  cdnManager: any;
  operations: any[];
}

export class CacheAnalytics {
  private config: AnalyticsConfig;
  private cacheManager: AdvancedCacheManager;
  private metricsHistory: CacheMetrics[] = [];
  private alerts: CacheAlert[] = [];
  private isRunning = false;
  private metricsInterval?: NodeJS.Timeout;

  constructor(config: AnalyticsConfig, cacheManager: AdvancedCacheManager) {
    this.config = config;
    this.cacheManager = cacheManager;
  }

  start(): void {
    if (!this.config.enabled || this.isRunning) {
      return;
    }

    console.log('📊 Starting cache analytics...');
    this.isRunning = true;

    // Collect metrics at configured interval
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Metrics collection failed:', error);
      }
    }, this.config.metricsInterval);

    // Clean up old data every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);

    console.log('✅ Cache analytics started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('⏹️  Stopping cache analytics...');
    this.isRunning = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    console.log('✅ Cache analytics stopped');
  }

  async collectMetrics(): Promise<void> {
    try {
      const timestamp = new Date();
      
      // Collect metrics from all cache levels
      const [cdnMetrics, redisMetrics, appMetrics] = await Promise.all([
        this.collectCdnMetrics(),
        this.collectRedisMetrics(),
        this.collectApplicationMetrics()
      ]);

      // Calculate overall metrics
      const overallMetrics = this.calculateOverallMetrics(cdnMetrics, redisMetrics, appMetrics);

      // Collect performance data
      const performanceMetrics = this.collectPerformanceMetrics();

      // Collect memory usage
      const memoryMetrics = await this.collectMemoryMetrics();

      const metrics: CacheMetrics = {
        timestamp,
        levels: {
          cdn: cdnMetrics,
          redis: redisMetrics,
          application: appMetrics
        },
        overall: overallMetrics,
        memory: memoryMetrics,
        performance: performanceMetrics
      };

      // Store metrics
      this.metricsHistory.push(metrics);

      // Check for alerts
      await this.checkAlerts(metrics);

      // Log summary
      this.logMetricsSummary(metrics);

    } catch (error) {
      console.error('Failed to collect cache metrics:', error);
    }
  }

  private async collectCdnMetrics(): Promise<LevelMetrics> {
    try {
      const stats = await this.cacheManager.cdnManager.getStats();
      
      return {
        hitRate: stats.requests?.hitRate || 0,
        missRate: 100 - (stats.requests?.hitRate || 0),
        requests: stats.requests?.total || 0,
        avgResponseTime: stats.performance?.avgResponseTime || 0,
        memoryUsage: 0, // CDN doesn't have traditional memory usage
        evictions: 0
      };
    } catch (error) {
      console.error('Failed to collect CDN metrics:', error);
      return this.getEmptyLevelMetrics();
    }
  }

  private async collectRedisMetrics(): Promise<LevelMetrics> {
    try {
      const info = await this.cacheManager.redis.info();
      const stats = this.parseRedisInfo(info);
      
      // Calculate hit/miss rates from operations
      const recentOps = this.getRecentOperations('redis', 5 * 60 * 1000); // Last 5 minutes
      const hits = recentOps.filter(op => op.operation === 'get' && op.success).length;
      const misses = recentOps.filter(op => op.operation === 'get' && !op.success).length;
      const total = hits + misses;
      
      const hitRate = total > 0 ? (hits / total) * 100 : 0;
      const avgResponseTime = recentOps.length > 0 
        ? recentOps.reduce((sum, op) => sum + op.duration, 0) / recentOps.length 
        : 0;

      return {
        hitRate: Math.round(hitRate * 100) / 100,
        missRate: Math.round((100 - hitRate) * 100) / 100,
        requests: total,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100,
        memoryUsage: stats.usedMemory || 0,
        evictions: stats.evictedKeys || 0
      };
    } catch (error) {
      console.error('Failed to collect Redis metrics:', error);
      return this.getEmptyLevelMetrics();
    }
  }

  private async collectApplicationMetrics(): Promise<LevelMetrics> {
    try {
      const stats = await this.cacheManager.appCacheManager.getStats();
      
      return {
        hitRate: stats.hitRate,
        missRate: stats.missRate,
        requests: stats.totalKeys, // Approximate
        avgResponseTime: 1, // Application cache is very fast
        memoryUsage: stats.memoryUsage,
        evictions: stats.evictionRate
      };
    } catch (error) {
      console.error('Failed to collect application cache metrics:', error);
      return this.getEmptyLevelMetrics();
    }
  }

  private calculateOverallMetrics(cdn: LevelMetrics, redis: LevelMetrics, app: LevelMetrics) {
    const totalRequests = cdn.requests + redis.requests + app.requests;
    const totalHits = (cdn.hitRate * cdn.requests + redis.hitRate * redis.requests + app.hitRate * app.requests) / 100;
    
    const overallHitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
    const overallMissRate = 100 - overallHitRate;
    
    const avgResponseTime = totalRequests > 0 
      ? (cdn.avgResponseTime * cdn.requests + redis.avgResponseTime * redis.requests + app.avgResponseTime * app.requests) / totalRequests
      : 0;

    // Calculate error rate from recent operations
    const recentOps = this.getRecentOperations('all', 5 * 60 * 1000);
    const errors = recentOps.filter(op => !op.success).length;
    const errorRate = recentOps.length > 0 ? (errors / recentOps.length) * 100 : 0;

    return {
      hitRate: Math.round(overallHitRate * 100) / 100,
      missRate: Math.round(overallMissRate * 100) / 100,
      totalRequests,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100
    };
  }

  private collectPerformanceMetrics() {
    const recentOps = this.getRecentOperations('all', 10 * 60 * 1000); // Last 10 minutes
    
    // Top keys by access frequency
    const keyStats = new Map<string, { hits: number; misses: number }>();
    
    for (const op of recentOps) {
      if (op.operation === 'get') {
        const stats = keyStats.get(op.key) || { hits: 0, misses: 0 };
        if (op.success) {
          stats.hits++;
        } else {
          stats.misses++;
        }
        keyStats.set(op.key, stats);
      }
    }

    const topKeys = Array.from(keyStats.entries())
      .map(([key, stats]) => ({ key, hits: stats.hits, misses: stats.misses }))
      .sort((a, b) => (b.hits + b.misses) - (a.hits + a.misses))
      .slice(0, 10);

    // Slow queries
    const slowQueries = recentOps
      .filter(op => op.duration > 100) // Slower than 100ms
      .map(op => ({ key: op.key, avgTime: op.duration }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 10);

    // Hotspots (frequently accessed patterns)
    const patternStats = new Map<string, number>();
    
    for (const op of recentOps) {
      const pattern = this.extractPattern(op.key);
      patternStats.set(pattern, (patternStats.get(pattern) || 0) + 1);
    }

    const hotspots = Array.from(patternStats.entries())
      .map(([pattern, frequency]) => ({ pattern, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);

    return {
      topKeys,
      slowQueries,
      hotspots
    };
  }

  private async collectMemoryMetrics() {
    try {
      const redisMemory = await this.getRedisMemoryUsage();
      const appMemory = (await this.cacheManager.appCacheManager.getStats()).memoryUsage;
      
      const used = redisMemory + appMemory;
      const available = this.estimateAvailableMemory();
      const usage = available > 0 ? (used / available) * 100 : 0;

      return {
        used,
        available,
        usage: Math.round(usage * 100) / 100
      };
    } catch (error) {
      console.error('Failed to collect memory metrics:', error);
      return { used: 0, available: 0, usage: 0 };
    }
  }

  private async checkAlerts(metrics: CacheMetrics): Promise<void> {
    const alerts: CacheAlert[] = [];

    // Check hit rate
    if (metrics.overall.hitRate < this.config.alertThresholds.hitRate) {
      alerts.push({
        id: `hit-rate-${Date.now()}`,
        type: 'hit-rate',
        severity: metrics.overall.hitRate < 50 ? 'critical' : 'medium',
        message: `Cache hit rate is ${metrics.overall.hitRate}% (threshold: ${this.config.alertThresholds.hitRate}%)`,
        timestamp: new Date(),
        resolved: false,
        metadata: { hitRate: metrics.overall.hitRate, threshold: this.config.alertThresholds.hitRate }
      });
    }

    // Check memory usage
    if (metrics.memory.usage > this.config.alertThresholds.memoryUsage) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'memory',
        severity: metrics.memory.usage > 95 ? 'critical' : 'high',
        message: `Cache memory usage is ${metrics.memory.usage}% (threshold: ${this.config.alertThresholds.memoryUsage}%)`,
        timestamp: new Date(),
        resolved: false,
        metadata: { memoryUsage: metrics.memory.usage, threshold: this.config.alertThresholds.memoryUsage }
      });
    }

    // Check error rate
    if (metrics.overall.errorRate > this.config.alertThresholds.errorRate) {
      alerts.push({
        id: `error-rate-${Date.now()}`,
        type: 'error-rate',
        severity: metrics.overall.errorRate > 10 ? 'critical' : 'medium',
        message: `Cache error rate is ${metrics.overall.errorRate}% (threshold: ${this.config.alertThresholds.errorRate}%)`,
        timestamp: new Date(),
        resolved: false,
        metadata: { errorRate: metrics.overall.errorRate, threshold: this.config.alertThresholds.errorRate }
      });
    }

    // Add new alerts
    this.alerts.push(...alerts);

    // Log alerts
    for (const alert of alerts) {
      console.warn(`🚨 Cache Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
    }
  }

  async getMetrics(): Promise<CacheMetrics> {
    if (this.metricsHistory.length === 0) {
      await this.collectMetrics();
    }
    
    return this.metricsHistory[this.metricsHistory.length - 1] || this.getEmptyMetrics();
  }

  getMetricsHistory(hours: number = 24): CacheMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoff);
  }

  getAlerts(resolved: boolean = false): CacheAlert[] {
    return this.alerts.filter(alert => alert.resolved === resolved);
  }

  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      console.log(`✅ Resolved cache alert: ${alertId}`);
    }
  }

  // Analysis methods
  async analyzeTrends(hours: number = 24): Promise<{
    hitRateTrend: 'improving' | 'declining' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    performanceTrend: 'improving' | 'declining' | 'stable';
    recommendations: string[];
  }> {
    const history = this.getMetricsHistory(hours);
    
    if (history.length < 2) {
      return {
        hitRateTrend: 'stable',
        memoryTrend: 'stable',
        performanceTrend: 'stable',
        recommendations: ['Insufficient data for trend analysis']
      };
    }

    const first = history[0];
    const last = history[history.length - 1];
    
    // Analyze trends
    const hitRateDiff = last.overall.hitRate - first.overall.hitRate;
    const memoryDiff = last.memory.usage - first.memory.usage;
    const responseDiff = last.overall.avgResponseTime - first.overall.avgResponseTime;

    const hitRateTrend = hitRateDiff > 5 ? 'improving' : hitRateDiff < -5 ? 'declining' : 'stable';
    const memoryTrend = memoryDiff > 10 ? 'increasing' : memoryDiff < -10 ? 'decreasing' : 'stable';
    const performanceTrend = responseDiff < -10 ? 'improving' : responseDiff > 10 ? 'declining' : 'stable';

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (hitRateTrend === 'declining') {
      recommendations.push('Consider increasing cache TTL or implementing cache warming');
    }
    
    if (memoryTrend === 'increasing') {
      recommendations.push('Monitor memory usage and consider implementing LRU eviction');
    }
    
    if (performanceTrend === 'declining') {
      recommendations.push('Investigate slow queries and optimize cache access patterns');
    }
    
    if (last.overall.hitRate < 70) {
      recommendations.push('Hit rate is below optimal threshold - review caching strategy');
    }

    return {
      hitRateTrend,
      memoryTrend,
      performanceTrend,
      recommendations
    };
  }

  async generateReport(): Promise<string> {
    const metrics = await this.getMetrics();
    const trends = await this.analyzeTrends(24);
    const alerts = this.getAlerts(false);

    let report = '# Cache Analytics Report\n\n';
    
    report += `**Generated:** ${new Date().toISOString()}\n\n`;

    // Current metrics
    report += '## Current Performance\n\n';
    report += `- **Overall Hit Rate:** ${metrics.overall.hitRate}%\n`;
    report += `- **Average Response Time:** ${metrics.overall.avgResponseTime}ms\n`;
    report += `- **Error Rate:** ${metrics.overall.errorRate}%\n`;
    report += `- **Memory Usage:** ${metrics.memory.usage}%\n\n`;

    // Level breakdown
    report += '## Cache Level Performance\n\n';
    report += `- **CDN:** ${metrics.levels.cdn.hitRate}% hit rate, ${metrics.levels.cdn.avgResponseTime}ms avg response\n`;
    report += `- **Redis:** ${metrics.levels.redis.hitRate}% hit rate, ${metrics.levels.redis.avgResponseTime}ms avg response\n`;
    report += `- **Application:** ${metrics.levels.application.hitRate}% hit rate, ${metrics.levels.application.avgResponseTime}ms avg response\n\n`;

    // Trends
    report += '## 24-Hour Trends\n\n';
    report += `- **Hit Rate:** ${trends.hitRateTrend}\n`;
    report += `- **Memory Usage:** ${trends.memoryTrend}\n`;
    report += `- **Performance:** ${trends.performanceTrend}\n\n`;

    // Top performing keys
    if (metrics.performance.topKeys.length > 0) {
      report += '## Top Cache Keys\n\n';
      metrics.performance.topKeys.forEach((key, index) => {
        report += `${index + 1}. **${key.key}**: ${key.hits} hits, ${key.misses} misses\n`;
      });
      report += '\n';
    }

    // Active alerts
    if (alerts.length > 0) {
      report += '## Active Alerts\n\n';
      alerts.forEach(alert => {
        report += `- **${alert.severity.toUpperCase()}**: ${alert.message}\n`;
      });
      report += '\n';
    }

    // Recommendations
    if (trends.recommendations.length > 0) {
      report += '## Recommendations\n\n';
      trends.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
    }

    return report;
  }

  // Utility methods
  private getRecentOperations(level: string, timeWindow: number) {
    const cutoff = new Date(Date.now() - timeWindow);
    return this.cacheManager.operations.filter(op => 
      op.timestamp >= cutoff && (level === 'all' || op.level === level)
    );
  }

  private extractPattern(key: string): string {
    // Extract pattern from key (e.g., "user:123" -> "user:*")
    const parts = key.split(':');
    if (parts.length > 1) {
      return `${parts[0]}:*`;
    }
    return key;
  }

  private parseRedisInfo(info: string): any {
    const stats: any = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key === 'used_memory') {
          stats.usedMemory = parseInt(value, 10);
        } else if (key === 'evicted_keys') {
          stats.evictedKeys = parseInt(value, 10);
        }
      }
    }
    
    return stats;
  }

  private async getRedisMemoryUsage(): Promise<number> {
    try {
      const info = await this.cacheManager.redis.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  private estimateAvailableMemory(): number {
    // Estimate available memory (this would be more sophisticated in production)
    return 1024 * 1024 * 1024; // 1GB
  }

  private getEmptyLevelMetrics(): LevelMetrics {
    return {
      hitRate: 0,
      missRate: 0,
      requests: 0,
      avgResponseTime: 0,
      memoryUsage: 0,
      evictions: 0
    };
  }

  private getEmptyMetrics(): CacheMetrics {
    return {
      timestamp: new Date(),
      levels: {
        cdn: this.getEmptyLevelMetrics(),
        redis: this.getEmptyLevelMetrics(),
        application: this.getEmptyLevelMetrics()
      },
      overall: {
        hitRate: 0,
        missRate: 0,
        totalRequests: 0,
        avgResponseTime: 0,
        errorRate: 0
      },
      memory: {
        used: 0,
        available: 0,
        usage: 0
      },
      performance: {
        topKeys: [],
        slowQueries: [],
        hotspots: []
      }
    };
  }

  private logMetricsSummary(metrics: CacheMetrics): void {
    console.log(`📊 Cache Metrics: ${metrics.overall.hitRate}% hit rate, ${metrics.overall.avgResponseTime}ms avg response, ${metrics.memory.usage}% memory`);
  }

  private cleanupOldData(): void {
    const cutoff = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
    
    // Clean up metrics history
    const initialMetricsCount = this.metricsHistory.length;
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoff);
    
    // Clean up resolved alerts
    const initialAlertsCount = this.alerts.length;
    this.alerts = this.alerts.filter(a => 
      !a.resolved || (a.resolvedAt && a.resolvedAt >= cutoff)
    );

    const cleanedMetrics = initialMetricsCount - this.metricsHistory.length;
    const cleanedAlerts = initialAlertsCount - this.alerts.length;

    if (cleanedMetrics > 0 || cleanedAlerts > 0) {
      console.log(`🧹 Cleaned up ${cleanedMetrics} old metrics and ${cleanedAlerts} old alerts`);
    }
  }
}