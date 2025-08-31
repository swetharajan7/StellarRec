import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { subDays, differenceInHours, differenceInDays, startOfDay, endOfDay } from 'date-fns';
import * as ss from 'simple-statistics';

const prisma = new PrismaClient();

export interface EffectivenessMetrics {
  userId?: string;
  timeframe: 'day' | 'week' | 'month' | 'quarter';
  overallEffectiveness: number; // 0-1
  responseRate: number; // 0-1
  averageResponseTime: number; // hours
  channelEffectiveness: Record<string, number>;
  timeEffectiveness: Record<string, number>;
  contentEffectiveness: Record<string, number>;
  improvementTrends: {
    direction: 'improving' | 'declining' | 'stable';
    rate: number; // percentage change
  };
}

export interface ReminderInteraction {
  id: string;
  reminderId: string;
  userId: string;
  interactionType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'responded' | 'completed' | 'dismissed';
  timestamp: Date;
  responseTime?: number; // hours from sent to response
  channel: string;
  content?: string;
  metadata: Record<string, any>;
}

export interface EffectivenessInsight {
  type: 'optimization' | 'warning' | 'success' | 'trend';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  actionable: boolean;
  recommendations: string[];
  confidence: number; // 0-1
}

export interface ABTestResult {
  testId: string;
  testName: string;
  variants: {
    name: string;
    effectiveness: number;
    sampleSize: number;
    confidence: number;
  }[];
  winner?: string;
  statisticalSignificance: number;
  recommendations: string[];
}

export class EffectivenessTrackingService {
  async trackReminderInteraction(interaction: Omit<ReminderInteraction, 'id'>): Promise<string> {
    try {
      logger.info('Tracking reminder interaction', { 
        reminderId: interaction.reminderId,
        type: interaction.interactionType 
      });

      const reminderInteraction = await prisma.reminderInteraction.create({
        data: {
          id: this.generateId(),
          reminderId: interaction.reminderId,
          userId: interaction.userId,
          interactionType: interaction.interactionType,
          timestamp: interaction.timestamp,
          responseTime: interaction.responseTime,
          channel: interaction.channel,
          content: interaction.content,
          metadata: interaction.metadata,
          createdAt: new Date()
        }
      });

      // Update effectiveness metrics asynchronously
      this.updateEffectivenessMetrics(interaction.userId, interaction);

      logger.info('Reminder interaction tracked', { 
        interactionId: reminderInteraction.id 
      });

      return reminderInteraction.id;

    } catch (error) {
      logger.error('Error tracking reminder interaction:', error);
      throw new Error(`Failed to track reminder interaction: ${error.message}`);
    }
  }

  async calculateEffectivenessMetrics(
    userId?: string,
    timeframe: 'day' | 'week' | 'month' | 'quarter' = 'month'
  ): Promise<EffectivenessMetrics> {
    try {
      logger.info('Calculating effectiveness metrics', { userId, timeframe });

      const days = this.getTimeframeDays(timeframe);
      const startDate = subDays(new Date(), days);

      const whereClause: any = {
        timestamp: { gte: startDate }
      };
      if (userId) {
        whereClause.userId = userId;
      }

      const interactions = await prisma.reminderInteraction.findMany({
        where: whereClause,
        include: {
          reminder: true
        }
      });

      const metrics = this.analyzeInteractions(interactions, timeframe);

      logger.info('Effectiveness metrics calculated', { 
        userId,
        overallEffectiveness: metrics.overallEffectiveness 
      });

      return metrics;

    } catch (error) {
      logger.error('Error calculating effectiveness metrics:', error);
      throw new Error(`Failed to calculate effectiveness metrics: ${error.message}`);
    }
  }

  async generateEffectivenessInsights(
    userId?: string,
    timeframe: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<EffectivenessInsight[]> {
    try {
      const metrics = await this.calculateEffectivenessMetrics(userId, timeframe);
      const historicalMetrics = await this.getHistoricalMetrics(userId, timeframe);
      
      const insights: EffectivenessInsight[] = [];

      // Analyze overall effectiveness
      if (metrics.overallEffectiveness < 0.3) {
        insights.push({
          type: 'warning',
          title: 'Low Overall Effectiveness',
          description: `Reminder effectiveness is ${Math.round(metrics.overallEffectiveness * 100)}%, which is below optimal levels.`,
          impact: 'high',
          actionable: true,
          recommendations: [
            'Review and optimize reminder timing',
            'Experiment with different communication channels',
            'Personalize reminder content based on user preferences'
          ],
          confidence: 0.9
        });
      }

      // Analyze response rate trends
      if (historicalMetrics.length > 1) {
        const trend = this.calculateTrend(historicalMetrics.map(m => m.responseRate));
        if (trend.direction === 'declining' && trend.rate > 10) {
          insights.push({
            type: 'warning',
            title: 'Declining Response Rate',
            description: `Response rate has declined by ${Math.round(trend.rate)}% over the past ${timeframe}.`,
            impact: 'medium',
            actionable: true,
            recommendations: [
              'Reduce reminder frequency to avoid fatigue',
              'Refresh reminder content and messaging',
              'Review timing preferences'
            ],
            confidence: 0.8
          });
        }
      }

      // Analyze channel effectiveness
      const bestChannel = Object.entries(metrics.channelEffectiveness)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (bestChannel && bestChannel[1] > 0.7) {
        insights.push({
          type: 'success',
          title: 'High-Performing Channel Identified',
          description: `${bestChannel[0]} channel shows ${Math.round(bestChannel[1] * 100)}% effectiveness.`,
          impact: 'medium',
          actionable: true,
          recommendations: [
            `Prioritize ${bestChannel[0]} for important reminders`,
            'Consider migrating more reminders to this channel'
          ],
          confidence: 0.8
        });
      }

      // Analyze timing effectiveness
      const bestTime = Object.entries(metrics.timeEffectiveness)
        .sort(([,a], [,b]) => b - a)[0];
      
      if (bestTime && bestTime[1] > 0.6) {
        insights.push({
          type: 'optimization',
          title: 'Optimal Timing Identified',
          description: `${bestTime[0]}:00 shows the highest response rate at ${Math.round(bestTime[1] * 100)}%.`,
          impact: 'medium',
          actionable: true,
          recommendations: [
            `Schedule important reminders around ${bestTime[0]}:00`,
            'Avoid scheduling reminders during low-response periods'
          ],
          confidence: 0.7
        });
      }

      // Analyze response time
      if (metrics.averageResponseTime > 48) {
        insights.push({
          type: 'optimization',
          title: 'Slow Response Time',
          description: `Average response time is ${Math.round(metrics.averageResponseTime)} hours.`,
          impact: 'low',
          actionable: true,
          recommendations: [
            'Consider more urgent reminder channels for time-sensitive items',
            'Implement escalation workflows for critical reminders'
          ],
          confidence: 0.6
        });
      }

      return insights;

    } catch (error) {
      logger.error('Error generating effectiveness insights:', error);
      throw new Error(`Failed to generate effectiveness insights: ${error.message}`);
    }
  }

  async runABTest(
    testName: string,
    variants: {
      name: string;
      reminderIds: string[];
    }[],
    duration: number = 7 // days
  ): Promise<string> {
    try {
      logger.info('Starting A/B test', { testName, variants: variants.length });

      const abTest = await prisma.abTest.create({
        data: {
          id: this.generateId(),
          testName,
          variants: variants.map(v => ({
            name: v.name,
            reminderIds: v.reminderIds,
            startDate: new Date(),
            endDate: addDays(new Date(), duration)
          })),
          status: 'running',
          startDate: new Date(),
          endDate: addDays(new Date(), duration),
          createdAt: new Date()
        }
      });

      logger.info('A/B test started', { testId: abTest.id });

      return abTest.id;

    } catch (error) {
      logger.error('Error starting A/B test:', error);
      throw new Error(`Failed to start A/B test: ${error.message}`);
    }
  }

  async analyzeABTest(testId: string): Promise<ABTestResult> {
    try {
      const test = await prisma.abTest.findUnique({
        where: { id: testId }
      });

      if (!test) {
        throw new Error('A/B test not found');
      }

      const results: ABTestResult = {
        testId,
        testName: test.testName,
        variants: [],
        statisticalSignificance: 0,
        recommendations: []
      };

      // Analyze each variant
      for (const variant of test.variants as any[]) {
        const interactions = await this.getVariantInteractions(variant.reminderIds);
        const effectiveness = this.calculateVariantEffectiveness(interactions);
        
        results.variants.push({
          name: variant.name,
          effectiveness,
          sampleSize: interactions.length,
          confidence: this.calculateConfidence(interactions)
        });
      }

      // Determine winner
      const sortedVariants = results.variants.sort((a, b) => b.effectiveness - a.effectiveness);
      if (sortedVariants.length > 1) {
        const winner = sortedVariants[0];
        const runnerUp = sortedVariants[1];
        
        results.statisticalSignificance = this.calculateStatisticalSignificance(
          winner,
          runnerUp
        );

        if (results.statisticalSignificance > 0.95) {
          results.winner = winner.name;
          results.recommendations.push(
            `Implement ${winner.name} variant - it shows ${Math.round((winner.effectiveness - runnerUp.effectiveness) * 100)}% better performance`
          );
        } else {
          results.recommendations.push(
            'No statistically significant winner - consider running test longer or with larger sample size'
          );
        }
      }

      return results;

    } catch (error) {
      logger.error('Error analyzing A/B test:', error);
      throw new Error(`Failed to analyze A/B test: ${error.message}`);
    }
  }

  async optimizeReminderFrequency(
    userId: string,
    reminderType: string
  ): Promise<{
    currentFrequency: number;
    recommendedFrequency: number;
    reasoning: string;
    expectedImprovement: number;
  }> {
    try {
      const interactions = await this.getUserInteractions(userId, reminderType, 30);
      const currentMetrics = this.analyzeInteractions(interactions, 'month');
      
      // Analyze frequency patterns
      const frequencyAnalysis = this.analyzeFrequencyPatterns(interactions);
      
      const recommendation = {
        currentFrequency: frequencyAnalysis.currentFrequency,
        recommendedFrequency: frequencyAnalysis.optimalFrequency,
        reasoning: frequencyAnalysis.reasoning,
        expectedImprovement: frequencyAnalysis.expectedImprovement
      };

      return recommendation;

    } catch (error) {
      logger.error('Error optimizing reminder frequency:', error);
      throw new Error(`Failed to optimize reminder frequency: ${error.message}`);
    }
  }

  private async updateEffectivenessMetrics(userId: string, interaction: any): Promise<void> {
    try {
      // Update user-specific metrics
      const existingMetrics = await prisma.userEffectivenessMetrics.findUnique({
        where: { userId }
      });

      const newMetrics = this.calculateIncrementalMetrics(existingMetrics, interaction);

      await prisma.userEffectivenessMetrics.upsert({
        where: { userId },
        update: newMetrics,
        create: {
          userId,
          ...newMetrics,
          createdAt: new Date()
        }
      });

    } catch (error) {
      logger.error('Error updating effectiveness metrics:', error);
    }
  }

  private analyzeInteractions(interactions: any[], timeframe: string): EffectivenessMetrics {
    if (interactions.length === 0) {
      return this.getEmptyMetrics(timeframe);
    }

    // Calculate overall effectiveness
    const responseInteractions = interactions.filter(i => 
      ['responded', 'completed', 'clicked'].includes(i.interactionType)
    );
    const overallEffectiveness = responseInteractions.length / interactions.length;

    // Calculate response rate
    const sentInteractions = interactions.filter(i => i.interactionType === 'sent');
    const responseRate = sentInteractions.length > 0 ? responseInteractions.length / sentInteractions.length : 0;

    // Calculate average response time
    const responseTimes = interactions
      .filter(i => i.responseTime)
      .map(i => i.responseTime);
    const averageResponseTime = responseTimes.length > 0 ? ss.mean(responseTimes) : 0;

    // Calculate channel effectiveness
    const channelEffectiveness = this.calculateChannelEffectiveness(interactions);

    // Calculate time effectiveness
    const timeEffectiveness = this.calculateTimeEffectiveness(interactions);

    // Calculate content effectiveness
    const contentEffectiveness = this.calculateContentEffectiveness(interactions);

    // Calculate improvement trends
    const improvementTrends = this.calculateImprovementTrends(interactions);

    return {
      timeframe,
      overallEffectiveness,
      responseRate,
      averageResponseTime,
      channelEffectiveness,
      timeEffectiveness,
      contentEffectiveness,
      improvementTrends
    };
  }

  private calculateChannelEffectiveness(interactions: any[]): Record<string, number> {
    const channelData: Record<string, { total: number; effective: number }> = {};

    interactions.forEach(interaction => {
      const channel = interaction.channel;
      if (!channelData[channel]) {
        channelData[channel] = { total: 0, effective: 0 };
      }
      channelData[channel].total++;
      if (['responded', 'completed', 'clicked'].includes(interaction.interactionType)) {
        channelData[channel].effective++;
      }
    });

    const effectiveness: Record<string, number> = {};
    Object.entries(channelData).forEach(([channel, data]) => {
      effectiveness[channel] = data.total > 0 ? data.effective / data.total : 0;
    });

    return effectiveness;
  }

  private calculateTimeEffectiveness(interactions: any[]): Record<string, number> {
    const timeData: Record<string, { total: number; effective: number }> = {};

    interactions.forEach(interaction => {
      const hour = new Date(interaction.timestamp).getHours().toString();
      if (!timeData[hour]) {
        timeData[hour] = { total: 0, effective: 0 };
      }
      timeData[hour].total++;
      if (['responded', 'completed', 'clicked'].includes(interaction.interactionType)) {
        timeData[hour].effective++;
      }
    });

    const effectiveness: Record<string, number> = {};
    Object.entries(timeData).forEach(([hour, data]) => {
      effectiveness[hour] = data.total > 0 ? data.effective / data.total : 0;
    });

    return effectiveness;
  }

  private calculateContentEffectiveness(interactions: any[]): Record<string, number> {
    // Simplified content analysis - in production would use NLP
    const contentTypes = {
      urgent: interactions.filter(i => i.content?.toLowerCase().includes('urgent')),
      gentle: interactions.filter(i => i.content?.toLowerCase().includes('gentle')),
      formal: interactions.filter(i => i.content?.toLowerCase().includes('dear')),
      casual: interactions.filter(i => i.content?.toLowerCase().includes('hey'))
    };

    const effectiveness: Record<string, number> = {};
    Object.entries(contentTypes).forEach(([type, typeInteractions]) => {
      const effective = typeInteractions.filter(i => 
        ['responded', 'completed', 'clicked'].includes(i.interactionType)
      ).length;
      effectiveness[type] = typeInteractions.length > 0 ? effective / typeInteractions.length : 0;
    });

    return effectiveness;
  }

  private calculateImprovementTrends(interactions: any[]): { direction: 'improving' | 'declining' | 'stable'; rate: number } {
    // Group interactions by week
    const weeklyData: Record<string, { total: number; effective: number }> = {};
    
    interactions.forEach(interaction => {
      const week = startOfDay(new Date(interaction.timestamp)).toISOString().split('T')[0];
      if (!weeklyData[week]) {
        weeklyData[week] = { total: 0, effective: 0 };
      }
      weeklyData[week].total++;
      if (['responded', 'completed', 'clicked'].includes(interaction.interactionType)) {
        weeklyData[week].effective++;
      }
    });

    const weeklyRates = Object.values(weeklyData).map(data => 
      data.total > 0 ? data.effective / data.total : 0
    );

    if (weeklyRates.length < 2) {
      return { direction: 'stable', rate: 0 };
    }

    const trend = this.calculateTrend(weeklyRates);
    return trend;
  }

  private calculateTrend(values: number[]): { direction: 'improving' | 'declining' | 'stable'; rate: number } {
    if (values.length < 2) return { direction: 'stable', rate: 0 };

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = ss.mean(firstHalf);
    const secondAvg = ss.mean(secondHalf);

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (Math.abs(change) < 5) {
      return { direction: 'stable', rate: Math.abs(change) };
    } else if (change > 0) {
      return { direction: 'improving', rate: change };
    } else {
      return { direction: 'declining', rate: Math.abs(change) };
    }
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month': return 30;
      case 'quarter': return 90;
      default: return 30;
    }
  }

  private getEmptyMetrics(timeframe: string): EffectivenessMetrics {
    return {
      timeframe: timeframe as any,
      overallEffectiveness: 0,
      responseRate: 0,
      averageResponseTime: 0,
      channelEffectiveness: {},
      timeEffectiveness: {},
      contentEffectiveness: {},
      improvementTrends: { direction: 'stable', rate: 0 }
    };
  }

  private async getHistoricalMetrics(userId?: string, timeframe: string = 'month'): Promise<any[]> {
    // Mock implementation - would get actual historical data
    return [];
  }

  private async getVariantInteractions(reminderIds: string[]): Promise<any[]> {
    return await prisma.reminderInteraction.findMany({
      where: {
        reminderId: { in: reminderIds }
      }
    });
  }

  private calculateVariantEffectiveness(interactions: any[]): number {
    if (interactions.length === 0) return 0;
    
    const effective = interactions.filter(i => 
      ['responded', 'completed', 'clicked'].includes(i.interactionType)
    ).length;
    
    return effective / interactions.length;
  }

  private calculateConfidence(interactions: any[]): number {
    // Simplified confidence calculation based on sample size
    const sampleSize = interactions.length;
    if (sampleSize < 10) return 0.3;
    if (sampleSize < 50) return 0.6;
    if (sampleSize < 100) return 0.8;
    return 0.9;
  }

  private calculateStatisticalSignificance(variant1: any, variant2: any): number {
    // Simplified statistical significance calculation
    const sampleSizeWeight = Math.min(variant1.sampleSize, variant2.sampleSize) / 100;
    const effectSizeWeight = Math.abs(variant1.effectiveness - variant2.effectiveness);
    
    return Math.min(0.99, sampleSizeWeight * effectSizeWeight * 2);
  }

  private async getUserInteractions(userId: string, reminderType: string, days: number): Promise<any[]> {
    const startDate = subDays(new Date(), days);
    
    return await prisma.reminderInteraction.findMany({
      where: {
        userId,
        timestamp: { gte: startDate },
        reminder: {
          type: reminderType
        }
      },
      include: {
        reminder: true
      }
    });
  }

  private analyzeFrequencyPatterns(interactions: any[]): any {
    // Simplified frequency analysis
    const dailyInteractions = interactions.length / 30; // assuming 30 days of data
    
    const effectiveness = interactions.filter(i => 
      ['responded', 'completed', 'clicked'].includes(i.interactionType)
    ).length / interactions.length;

    let recommendedFrequency = dailyInteractions;
    let reasoning = 'Maintaining current frequency';
    let expectedImprovement = 0;

    if (effectiveness < 0.3 && dailyInteractions > 1) {
      recommendedFrequency = dailyInteractions * 0.7;
      reasoning = 'Reducing frequency to combat notification fatigue';
      expectedImprovement = 15;
    } else if (effectiveness > 0.8 && dailyInteractions < 2) {
      recommendedFrequency = dailyInteractions * 1.3;
      reasoning = 'Increasing frequency due to high engagement';
      expectedImprovement = 10;
    }

    return {
      currentFrequency: dailyInteractions,
      optimalFrequency: recommendedFrequency,
      reasoning,
      expectedImprovement
    };
  }

  private calculateIncrementalMetrics(existingMetrics: any, interaction: any): any {
    // Simplified incremental update
    const isEffective = ['responded', 'completed', 'clicked'].includes(interaction.interactionType);
    
    return {
      totalInteractions: (existingMetrics?.totalInteractions || 0) + 1,
      effectiveInteractions: (existingMetrics?.effectiveInteractions || 0) + (isEffective ? 1 : 0),
      lastInteractionAt: interaction.timestamp,
      updatedAt: new Date()
    };
  }

  private generateId(): string {
    return `effectiveness_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}