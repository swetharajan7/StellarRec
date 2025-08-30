import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import axios from 'axios';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

const prisma = new PrismaClient();

export interface MetricData {
  id?: string;
  metricName: string;
  metricType: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  dimensions: Record<string, string>;
  timestamp: Date;
  source: string;
  userId?: string;
  sessionId?: string;
}

export interface AggregatedMetric {
  metricName: string;
  period: string;
  value: number;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
  dimensions: Record<string, string>;
  timestamp: Date;
}

export interface MetricQuery {
  metricNames?: string[];
  startTime?: Date;
  endTime?: Date;
  dimensions?: Record<string, string>;
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  groupBy?: string[];
  limit?: number;
}

export class MetricsCollectionService {
  private readonly USER_SERVICE_URL: string;
  private readonly APPLICATION_SERVICE_URL: string;
  private readonly SEARCH_SERVICE_URL: string;
  private readonly CONTENT_DISCOVERY_URL: string;
  private readonly batchQueue: MetricData[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds

  constructor() {
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.APPLICATION_SERVICE_URL = process.env.APPLICATION_SERVICE_URL || 'http://localhost:3007';
    this.SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'http://localhost:3003';
    this.CONTENT_DISCOVERY_URL = process.env.CONTENT_DISCOVERY_URL || 'http://localhost:3005';
    
    this.startBatchProcessor();
    this.startPeriodicCollection();
  }

  async collectMetric(metric: MetricData): Promise<void> {
    try {
      // Add to batch queue
      this.batchQueue.push({
        ...metric,
        timestamp: metric.timestamp || new Date()
      });

      // Process batch if it's full
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        await this.processBatch();
      }

      logger.debug('Metric collected', { 
        metricName: metric.metricName, 
        value: metric.value,
        source: metric.source 
      });

    } catch (error) {
      logger.error('Error collecting metric:', error);
    }
  }

  async collectMultipleMetrics(metrics: MetricData[]): Promise<void> {
    try {
      const timestampedMetrics = metrics.map(metric => ({
        ...metric,
        timestamp: metric.timestamp || new Date()
      }));

      this.batchQueue.push(...timestampedMetrics);

      // Process batch if it's full
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        await this.processBatch();
      }

    } catch (error) {
      logger.error('Error collecting multiple metrics:', error);
    }
  }

  async queryMetrics(query: MetricQuery): Promise<any[]> {
    try {
      const whereClause: any = {};

      if (query.metricNames && query.metricNames.length > 0) {
        whereClause.metricName = { in: query.metricNames };
      }

      if (query.startTime || query.endTime) {
        whereClause.timestamp = {};
        if (query.startTime) {
          whereClause.timestamp.gte = query.startTime;
        }
        if (query.endTime) {
          whereClause.timestamp.lte = query.endTime;
        }
      }

      if (query.dimensions) {
        Object.entries(query.dimensions).forEach(([key, value]) => {
          whereClause.dimensions = {
            ...whereClause.dimensions,
            path: [key],
            equals: value
          };
        });
      }

      const metrics = await prisma.metric.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: query.limit || 1000
      });

      return this.processQueryResults(metrics, query);

    } catch (error) {
      logger.error('Error querying metrics:', error);
      return [];
    }
  }

  async getAggregatedMetrics(
    metricName: string,
    period: 'hour' | 'day' | 'week' | 'month',
    startTime: Date,
    endTime: Date
  ): Promise<AggregatedMetric[]> {
    try {
      // Get aggregated data from database
      const aggregated = await prisma.aggregatedMetric.findMany({
        where: {
          metricName,
          period,
          timestamp: {
            gte: startTime,
            lte: endTime
          }
        },
        orderBy: { timestamp: 'asc' }
      });

      return aggregated.map(item => ({
        metricName: item.metricName,
        period: item.period,
        value: item.value,
        count: item.count,
        min: item.min,
        max: item.max,
        avg: item.avg,
        sum: item.sum,
        dimensions: item.dimensions as Record<string, string>,
        timestamp: item.timestamp
      }));

    } catch (error) {
      logger.error('Error getting aggregated metrics:', error);
      return [];
    }
  }

  async collectUserMetrics(): Promise<void> {
    try {
      logger.info('Collecting user metrics');

      // Get user statistics
      const userStats = await this.getUserStatistics();
      
      // Collect user metrics
      await this.collectMultipleMetrics([
        {
          metricName: 'users.total',
          metricType: 'gauge',
          value: userStats.totalUsers,
          dimensions: { type: 'all' },
          timestamp: new Date(),
          source: 'user-service'
        },
        {
          metricName: 'users.active',
          metricType: 'gauge',
          value: userStats.activeUsers,
          dimensions: { period: 'daily' },
          timestamp: new Date(),
          source: 'user-service'
        },
        {
          metricName: 'users.new',
          metricType: 'counter',
          value: userStats.newUsers,
          dimensions: { period: 'daily' },
          timestamp: new Date(),
          source: 'user-service'
        },
        {
          metricName: 'users.students',
          metricType: 'gauge',
          value: userStats.studentCount,
          dimensions: { type: 'student' },
          timestamp: new Date(),
          source: 'user-service'
        },
        {
          metricName: 'users.recommenders',
          metricType: 'gauge',
          value: userStats.recommenderCount,
          dimensions: { type: 'recommender' },
          timestamp: new Date(),
          source: 'user-service'
        }
      ]);

    } catch (error) {
      logger.error('Error collecting user metrics:', error);
    }
  }

  async collectApplicationMetrics(): Promise<void> {
    try {
      logger.info('Collecting application metrics');

      // Get application statistics
      const appStats = await this.getApplicationStatistics();
      
      // Collect application metrics
      await this.collectMultipleMetrics([
        {
          metricName: 'applications.total',
          metricType: 'gauge',
          value: appStats.totalApplications,
          dimensions: { status: 'all' },
          timestamp: new Date(),
          source: 'application-service'
        },
        {
          metricName: 'applications.submitted',
          metricType: 'counter',
          value: appStats.submittedToday,
          dimensions: { period: 'daily' },
          timestamp: new Date(),
          source: 'application-service'
        },
        {
          metricName: 'applications.in_progress',
          metricType: 'gauge',
          value: appStats.inProgress,
          dimensions: { status: 'in_progress' },
          timestamp: new Date(),
          source: 'application-service'
        },
        {
          metricName: 'applications.completed',
          metricType: 'gauge',
          value: appStats.completed,
          dimensions: { status: 'completed' },
          timestamp: new Date(),
          source: 'application-service'
        },
        {
          metricName: 'applications.success_rate',
          metricType: 'gauge',
          value: appStats.successRate,
          dimensions: { metric: 'success_rate' },
          timestamp: new Date(),
          source: 'application-service'
        }
      ]);

    } catch (error) {
      logger.error('Error collecting application metrics:', error);
    }
  }

  async collectSearchMetrics(): Promise<void> {
    try {
      logger.info('Collecting search metrics');

      // Get search statistics
      const searchStats = await this.getSearchStatistics();
      
      // Collect search metrics
      await this.collectMultipleMetrics([
        {
          metricName: 'search.queries',
          metricType: 'counter',
          value: searchStats.totalQueries,
          dimensions: { period: 'daily' },
          timestamp: new Date(),
          source: 'search-service'
        },
        {
          metricName: 'search.avg_response_time',
          metricType: 'gauge',
          value: searchStats.avgResponseTime,
          dimensions: { metric: 'response_time' },
          timestamp: new Date(),
          source: 'search-service'
        },
        {
          metricName: 'search.click_through_rate',
          metricType: 'gauge',
          value: searchStats.clickThroughRate,
          dimensions: { metric: 'ctr' },
          timestamp: new Date(),
          source: 'search-service'
        },
        {
          metricName: 'search.zero_results',
          metricType: 'counter',
          value: searchStats.zeroResults,
          dimensions: { type: 'zero_results' },
          timestamp: new Date(),
          source: 'search-service'
        }
      ]);

    } catch (error) {
      logger.error('Error collecting search metrics:', error);
    }
  }

  async collectEngagementMetrics(): Promise<void> {
    try {
      logger.info('Collecting engagement metrics');

      // Get engagement statistics
      const engagementStats = await this.getEngagementStatistics();
      
      // Collect engagement metrics
      await this.collectMultipleMetrics([
        {
          metricName: 'engagement.page_views',
          metricType: 'counter',
          value: engagementStats.pageViews,
          dimensions: { period: 'daily' },
          timestamp: new Date(),
          source: 'content-discovery'
        },
        {
          metricName: 'engagement.session_duration',
          metricType: 'gauge',
          value: engagementStats.avgSessionDuration,
          dimensions: { metric: 'avg_duration' },
          timestamp: new Date(),
          source: 'content-discovery'
        },
        {
          metricName: 'engagement.bounce_rate',
          metricType: 'gauge',
          value: engagementStats.bounceRate,
          dimensions: { metric: 'bounce_rate' },
          timestamp: new Date(),
          source: 'content-discovery'
        },
        {
          metricName: 'engagement.interactions',
          metricType: 'counter',
          value: engagementStats.totalInteractions,
          dimensions: { period: 'daily' },
          timestamp: new Date(),
          source: 'content-discovery'
        }
      ]);

    } catch (error) {
      logger.error('Error collecting engagement metrics:', error);
    }
  }

  async getMetricsSummary(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<any> {
    try {
      const endTime = new Date();
      let startTime: Date;

      switch (timeframe) {
        case 'week':
          startTime = subDays(endTime, 7);
          break;
        case 'month':
          startTime = subDays(endTime, 30);
          break;
        default:
          startTime = startOfDay(endTime);
      }

      // Get key metrics
      const [userMetrics, appMetrics, searchMetrics, engagementMetrics] = await Promise.all([
        this.queryMetrics({
          metricNames: ['users.total', 'users.active', 'users.new'],
          startTime,
          endTime
        }),
        this.queryMetrics({
          metricNames: ['applications.total', 'applications.submitted', 'applications.success_rate'],
          startTime,
          endTime
        }),
        this.queryMetrics({
          metricNames: ['search.queries', 'search.click_through_rate'],
          startTime,
          endTime
        }),
        this.queryMetrics({
          metricNames: ['engagement.page_views', 'engagement.session_duration'],
          startTime,
          endTime
        })
      ]);

      return {
        timeframe,
        period: { startTime, endTime },
        summary: {
          users: this.summarizeMetrics(userMetrics),
          applications: this.summarizeMetrics(appMetrics),
          search: this.summarizeMetrics(searchMetrics),
          engagement: this.summarizeMetrics(engagementMetrics)
        }
      };

    } catch (error) {
      logger.error('Error getting metrics summary:', error);
      return null;
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    try {
      const batch = this.batchQueue.splice(0, this.BATCH_SIZE);
      
      // Insert batch into database
      await prisma.metric.createMany({
        data: batch.map(metric => ({
          metricName: metric.metricName,
          metricType: metric.metricType,
          value: metric.value,
          dimensions: metric.dimensions,
          timestamp: metric.timestamp,
          source: metric.source,
          userId: metric.userId,
          sessionId: metric.sessionId
        }))
      });

      logger.debug(`Processed metrics batch of ${batch.length} items`);

    } catch (error) {
      logger.error('Error processing metrics batch:', error);
    }
  }

  private async getUserStatistics(): Promise<any> {
    try {
      const response = await axios.get(`${this.USER_SERVICE_URL}/api/v1/users/statistics`);
      return response.data;
    } catch (error) {
      logger.warn('Failed to get user statistics:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
        studentCount: 0,
        recommenderCount: 0
      };
    }
  }

  private async getApplicationStatistics(): Promise<any> {
    try {
      const response = await axios.get(`${this.APPLICATION_SERVICE_URL}/api/v1/applications/statistics`);
      return response.data;
    } catch (error) {
      logger.warn('Failed to get application statistics:', error);
      return {
        totalApplications: 0,
        submittedToday: 0,
        inProgress: 0,
        completed: 0,
        successRate: 0
      };
    }
  }

  private async getSearchStatistics(): Promise<any> {
    try {
      const response = await axios.get(`${this.SEARCH_SERVICE_URL}/api/v1/analytics/stats`);
      return response.data.stats;
    } catch (error) {
      logger.warn('Failed to get search statistics:', error);
      return {
        totalQueries: 0,
        avgResponseTime: 0,
        clickThroughRate: 0,
        zeroResults: 0
      };
    }
  }

  private async getEngagementStatistics(): Promise<any> {
    try {
      const response = await axios.get(`${this.CONTENT_DISCOVERY_URL}/api/v1/behavior/global-engagement`);
      return response.data.metrics;
    } catch (error) {
      logger.warn('Failed to get engagement statistics:', error);
      return {
        pageViews: 0,
        avgSessionDuration: 0,
        bounceRate: 0,
        totalInteractions: 0
      };
    }
  }

  private processQueryResults(metrics: any[], query: MetricQuery): any[] {
    if (!query.aggregation && !query.groupBy) {
      return metrics;
    }

    // Group by specified dimensions
    const grouped = new Map();
    
    metrics.forEach(metric => {
      let groupKey = metric.metricName;
      
      if (query.groupBy) {
        const groupValues = query.groupBy.map(field => {
          if (field === 'timestamp') {
            return format(metric.timestamp, 'yyyy-MM-dd HH:00');
          }
          return metric.dimensions[field] || 'unknown';
        });
        groupKey = `${metric.metricName}:${groupValues.join(':')}`;
      }

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey).push(metric);
    });

    // Apply aggregation
    const results: any[] = [];
    grouped.forEach((groupMetrics, groupKey) => {
      const values = groupMetrics.map((m: any) => m.value);
      let aggregatedValue: number;

      switch (query.aggregation) {
        case 'sum':
          aggregatedValue = values.reduce((sum: number, val: number) => sum + val, 0);
          break;
        case 'avg':
          aggregatedValue = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
          break;
        case 'min':
          aggregatedValue = Math.min(...values);
          break;
        case 'max':
          aggregatedValue = Math.max(...values);
          break;
        case 'count':
          aggregatedValue = values.length;
          break;
        default:
          aggregatedValue = values[0];
      }

      results.push({
        groupKey,
        metricName: groupMetrics[0].metricName,
        value: aggregatedValue,
        count: values.length,
        timestamp: groupMetrics[0].timestamp,
        dimensions: groupMetrics[0].dimensions
      });
    });

    return results;
  }

  private summarizeMetrics(metrics: any[]): any {
    if (metrics.length === 0) return {};

    const summary: any = {};
    
    metrics.forEach(metric => {
      if (!summary[metric.metricName]) {
        summary[metric.metricName] = {
          current: metric.value,
          count: 1,
          sum: metric.value,
          min: metric.value,
          max: metric.value
        };
      } else {
        const s = summary[metric.metricName];
        s.count++;
        s.sum += metric.value;
        s.min = Math.min(s.min, metric.value);
        s.max = Math.max(s.max, metric.value);
        s.current = metric.value; // Most recent value
      }
    });

    // Calculate averages
    Object.keys(summary).forEach(key => {
      summary[key].avg = summary[key].sum / summary[key].count;
    });

    return summary;
  }

  private startBatchProcessor(): void {
    // Process batch queue every 30 seconds
    setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.processBatch().catch(error => {
          logger.error('Error in batch processor:', error);
        });
      }
    }, this.FLUSH_INTERVAL);
  }

  private startPeriodicCollection(): void {
    // Collect metrics every 5 minutes
    setInterval(() => {
      Promise.all([
        this.collectUserMetrics(),
        this.collectApplicationMetrics(),
        this.collectSearchMetrics(),
        this.collectEngagementMetrics()
      ]).catch(error => {
        logger.error('Error in periodic collection:', error);
      });
    }, 300000); // 5 minutes

    logger.info('Periodic metrics collection started');
  }
}