import { DeveloperAnalyticsConfig, APIUsageStats, DeveloperMetrics, ErrorAnalytics } from '../types';

export class DeveloperAnalytics {
  private usageData: Map<string, APIUsageStats[]> = new Map();
  private errorData: Map<string, ErrorAnalytics[]> = new Map();

  constructor(private config: DeveloperAnalyticsConfig) {}

  async trackAPIUsage(stats: APIUsageStats): Promise<void> {
    const key = `${stats.apiKeyId}_${stats.endpoint}`;
    const existing = this.usageData.get(key) || [];
    existing.push(stats);
    this.usageData.set(key, existing);
  }

  async trackError(error: ErrorAnalytics): Promise<void> {
    const key = error.apiKeyId;
    const existing = this.errorData.get(key) || [];
    existing.push(error);
    this.errorData.set(key, existing);
  }

  async getDeveloperMetrics(apiKeyId: string, timeRange: { start: Date; end: Date }): Promise<DeveloperMetrics> {
    const usageStats = this.getUsageInRange(apiKeyId, timeRange);
    const errorStats = this.getErrorsInRange(apiKeyId, timeRange);

    const totalRequests = usageStats.length;
    const successfulRequests = usageStats.filter(s => s.statusCode >= 200 && s.statusCode < 300).length;
    const errorRequests = errorStats.length;

    const responseTimeSum = usageStats.reduce((sum, s) => sum + s.responseTime, 0);
    const averageResponseTime = totalRequests > 0 ? responseTimeSum / totalRequests : 0;

    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    return {
      apiKeyId,
      timeRange,
      totalRequests,
      successfulRequests,
      errorRequests,
      successRate,
      averageResponseTime,
      topEndpoints: this.getTopEndpoints(usageStats),
      errorBreakdown: this.getErrorBreakdown(errorStats),
      requestsOverTime: this.getRequestsOverTime(usageStats, timeRange),
      responseTimeDistribution: this.getResponseTimeDistribution(usageStats),
    };
  }

  private getUsageInRange(apiKeyId: string, timeRange: { start: Date; end: Date }): APIUsageStats[] {
    const allUsage = Array.from(this.usageData.values()).flat();
    return allUsage.filter(usage => 
      usage.apiKeyId === apiKeyId &&
      usage.timestamp >= timeRange.start &&
      usage.timestamp <= timeRange.end
    );
  }

  private getErrorsInRange(apiKeyId: string, timeRange: { start: Date; end: Date }): ErrorAnalytics[] {
    const errors = this.errorData.get(apiKeyId) || [];
    return errors.filter(error =>
      error.timestamp >= timeRange.start &&
      error.timestamp <= timeRange.end
    );
  }

  private getTopEndpoints(usageStats: APIUsageStats[]): Array<{ endpoint: string; count: number; avgResponseTime: number }> {
    const endpointMap = new Map<string, { count: number; totalResponseTime: number }>();

    usageStats.forEach(stat => {
      const existing = endpointMap.get(stat.endpoint) || { count: 0, totalResponseTime: 0 };
      existing.count++;
      existing.totalResponseTime += stat.responseTime;
      endpointMap.set(stat.endpoint, existing);
    });

    return Array.from(endpointMap.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        count: data.count,
        avgResponseTime: data.totalResponseTime / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private getErrorBreakdown(errorStats: ErrorAnalytics[]): Array<{ statusCode: number; count: number; percentage: number }> {
    const statusMap = new Map<number, number>();
    
    errorStats.forEach(error => {
      statusMap.set(error.statusCode, (statusMap.get(error.statusCode) || 0) + 1);
    });

    const total = errorStats.length;
    return Array.from(statusMap.entries())
      .map(([statusCode, count]) => ({
        statusCode,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private getRequestsOverTime(usageStats: APIUsageStats[], timeRange: { start: Date; end: Date }): Array<{ timestamp: Date; count: number }> {
    const hourlyBuckets = new Map<string, number>();
    
    usageStats.forEach(stat => {
      const hour = new Date(stat.timestamp);
      hour.setMinutes(0, 0, 0);
      const key = hour.toISOString();
      hourlyBuckets.set(key, (hourlyBuckets.get(key) || 0) + 1);
    });

    return Array.from(hourlyBuckets.entries())
      .map(([timestamp, count]) => ({
        timestamp: new Date(timestamp),
        count,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private getResponseTimeDistribution(usageStats: APIUsageStats[]): Array<{ range: string; count: number }> {
    const buckets = [
      { range: '0-100ms', min: 0, max: 100 },
      { range: '100-500ms', min: 100, max: 500 },
      { range: '500ms-1s', min: 500, max: 1000 },
      { range: '1s-5s', min: 1000, max: 5000 },
      { range: '5s+', min: 5000, max: Infinity },
    ];

    return buckets.map(bucket => ({
      range: bucket.range,
      count: usageStats.filter(stat => 
        stat.responseTime >= bucket.min && stat.responseTime < bucket.max
      ).length,
    }));
  }

  async generateReport(apiKeyId: string, timeRange: { start: Date; end: Date }): Promise<string> {
    const metrics = await this.getDeveloperMetrics(apiKeyId, timeRange);
    
    let report = `Developer Analytics Report\n`;
    report += `==========================\n\n`;
    report += `API Key: ${apiKeyId}\n`;
    report += `Time Range: ${timeRange.start.toISOString()} - ${timeRange.end.toISOString()}\n\n`;
    
    report += `Summary:\n`;
    report += `--------\n`;
    report += `Total Requests: ${metrics.totalRequests}\n`;
    report += `Successful Requests: ${metrics.successfulRequests}\n`;
    report += `Error Requests: ${metrics.errorRequests}\n`;
    report += `Success Rate: ${metrics.successRate.toFixed(2)}%\n`;
    report += `Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms\n\n`;
    
    report += `Top Endpoints:\n`;
    report += `-------------\n`;
    metrics.topEndpoints.forEach(endpoint => {
      report += `${endpoint.endpoint}: ${endpoint.count} requests (${endpoint.avgResponseTime.toFixed(2)}ms avg)\n`;
    });
    
    if (metrics.errorBreakdown.length > 0) {
      report += `\nError Breakdown:\n`;
      report += `---------------\n`;
      metrics.errorBreakdown.forEach(error => {
        report += `HTTP ${error.statusCode}: ${error.count} errors (${error.percentage.toFixed(1)}%)\n`;
      });
    }

    return report;
  }
}