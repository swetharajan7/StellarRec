import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { MetricsCollectionService } from './metricsCollectionService';
import { subDays, format } from 'date-fns';

const prisma = new PrismaClient();

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'kpi' | 'trend';
  title: string;
  description?: string;
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
  data?: any;
  lastUpdated?: Date;
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  userId?: string;
  isPublic: boolean;
  widgets: DashboardWidget[];
  layout: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface KPIData {
  name: string;
  value: number;
  previousValue?: number;
  change?: number;
  changePercent?: number;
  trend: 'up' | 'down' | 'stable';
  target?: number;
  unit?: string;
  format?: 'number' | 'percentage' | 'currency' | 'duration';
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'heatmap';
  title: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    fill?: boolean;
  }>;
  options?: any;
}

export class DashboardService {
  private metricsService: MetricsCollectionService;

  constructor() {
    this.metricsService = new MetricsCollectionService();
  }

  async createDashboard(dashboard: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const newDashboard = await prisma.dashboard.create({
        data: {
          name: dashboard.name,
          description: dashboard.description,
          userId: dashboard.userId,
          isPublic: dashboard.isPublic,
          widgets: dashboard.widgets,
          layout: dashboard.layout
        }
      });

      logger.info('Dashboard created', { dashboardId: newDashboard.id, name: dashboard.name });
      return newDashboard.id;

    } catch (error) {
      logger.error('Error creating dashboard:', error);
      throw new Error('Failed to create dashboard');
    }
  }

  async getDashboard(dashboardId: string, userId?: string): Promise<Dashboard | null> {
    try {
      const dashboard = await prisma.dashboard.findFirst({
        where: {
          id: dashboardId,
          OR: [
            { isPublic: true },
            { userId: userId }
          ]
        }
      });

      if (!dashboard) return null;

      // Load widget data
      const widgetsWithData = await Promise.all(
        (dashboard.widgets as DashboardWidget[]).map(async (widget) => ({
          ...widget,
          data: await this.getWidgetData(widget),
          lastUpdated: new Date()
        }))
      );

      return {
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        userId: dashboard.userId,
        isPublic: dashboard.isPublic,
        widgets: widgetsWithData,
        layout: dashboard.layout,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt
      };

    } catch (error) {
      logger.error('Error getting dashboard:', error);
      return null;
    }
  }

  async updateDashboard(dashboardId: string, updates: Partial<Dashboard>, userId?: string): Promise<boolean> {
    try {
      const dashboard = await prisma.dashboard.findFirst({
        where: {
          id: dashboardId,
          userId: userId
        }
      });

      if (!dashboard) return false;

      await prisma.dashboard.update({
        where: { id: dashboardId },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      logger.info('Dashboard updated', { dashboardId, userId });
      return true;

    } catch (error) {
      logger.error('Error updating dashboard:', error);
      return false;
    }
  }

  async deleteDashboard(dashboardId: string, userId?: string): Promise<boolean> {
    try {
      const result = await prisma.dashboard.deleteMany({
        where: {
          id: dashboardId,
          userId: userId
        }
      });

      return result.count > 0;

    } catch (error) {
      logger.error('Error deleting dashboard:', error);
      return false;
    }
  }

  async getUserDashboards(userId: string): Promise<Dashboard[]> {
    try {
      const dashboards = await prisma.dashboard.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' }
      });

      return dashboards.map(dashboard => ({
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        userId: dashboard.userId,
        isPublic: dashboard.isPublic,
        widgets: dashboard.widgets as DashboardWidget[],
        layout: dashboard.layout,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt
      }));

    } catch (error) {
      logger.error('Error getting user dashboards:', error);
      return [];
    }
  }

  async getPublicDashboards(): Promise<Dashboard[]> {
    try {
      const dashboards = await prisma.dashboard.findMany({
        where: { isPublic: true },
        orderBy: { updatedAt: 'desc' }
      });

      return dashboards.map(dashboard => ({
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description,
        userId: dashboard.userId,
        isPublic: dashboard.isPublic,
        widgets: dashboard.widgets as DashboardWidget[],
        layout: dashboard.layout,
        createdAt: dashboard.createdAt,
        updatedAt: dashboard.updatedAt
      }));

    } catch (error) {
      logger.error('Error getting public dashboards:', error);
      return [];
    }
  }

  async getExecutiveDashboard(): Promise<Dashboard> {
    try {
      const widgets: DashboardWidget[] = [
        {
          id: 'kpi-users',
          type: 'kpi',
          title: 'Total Users',
          size: 'small',
          position: { x: 0, y: 0, w: 3, h: 2 },
          config: { metricName: 'users.total', format: 'number' }
        },
        {
          id: 'kpi-applications',
          type: 'kpi',
          title: 'Applications',
          size: 'small',
          position: { x: 3, y: 0, w: 3, h: 2 },
          config: { metricName: 'applications.total', format: 'number' }
        },
        {
          id: 'kpi-success-rate',
          type: 'kpi',
          title: 'Success Rate',
          size: 'small',
          position: { x: 6, y: 0, w: 3, h: 2 },
          config: { metricName: 'applications.success_rate', format: 'percentage' }
        },
        {
          id: 'kpi-engagement',
          type: 'kpi',
          title: 'User Engagement',
          size: 'small',
          position: { x: 9, y: 0, w: 3, h: 2 },
          config: { metricName: 'engagement.session_duration', format: 'duration' }
        },
        {
          id: 'chart-user-growth',
          type: 'chart',
          title: 'User Growth Trend',
          size: 'large',
          position: { x: 0, y: 2, w: 6, h: 4 },
          config: { 
            chartType: 'line',
            metricName: 'users.total',
            period: '30d'
          }
        },
        {
          id: 'chart-application-funnel',
          type: 'chart',
          title: 'Application Funnel',
          size: 'large',
          position: { x: 6, y: 2, w: 6, h: 4 },
          config: { 
            chartType: 'bar',
            metrics: ['applications.in_progress', 'applications.submitted', 'applications.completed']
          }
        },
        {
          id: 'table-top-universities',
          type: 'table',
          title: 'Top Universities',
          size: 'medium',
          position: { x: 0, y: 6, w: 6, h: 3 },
          config: { 
            dataSource: 'top_universities',
            columns: ['name', 'applications', 'success_rate']
          }
        },
        {
          id: 'chart-search-analytics',
          type: 'chart',
          title: 'Search Performance',
          size: 'medium',
          position: { x: 6, y: 6, w: 6, h: 3 },
          config: { 
            chartType: 'area',
            metrics: ['search.queries', 'search.click_through_rate']
          }
        }
      ];

      // Load data for all widgets
      const widgetsWithData = await Promise.all(
        widgets.map(async (widget) => ({
          ...widget,
          data: await this.getWidgetData(widget),
          lastUpdated: new Date()
        }))
      );

      return {
        id: 'executive-dashboard',
        name: 'Executive Dashboard',
        description: 'High-level overview of key business metrics',
        isPublic: false,
        widgets: widgetsWithData,
        layout: { columns: 12, rows: 9 },
        createdAt: new Date(),
        updatedAt: new Date()
      };

    } catch (error) {
      logger.error('Error getting executive dashboard:', error);
      throw new Error('Failed to get executive dashboard');
    }
  }

  async getOperationalDashboard(): Promise<Dashboard> {
    try {
      const widgets: DashboardWidget[] = [
        {
          id: 'metric-system-health',
          type: 'metric',
          title: 'System Health',
          size: 'small',
          position: { x: 0, y: 0, w: 2, h: 2 },
          config: { metricName: 'system.health', format: 'percentage' }
        },
        {
          id: 'metric-response-time',
          type: 'metric',
          title: 'Avg Response Time',
          size: 'small',
          position: { x: 2, y: 0, w: 2, h: 2 },
          config: { metricName: 'system.response_time', format: 'duration' }
        },
        {
          id: 'metric-error-rate',
          type: 'metric',
          title: 'Error Rate',
          size: 'small',
          position: { x: 4, y: 0, w: 2, h: 2 },
          config: { metricName: 'system.error_rate', format: 'percentage' }
        },
        {
          id: 'chart-service-performance',
          type: 'chart',
          title: 'Service Performance',
          size: 'large',
          position: { x: 0, y: 2, w: 8, h: 4 },
          config: { 
            chartType: 'line',
            metrics: ['api.response_time', 'search.response_time', 'db.query_time']
          }
        },
        {
          id: 'table-recent-errors',
          type: 'table',
          title: 'Recent Errors',
          size: 'medium',
          position: { x: 8, y: 0, w: 4, h: 6 },
          config: { 
            dataSource: 'recent_errors',
            columns: ['timestamp', 'service', 'error', 'count']
          }
        }
      ];

      const widgetsWithData = await Promise.all(
        widgets.map(async (widget) => ({
          ...widget,
          data: await this.getWidgetData(widget),
          lastUpdated: new Date()
        }))
      );

      return {
        id: 'operational-dashboard',
        name: 'Operational Dashboard',
        description: 'System performance and operational metrics',
        isPublic: false,
        widgets: widgetsWithData,
        layout: { columns: 12, rows: 6 },
        createdAt: new Date(),
        updatedAt: new Date()
      };

    } catch (error) {
      logger.error('Error getting operational dashboard:', error);
      throw new Error('Failed to get operational dashboard');
    }
  }

  async refreshWidget(widgetId: string, dashboardId: string): Promise<any> {
    try {
      const dashboard = await prisma.dashboard.findUnique({
        where: { id: dashboardId }
      });

      if (!dashboard) return null;

      const widgets = dashboard.widgets as DashboardWidget[];
      const widget = widgets.find(w => w.id === widgetId);

      if (!widget) return null;

      const data = await this.getWidgetData(widget);
      
      // Update widget data in database
      const updatedWidgets = widgets.map(w => 
        w.id === widgetId 
          ? { ...w, data, lastUpdated: new Date() }
          : w
      );

      await prisma.dashboard.update({
        where: { id: dashboardId },
        data: { widgets: updatedWidgets }
      });

      return data;

    } catch (error) {
      logger.error('Error refreshing widget:', error);
      return null;
    }
  }

  private async getWidgetData(widget: DashboardWidget): Promise<any> {
    try {
      switch (widget.type) {
        case 'kpi':
          return await this.getKPIData(widget.config);
        case 'metric':
          return await this.getMetricData(widget.config);
        case 'chart':
          return await this.getChartData(widget.config);
        case 'table':
          return await this.getTableData(widget.config);
        case 'trend':
          return await this.getTrendData(widget.config);
        default:
          return null;
      }
    } catch (error) {
      logger.error('Error getting widget data:', error);
      return null;
    }
  }

  private async getKPIData(config: any): Promise<KPIData> {
    const endTime = new Date();
    const startTime = subDays(endTime, 1);
    const previousStartTime = subDays(startTime, 1);

    const [currentMetrics, previousMetrics] = await Promise.all([
      this.metricsService.queryMetrics({
        metricNames: [config.metricName],
        startTime,
        endTime,
        limit: 1
      }),
      this.metricsService.queryMetrics({
        metricNames: [config.metricName],
        startTime: previousStartTime,
        endTime: startTime,
        limit: 1
      })
    ]);

    const currentValue = currentMetrics.length > 0 ? currentMetrics[0].value : 0;
    const previousValue = previousMetrics.length > 0 ? previousMetrics[0].value : 0;
    const change = currentValue - previousValue;
    const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;

    return {
      name: config.metricName,
      value: currentValue,
      previousValue,
      change,
      changePercent,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      target: config.target,
      unit: config.unit,
      format: config.format || 'number'
    };
  }

  private async getMetricData(config: any): Promise<any> {
    const endTime = new Date();
    const startTime = subDays(endTime, config.period || 7);

    const metrics = await this.metricsService.queryMetrics({
      metricNames: [config.metricName],
      startTime,
      endTime
    });

    return {
      current: metrics.length > 0 ? metrics[0].value : 0,
      history: metrics.map(m => ({
        timestamp: m.timestamp,
        value: m.value
      }))
    };
  }

  private async getChartData(config: any): Promise<ChartData> {
    const endTime = new Date();
    const days = parseInt(config.period?.replace('d', '')) || 7;
    const startTime = subDays(endTime, days);

    let datasets: any[] = [];

    if (config.metricName) {
      // Single metric chart
      const metrics = await this.metricsService.queryMetrics({
        metricNames: [config.metricName],
        startTime,
        endTime,
        groupBy: ['timestamp']
      });

      datasets = [{
        label: config.metricName,
        data: metrics.map(m => m.value),
        borderColor: '#1976d2',
        backgroundColor: config.chartType === 'area' ? 'rgba(25, 118, 210, 0.1)' : '#1976d2',
        fill: config.chartType === 'area'
      }];
    } else if (config.metrics) {
      // Multiple metrics chart
      for (const metricName of config.metrics) {
        const metrics = await this.metricsService.queryMetrics({
          metricNames: [metricName],
          startTime,
          endTime,
          groupBy: ['timestamp']
        });

        datasets.push({
          label: metricName,
          data: metrics.map(m => m.value),
          borderColor: this.getColorForMetric(metricName),
          backgroundColor: this.getColorForMetric(metricName),
          fill: false
        });
      }
    }

    // Generate labels (dates)
    const labels: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(endTime, i);
      labels.push(format(date, 'MMM dd'));
    }

    return {
      type: config.chartType || 'line',
      title: config.title || 'Chart',
      labels,
      datasets,
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top' as const,
          },
          title: {
            display: true,
            text: config.title
          }
        }
      }
    };
  }

  private async getTableData(config: any): Promise<any> {
    switch (config.dataSource) {
      case 'top_universities':
        return await this.getTopUniversitiesData();
      case 'recent_errors':
        return await this.getRecentErrorsData();
      case 'user_activity':
        return await this.getUserActivityData();
      default:
        return { columns: config.columns || [], rows: [] };
    }
  }

  private async getTrendData(config: any): Promise<any> {
    const endTime = new Date();
    const startTime = subDays(endTime, 30);

    const metrics = await this.metricsService.queryMetrics({
      metricNames: [config.metricName],
      startTime,
      endTime
    });

    if (metrics.length < 2) {
      return { trend: 'stable', change: 0 };
    }

    const recent = metrics.slice(0, Math.floor(metrics.length / 2));
    const older = metrics.slice(Math.floor(metrics.length / 2));

    const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    return {
      trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
      change: Math.round(change * 100) / 100,
      current: recentAvg,
      previous: olderAvg
    };
  }

  private async getTopUniversitiesData(): Promise<any> {
    // Mock data - in production, this would come from actual metrics
    return {
      columns: ['University', 'Applications', 'Success Rate'],
      rows: [
        ['Harvard University', 1250, '85%'],
        ['Stanford University', 1180, '82%'],
        ['MIT', 1050, '88%'],
        ['Yale University', 980, '79%'],
        ['Princeton University', 920, '81%']
      ]
    };
  }

  private async getRecentErrorsData(): Promise<any> {
    // Mock data - in production, this would come from error logs
    return {
      columns: ['Time', 'Service', 'Error', 'Count'],
      rows: [
        ['10:30 AM', 'search-service', 'Timeout', 3],
        ['10:25 AM', 'user-service', 'DB Connection', 1],
        ['10:20 AM', 'api-gateway', 'Rate Limit', 5],
        ['10:15 AM', 'application-service', 'Validation', 2]
      ]
    };
  }

  private async getUserActivityData(): Promise<any> {
    return {
      columns: ['User Type', 'Active Users', 'Growth'],
      rows: [
        ['Students', 2450, '+12%'],
        ['Recommenders', 890, '+8%'],
        ['Total', 3340, '+11%']
      ]
    };
  }

  private getColorForMetric(metricName: string): string {
    const colors: Record<string, string> = {
      'users.total': '#1976d2',
      'applications.total': '#388e3c',
      'search.queries': '#f57c00',
      'engagement.page_views': '#7b1fa2',
      'system.response_time': '#d32f2f',
      'api.response_time': '#1976d2',
      'search.response_time': '#388e3c',
      'db.query_time': '#f57c00'
    };

    return colors[metricName] || '#666666';
  }
}