import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { LoggingService } from './loggingService';
import { MetricsCollectionService } from './metricsCollectionService';
import { HealthCheckService } from './healthCheckService';
import { SystemMonitoringService } from './systemMonitoringService';
import { PerformanceMonitoringService } from './performanceMonitoringService';
import { AlertingService } from './alertingService';

const prisma = new PrismaClient();

export interface DashboardData {
  overview: {
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    totalAlerts: number;
    criticalAlerts: number;
    systemStatus: 'healthy' | 'warning' | 'critical';
    uptime: number;
  };
  services: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    responseTime: number;
    errorRate: number;
    uptime: number;
    lastCheck: Date;
  }>;
  system: {
    cpu: number;
    memory: number;
    disk: number;
    load: number;
    processes: number;
  };
  metrics: {
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    requestsPerMinute: number;
  };
  alerts: Array<{
    id: string;
    service: string;
    severity: string;
    message: string;
    timestamp: Date;
    status: string;
  }>;
  logs: Array<{
    timestamp: Date;
    level: string;
    service: string;
    message: string;
  }>;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string;
  }>;
}

export class DashboardService {
  private loggingService: LoggingService;
  private metricsService: MetricsCollectionService;
  private healthService: HealthCheckService;
  private systemService: SystemMonitoringService;
  private performanceService: PerformanceMonitoringService;
  private alertingService: AlertingService;

  constructor() {
    this.loggingService = new LoggingService();
    this.metricsService = new MetricsCollectionService();
    this.healthService = new HealthCheckService();
    this.systemService = new SystemMonitoringService();
    this.performanceService = new PerformanceMonitoringService();
    this.alertingService = new AlertingService();
  }

  async getDashboardData(): Promise<DashboardData> {
    try {
      const [
        serviceHealth,
        systemOverview,
        aggregatedMetrics,
        activeAlerts,
        recentLogs
      ] = await Promise.all([
        this.healthService.getAllServiceHealth(),
        this.systemService.getSystemOverview(),
        this.metricsService.getAggregatedMetrics(),
        this.alertingService.getActiveAlerts(),
        this.getRecentLogs()
      ]);

      const totalServices = serviceHealth.length;
      const healthyServices = serviceHealth.filter(s => s.status === 'healthy').length;
      const unhealthyServices = serviceHealth.filter(s => s.status === 'unhealthy').length;
      const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;

      const overview = {
        totalServices,
        healthyServices,
        unhealthyServices,
        totalAlerts: activeAlerts.length,
        criticalAlerts,
        systemStatus: systemOverview.status,
        uptime: systemOverview.uptime
      };

      const services = serviceHealth.map(service => ({
        name: service.service,
        status: service.status,
        responseTime: service.responseTime,
        errorRate: 0, // Will be calculated from metrics
        uptime: service.uptime,
        lastCheck: service.lastCheck
      }));

      const system = {
        cpu: systemOverview.cpuUsage,
        memory: systemOverview.memoryUsage,
        disk: systemOverview.diskUsage,
        load: systemOverview.loadAverage,
        processes: systemOverview.activeProcesses
      };

      const metrics = {
        totalRequests: aggregatedMetrics.totalRequests,
        totalErrors: aggregatedMetrics.totalErrors,
        averageResponseTime: aggregatedMetrics.averageResponseTime,
        requestsPerMinute: await this.getRequestsPerMinute()
      };

      const alerts = activeAlerts.map(alert => ({
        id: alert.id,
        service: alert.service,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.triggeredAt,
        status: alert.status
      }));

      const logs = recentLogs.map(log => ({
        timestamp: log.timestamp,
        level: log.level,
        service: log.service,
        message: log.message
      }));

      return {
        overview,
        services,
        system,
        metrics,
        alerts,
        logs
      };

    } catch (error) {
      logger.error('Error getting dashboard data:', error);
      throw new Error(`Failed to get dashboard data: ${error.message}`);
    }
  }

  async getServiceMetricsChart(
    serviceName: string,
    metric: 'responseTime' | 'errorRate' | 'throughput',
    hours: number = 24
  ): Promise<ChartData> {
    try {
      const performanceHistory = await this.performanceService.getPerformanceHistory(serviceName, hours);
      
      const labels = performanceHistory.map(p => 
        p.timestamp.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      ).reverse();

      let data: number[];
      let label: string;
      let borderColor: string;

      switch (metric) {
        case 'responseTime':
          data = performanceHistory.map(p => p.responseTime).reverse();
          label = 'Response Time (ms)';
          borderColor = '#3b82f6';
          break;
        case 'errorRate':
          data = performanceHistory.map(p => p.errorRate).reverse();
          label = 'Error Rate (%)';
          borderColor = '#ef4444';
          break;
        case 'throughput':
          data = performanceHistory.map(p => p.throughput).reverse();
          label = 'Throughput (req/s)';
          borderColor = '#10b981';
          break;
        default:
          throw new Error(`Unknown metric: ${metric}`);
      }

      return {
        labels,
        datasets: [{
          label,
          data,
          borderColor,
          backgroundColor: borderColor + '20'
        }]
      };

    } catch (error) {
      logger.error('Error getting service metrics chart:', error);
      throw new Error(`Failed to get service metrics chart: ${error.message}`);
    }
  }

  async getSystemMetricsChart(
    metric: 'cpu' | 'memory' | 'disk' | 'load',
    hours: number = 24
  ): Promise<ChartData> {
    try {
      const systemHistory = await this.systemService.getSystemHistory(hours);
      
      const labels = systemHistory.map(s => 
        s.timestamp.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      ).reverse();

      let data: number[];
      let label: string;
      let borderColor: string;

      switch (metric) {
        case 'cpu':
          data = systemHistory.map(s => s.cpu.usage).reverse();
          label = 'CPU Usage (%)';
          borderColor = '#f59e0b';
          break;
        case 'memory':
          data = systemHistory.map(s => s.memory.usage).reverse();
          label = 'Memory Usage (%)';
          borderColor = '#8b5cf6';
          break;
        case 'disk':
          data = systemHistory.map(s => s.disk.usage).reverse();
          label = 'Disk Usage (%)';
          borderColor = '#06b6d4';
          break;
        case 'load':
          data = systemHistory.map(s => s.load.avg1).reverse();
          label = 'Load Average';
          borderColor = '#84cc16';
          break;
        default:
          throw new Error(`Unknown metric: ${metric}`);
      }

      return {
        labels,
        datasets: [{
          label,
          data,
          borderColor,
          backgroundColor: borderColor + '20'
        }]
      };

    } catch (error) {
      logger.error('Error getting system metrics chart:', error);
      throw new Error(`Failed to get system metrics chart: ${error.message}`);
    }
  }

  async getErrorTrendsChart(hours: number = 24): Promise<ChartData> {
    try {
      const errorTrends = await this.loggingService.getErrorTrends('hour');
      
      const serviceNames = [...new Set(errorTrends.map(t => t.service))];
      const timeLabels = [...new Set(errorTrends.map(t => 
        t.timestamp.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      ))];

      const datasets = serviceNames.map((service, index) => {
        const serviceData = errorTrends.filter(t => t.service === service);
        const colors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e'];
        
        return {
          label: service,
          data: timeLabels.map(time => {
            const dataPoint = serviceData.find(d => 
              d.timestamp.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }) === time
            );
            return dataPoint ? dataPoint.errorCount : 0;
          }),
          borderColor: colors[index % colors.length],
          backgroundColor: colors[index % colors.length] + '20'
        };
      });

      return {
        labels: timeLabels,
        datasets
      };

    } catch (error) {
      logger.error('Error getting error trends chart:', error);
      throw new Error(`Failed to get error trends chart: ${error.message}`);
    }
  }

  async getServiceHealthOverview(): Promise<{
    healthy: number;
    unhealthy: number;
    degraded: number;
    services: Array<{
      name: string;
      status: string;
      uptime: number;
      responseTime: number;
    }>;
  }> {
    try {
      const serviceHealth = await this.healthService.getAllServiceHealth();
      
      const healthy = serviceHealth.filter(s => s.status === 'healthy').length;
      const unhealthy = serviceHealth.filter(s => s.status === 'unhealthy').length;
      const degraded = serviceHealth.filter(s => s.status === 'degraded').length;

      const services = serviceHealth.map(service => ({
        name: service.service,
        status: service.status,
        uptime: service.uptime,
        responseTime: service.responseTime
      }));

      return {
        healthy,
        unhealthy,
        degraded,
        services
      };

    } catch (error) {
      logger.error('Error getting service health overview:', error);
      throw new Error(`Failed to get service health overview: ${error.message}`);
    }
  }

  async getTopErrors(limit: number = 10): Promise<Array<{
    service: string;
    message: string;
    count: number;
    lastOccurrence: Date;
  }>> {
    try {
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const topErrors = await prisma.logEntry.groupBy({
        by: ['service', 'message'],
        where: {
          level: 'error',
          timestamp: { gte: last24Hours }
        },
        _count: {
          message: true
        },
        _max: {
          timestamp: true
        },
        orderBy: {
          _count: {
            message: 'desc'
          }
        },
        take: limit
      });

      return topErrors.map(error => ({
        service: error.service,
        message: error.message,
        count: error._count.message,
        lastOccurrence: error._max.timestamp || new Date()
      }));

    } catch (error) {
      logger.error('Error getting top errors:', error);
      throw new Error(`Failed to get top errors: ${error.message}`);
    }
  }

  async getAlertsSummary(): Promise<{
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recent: Array<{
      id: string;
      service: string;
      severity: string;
      message: string;
      timestamp: Date;
    }>;
  }> {
    try {
      const activeAlerts = await this.alertingService.getActiveAlerts();
      
      const total = activeAlerts.length;
      const critical = activeAlerts.filter(a => a.severity === 'critical').length;
      const high = activeAlerts.filter(a => a.severity === 'high').length;
      const medium = activeAlerts.filter(a => a.severity === 'medium').length;
      const low = activeAlerts.filter(a => a.severity === 'low').length;

      const recent = activeAlerts
        .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
        .slice(0, 5)
        .map(alert => ({
          id: alert.id,
          service: alert.service,
          severity: alert.severity,
          message: alert.message,
          timestamp: alert.triggeredAt
        }));

      return {
        total,
        critical,
        high,
        medium,
        low,
        recent
      };

    } catch (error) {
      logger.error('Error getting alerts summary:', error);
      throw new Error(`Failed to get alerts summary: ${error.message}`);
    }
  }

  private async getRecentLogs(limit: number = 50): Promise<Array<{
    timestamp: Date;
    level: string;
    service: string;
    message: string;
  }>> {
    try {
      const logs = await this.loggingService.queryLogs({
        limit,
        offset: 0
      });

      return logs.logs.map(log => ({
        timestamp: log.timestamp,
        level: log.level,
        service: log.service,
        message: log.message
      }));

    } catch (error) {
      logger.error('Error getting recent logs:', error);
      return [];
    }
  }

  private async getRequestsPerMinute(): Promise<number> {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      
      const requestCount = await prisma.logEntry.count({
        where: {
          timestamp: { gte: oneMinuteAgo },
          duration: { not: null } // Only count actual requests
        }
      });

      return requestCount;

    } catch (error) {
      logger.error('Error getting requests per minute:', error);
      return 0;
    }
  }
}