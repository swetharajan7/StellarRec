import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { MetricsCollectionService } from './metricsCollectionService';
import { startOfHour, startOfDay, startOfWeek, startOfMonth, format } from 'date-fns';
import * as cron from 'node-cron';

const prisma = new PrismaClient();

export interface AggregationRule {
  id: string;
  name: string;
  sourceMetrics: string[];
  aggregationType: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percentile';
  groupBy: string[];
  timeWindow: 'hour' | 'day' | 'week' | 'month';
  filters?: Record<string, any>;
  isActive: boolean;
}

export interface AggregatedData {
  metricName: string;
  period: string;
  timestamp: Date;
  value: number;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
  dimensions: Record<string, string>;
  metadata: Record<string, any>;
}

export class DataAggregationService {
  private metricsService: MetricsCollectionService;
  private aggregationRules: Map<string, AggregationRule> = new Map();

  constructor() {
    this.metricsService = new MetricsCollectionService();
    this.initializeAggregationRules();
    this.startAggregationScheduler();
  }

  async createAggregationRule(rule: Omit<AggregationRule, 'id'>): Promise<string> {
    try {
      const ruleId = `rule_${Date.now()}`;
      const newRule: AggregationRule = {
        id: ruleId,
        ...rule
      };

      await prisma.aggregationRule.create({
        data: {
          id: newRule.id,
          name: newRule.name,
          sourceMetrics: newRule.sourceMetrics,
          aggregationType: newRule.aggregationType,
          groupBy: newRule.groupBy,
          timeWindow: newRule.timeWindow,
          filters: newRule.filters || {},
          isActive: newRule.isActive
        }
      });

      this.aggregationRules.set(ruleId, newRule);
      logger.info('Aggregation rule created', { ruleId, name: rule.name });

      return ruleId;

    } catch (error) {
      logger.error('Error creating aggregation rule:', error);
      throw new Error('Failed to create aggregation rule');
    }
  }

  async runAggregation(ruleId?: string, timeWindow?: string): Promise<void> {
    try {
      const rules = ruleId 
        ? [this.aggregationRules.get(ruleId)].filter(Boolean)
        : Array.from(this.aggregationRules.values()).filter(rule => 
            rule.isActive && (!timeWindow || rule.timeWindow === timeWindow)
          );

      logger.info('Running aggregation', { rulesCount: rules.length, timeWindow });

      for (const rule of rules) {
        await this.processAggregationRule(rule);
      }

    } catch (error) {
      logger.error('Error running aggregation:', error);
    }
  }

  async getAggregatedData(
    metricName: string,
    period: string,
    startTime: Date,
    endTime: Date,
    dimensions?: Record<string, string>
  ): Promise<AggregatedData[]> {
    try {
      const whereClause: any = {
        metricName,
        period,
        timestamp: {
          gte: startTime,
          lte: endTime
        }
      };

      if (dimensions) {
        Object.entries(dimensions).forEach(([key, value]) => {
          whereClause.dimensions = {
            ...whereClause.dimensions,
            path: [key],
            equals: value
          };
        });
      }

      const aggregatedData = await prisma.aggregatedMetric.findMany({
        where: whereClause,
        orderBy: { timestamp: 'asc' }
      });

      return aggregatedData.map(data => ({
        metricName: data.metricName,
        period: data.period,
        timestamp: data.timestamp,
        value: data.value,
        count: data.count,
        min: data.min,
        max: data.max,
        avg: data.avg,
        sum: data.sum,
        dimensions: data.dimensions as Record<string, string>,
        metadata: data.metadata as Record<string, any>
      }));

    } catch (error) {
      logger.error('Error getting aggregated data:', error);
      return [];
    }
  }

  async aggregateRealTime(
    metricName: string,
    timeWindow: 'minute' | 'hour' = 'minute',
    windowSize: number = 5
  ): Promise<AggregatedData | null> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - (windowSize * (timeWindow === 'minute' ? 60000 : 3600000)));

      const metrics = await this.metricsService.queryMetrics({
        metricNames: [metricName],
        startTime,
        endTime
      });

      if (metrics.length === 0) return null;

      const values = metrics.map(m => m.value);
      const aggregated: AggregatedData = {
        metricName,
        period: `${windowSize}${timeWindow}`,
        timestamp: endTime,
        value: values[values.length - 1], // Latest value
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: values.reduce((sum, v) => sum + v, 0) / values.length,
        sum: values.reduce((sum, v) => sum + v, 0),
        dimensions: {},
        metadata: { windowSize, timeWindow }
      };

      return aggregated;

    } catch (error) {
      logger.error('Error in real-time aggregation:', error);
      return null;
    }
  }

  async createCustomAggregation(
    name: string,
    sourceMetrics: string[],
    aggregationFunction: (values: number[][]) => number,
    timeWindow: 'hour' | 'day' | 'week' | 'month'
  ): Promise<AggregatedData[]> {
    try {
      const endTime = new Date();
      let startTime: Date;
      let periodStart: Date;

      switch (timeWindow) {
        case 'hour':
          startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
          periodStart = startOfHour(endTime);
          break;
        case 'day':
          startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
          periodStart = startOfDay(endTime);
          break;
        case 'week':
          startTime = new Date(endTime.getTime() - 12 * 7 * 24 * 60 * 60 * 1000); // Last 12 weeks
          periodStart = startOfWeek(endTime);
          break;
        case 'month':
          startTime = new Date(endTime.getTime() - 12 * 30 * 24 * 60 * 60 * 1000); // Last 12 months
          periodStart = startOfMonth(endTime);
          break;
      }

      // Get data for all source metrics
      const metricsData = await Promise.all(
        sourceMetrics.map(metric =>
          this.metricsService.queryMetrics({
            metricNames: [metric],
            startTime,
            endTime
          })
        )
      );

      // Group by time periods
      const periodGroups = this.groupByTimePeriod(metricsData, timeWindow);
      const aggregatedResults: AggregatedData[] = [];

      for (const [period, data] of periodGroups.entries()) {
        const values = data.map(metricData => metricData.map(m => m.value));
        const aggregatedValue = aggregationFunction(values);

        aggregatedResults.push({
          metricName: name,
          period: timeWindow,
          timestamp: new Date(period),
          value: aggregatedValue,
          count: data.reduce((sum, metricData) => sum + metricData.length, 0),
          min: aggregatedValue,
          max: aggregatedValue,
          avg: aggregatedValue,
          sum: aggregatedValue,
          dimensions: { custom: 'true' },
          metadata: { sourceMetrics, aggregationFunction: 'custom' }
        });
      }

      return aggregatedResults;

    } catch (error) {
      logger.error('Error creating custom aggregation:', error);
      return [];
    }
  }

  async getAggregationSummary(): Promise<any> {
    try {
      const [totalRules, activeRules, recentAggregations] = await Promise.all([
        prisma.aggregationRule.count(),
        prisma.aggregationRule.count({ where: { isActive: true } }),
        prisma.aggregatedMetric.count({
          where: {
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        })
      ]);

      const rulesByTimeWindow = await prisma.aggregationRule.groupBy({
        by: ['timeWindow'],
        _count: { id: true },
        where: { isActive: true }
      });

      return {
        totalRules,
        activeRules,
        recentAggregations,
        rulesByTimeWindow: rulesByTimeWindow.reduce((acc, item) => {
          acc[item.timeWindow] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        lastAggregationRun: await this.getLastAggregationTime()
      };

    } catch (error) {
      logger.error('Error getting aggregation summary:', error);
      return null;
    }
  }

  private async processAggregationRule(rule: AggregationRule): Promise<void> {
    try {
      logger.debug('Processing aggregation rule', { ruleId: rule.id, name: rule.name });

      const endTime = new Date();
      let startTime: Date;
      let periodStart: Date;

      // Determine time window
      switch (rule.timeWindow) {
        case 'hour':
          startTime = new Date(endTime.getTime() - 60 * 60 * 1000);
          periodStart = startOfHour(endTime);
          break;
        case 'day':
          startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
          periodStart = startOfDay(endTime);
          break;
        case 'week':
          startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);
          periodStart = startOfWeek(endTime);
          break;
        case 'month':
          startTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
          periodStart = startOfMonth(endTime);
          break;
      }

      // Get source metrics data
      const metricsData = await this.metricsService.queryMetrics({
        metricNames: rule.sourceMetrics,
        startTime,
        endTime,
        groupBy: rule.groupBy
      });

      if (metricsData.length === 0) return;

      // Group data by dimensions
      const groupedData = this.groupDataByDimensions(metricsData, rule.groupBy);

      // Process each group
      for (const [groupKey, data] of groupedData.entries()) {
        const aggregatedValue = this.calculateAggregation(data, rule.aggregationType);
        const dimensions = this.parseDimensions(groupKey, rule.groupBy);

        // Save aggregated data
        await this.saveAggregatedData({
          metricName: `${rule.name}_${rule.aggregationType}`,
          period: rule.timeWindow,
          timestamp: periodStart,
          value: aggregatedValue.value,
          count: aggregatedValue.count,
          min: aggregatedValue.min,
          max: aggregatedValue.max,
          avg: aggregatedValue.avg,
          sum: aggregatedValue.sum,
          dimensions,
          metadata: { ruleId: rule.id, sourceMetrics: rule.sourceMetrics }
        });
      }

    } catch (error) {
      logger.error('Error processing aggregation rule:', error);
    }
  }

  private groupDataByDimensions(data: any[], groupBy: string[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();

    data.forEach(item => {
      const groupKey = groupBy.map(field => {
        if (field === 'timestamp') {
          return format(new Date(item.timestamp), 'yyyy-MM-dd HH:00');
        }
        return item.dimensions?.[field] || 'unknown';
      }).join('|');

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(item);
    });

    return groups;
  }

  private calculateAggregation(data: any[], type: string): any {
    const values = data.map(item => item.value);

    switch (type) {
      case 'sum':
        return {
          value: values.reduce((sum, v) => sum + v, 0),
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          sum: values.reduce((sum, v) => sum + v, 0)
        };
      case 'avg':
        const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
        return {
          value: avg,
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg,
          sum: values.reduce((sum, v) => sum + v, 0)
        };
      case 'min':
        const min = Math.min(...values);
        return {
          value: min,
          count: values.length,
          min,
          max: Math.max(...values),
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          sum: values.reduce((sum, v) => sum + v, 0)
        };
      case 'max':
        const max = Math.max(...values);
        return {
          value: max,
          count: values.length,
          min: Math.min(...values),
          max,
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          sum: values.reduce((sum, v) => sum + v, 0)
        };
      case 'count':
        return {
          value: values.length,
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          sum: values.reduce((sum, v) => sum + v, 0)
        };
      case 'percentile':
        const sorted = values.sort((a, b) => a - b);
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        return {
          value: p95,
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, v) => sum + v, 0) / values.length,
          sum: values.reduce((sum, v) => sum + v, 0)
        };
      default:
        return {
          value: 0,
          count: 0,
          min: 0,
          max: 0,
          avg: 0,
          sum: 0
        };
    }
  }

  private parseDimensions(groupKey: string, groupBy: string[]): Record<string, string> {
    const dimensions: Record<string, string> = {};
    const values = groupKey.split('|');

    groupBy.forEach((field, index) => {
      dimensions[field] = values[index] || 'unknown';
    });

    return dimensions;
  }

  private groupByTimePeriod(metricsData: any[][], timeWindow: string): Map<string, any[][]> {
    const groups = new Map<string, any[][]>();

    // This is a simplified implementation
    // In practice, you'd need to align timestamps across all metrics
    const now = new Date();
    const periodKey = format(now, 'yyyy-MM-dd HH:00');
    groups.set(periodKey, metricsData);

    return groups;
  }

  private async saveAggregatedData(data: AggregatedData): Promise<void> {
    try {
      await prisma.aggregatedMetric.upsert({
        where: {
          metricName_period_timestamp: {
            metricName: data.metricName,
            period: data.period,
            timestamp: data.timestamp
          }
        },
        update: {
          value: data.value,
          count: data.count,
          min: data.min,
          max: data.max,
          avg: data.avg,
          sum: data.sum,
          dimensions: data.dimensions,
          metadata: data.metadata
        },
        create: {
          metricName: data.metricName,
          period: data.period,
          timestamp: data.timestamp,
          value: data.value,
          count: data.count,
          min: data.min,
          max: data.max,
          avg: data.avg,
          sum: data.sum,
          dimensions: data.dimensions,
          metadata: data.metadata
        }
      });

    } catch (error) {
      logger.error('Error saving aggregated data:', error);
    }
  }

  private async getLastAggregationTime(): Promise<Date | null> {
    try {
      const lastAggregation = await prisma.aggregatedMetric.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true }
      });

      return lastAggregation?.timestamp || null;

    } catch (error) {
      logger.error('Error getting last aggregation time:', error);
      return null;
    }
  }

  private initializeAggregationRules(): void {
    // Initialize with default aggregation rules
    const defaultRules: Omit<AggregationRule, 'id'>[] = [
      {
        name: 'hourly_user_metrics',
        sourceMetrics: ['users.active', 'users.new'],
        aggregationType: 'sum',
        groupBy: ['timestamp'],
        timeWindow: 'hour',
        isActive: true
      },
      {
        name: 'daily_application_metrics',
        sourceMetrics: ['applications.submitted', 'applications.completed'],
        aggregationType: 'sum',
        groupBy: ['timestamp'],
        timeWindow: 'day',
        isActive: true
      },
      {
        name: 'weekly_engagement_metrics',
        sourceMetrics: ['engagement.page_views', 'engagement.interactions'],
        aggregationType: 'avg',
        groupBy: ['timestamp'],
        timeWindow: 'week',
        isActive: true
      }
    ];

    // Create default rules
    defaultRules.forEach(rule => {
      this.createAggregationRule(rule).catch(error => {
        logger.error('Error creating default aggregation rule:', error);
      });
    });

    logger.info('Data aggregation service initialized');
  }

  private startAggregationScheduler(): void {
    // Run hourly aggregations every hour
    cron.schedule('0 * * * *', () => {
      this.runAggregation(undefined, 'hour').catch(error => {
        logger.error('Error in hourly aggregation:', error);
      });
    });

    // Run daily aggregations every day at midnight
    cron.schedule('0 0 * * *', () => {
      this.runAggregation(undefined, 'day').catch(error => {
        logger.error('Error in daily aggregation:', error);
      });
    });

    // Run weekly aggregations every Sunday at midnight
    cron.schedule('0 0 * * 0', () => {
      this.runAggregation(undefined, 'week').catch(error => {
        logger.error('Error in weekly aggregation:', error);
      });
    });

    // Run monthly aggregations on the first day of each month
    cron.schedule('0 0 1 * *', () => {
      this.runAggregation(undefined, 'month').catch(error => {
        logger.error('Error in monthly aggregation:', error);
      });
    });

    logger.info('Aggregation scheduler started');
  }
}