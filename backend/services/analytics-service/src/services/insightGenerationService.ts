import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { MetricsCollectionService } from './metricsCollectionService';
import { subDays, format, differenceInDays } from 'date-fns';
import * as ss from 'simple-statistics';

const prisma = new PrismaClient();

export interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'correlation' | 'prediction' | 'recommendation';
  category: 'user_behavior' | 'performance' | 'business' | 'technical' | 'engagement';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1
  impact: 'positive' | 'negative' | 'neutral';
  metrics: string[];
  data: any;
  recommendations: string[];
  createdAt: Date;
  expiresAt?: Date;
}

export interface TrendAnalysis {
  metric: string;
  period: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  slope: number;
  correlation: number;
  seasonality?: {
    detected: boolean;
    period?: number;
    strength?: number;
  };
  forecast?: {
    nextValue: number;
    confidence: number;
    range: { min: number; max: number };
  };
}

export interface AnomalyDetection {
  metric: string;
  timestamp: Date;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
  type: 'spike' | 'drop' | 'outlier';
}

export interface CorrelationAnalysis {
  metric1: string;
  metric2: string;
  correlation: number;
  significance: number;
  relationship: 'strong_positive' | 'weak_positive' | 'none' | 'weak_negative' | 'strong_negative';
  insights: string[];
}

export class InsightGenerationService {
  private metricsService: MetricsCollectionService;
  private readonly INSIGHT_CACHE_TTL = 3600000; // 1 hour

  constructor() {
    this.metricsService = new MetricsCollectionService();
    this.startInsightGeneration();
  }

  async generateInsights(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<Insight[]> {
    try {
      logger.info('Generating insights', { timeframe });

      const insights: Insight[] = [];
      const endTime = new Date();
      let startTime: Date;

      switch (timeframe) {
        case 'day':
          startTime = subDays(endTime, 1);
          break;
        case 'week':
          startTime = subDays(endTime, 7);
          break;
        case 'month':
          startTime = subDays(endTime, 30);
          break;
      }

      // Generate different types of insights
      const [
        trendInsights,
        anomalyInsights,
        correlationInsights,
        performanceInsights,
        businessInsights
      ] = await Promise.all([
        this.generateTrendInsights(startTime, endTime),
        this.generateAnomalyInsights(startTime, endTime),
        this.generateCorrelationInsights(startTime, endTime),
        this.generatePerformanceInsights(startTime, endTime),
        this.generateBusinessInsights(startTime, endTime)
      ]);

      insights.push(
        ...trendInsights,
        ...anomalyInsights,
        ...correlationInsights,
        ...performanceInsights,
        ...businessInsights
      );

      // Sort by severity and confidence
      insights.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.confidence - a.confidence;
      });

      // Save insights to database
      await this.saveInsights(insights);

      return insights;

    } catch (error) {
      logger.error('Error generating insights:', error);
      return [];
    }
  }

  async getTrendAnalysis(metricName: string, period: 'week' | 'month' | 'quarter' = 'month'): Promise<TrendAnalysis | null> {
    try {
      const endTime = new Date();
      let startTime: Date;
      let periodDays: number;

      switch (period) {
        case 'week':
          startTime = subDays(endTime, 7);
          periodDays = 7;
          break;
        case 'month':
          startTime = subDays(endTime, 30);
          periodDays = 30;
          break;
        case 'quarter':
          startTime = subDays(endTime, 90);
          periodDays = 90;
          break;
      }

      const metrics = await this.metricsService.queryMetrics({
        metricNames: [metricName],
        startTime,
        endTime,
        groupBy: ['timestamp']
      });

      if (metrics.length < 3) {
        return null;
      }

      // Prepare data for analysis
      const values = metrics.map(m => m.value);
      const timestamps = metrics.map(m => new Date(m.timestamp).getTime());

      // Calculate trend
      const regression = ss.linearRegression(timestamps.map((t, i) => [i, values[i]]));
      const slope = regression.m;
      const correlation = ss.sampleCorrelation(timestamps.map((_, i) => i), values);

      // Determine trend direction
      let trend: TrendAnalysis['trend'];
      if (Math.abs(slope) < 0.01) {
        trend = 'stable';
      } else if (slope > 0) {
        trend = 'increasing';
      } else {
        trend = 'decreasing';
      }

      // Check for volatility
      const volatility = ss.standardDeviation(values) / ss.mean(values);
      if (volatility > 0.3) {
        trend = 'volatile';
      }

      // Detect seasonality (simplified)
      const seasonality = this.detectSeasonality(values, periodDays);

      // Generate forecast
      const forecast = this.generateForecast(values, regression);

      return {
        metric: metricName,
        period,
        trend,
        slope,
        correlation,
        seasonality,
        forecast
      };

    } catch (error) {
      logger.error('Error in trend analysis:', error);
      return null;
    }
  }

  async detectAnomalies(metricName: string, lookbackDays: number = 30): Promise<AnomalyDetection[]> {
    try {
      const endTime = new Date();
      const startTime = subDays(endTime, lookbackDays);

      const metrics = await this.metricsService.queryMetrics({
        metricNames: [metricName],
        startTime,
        endTime
      });

      if (metrics.length < 10) {
        return [];
      }

      const values = metrics.map(m => m.value);
      const mean = ss.mean(values);
      const stdDev = ss.standardDeviation(values);
      const threshold = 2 * stdDev; // 2 standard deviations

      const anomalies: AnomalyDetection[] = [];

      metrics.forEach((metric, index) => {
        const deviation = Math.abs(metric.value - mean);
        
        if (deviation > threshold) {
          let severity: AnomalyDetection['severity'];
          let type: AnomalyDetection['type'];

          // Determine severity
          if (deviation > 3 * stdDev) {
            severity = 'high';
          } else if (deviation > 2.5 * stdDev) {
            severity = 'medium';
          } else {
            severity = 'low';
          }

          // Determine type
          if (metric.value > mean + threshold) {
            type = 'spike';
          } else if (metric.value < mean - threshold) {
            type = 'drop';
          } else {
            type = 'outlier';
          }

          anomalies.push({
            metric: metricName,
            timestamp: new Date(metric.timestamp),
            value: metric.value,
            expectedValue: mean,
            deviation,
            severity,
            type
          });
        }
      });

      return anomalies;

    } catch (error) {
      logger.error('Error detecting anomalies:', error);
      return [];
    }
  }

  async analyzeCorrelations(metricNames: string[], period: 'week' | 'month' = 'month'): Promise<CorrelationAnalysis[]> {
    try {
      const endTime = new Date();
      const startTime = subDays(endTime, period === 'week' ? 7 : 30);

      const correlations: CorrelationAnalysis[] = [];

      // Get all metric combinations
      for (let i = 0; i < metricNames.length; i++) {
        for (let j = i + 1; j < metricNames.length; j++) {
          const metric1 = metricNames[i];
          const metric2 = metricNames[j];

          const [metrics1, metrics2] = await Promise.all([
            this.metricsService.queryMetrics({
              metricNames: [metric1],
              startTime,
              endTime
            }),
            this.metricsService.queryMetrics({
              metricNames: [metric2],
              startTime,
              endTime
            })
          ]);

          if (metrics1.length < 5 || metrics2.length < 5) continue;

          // Align metrics by timestamp
          const alignedData = this.alignMetricsByTimestamp(metrics1, metrics2);
          
          if (alignedData.length < 5) continue;

          const values1 = alignedData.map(d => d.value1);
          const values2 = alignedData.map(d => d.value2);

          const correlation = ss.sampleCorrelation(values1, values2);
          const significance = this.calculateSignificance(correlation, alignedData.length);

          let relationship: CorrelationAnalysis['relationship'];
          if (Math.abs(correlation) < 0.3) {
            relationship = 'none';
          } else if (correlation >= 0.7) {
            relationship = 'strong_positive';
          } else if (correlation >= 0.3) {
            relationship = 'weak_positive';
          } else if (correlation <= -0.7) {
            relationship = 'strong_negative';
          } else {
            relationship = 'weak_negative';
          }

          const insights = this.generateCorrelationInsights(metric1, metric2, correlation, relationship);

          correlations.push({
            metric1,
            metric2,
            correlation,
            significance,
            relationship,
            insights
          });
        }
      }

      return correlations.filter(c => Math.abs(c.correlation) > 0.3); // Only significant correlations

    } catch (error) {
      logger.error('Error analyzing correlations:', error);
      return [];
    }
  }

  async getInsightHistory(category?: string, limit: number = 50): Promise<Insight[]> {
    try {
      const whereClause: any = {};
      if (category) {
        whereClause.category = category;
      }

      const insights = await prisma.insight.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return insights.map(insight => ({
        id: insight.id,
        type: insight.type as Insight['type'],
        category: insight.category as Insight['category'],
        title: insight.title,
        description: insight.description,
        severity: insight.severity as Insight['severity'],
        confidence: insight.confidence,
        impact: insight.impact as Insight['impact'],
        metrics: insight.metrics as string[],
        data: insight.data,
        recommendations: insight.recommendations as string[],
        createdAt: insight.createdAt,
        expiresAt: insight.expiresAt
      }));

    } catch (error) {
      logger.error('Error getting insight history:', error);
      return [];
    }
  }

  private async generateTrendInsights(startTime: Date, endTime: Date): Promise<Insight[]> {
    const insights: Insight[] = [];
    const keyMetrics = [
      'users.total',
      'users.active',
      'applications.success_rate',
      'search.click_through_rate',
      'engagement.session_duration'
    ];

    for (const metric of keyMetrics) {
      const trendAnalysis = await this.getTrendAnalysis(metric, 'month');
      
      if (trendAnalysis && Math.abs(trendAnalysis.slope) > 0.05) {
        const isPositive = trendAnalysis.slope > 0;
        const metricDisplayName = this.getMetricDisplayName(metric);

        insights.push({
          id: `trend_${metric}_${Date.now()}`,
          type: 'trend',
          category: this.getMetricCategory(metric),
          title: `${metricDisplayName} ${isPositive ? 'Increasing' : 'Decreasing'} Trend`,
          description: `${metricDisplayName} has been ${trendAnalysis.trend} over the past month with a ${isPositive ? 'positive' : 'negative'} slope of ${Math.abs(trendAnalysis.slope).toFixed(3)}.`,
          severity: Math.abs(trendAnalysis.slope) > 0.2 ? 'high' : 'medium',
          confidence: Math.abs(trendAnalysis.correlation),
          impact: isPositive ? 'positive' : 'negative',
          metrics: [metric],
          data: trendAnalysis,
          recommendations: this.generateTrendRecommendations(metric, trendAnalysis),
          createdAt: new Date()
        });
      }
    }

    return insights;
  }

  private async generateAnomalyInsights(startTime: Date, endTime: Date): Promise<Insight[]> {
    const insights: Insight[] = [];
    const keyMetrics = [
      'users.active',
      'applications.submitted',
      'search.queries',
      'system.error_rate'
    ];

    for (const metric of keyMetrics) {
      const anomalies = await this.detectAnomalies(metric, 7);
      
      for (const anomaly of anomalies) {
        if (anomaly.severity === 'high' || anomaly.severity === 'medium') {
          const metricDisplayName = this.getMetricDisplayName(metric);

          insights.push({
            id: `anomaly_${metric}_${anomaly.timestamp.getTime()}`,
            type: 'anomaly',
            category: this.getMetricCategory(metric),
            title: `${metricDisplayName} ${anomaly.type.charAt(0).toUpperCase() + anomaly.type.slice(1)} Detected`,
            description: `Unusual ${anomaly.type} in ${metricDisplayName}: ${anomaly.value} (expected ~${anomaly.expectedValue.toFixed(2)})`,
            severity: anomaly.severity,
            confidence: Math.min(anomaly.deviation / anomaly.expectedValue, 1),
            impact: anomaly.type === 'spike' ? 'positive' : 'negative',
            metrics: [metric],
            data: anomaly,
            recommendations: this.generateAnomalyRecommendations(metric, anomaly),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          });
        }
      }
    }

    return insights;
  }

  private async generateCorrelationInsights(startTime: Date, endTime: Date): Promise<Insight[]> {
    const insights: Insight[] = [];
    const metricGroups = [
      ['users.active', 'applications.submitted'],
      ['search.click_through_rate', 'engagement.session_duration'],
      ['applications.success_rate', 'users.active']
    ];

    for (const group of metricGroups) {
      const correlations = await this.analyzeCorrelations(group, 'month');
      
      for (const correlation of correlations) {
        if (Math.abs(correlation.correlation) > 0.5) {
          insights.push({
            id: `correlation_${correlation.metric1}_${correlation.metric2}_${Date.now()}`,
            type: 'correlation',
            category: 'business',
            title: `${correlation.relationship.replace('_', ' ').toUpperCase()} correlation found`,
            description: `${this.getMetricDisplayName(correlation.metric1)} and ${this.getMetricDisplayName(correlation.metric2)} show ${correlation.relationship.replace('_', ' ')} correlation (${correlation.correlation.toFixed(3)})`,
            severity: Math.abs(correlation.correlation) > 0.7 ? 'high' : 'medium',
            confidence: correlation.significance,
            impact: 'neutral',
            metrics: [correlation.metric1, correlation.metric2],
            data: correlation,
            recommendations: correlation.insights,
            createdAt: new Date()
          });
        }
      }
    }

    return insights;
  }

  private async generatePerformanceInsights(startTime: Date, endTime: Date): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Check system performance metrics
    const performanceMetrics = await this.metricsService.queryMetrics({
      metricNames: ['system.response_time', 'system.error_rate', 'search.avg_response_time'],
      startTime,
      endTime
    });

    // Response time insight
    const responseTimeMetrics = performanceMetrics.filter(m => m.metricName === 'system.response_time');
    if (responseTimeMetrics.length > 0) {
      const avgResponseTime = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length;
      
      if (avgResponseTime > 1000) { // > 1 second
        insights.push({
          id: `performance_response_time_${Date.now()}`,
          type: 'recommendation',
          category: 'performance',
          title: 'High Response Time Detected',
          description: `Average response time is ${avgResponseTime.toFixed(0)}ms, which may impact user experience.`,
          severity: avgResponseTime > 2000 ? 'high' : 'medium',
          confidence: 0.9,
          impact: 'negative',
          metrics: ['system.response_time'],
          data: { avgResponseTime, threshold: 1000 },
          recommendations: [
            'Optimize database queries',
            'Implement caching strategies',
            'Scale infrastructure if needed',
            'Review and optimize slow endpoints'
          ],
          createdAt: new Date()
        });
      }
    }

    return insights;
  }

  private async generateBusinessInsights(startTime: Date, endTime: Date): Promise<Insight[]> {
    const insights: Insight[] = [];

    // User engagement insight
    const engagementMetrics = await this.metricsService.queryMetrics({
      metricNames: ['engagement.session_duration', 'engagement.bounce_rate'],
      startTime,
      endTime
    });

    const sessionDurationMetrics = engagementMetrics.filter(m => m.metricName === 'engagement.session_duration');
    const bounceRateMetrics = engagementMetrics.filter(m => m.metricName === 'engagement.bounce_rate');

    if (sessionDurationMetrics.length > 0 && bounceRateMetrics.length > 0) {
      const avgSessionDuration = sessionDurationMetrics.reduce((sum, m) => sum + m.value, 0) / sessionDurationMetrics.length;
      const avgBounceRate = bounceRateMetrics.reduce((sum, m) => sum + m.value, 0) / bounceRateMetrics.length;

      if (avgBounceRate > 0.6) { // > 60% bounce rate
        insights.push({
          id: `business_engagement_${Date.now()}`,
          type: 'recommendation',
          category: 'engagement',
          title: 'High Bounce Rate Detected',
          description: `Bounce rate is ${(avgBounceRate * 100).toFixed(1)}% with average session duration of ${(avgSessionDuration / 60).toFixed(1)} minutes.`,
          severity: avgBounceRate > 0.7 ? 'high' : 'medium',
          confidence: 0.8,
          impact: 'negative',
          metrics: ['engagement.bounce_rate', 'engagement.session_duration'],
          data: { avgBounceRate, avgSessionDuration },
          recommendations: [
            'Improve landing page content and design',
            'Optimize page load times',
            'Enhance user onboarding experience',
            'Review and improve content relevance'
          ],
          createdAt: new Date()
        });
      }
    }

    return insights;
  }

  private detectSeasonality(values: number[], periodDays: number): TrendAnalysis['seasonality'] {
    // Simplified seasonality detection
    if (values.length < 14) {
      return { detected: false };
    }

    // Check for weekly patterns (7-day cycle)
    if (periodDays >= 14) {
      const weeklyPattern = this.checkCyclicalPattern(values, 7);
      if (weeklyPattern.strength > 0.3) {
        return {
          detected: true,
          period: 7,
          strength: weeklyPattern.strength
        };
      }
    }

    return { detected: false };
  }

  private checkCyclicalPattern(values: number[], period: number): { strength: number } {
    if (values.length < period * 2) {
      return { strength: 0 };
    }

    const cycles = Math.floor(values.length / period);
    const correlations: number[] = [];

    for (let i = 0; i < cycles - 1; i++) {
      const cycle1 = values.slice(i * period, (i + 1) * period);
      const cycle2 = values.slice((i + 1) * period, (i + 2) * period);
      
      if (cycle1.length === cycle2.length) {
        const correlation = ss.sampleCorrelation(cycle1, cycle2);
        if (!isNaN(correlation)) {
          correlations.push(correlation);
        }
      }
    }

    const avgCorrelation = correlations.length > 0 
      ? correlations.reduce((sum, c) => sum + c, 0) / correlations.length 
      : 0;

    return { strength: Math.max(0, avgCorrelation) };
  }

  private generateForecast(values: number[], regression: any): TrendAnalysis['forecast'] {
    const nextIndex = values.length;
    const nextValue = regression.m * nextIndex + regression.b;
    
    // Calculate confidence based on R-squared
    const predicted = values.map((_, i) => regression.m * i + regression.b);
    const residuals = values.map((v, i) => v - predicted[i]);
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length;
    const confidence = Math.max(0, 1 - (mse / ss.variance(values)));

    const margin = Math.sqrt(mse) * 1.96; // 95% confidence interval

    return {
      nextValue,
      confidence,
      range: {
        min: nextValue - margin,
        max: nextValue + margin
      }
    };
  }

  private alignMetricsByTimestamp(metrics1: any[], metrics2: any[]): Array<{ value1: number; value2: number; timestamp: Date }> {
    const aligned: Array<{ value1: number; value2: number; timestamp: Date }> = [];
    
    // Create timestamp maps
    const map1 = new Map(metrics1.map(m => [m.timestamp.getTime(), m.value]));
    const map2 = new Map(metrics2.map(m => [m.timestamp.getTime(), m.value]));

    // Find common timestamps
    const commonTimestamps = [...map1.keys()].filter(t => map2.has(t));

    commonTimestamps.forEach(timestamp => {
      aligned.push({
        value1: map1.get(timestamp)!,
        value2: map2.get(timestamp)!,
        timestamp: new Date(timestamp)
      });
    });

    return aligned;
  }

  private calculateSignificance(correlation: number, sampleSize: number): number {
    // Simplified significance calculation
    const tStat = Math.abs(correlation) * Math.sqrt((sampleSize - 2) / (1 - correlation * correlation));
    return Math.min(1, tStat / 2); // Normalized to 0-1
  }

  private generateCorrelationInsights(metric1: string, metric2: string, correlation: number, relationship: string): string[] {
    const insights: string[] = [];
    
    if (relationship.includes('positive')) {
      insights.push(`When ${this.getMetricDisplayName(metric1)} increases, ${this.getMetricDisplayName(metric2)} tends to increase as well`);
    } else if (relationship.includes('negative')) {
      insights.push(`When ${this.getMetricDisplayName(metric1)} increases, ${this.getMetricDisplayName(metric2)} tends to decrease`);
    }

    if (relationship.includes('strong')) {
      insights.push('This is a strong relationship that can be leveraged for predictions and optimization');
    }

    return insights;
  }

  private generateTrendRecommendations(metric: string, trend: TrendAnalysis): string[] {
    const recommendations: string[] = [];
    const isIncreasing = trend.slope > 0;

    switch (metric) {
      case 'users.total':
        if (isIncreasing) {
          recommendations.push('Continue current user acquisition strategies');
          recommendations.push('Prepare infrastructure for increased load');
        } else {
          recommendations.push('Review and improve user acquisition campaigns');
          recommendations.push('Analyze user churn reasons');
        }
        break;
      case 'applications.success_rate':
        if (isIncreasing) {
          recommendations.push('Document and replicate successful practices');
        } else {
          recommendations.push('Review application process for bottlenecks');
          recommendations.push('Improve user guidance and support');
        }
        break;
      default:
        recommendations.push(`Monitor ${this.getMetricDisplayName(metric)} closely`);
    }

    return recommendations;
  }

  private generateAnomalyRecommendations(metric: string, anomaly: AnomalyDetection): string[] {
    const recommendations: string[] = [];

    if (anomaly.type === 'spike') {
      recommendations.push('Investigate the cause of the unusual increase');
      recommendations.push('Monitor system capacity and performance');
    } else if (anomaly.type === 'drop') {
      recommendations.push('Investigate potential issues causing the decrease');
      recommendations.push('Check for system outages or problems');
    }

    recommendations.push('Set up alerts for similar anomalies in the future');
    return recommendations;
  }

  private getMetricDisplayName(metric: string): string {
    const displayNames: Record<string, string> = {
      'users.total': 'Total Users',
      'users.active': 'Active Users',
      'applications.success_rate': 'Application Success Rate',
      'search.click_through_rate': 'Search Click-Through Rate',
      'engagement.session_duration': 'Session Duration',
      'system.response_time': 'System Response Time',
      'system.error_rate': 'Error Rate'
    };

    return displayNames[metric] || metric;
  }

  private getMetricCategory(metric: string): Insight['category'] {
    if (metric.startsWith('users.') || metric.startsWith('engagement.')) {
      return 'user_behavior';
    } else if (metric.startsWith('system.') || metric.includes('response_time')) {
      return 'performance';
    } else if (metric.startsWith('applications.') || metric.startsWith('search.')) {
      return 'business';
    } else {
      return 'technical';
    }
  }

  private async saveInsights(insights: Insight[]): Promise<void> {
    try {
      for (const insight of insights) {
        await prisma.insight.upsert({
          where: { id: insight.id },
          update: {
            confidence: insight.confidence,
            data: insight.data,
            recommendations: insight.recommendations
          },
          create: {
            id: insight.id,
            type: insight.type,
            category: insight.category,
            title: insight.title,
            description: insight.description,
            severity: insight.severity,
            confidence: insight.confidence,
            impact: insight.impact,
            metrics: insight.metrics,
            data: insight.data,
            recommendations: insight.recommendations,
            createdAt: insight.createdAt,
            expiresAt: insight.expiresAt
          }
        });
      }

      logger.info(`Saved ${insights.length} insights to database`);

    } catch (error) {
      logger.error('Error saving insights:', error);
    }
  }

  private startInsightGeneration(): void {
    // Generate insights every hour
    setInterval(() => {
      this.generateInsights('day').catch(error => {
        logger.error('Error in automated insight generation:', error);
      });
    }, 3600000); // 1 hour

    logger.info('Automated insight generation started');
  }
}