import { performance } from 'perf_hooks';
import pidusage from 'pidusage';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { LoggingService } from './loggingService';

const prisma = new PrismaClient();

export interface PerformanceMetrics {
  service: string;
  timestamp: Date;
  cpu: number;
  memory: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  activeConnections: number;
  queueSize: number;
}

export interface PerformanceAlert {
  service: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: Date;
}

export interface PerformanceThreshold {
  service: string;
  metric: string;
  warningThreshold: number;
  criticalThreshold: number;
  enabled: boolean;
}

export class PerformanceMonitoringService {
  private loggingService: LoggingService;
  private monitoringInterval?: NodeJS.Timeout;
  private performanceData: Map<string, PerformanceMetrics[]> = new Map();
  private thresholds: Map<string, PerformanceThreshold[]> = new Map();
  private isMonitoring: boolean = false;

  constructor() {
    this.loggingService = new LoggingService();
    this.initializeThresholds();
    this.loadPerformanceHistory();
  }

  async collectPerformanceMetrics(serviceName: string): Promise<PerformanceMetrics> {
    try {
      const timestamp = new Date();
      
      // Get process metrics if available
      let cpu = 0;
      let memory = 0;
      
      try {
        const processMetrics = await this.getProcessMetrics(serviceName);
        cpu = processMetrics.cpu;
        memory = processMetrics.memory;
      } catch (error) {
        logger.debug(`Could not get process metrics for ${serviceName}:`, error.message);
      }

      // Get application metrics
      const appMetrics = await this.getApplicationMetrics(serviceName);
      
      const performanceMetrics: PerformanceMetrics = {
        service: serviceName,
        timestamp,
        cpu,
        memory,
        responseTime: appMetrics.responseTime,
        throughput: appMetrics.throughput,
        errorRate: appMetrics.errorRate,
        activeConnections: appMetrics.activeConnections,
        queueSize: appMetrics.queueSize
      };

      // Store metrics
      await this.storePerformanceMetrics(performanceMetrics);
      
      // Update in-memory cache
      this.updatePerformanceCache(serviceName, performanceMetrics);
      
      // Check thresholds
      await this.checkPerformanceThresholds(performanceMetrics);

      return performanceMetrics;

    } catch (error) {
      logger.error(`Error collecting performance metrics for ${serviceName}:`, error);
      throw new Error(`Failed to collect performance metrics: ${error.message}`);
    }
  }

  async collectAllPerformanceMetrics(): Promise<PerformanceMetrics[]> {
    const services = [
      'user-service',
      'application-service',
      'ai-service',
      'notification-service',
      'reminder-service',
      'predictive-analytics',
      'analytics-service',
      'search-service',
      'document-processing',
      'file-management',
      'content-discovery'
    ];

    const metricsPromises = services.map(service => 
      this.collectPerformanceMetrics(service).catch(error => {
        logger.warn(`Failed to collect metrics for ${service}:`, error.message);
        return null;
      })
    );

    const results = await Promise.all(metricsPromises);
    return results.filter(result => result !== null) as PerformanceMetrics[];
  }

  async getPerformanceHistory(
    serviceName: string,
    hours: number = 24
  ): Promise<PerformanceMetrics[]> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const metrics = await prisma.performanceMetrics.findMany({
        where: {
          service: serviceName,
          timestamp: { gte: startTime }
        },
        orderBy: { timestamp: 'desc' },
        take: 1000
      });

      return metrics.map(m => ({
        service: m.service,
        timestamp: m.timestamp,
        cpu: m.cpu,
        memory: m.memory,
        responseTime: m.responseTime,
        throughput: m.throughput,
        errorRate: m.errorRate,
        activeConnections: m.activeConnections,
        queueSize: m.queueSize
      }));

    } catch (error) {
      logger.error('Error getting performance history:', error);
      throw new Error(`Failed to get performance history: ${error.message}`);
    }
  }

  async getPerformanceAggregates(
    serviceName?: string,
    timeframe: 'hour' | 'day' | 'week' = 'day'
  ): Promise<{
    avgCpu: number;
    avgMemory: number;
    avgResponseTime: number;
    avgThroughput: number;
    avgErrorRate: number;
    maxCpu: number;
    maxMemory: number;
    maxResponseTime: number;
  }> {
    try {
      const startTime = this.getTimeframeStart(timeframe);
      
      const whereClause: any = {
        timestamp: { gte: startTime }
      };

      if (serviceName) {
        whereClause.service = serviceName;
      }

      const aggregates = await prisma.performanceMetrics.aggregate({
        where: whereClause,
        _avg: {
          cpu: true,
          memory: true,
          responseTime: true,
          throughput: true,
          errorRate: true
        },
        _max: {
          cpu: true,
          memory: true,
          responseTime: true
        }
      });

      return {
        avgCpu: aggregates._avg.cpu || 0,
        avgMemory: aggregates._avg.memory || 0,
        avgResponseTime: aggregates._avg.responseTime || 0,
        avgThroughput: aggregates._avg.throughput || 0,
        avgErrorRate: aggregates._avg.errorRate || 0,
        maxCpu: aggregates._max.cpu || 0,
        maxMemory: aggregates._max.memory || 0,
        maxResponseTime: aggregates._max.responseTime || 0
      };

    } catch (error) {
      logger.error('Error getting performance aggregates:', error);
      throw new Error(`Failed to get performance aggregates: ${error.message}`);
    }
  }

  async setPerformanceThreshold(threshold: PerformanceThreshold): Promise<void> {
    try {
      await prisma.performanceThreshold.upsert({
        where: {
          service_metric: {
            service: threshold.service,
            metric: threshold.metric
          }
        },
        update: {
          warningThreshold: threshold.warningThreshold,
          criticalThreshold: threshold.criticalThreshold,
          enabled: threshold.enabled
        },
        create: {
          service: threshold.service,
          metric: threshold.metric,
          warningThreshold: threshold.warningThreshold,
          criticalThreshold: threshold.criticalThreshold,
          enabled: threshold.enabled
        }
      });

      // Update in-memory cache
      const serviceThresholds = this.thresholds.get(threshold.service) || [];
      const existingIndex = serviceThresholds.findIndex(t => t.metric === threshold.metric);
      
      if (existingIndex >= 0) {
        serviceThresholds[existingIndex] = threshold;
      } else {
        serviceThresholds.push(threshold);
      }
      
      this.thresholds.set(threshold.service, serviceThresholds);

      await this.loggingService.logEntry({
        level: 'info',
        message: `Performance threshold updated for ${threshold.service}.${threshold.metric}`,
        service: 'monitoring-service',
        metadata: { threshold }
      });

    } catch (error) {
      logger.error('Error setting performance threshold:', error);
      throw new Error(`Failed to set performance threshold: ${error.message}`);
    }
  }

  async getPerformanceThresholds(serviceName?: string): Promise<PerformanceThreshold[]> {
    if (serviceName) {
      return this.thresholds.get(serviceName) || [];
    }

    const allThresholds: PerformanceThreshold[] = [];
    for (const thresholds of this.thresholds.values()) {
      allThresholds.push(...thresholds);
    }
    return allThresholds;
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    
    // Collect metrics every 60 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectAllPerformanceMetrics();
      } catch (error) {
        logger.error('Error in performance monitoring cycle:', error);
      }
    }, 60000);

    // Perform initial collection
    this.collectAllPerformanceMetrics();
    
    logger.info('Performance monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.isMonitoring = false;
    logger.info('Performance monitoring stopped');
  }

  private async getProcessMetrics(serviceName: string): Promise<{ cpu: number; memory: number }> {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd need to track PIDs of your services
      const stats = await pidusage(process.pid);
      
      return {
        cpu: stats.cpu,
        memory: stats.memory / 1024 / 1024 // Convert to MB
      };

    } catch (error) {
      return { cpu: 0, memory: 0 };
    }
  }

  private async getApplicationMetrics(serviceName: string): Promise<{
    responseTime: number;
    throughput: number;
    errorRate: number;
    activeConnections: number;
    queueSize: number;
  }> {
    try {
      // Get recent performance data from logs or metrics endpoint
      const recentMetrics = await this.getRecentMetricsFromLogs(serviceName);
      
      return {
        responseTime: recentMetrics.avgResponseTime || 0,
        throughput: recentMetrics.requestsPerSecond || 0,
        errorRate: recentMetrics.errorRate || 0,
        activeConnections: recentMetrics.activeConnections || 0,
        queueSize: recentMetrics.queueSize || 0
      };

    } catch (error) {
      return {
        responseTime: 0,
        throughput: 0,
        errorRate: 0,
        activeConnections: 0,
        queueSize: 0
      };
    }
  }

  private async getRecentMetricsFromLogs(serviceName: string): Promise<{
    avgResponseTime?: number;
    requestsPerSecond?: number;
    errorRate?: number;
    activeConnections?: number;
    queueSize?: number;
  }> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // Get recent logs for the service
      const logs = await prisma.logEntry.findMany({
        where: {
          service: serviceName,
          timestamp: { gte: fiveMinutesAgo },
          duration: { not: null }
        },
        select: {
          duration: true,
          level: true
        }
      });

      if (logs.length === 0) {
        return {};
      }

      const totalRequests = logs.length;
      const errorRequests = logs.filter(log => log.level === 'error').length;
      const avgResponseTime = logs.reduce((sum, log) => sum + (log.duration || 0), 0) / totalRequests;
      const requestsPerSecond = totalRequests / (5 * 60); // 5 minutes
      const errorRate = (errorRequests / totalRequests) * 100;

      return {
        avgResponseTime,
        requestsPerSecond,
        errorRate
      };

    } catch (error) {
      logger.debug(`Error getting recent metrics from logs for ${serviceName}:`, error);
      return {};
    }
  }

  private async storePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      await prisma.performanceMetrics.create({
        data: {
          id: this.generateId(),
          service: metrics.service,
          timestamp: metrics.timestamp,
          cpu: metrics.cpu,
          memory: metrics.memory,
          responseTime: metrics.responseTime,
          throughput: metrics.throughput,
          errorRate: metrics.errorRate,
          activeConnections: metrics.activeConnections,
          queueSize: metrics.queueSize
        }
      });

    } catch (error) {
      logger.error('Error storing performance metrics:', error);
    }
  }

  private updatePerformanceCache(serviceName: string, metrics: PerformanceMetrics): void {
    const serviceData = this.performanceData.get(serviceName) || [];
    serviceData.push(metrics);
    
    // Keep only last 100 entries per service
    if (serviceData.length > 100) {
      serviceData.shift();
    }
    
    this.performanceData.set(serviceName, serviceData);
  }

  private async checkPerformanceThresholds(metrics: PerformanceMetrics): Promise<void> {
    const serviceThresholds = this.thresholds.get(metrics.service) || [];
    
    for (const threshold of serviceThresholds) {
      if (!threshold.enabled) continue;

      let metricValue: number;
      switch (threshold.metric) {
        case 'cpu':
          metricValue = metrics.cpu;
          break;
        case 'memory':
          metricValue = metrics.memory;
          break;
        case 'responseTime':
          metricValue = metrics.responseTime;
          break;
        case 'errorRate':
          metricValue = metrics.errorRate;
          break;
        case 'throughput':
          metricValue = metrics.throughput;
          break;
        default:
          continue;
      }

      let severity: 'warning' | 'critical' | null = null;
      
      if (metricValue >= threshold.criticalThreshold) {
        severity = 'critical';
      } else if (metricValue >= threshold.warningThreshold) {
        severity = 'warning';
      }

      if (severity) {
        await this.triggerPerformanceAlert({
          service: metrics.service,
          metric: threshold.metric,
          value: metricValue,
          threshold: severity === 'critical' ? threshold.criticalThreshold : threshold.warningThreshold,
          severity,
          timestamp: metrics.timestamp
        });
      }
    }
  }

  private async triggerPerformanceAlert(alert: PerformanceAlert): Promise<void> {
    try {
      await this.loggingService.logEntry({
        level: alert.severity === 'critical' ? 'error' : 'warn',
        message: `Performance alert: ${alert.service} ${alert.metric} is ${alert.value} (threshold: ${alert.threshold})`,
        service: 'monitoring-service',
        metadata: { alert }
      });

      // Store alert
      await prisma.performanceAlert.create({
        data: {
          id: this.generateId(),
          service: alert.service,
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold,
          severity: alert.severity,
          timestamp: alert.timestamp
        }
      });

    } catch (error) {
      logger.error('Error triggering performance alert:', error);
    }
  }

  private async initializeThresholds(): Promise<void> {
    try {
      const thresholds = await prisma.performanceThreshold.findMany({
        where: { enabled: true }
      });

      thresholds.forEach(threshold => {
        const serviceThresholds = this.thresholds.get(threshold.service) || [];
        serviceThresholds.push({
          service: threshold.service,
          metric: threshold.metric,
          warningThreshold: threshold.warningThreshold,
          criticalThreshold: threshold.criticalThreshold,
          enabled: threshold.enabled
        });
        this.thresholds.set(threshold.service, serviceThresholds);
      });

      // Set default thresholds if none exist
      if (thresholds.length === 0) {
        await this.setDefaultThresholds();
      }

    } catch (error) {
      logger.error('Error initializing performance thresholds:', error);
    }
  }

  private async setDefaultThresholds(): Promise<void> {
    const defaultThresholds: PerformanceThreshold[] = [
      { service: 'all', metric: 'cpu', warningThreshold: 70, criticalThreshold: 90, enabled: true },
      { service: 'all', metric: 'memory', warningThreshold: 80, criticalThreshold: 95, enabled: true },
      { service: 'all', metric: 'responseTime', warningThreshold: 1000, criticalThreshold: 3000, enabled: true },
      { service: 'all', metric: 'errorRate', warningThreshold: 5, criticalThreshold: 10, enabled: true }
    ];

    for (const threshold of defaultThresholds) {
      await this.setPerformanceThreshold(threshold);
    }
  }

  private async loadPerformanceHistory(): Promise<void> {
    try {
      // Load recent performance data for each service
      const services = [
        'user-service', 'application-service', 'ai-service',
        'notification-service', 'reminder-service', 'predictive-analytics'
      ];

      for (const service of services) {
        const recentMetrics = await prisma.performanceMetrics.findMany({
          where: {
            service,
            timestamp: {
              gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
            }
          },
          orderBy: { timestamp: 'desc' },
          take: 60
        });

        const serviceData = recentMetrics.map(m => ({
          service: m.service,
          timestamp: m.timestamp,
          cpu: m.cpu,
          memory: m.memory,
          responseTime: m.responseTime,
          throughput: m.throughput,
          errorRate: m.errorRate,
          activeConnections: m.activeConnections,
          queueSize: m.queueSize
        }));

        this.performanceData.set(service, serviceData);
      }

    } catch (error) {
      logger.error('Error loading performance history:', error);
    }
  }

  private getTimeframeStart(timeframe: 'hour' | 'day' | 'week'): Date {
    const now = new Date();
    switch (timeframe) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private generateId(): string {
    return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}