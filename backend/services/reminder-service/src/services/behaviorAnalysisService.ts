import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import axios from 'axios';

const prisma = new PrismaClient();

export class BehaviorAnalysisService {
  private readonly USER_SERVICE_URL: string;
  private readonly ANALYTICS_SERVICE_URL: string;

  constructor() {
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006';
  }

  async analyzeUserBehavior(userId: string): Promise<any> {
    try {
      logger.info('Analyzing user behavior', { userId });

      // Get user interaction data
      const interactions = await prisma.reminderInteraction.findMany({
        where: { userId },
        take: 100,
        orderBy: { timestamp: 'desc' }
      });

      // Calculate behavior metrics
      const behaviorData = {
        responsiveness: this.calculateResponsiveness(interactions),
        procrastinationTendency: this.calculateProcrastinationTendency(interactions),
        preferredTimes: this.calculatePreferredTimes(interactions),
        preferredDays: this.calculatePreferredDays(interactions),
        channelPreferences: this.calculateChannelPreferences(interactions),
        attentionSpan: this.calculateAttentionSpan(interactions),
        effectiveLeadTime: this.calculateEffectiveLeadTime(interactions),
        stressResponse: this.calculateStressResponse(interactions)
      };

      return behaviorData;

    } catch (error) {
      logger.error('Error analyzing user behavior:', error);
      return this.getDefaultBehaviorData();
    }
  }

  private calculateResponsiveness(interactions: any[]): number {
    if (interactions.length === 0) return 0.5;
    
    const responseInteractions = interactions.filter(i => 
      ['responded', 'completed', 'clicked'].includes(i.interactionType)
    );
    
    return responseInteractions.length / interactions.length;
  }

  private calculateProcrastinationTendency(interactions: any[]): number {
    // Simplified calculation based on response times
    const responseTimes = interactions
      .filter(i => i.responseTime)
      .map(i => i.responseTime);
    
    if (responseTimes.length === 0) return 0.3;
    
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    // Higher response time indicates higher procrastination tendency
    return Math.min(1, avgResponseTime / 48); // 48 hours as baseline
  }

  private calculatePreferredTimes(interactions: any[]): number[] {
    const hourCounts: Record<number, number> = {};
    
    interactions.forEach(interaction => {
      if (['responded', 'completed', 'clicked'].includes(interaction.interactionType)) {
        const hour = new Date(interaction.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });

    // Return top 3 hours
    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  private calculatePreferredDays(interactions: any[]): number[] {
    const dayCounts: Record<number, number> = {};
    
    interactions.forEach(interaction => {
      if (['responded', 'completed', 'clicked'].includes(interaction.interactionType)) {
        const day = new Date(interaction.timestamp).getDay();
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
    });

    // Return days with above-average activity
    const avgCount = Object.values(dayCounts).reduce((sum, count) => sum + count, 0) / 7;
    return Object.entries(dayCounts)
      .filter(([, count]) => count > avgCount)
      .map(([day]) => parseInt(day));
  }

  private calculateChannelPreferences(interactions: any[]): Record<string, number> {
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

    const preferences: Record<string, number> = {};
    Object.entries(channelData).forEach(([channel, data]) => {
      preferences[channel] = data.total > 0 ? data.effective / data.total : 0.5;
    });

    return preferences;
  }

  private calculateAttentionSpan(interactions: any[]): number {
    const responseTimes = interactions
      .filter(i => i.responseTime && i.responseTime > 0)
      .map(i => i.responseTime);
    
    if (responseTimes.length === 0) return 4; // default 4 hours
    
    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  private calculateEffectiveLeadTime(interactions: any[]): number {
    // Simplified calculation - would analyze when reminders are most effective
    return 3; // default 3 days
  }

  private calculateStressResponse(interactions: any[]): 'positive' | 'negative' | 'neutral' {
    // Simplified analysis - would look at response to urgent vs gentle reminders
    return 'neutral';
  }

  private getDefaultBehaviorData(): any {
    return {
      responsiveness: 0.5,
      procrastinationTendency: 0.3,
      preferredTimes: [9, 14, 18],
      preferredDays: [1, 2, 3, 4, 5],
      channelPreferences: {
        email: 0.7,
        push: 0.8,
        sms: 0.6,
        in_app: 0.5
      },
      attentionSpan: 4,
      effectiveLeadTime: 3,
      stressResponse: 'neutral'
    };
  }
}