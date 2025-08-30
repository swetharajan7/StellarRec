import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { startOfDay, endOfDay, subDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { MetricsCollectionService } from './metricsCollectionService';

const prisma = new PrismaClient();

export interface ReportConfig {
  id?: string;
  name: string;
  description: string;
  type: 'user_activity' | 'application_performance' | 'search_analytics' | 'engagement' | 'custom';
  schedule: 'daily' | 'weekly' | 'monthly' | 'on_demand';
  recipients: string[];
  parameters: Record<string, any>;
  isActive: boolean;
}

export interface ReportData {
  id: string;
  name: string;
  type: string;
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  data: any;
  summary: any;
  visualizations: any[];
  insights: string[];
}

export interface PerformanceReport {
  period: string;
  metrics: {
    userGrowth: number;
    applicationSuccess: number;
    searchEfficiency: number;
    userEngagement: number;
  };
  trends: {
    userGrowthTrend: 'up' | 'down' | 'stable';
    applicationTrend: 'up' | 'down' | 'stable';
    searchTrend: 'up' | 'down' | 'stable';
    engagementTrend: 'up' | 'down' | 'stable';
  };
  comparisons: {
    previousPeriod: any;
    yearOverYear: any;
  };
  recommendations: string[];
}

export class ReportingService {
  private metricsService: MetricsCollectionService;

  constructor() {
    this.metricsService = new MetricsCollectionService();
  }

  async generateReport(reportConfig: ReportConfig, startDate?: Date, endDate?: Date): Promise<ReportData> {
    try {
      logger.info('Generating report', { 
        reportName: reportConfig.name, 
        type: reportConfig.type 
      });

      // Determine report period
      const period = this.calculateReportPeriod(reportConfig.schedule, startDate, endDate);
      
      // Generate report data based on type
      let reportData: any;
      let visualizations: any[] = [];
      let insights: string[] = [];

      switch (reportConfig.type) {
        case 'user_activity':
          reportData = await this.generateUserActivityReport(period.startDate, period.endDate);
          visualizations = this.createUserActivityVisualizations(reportData);
          insights = this.generateUserActivityInsights(reportData);
          break;
        case 'application_performance':
          reportData = await this.generateApplicationPerformanceReport(period.startDate, period.endDate);
          visualizations = this.createApplicationVisualizations(reportData);
          insights = this.generateApplicationInsights(reportData);
          break;
        case 'search_analytics':
          reportData = await this.generateSearchAnalyticsReport(period.startDate, period.endDate);
          visualizations = this.createSearchVisualizations(reportData);
          insights = this.generateSearchInsights(reportData);
          break;
        case 'engagement':
          reportData = await this.generateEngagementReport(period.startDate, period.endDate);
          visualizations = this.createEngagementVisualizations(reportData);
          insights = this.generateEngagementInsights(reportData);
          break;
        case 'custom':
          reportData = await this.generateCustomReport(reportConfig.parameters, period.startDate, period.endDate);
          visualizations = this.createCustomVisualizations(reportData, reportConfig.parameters);
          insights = this.generateCustomInsights(reportData, reportConfig.parameters);
          break;
        default:
          throw new Error(`Unsupported report type: ${reportConfig.type}`);
      }

      // Create summary
      const summary = this.createReportSummary(reportData, reportConfig.type);

      const report: ReportData = {
        id: `report_${Date.now()}`,
        name: reportConfig.name,
        type: reportConfig.type,
        generatedAt: new Date(),
        period,
        data: reportData,
        summary,
        visualizations,
        insights
      };

      // Save report to database
      await this.saveReport(report);

      return report;

    } catch (error) {
      logger.error('Error generating report:', error);
      throw new Error('Failed to generate report');
    }
  }

  async generatePerformanceReport(period: 'day' | 'week' | 'month' = 'week'): Promise<PerformanceReport> {
    try {
      const { startDate, endDate } = this.calculateReportPeriod(period);
      const previousPeriod = this.calculatePreviousPeriod(startDate, endDate, period);
      
      // Get current period metrics
      const currentMetrics = await this.getPerformanceMetrics(startDate, endDate);
      
      // Get previous period metrics for comparison
      const previousMetrics = await this.getPerformanceMetrics(
        previousPeriod.startDate, 
        previousPeriod.endDate
      );

      // Calculate trends
      const trends = this.calculateTrends(currentMetrics, previousMetrics);
      
      // Generate recommendations
      const recommendations = this.generatePerformanceRecommendations(currentMetrics, trends);

      return {
        period: `${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`,
        metrics: currentMetrics,
        trends,
        comparisons: {
          previousPeriod: {
            metrics: previousMetrics,
            change: this.calculatePercentageChange(currentMetrics, previousMetrics)
          },
          yearOverYear: await this.getYearOverYearComparison(startDate, endDate)
        },
        recommendations
      };

    } catch (error) {
      logger.error('Error generating performance report:', error);
      throw new Error('Failed to generate performance report');
    }
  }

  async getReportHistory(limit: number = 50): Promise<ReportData[]> {
    try {
      const reports = await prisma.report.findMany({
        orderBy: { generatedAt: 'desc' },
        take: limit
      });

      return reports.map(report => ({
        id: report.id,
        name: report.name,
        type: report.type,
        generatedAt: report.generatedAt,
        period: report.period as any,
        data: report.data,
        summary: report.summary,
        visualizations: report.visualizations as any[],
        insights: report.insights as string[]
      }));

    } catch (error) {
      logger.error('Error getting report history:', error);
      return [];
    }
  }

  async getReportById(reportId: string): Promise<ReportData | null> {
    try {
      const report = await prisma.report.findUnique({
        where: { id: reportId }
      });

      if (!report) return null;

      return {
        id: report.id,
        name: report.name,
        type: report.type,
        generatedAt: report.generatedAt,
        period: report.period as any,
        data: report.data,
        summary: report.summary,
        visualizations: report.visualizations as any[],
        insights: report.insights as string[]
      };

    } catch (error) {
      logger.error('Error getting report by ID:', error);
      return null;
    }
  }

  async scheduleReport(reportConfig: ReportConfig): Promise<string> {
    try {
      const scheduledReport = await prisma.scheduledReport.create({
        data: {
          name: reportConfig.name,
          description: reportConfig.description,
          type: reportConfig.type,
          schedule: reportConfig.schedule,
          recipients: reportConfig.recipients,
          parameters: reportConfig.parameters,
          isActive: reportConfig.isActive,
          nextRun: this.calculateNextRun(reportConfig.schedule)
        }
      });

      logger.info('Report scheduled', { 
        reportId: scheduledReport.id, 
        name: reportConfig.name 
      });

      return scheduledReport.id;

    } catch (error) {
      logger.error('Error scheduling report:', error);
      throw new Error('Failed to schedule report');
    }
  }

  async exportReport(reportId: string, format: 'json' | 'csv' | 'pdf' = 'json'): Promise<Buffer | string> {
    try {
      const report = await this.getReportById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      switch (format) {
        case 'json':
          return JSON.stringify(report, null, 2);
        case 'csv':
          return this.convertToCSV(report);
        case 'pdf':
          return await this.generatePDF(report);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

    } catch (error) {
      logger.error('Error exporting report:', error);
      throw new Error('Failed to export report');
    }
  }

  private async generateUserActivityReport(startDate: Date, endDate: Date): Promise<any> {
    const userMetrics = await this.metricsService.queryMetrics({
      metricNames: ['users.total', 'users.active', 'users.new', 'users.students', 'users.recommenders'],
      startTime: startDate,
      endTime: endDate
    });

    return {
      totalUsers: this.getLatestMetricValue(userMetrics, 'users.total'),
      activeUsers: this.getLatestMetricValue(userMetrics, 'users.active'),
      newUsers: this.getLatestMetricValue(userMetrics, 'users.new'),
      studentCount: this.getLatestMetricValue(userMetrics, 'users.students'),
      recommenderCount: this.getLatestMetricValue(userMetrics, 'users.recommenders'),
      userGrowthRate: this.calculateGrowthRate(userMetrics, 'users.total'),
      activationRate: this.calculateActivationRate(userMetrics),
      retentionRate: await this.calculateRetentionRate(startDate, endDate)
    };
  }

  private async generateApplicationPerformanceReport(startDate: Date, endDate: Date): Promise<any> {
    const appMetrics = await this.metricsService.queryMetrics({
      metricNames: ['applications.total', 'applications.submitted', 'applications.in_progress', 'applications.completed', 'applications.success_rate'],
      startTime: startDate,
      endTime: endDate
    });

    return {
      totalApplications: this.getLatestMetricValue(appMetrics, 'applications.total'),
      submittedApplications: this.getLatestMetricValue(appMetrics, 'applications.submitted'),
      inProgressApplications: this.getLatestMetricValue(appMetrics, 'applications.in_progress'),
      completedApplications: this.getLatestMetricValue(appMetrics, 'applications.completed'),
      successRate: this.getLatestMetricValue(appMetrics, 'applications.success_rate'),
      completionRate: this.calculateCompletionRate(appMetrics),
      averageTimeToComplete: await this.calculateAverageCompletionTime(startDate, endDate)
    };
  }

  private async generateSearchAnalyticsReport(startDate: Date, endDate: Date): Promise<any> {
    const searchMetrics = await this.metricsService.queryMetrics({
      metricNames: ['search.queries', 'search.avg_response_time', 'search.click_through_rate', 'search.zero_results'],
      startTime: startDate,
      endTime: endDate
    });

    return {
      totalQueries: this.getLatestMetricValue(searchMetrics, 'search.queries'),
      averageResponseTime: this.getLatestMetricValue(searchMetrics, 'search.avg_response_time'),
      clickThroughRate: this.getLatestMetricValue(searchMetrics, 'search.click_through_rate'),
      zeroResultsRate: this.calculateZeroResultsRate(searchMetrics),
      popularQueries: await this.getPopularQueries(startDate, endDate),
      searchEfficiency: this.calculateSearchEfficiency(searchMetrics)
    };
  }

  private async generateEngagementReport(startDate: Date, endDate: Date): Promise<any> {
    const engagementMetrics = await this.metricsService.queryMetrics({
      metricNames: ['engagement.page_views', 'engagement.session_duration', 'engagement.bounce_rate', 'engagement.interactions'],
      startTime: startDate,
      endTime: endDate
    });

    return {
      pageViews: this.getLatestMetricValue(engagementMetrics, 'engagement.page_views'),
      averageSessionDuration: this.getLatestMetricValue(engagementMetrics, 'engagement.session_duration'),
      bounceRate: this.getLatestMetricValue(engagementMetrics, 'engagement.bounce_rate'),
      totalInteractions: this.getLatestMetricValue(engagementMetrics, 'engagement.interactions'),
      engagementScore: this.calculateEngagementScore(engagementMetrics),
      topContent: await this.getTopContent(startDate, endDate)
    };
  }

  private async generateCustomReport(parameters: Record<string, any>, startDate: Date, endDate: Date): Promise<any> {
    const metrics = await this.metricsService.queryMetrics({
      metricNames: parameters.metricNames || [],
      startTime: startDate,
      endTime: endDate,
      dimensions: parameters.dimensions,
      aggregation: parameters.aggregation,
      groupBy: parameters.groupBy
    });

    return {
      metrics,
      parameters,
      customAnalysis: this.performCustomAnalysis(metrics, parameters)
    };
  }

  private calculateReportPeriod(schedule: string, startDate?: Date, endDate?: Date): { startDate: Date; endDate: Date } {
    if (startDate && endDate) {
      return { startDate, endDate };
    }

    const now = new Date();
    
    switch (schedule) {
      case 'daily':
        return {
          startDate: startOfDay(now),
          endDate: endOfDay(now)
        };
      case 'weekly':
        return {
          startDate: startOfWeek(now),
          endDate: endOfWeek(now)
        };
      case 'monthly':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now)
        };
      default:
        return {
          startDate: subDays(now, 7),
          endDate: now
        };
    }
  }

  private calculatePreviousPeriod(startDate: Date, endDate: Date, period: string): { startDate: Date; endDate: Date } {
    const duration = endDate.getTime() - startDate.getTime();
    
    return {
      startDate: new Date(startDate.getTime() - duration),
      endDate: new Date(endDate.getTime() - duration)
    };
  }

  private async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<any> {
    const [userMetrics, appMetrics, searchMetrics, engagementMetrics] = await Promise.all([
      this.generateUserActivityReport(startDate, endDate),
      this.generateApplicationPerformanceReport(startDate, endDate),
      this.generateSearchAnalyticsReport(startDate, endDate),
      this.generateEngagementReport(startDate, endDate)
    ]);

    return {
      userGrowth: userMetrics.userGrowthRate || 0,
      applicationSuccess: appMetrics.successRate || 0,
      searchEfficiency: searchMetrics.searchEfficiency || 0,
      userEngagement: engagementMetrics.engagementScore || 0
    };
  }

  private calculateTrends(current: any, previous: any): any {
    return {
      userGrowthTrend: this.getTrend(current.userGrowth, previous.userGrowth),
      applicationTrend: this.getTrend(current.applicationSuccess, previous.applicationSuccess),
      searchTrend: this.getTrend(current.searchEfficiency, previous.searchEfficiency),
      engagementTrend: this.getTrend(current.userEngagement, previous.userEngagement)
    };
  }

  private getTrend(current: number, previous: number): 'up' | 'down' | 'stable' {
    const threshold = 0.05; // 5% threshold for stability
    const change = (current - previous) / previous;
    
    if (Math.abs(change) < threshold) return 'stable';
    return change > 0 ? 'up' : 'down';
  }

  private generatePerformanceRecommendations(metrics: any, trends: any): string[] {
    const recommendations: string[] = [];

    if (trends.userGrowthTrend === 'down') {
      recommendations.push('Consider implementing user acquisition campaigns to boost growth');
    }

    if (metrics.applicationSuccess < 0.7) {
      recommendations.push('Review application process to improve success rates');
    }

    if (trends.searchTrend === 'down') {
      recommendations.push('Optimize search algorithms and user experience');
    }

    if (metrics.userEngagement < 0.6) {
      recommendations.push('Enhance content and features to improve user engagement');
    }

    return recommendations;
  }

  // Helper methods for calculations and data processing
  private getLatestMetricValue(metrics: any[], metricName: string): number {
    const metric = metrics.find(m => m.metricName === metricName);
    return metric ? metric.value : 0;
  }

  private calculateGrowthRate(metrics: any[], metricName: string): number {
    // Simplified growth rate calculation
    return 0.05; // 5% placeholder
  }

  private calculateActivationRate(metrics: any[]): number {
    const activeUsers = this.getLatestMetricValue(metrics, 'users.active');
    const totalUsers = this.getLatestMetricValue(metrics, 'users.total');
    return totalUsers > 0 ? activeUsers / totalUsers : 0;
  }

  private async calculateRetentionRate(startDate: Date, endDate: Date): Promise<number> {
    // Placeholder for retention rate calculation
    return 0.8; // 80% placeholder
  }

  private calculateCompletionRate(metrics: any[]): number {
    const completed = this.getLatestMetricValue(metrics, 'applications.completed');
    const total = this.getLatestMetricValue(metrics, 'applications.total');
    return total > 0 ? completed / total : 0;
  }

  private async calculateAverageCompletionTime(startDate: Date, endDate: Date): Promise<number> {
    // Placeholder for average completion time calculation
    return 14; // 14 days placeholder
  }

  private calculateZeroResultsRate(metrics: any[]): number {
    const zeroResults = this.getLatestMetricValue(metrics, 'search.zero_results');
    const totalQueries = this.getLatestMetricValue(metrics, 'search.queries');
    return totalQueries > 0 ? zeroResults / totalQueries : 0;
  }

  private async getPopularQueries(startDate: Date, endDate: Date): Promise<string[]> {
    // Placeholder for popular queries
    return ['computer science', 'scholarships', 'harvard university'];
  }

  private calculateSearchEfficiency(metrics: any[]): number {
    const ctr = this.getLatestMetricValue(metrics, 'search.click_through_rate');
    const responseTime = this.getLatestMetricValue(metrics, 'search.avg_response_time');
    
    // Efficiency score based on CTR and response time
    const ctrScore = Math.min(ctr * 10, 1); // Normalize CTR
    const speedScore = Math.max(0, 1 - (responseTime / 1000)); // Penalize slow responses
    
    return (ctrScore + speedScore) / 2;
  }

  private calculateEngagementScore(metrics: any[]): number {
    const bounceRate = this.getLatestMetricValue(metrics, 'engagement.bounce_rate');
    const sessionDuration = this.getLatestMetricValue(metrics, 'engagement.session_duration');
    
    // Engagement score based on bounce rate and session duration
    const bounceScore = Math.max(0, 1 - bounceRate);
    const durationScore = Math.min(sessionDuration / 300, 1); // Normalize to 5 minutes
    
    return (bounceScore + durationScore) / 2;
  }

  private async getTopContent(startDate: Date, endDate: Date): Promise<any[]> {
    // Placeholder for top content
    return [
      { title: 'University Rankings', views: 1500 },
      { title: 'Scholarship Guide', views: 1200 },
      { title: 'Application Tips', views: 1000 }
    ];
  }

  private performCustomAnalysis(metrics: any[], parameters: Record<string, any>): any {
    // Placeholder for custom analysis
    return {
      totalDataPoints: metrics.length,
      averageValue: metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length,
      parameters
    };
  }

  private createReportSummary(data: any, type: string): any {
    return {
      type,
      keyMetrics: Object.keys(data).slice(0, 5),
      generatedAt: new Date(),
      dataPoints: Object.keys(data).length
    };
  }

  private createUserActivityVisualizations(data: any): any[] {
    return [
      {
        type: 'line_chart',
        title: 'User Growth Over Time',
        data: { /* chart data */ }
      },
      {
        type: 'pie_chart',
        title: 'User Type Distribution',
        data: { /* chart data */ }
      }
    ];
  }

  private createApplicationVisualizations(data: any): any[] {
    return [
      {
        type: 'bar_chart',
        title: 'Application Status Distribution',
        data: { /* chart data */ }
      }
    ];
  }

  private createSearchVisualizations(data: any): any[] {
    return [
      {
        type: 'line_chart',
        title: 'Search Performance Trends',
        data: { /* chart data */ }
      }
    ];
  }

  private createEngagementVisualizations(data: any): any[] {
    return [
      {
        type: 'area_chart',
        title: 'Engagement Metrics',
        data: { /* chart data */ }
      }
    ];
  }

  private createCustomVisualizations(data: any, parameters: Record<string, any>): any[] {
    return [
      {
        type: 'custom_chart',
        title: 'Custom Analysis',
        data: { /* chart data */ }
      }
    ];
  }

  private generateUserActivityInsights(data: any): string[] {
    const insights: string[] = [];
    
    if (data.userGrowthRate > 0.1) {
      insights.push('Strong user growth indicates successful acquisition strategies');
    }
    
    if (data.activationRate < 0.5) {
      insights.push('Low activation rate suggests need for improved onboarding');
    }

    return insights;
  }

  private generateApplicationInsights(data: any): string[] {
    const insights: string[] = [];
    
    if (data.successRate > 0.8) {
      insights.push('High application success rate indicates effective guidance');
    }

    return insights;
  }

  private generateSearchInsights(data: any): string[] {
    const insights: string[] = [];
    
    if (data.clickThroughRate < 0.3) {
      insights.push('Low click-through rate suggests search results need improvement');
    }

    return insights;
  }

  private generateEngagementInsights(data: any): string[] {
    const insights: string[] = [];
    
    if (data.bounceRate > 0.6) {
      insights.push('High bounce rate indicates content or UX issues');
    }

    return insights;
  }

  private generateCustomInsights(data: any, parameters: Record<string, any>): string[] {
    return ['Custom analysis completed with provided parameters'];
  }

  private calculatePercentageChange(current: any, previous: any): any {
    const changes: any = {};
    
    Object.keys(current).forEach(key => {
      if (previous[key] !== undefined && previous[key] !== 0) {
        changes[key] = ((current[key] - previous[key]) / previous[key]) * 100;
      }
    });

    return changes;
  }

  private async getYearOverYearComparison(startDate: Date, endDate: Date): Promise<any> {
    // Placeholder for year-over-year comparison
    return {
      userGrowth: 15.5,
      applicationSuccess: 8.2,
      searchEfficiency: -2.1,
      userEngagement: 12.3
    };
  }

  private calculateNextRun(schedule: string): Date {
    const now = new Date();
    
    switch (schedule) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  private async saveReport(report: ReportData): Promise<void> {
    try {
      await prisma.report.create({
        data: {
          id: report.id,
          name: report.name,
          type: report.type,
          generatedAt: report.generatedAt,
          period: report.period,
          data: report.data,
          summary: report.summary,
          visualizations: report.visualizations,
          insights: report.insights
        }
      });
    } catch (error) {
      logger.error('Error saving report:', error);
    }
  }

  private convertToCSV(report: ReportData): string {
    // Simplified CSV conversion
    const headers = Object.keys(report.data);
    const values = Object.values(report.data);
    
    return `${headers.join(',')}\n${values.join(',')}`;
  }

  private async generatePDF(report: ReportData): Promise<Buffer> {
    // Placeholder for PDF generation
    return Buffer.from('PDF content placeholder');
  }
}