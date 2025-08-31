import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { addDays, addHours, addMinutes, subDays, getHours, getDay, differenceInDays, differenceInHours } from 'date-fns';
import { BehaviorAnalysisService } from './behaviorAnalysisService';
import * as ss from 'simple-statistics';

const prisma = new PrismaClient();

export interface UserBehaviorProfile {
  userId: string;
  responsiveness: number; // 0-1, how quickly user responds to reminders
  procrastinationTendency: number; // 0-1, tendency to delay tasks
  preferredTimes: number[]; // preferred hours of day (0-23)
  preferredDays: number[]; // preferred days of week (0-6)
  channelPreferences: Record<string, number>; // channel effectiveness scores
  attentionSpan: number; // average time between reminder and action
  effectiveLeadTime: number; // optimal days before deadline to start reminding
  stressResponse: 'positive' | 'negative' | 'neutral'; // how user responds to urgency
  lastUpdated: Date;
}

export interface OptimalReminderTime {
  scheduledAt: Date;
  type: 'initial' | 'follow_up' | 'escalation' | 'final';
  channel: 'email' | 'sms' | 'push' | 'in_app';
  confidence: number; // 0-1, confidence in timing effectiveness
  templateId?: string;
  reasoning: string;
}

export interface TimingRecommendation {
  recommendedTimes: OptimalReminderTime[];
  strategy: 'early_bird' | 'standard' | 'last_minute' | 'persistent' | 'gentle';
  totalReminders: number;
  estimatedEffectiveness: number;
}

export class SmartTimingService {
  private behaviorAnalysisService: BehaviorAnalysisService;

  constructor() {
    this.behaviorAnalysisService = new BehaviorAnalysisService();
  }

  async calculateOptimalReminderTimes(
    userId: string,
    targetDate: Date,
    priority: 'low' | 'medium' | 'high' | 'critical',
    type: 'deadline' | 'milestone' | 'task' | 'follow_up' | 'custom'
  ): Promise<OptimalReminderTime[]> {
    try {
      logger.info('Calculating optimal reminder times', { 
        userId, 
        targetDate, 
        priority, 
        type 
      });

      // Get user behavior profile
      const behaviorProfile = await this.getUserBehaviorProfile(userId);
      
      // Calculate timing strategy
      const strategy = this.determineTimingStrategy(behaviorProfile, priority, type);
      
      // Generate optimal times based on strategy
      const optimalTimes = await this.generateOptimalTimes(
        behaviorProfile,
        targetDate,
        priority,
        type,
        strategy
      );

      // Apply machine learning optimization
      const optimizedTimes = await this.optimizeWithML(userId, optimalTimes, type);

      logger.info('Optimal reminder times calculated', { 
        userId,
        strategy,
        reminderCount: optimizedTimes.length 
      });

      return optimizedTimes;

    } catch (error) {
      logger.error('Error calculating optimal reminder times:', error);
      // Return fallback times
      return this.getFallbackReminderTimes(targetDate, priority);
    }
  }

  async getUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
    try {
      // Try to get existing profile
      const existingProfile = await prisma.userBehaviorProfile.findUnique({
        where: { userId }
      });

      if (existingProfile && this.isProfileFresh(existingProfile.lastUpdated)) {
        return this.mapToBehaviorProfile(existingProfile);
      }

      // Generate new profile from behavior analysis
      const profile = await this.generateBehaviorProfile(userId);
      
      // Save profile
      await this.saveBehaviorProfile(profile);

      return profile;

    } catch (error) {
      logger.error('Error getting user behavior profile:', error);
      return this.getDefaultBehaviorProfile(userId);
    }
  }

  async updateBehaviorProfile(userId: string, reminderInteraction: {
    reminderId: string;
    sentAt: Date;
    respondedAt?: Date;
    actionTaken: boolean;
    channel: string;
    timeToResponse?: number;
  }): Promise<void> {
    try {
      const profile = await this.getUserBehaviorProfile(userId);
      
      // Update responsiveness
      if (reminderInteraction.respondedAt && reminderInteraction.actionTaken) {
        const responseTime = differenceInHours(reminderInteraction.respondedAt, reminderInteraction.sentAt);
        profile.attentionSpan = this.updateMovingAverage(profile.attentionSpan, responseTime, 0.1);
        profile.responsiveness = Math.min(1, profile.responsiveness + 0.05);
      } else {
        profile.responsiveness = Math.max(0, profile.responsiveness - 0.02);
      }

      // Update channel preferences
      const channelEffectiveness = reminderInteraction.actionTaken ? 1 : 0;
      profile.channelPreferences[reminderInteraction.channel] = this.updateMovingAverage(
        profile.channelPreferences[reminderInteraction.channel] || 0.5,
        channelEffectiveness,
        0.1
      );

      // Update preferred times
      const hour = getHours(reminderInteraction.sentAt);
      if (reminderInteraction.actionTaken) {
        if (!profile.preferredTimes.includes(hour)) {
          profile.preferredTimes.push(hour);
        }
      }

      profile.lastUpdated = new Date();
      await this.saveBehaviorProfile(profile);

      logger.info('Behavior profile updated', { userId });

    } catch (error) {
      logger.error('Error updating behavior profile:', error);
    }
  }

  async analyzeReminderEffectiveness(
    userId: string,
    timeframe: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<{
    overallEffectiveness: number;
    channelEffectiveness: Record<string, number>;
    timeEffectiveness: Record<string, number>;
    recommendations: string[];
  }> {
    try {
      const days = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 90;
      const startDate = subDays(new Date(), days);

      const interactions = await prisma.reminderInteraction.findMany({
        where: {
          userId,
          createdAt: { gte: startDate }
        },
        include: {
          reminder: true
        }
      });

      const analysis = this.analyzeInteractions(interactions);
      const recommendations = this.generateEffectivenessRecommendations(analysis);

      return {
        overallEffectiveness: analysis.overallEffectiveness,
        channelEffectiveness: analysis.channelEffectiveness,
        timeEffectiveness: analysis.timeEffectiveness,
        recommendations
      };

    } catch (error) {
      logger.error('Error analyzing reminder effectiveness:', error);
      throw new Error(`Failed to analyze reminder effectiveness: ${error.message}`);
    }
  }

  async predictOptimalFrequency(
    userId: string,
    taskType: string,
    urgency: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<{
    frequency: number; // reminders per day
    spacing: number; // hours between reminders
    totalReminders: number;
    confidence: number;
  }> {
    try {
      const behaviorProfile = await this.getUserBehaviorProfile(userId);
      const historicalData = await this.getHistoricalFrequencyData(userId, taskType);

      // Use machine learning to predict optimal frequency
      const prediction = this.predictFrequencyWithML(behaviorProfile, historicalData, urgency);

      return prediction;

    } catch (error) {
      logger.error('Error predicting optimal frequency:', error);
      return this.getDefaultFrequency(urgency);
    }
  }

  private async generateBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
    const behaviorData = await this.behaviorAnalysisService.analyzeUserBehavior(userId);
    
    return {
      userId,
      responsiveness: behaviorData.responsiveness || 0.5,
      procrastinationTendency: behaviorData.procrastinationTendency || 0.3,
      preferredTimes: behaviorData.preferredTimes || [9, 14, 18], // 9am, 2pm, 6pm
      preferredDays: behaviorData.preferredDays || [1, 2, 3, 4, 5], // weekdays
      channelPreferences: behaviorData.channelPreferences || {
        email: 0.7,
        push: 0.8,
        sms: 0.6,
        in_app: 0.5
      },
      attentionSpan: behaviorData.attentionSpan || 4, // hours
      effectiveLeadTime: behaviorData.effectiveLeadTime || 3, // days
      stressResponse: behaviorData.stressResponse || 'neutral',
      lastUpdated: new Date()
    };
  }

  private determineTimingStrategy(
    profile: UserBehaviorProfile,
    priority: string,
    type: string
  ): 'early_bird' | 'standard' | 'last_minute' | 'persistent' | 'gentle' {
    if (profile.procrastinationTendency > 0.7) {
      return priority === 'critical' ? 'persistent' : 'last_minute';
    }
    
    if (profile.responsiveness > 0.8) {
      return 'gentle';
    }
    
    if (priority === 'critical') {
      return 'persistent';
    }
    
    if (profile.procrastinationTendency < 0.3) {
      return 'early_bird';
    }
    
    return 'standard';
  }

  private async generateOptimalTimes(
    profile: UserBehaviorProfile,
    targetDate: Date,
    priority: string,
    type: string,
    strategy: string
  ): Promise<OptimalReminderTime[]> {
    const times: OptimalReminderTime[] = [];
    const daysUntilTarget = differenceInDays(targetDate, new Date());
    
    // Determine number of reminders based on strategy and priority
    const reminderCount = this.calculateReminderCount(strategy, priority, daysUntilTarget);
    
    // Generate reminder schedule
    const schedule = this.generateReminderSchedule(
      strategy,
      reminderCount,
      daysUntilTarget,
      profile
    );

    for (let i = 0; i < schedule.length; i++) {
      const reminderDate = addDays(new Date(), schedule[i].daysFromNow);
      const optimalHour = this.selectOptimalHour(profile, schedule[i].urgency);
      const scheduledAt = addHours(reminderDate, optimalHour);

      times.push({
        scheduledAt,
        type: schedule[i].type,
        channel: this.selectOptimalChannel(profile, schedule[i].urgency),
        confidence: schedule[i].confidence,
        reasoning: schedule[i].reasoning
      });
    }

    return times;
  }

  private calculateReminderCount(strategy: string, priority: string, daysUntilTarget: number): number {
    const baseCount = {
      early_bird: Math.min(3, Math.floor(daysUntilTarget / 7)),
      standard: Math.min(2, Math.floor(daysUntilTarget / 3)),
      last_minute: 1,
      persistent: Math.min(5, Math.floor(daysUntilTarget / 2)),
      gentle: 1
    };

    const priorityMultiplier = {
      low: 0.5,
      medium: 1,
      high: 1.5,
      critical: 2
    };

    return Math.max(1, Math.floor(baseCount[strategy] * priorityMultiplier[priority]));
  }

  private generateReminderSchedule(
    strategy: string,
    count: number,
    daysUntilTarget: number,
    profile: UserBehaviorProfile
  ): any[] {
    const schedule = [];

    switch (strategy) {
      case 'early_bird':
        // Start early, spread evenly
        for (let i = 0; i < count; i++) {
          const daysFromNow = Math.floor((daysUntilTarget * (i + 1)) / (count + 1));
          schedule.push({
            daysFromNow: -daysFromNow,
            type: i === 0 ? 'initial' : i === count - 1 ? 'final' : 'follow_up',
            urgency: 'low',
            confidence: 0.8,
            reasoning: 'Early reminder for proactive users'
          });
        }
        break;

      case 'persistent':
        // Frequent reminders with escalating urgency
        const intervals = this.calculatePersistentIntervals(count, daysUntilTarget);
        for (let i = 0; i < count; i++) {
          schedule.push({
            daysFromNow: -intervals[i],
            type: i === 0 ? 'initial' : i === count - 1 ? 'final' : 'escalation',
            urgency: i < count / 2 ? 'medium' : 'high',
            confidence: 0.9,
            reasoning: 'Persistent reminders for high-priority tasks'
          });
        }
        break;

      case 'last_minute':
        // Single reminder close to deadline
        schedule.push({
          daysFromNow: -Math.max(1, Math.floor(daysUntilTarget * 0.1)),
          type: 'final',
          urgency: 'high',
          confidence: 0.7,
          reasoning: 'Last-minute reminder for procrastinators'
        });
        break;

      case 'gentle':
        // Single, polite reminder
        schedule.push({
          daysFromNow: -Math.floor(daysUntilTarget / 2),
          type: 'initial',
          urgency: 'low',
          confidence: 0.8,
          reasoning: 'Gentle reminder for responsive users'
        });
        break;

      default: // standard
        // Balanced approach
        if (count >= 2) {
          schedule.push({
            daysFromNow: -Math.floor(daysUntilTarget * 0.7),
            type: 'initial',
            urgency: 'medium',
            confidence: 0.8,
            reasoning: 'Initial reminder'
          });
          schedule.push({
            daysFromNow: -1,
            type: 'final',
            urgency: 'high',
            confidence: 0.9,
            reasoning: 'Final reminder'
          });
        } else {
          schedule.push({
            daysFromNow: -Math.floor(daysUntilTarget / 2),
            type: 'initial',
            urgency: 'medium',
            confidence: 0.8,
            reasoning: 'Standard reminder'
          });
        }
        break;
    }

    return schedule;
  }

  private selectOptimalHour(profile: UserBehaviorProfile, urgency: string): number {
    if (urgency === 'high' || urgency === 'critical') {
      // For urgent reminders, use the most effective time
      return profile.preferredTimes[0] || 9;
    }

    // For normal reminders, rotate through preferred times
    const randomIndex = Math.floor(Math.random() * profile.preferredTimes.length);
    return profile.preferredTimes[randomIndex] || 14;
  }

  private selectOptimalChannel(profile: UserBehaviorProfile, urgency: string): 'email' | 'sms' | 'push' | 'in_app' {
    const channels = Object.entries(profile.channelPreferences)
      .sort(([,a], [,b]) => b - a)
      .map(([channel]) => channel);

    if (urgency === 'high' || urgency === 'critical') {
      // For urgent reminders, use the most effective channel
      return channels[0] as any || 'push';
    }

    // For normal reminders, use a good channel
    return channels[0] as any || 'email';
  }

  private async optimizeWithML(
    userId: string,
    times: OptimalReminderTime[],
    type: string
  ): Promise<OptimalReminderTime[]> {
    try {
      // Get historical effectiveness data
      const historicalData = await this.getHistoricalEffectivenessData(userId, type);
      
      if (historicalData.length < 10) {
        // Not enough data for ML optimization
        return times;
      }

      // Apply ML-based adjustments
      return times.map(time => ({
        ...time,
        confidence: this.adjustConfidenceWithML(time, historicalData),
        scheduledAt: this.adjustTimingWithML(time.scheduledAt, historicalData)
      }));

    } catch (error) {
      logger.error('Error optimizing with ML:', error);
      return times;
    }
  }

  private adjustConfidenceWithML(time: OptimalReminderTime, historicalData: any[]): number {
    // Simplified ML adjustment - in production would use more sophisticated models
    const similarReminders = historicalData.filter(d => 
      d.channel === time.channel && 
      d.type === time.type
    );

    if (similarReminders.length === 0) return time.confidence;

    const avgEffectiveness = similarReminders.reduce((sum, r) => sum + r.effectiveness, 0) / similarReminders.length;
    return Math.min(1, time.confidence * (0.5 + avgEffectiveness));
  }

  private adjustTimingWithML(scheduledAt: Date, historicalData: any[]): Date {
    // Simplified timing adjustment based on historical success
    const hour = getHours(scheduledAt);
    const hourlyEffectiveness = this.calculateHourlyEffectiveness(historicalData);
    
    const bestHour = Object.entries(hourlyEffectiveness)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];

    if (bestHour && Math.abs(parseInt(bestHour[0]) - hour) <= 2) {
      // Adjust to the most effective nearby hour
      return addHours(scheduledAt, parseInt(bestHour[0]) - hour);
    }

    return scheduledAt;
  }

  private calculateHourlyEffectiveness(historicalData: any[]): Record<string, number> {
    const hourlyData: Record<string, { total: number; effective: number }> = {};

    historicalData.forEach(data => {
      const hour = getHours(data.sentAt).toString();
      if (!hourlyData[hour]) {
        hourlyData[hour] = { total: 0, effective: 0 };
      }
      hourlyData[hour].total++;
      if (data.effectiveness > 0.5) {
        hourlyData[hour].effective++;
      }
    });

    const effectiveness: Record<string, number> = {};
    Object.entries(hourlyData).forEach(([hour, data]) => {
      effectiveness[hour] = data.total > 0 ? data.effective / data.total : 0;
    });

    return effectiveness;
  }

  private getFallbackReminderTimes(targetDate: Date, priority: string): OptimalReminderTime[] {
    const daysUntilTarget = differenceInDays(targetDate, new Date());
    const times: OptimalReminderTime[] = [];

    if (daysUntilTarget > 3) {
      times.push({
        scheduledAt: addDays(new Date(), Math.floor(daysUntilTarget / 2)),
        type: 'initial',
        channel: 'email',
        confidence: 0.5,
        reasoning: 'Fallback timing - initial reminder'
      });
    }

    times.push({
      scheduledAt: addDays(targetDate, -1),
      type: 'final',
      channel: priority === 'critical' ? 'push' : 'email',
      confidence: 0.7,
      reasoning: 'Fallback timing - final reminder'
    });

    return times;
  }

  private calculatePersistentIntervals(count: number, totalDays: number): number[] {
    const intervals = [];
    let remaining = totalDays;

    for (let i = 0; i < count; i++) {
      const interval = Math.floor(remaining / (count - i));
      intervals.push(totalDays - remaining + interval);
      remaining -= interval;
    }

    return intervals;
  }

  private predictFrequencyWithML(
    profile: UserBehaviorProfile,
    historicalData: any[],
    urgency: string
  ): any {
    // Simplified ML prediction - in production would use more sophisticated models
    const baseFrequency = {
      low: 0.2,
      medium: 0.5,
      high: 1.0,
      critical: 2.0
    }[urgency] || 0.5;

    const adjustment = profile.procrastinationTendency > 0.5 ? 1.5 : 0.8;
    const frequency = baseFrequency * adjustment;

    return {
      frequency,
      spacing: Math.max(2, Math.floor(24 / frequency)),
      totalReminders: Math.ceil(frequency * 7), // per week
      confidence: historicalData.length > 10 ? 0.8 : 0.5
    };
  }

  private getDefaultFrequency(urgency: string): any {
    const defaults = {
      low: { frequency: 0.2, spacing: 24, totalReminders: 1, confidence: 0.5 },
      medium: { frequency: 0.5, spacing: 12, totalReminders: 2, confidence: 0.5 },
      high: { frequency: 1.0, spacing: 6, totalReminders: 4, confidence: 0.5 },
      critical: { frequency: 2.0, spacing: 3, totalReminders: 8, confidence: 0.5 }
    };

    return defaults[urgency] || defaults.medium;
  }

  private analyzeInteractions(interactions: any[]): any {
    const analysis = {
      overallEffectiveness: 0,
      channelEffectiveness: {} as Record<string, number>,
      timeEffectiveness: {} as Record<string, number>
    };

    if (interactions.length === 0) return analysis;

    // Calculate overall effectiveness
    const effectiveInteractions = interactions.filter(i => i.actionTaken).length;
    analysis.overallEffectiveness = effectiveInteractions / interactions.length;

    // Calculate channel effectiveness
    const channelData: Record<string, { total: number; effective: number }> = {};
    interactions.forEach(interaction => {
      const channel = interaction.reminder.channel;
      if (!channelData[channel]) {
        channelData[channel] = { total: 0, effective: 0 };
      }
      channelData[channel].total++;
      if (interaction.actionTaken) {
        channelData[channel].effective++;
      }
    });

    Object.entries(channelData).forEach(([channel, data]) => {
      analysis.channelEffectiveness[channel] = data.effective / data.total;
    });

    // Calculate time effectiveness
    const timeData: Record<string, { total: number; effective: number }> = {};
    interactions.forEach(interaction => {
      const hour = getHours(interaction.reminder.sentAt).toString();
      if (!timeData[hour]) {
        timeData[hour] = { total: 0, effective: 0 };
      }
      timeData[hour].total++;
      if (interaction.actionTaken) {
        timeData[hour].effective++;
      }
    });

    Object.entries(timeData).forEach(([hour, data]) => {
      analysis.timeEffectiveness[hour] = data.effective / data.total;
    });

    return analysis;
  }

  private generateEffectivenessRecommendations(analysis: any): string[] {
    const recommendations = [];

    if (analysis.overallEffectiveness < 0.3) {
      recommendations.push('Consider reducing reminder frequency to avoid notification fatigue');
    } else if (analysis.overallEffectiveness > 0.8) {
      recommendations.push('Your reminder settings are working well - maintain current approach');
    }

    // Channel recommendations
    const bestChannel = Object.entries(analysis.channelEffectiveness)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    if (bestChannel && bestChannel[1] > 0.7) {
      recommendations.push(`${bestChannel[0]} is your most effective channel - consider using it more`);
    }

    // Time recommendations
    const bestTime = Object.entries(analysis.timeEffectiveness)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    if (bestTime && bestTime[1] > 0.7) {
      recommendations.push(`${bestTime[0]}:00 is your most responsive time - schedule important reminders then`);
    }

    return recommendations;
  }

  private async getHistoricalEffectivenessData(userId: string, type: string): Promise<any[]> {
    try {
      const data = await prisma.reminderInteraction.findMany({
        where: { userId },
        include: { reminder: true },
        take: 100,
        orderBy: { createdAt: 'desc' }
      });

      return data.map(d => ({
        sentAt: d.reminder.sentAt,
        channel: d.reminder.channel,
        type: d.reminder.type,
        effectiveness: d.actionTaken ? 1 : 0
      }));
    } catch (error) {
      return [];
    }
  }

  private async getHistoricalFrequencyData(userId: string, taskType: string): Promise<any[]> {
    // Mock implementation - would get actual historical data
    return [];
  }

  private isProfileFresh(lastUpdated: Date): boolean {
    const daysSinceUpdate = differenceInDays(new Date(), lastUpdated);
    return daysSinceUpdate < 7; // Profile is fresh for 7 days
  }

  private getDefaultBehaviorProfile(userId: string): UserBehaviorProfile {
    return {
      userId,
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
      stressResponse: 'neutral',
      lastUpdated: new Date()
    };
  }

  private async saveBehaviorProfile(profile: UserBehaviorProfile): Promise<void> {
    try {
      await prisma.userBehaviorProfile.upsert({
        where: { userId: profile.userId },
        update: {
          responsiveness: profile.responsiveness,
          procrastinationTendency: profile.procrastinationTendency,
          preferredTimes: profile.preferredTimes,
          preferredDays: profile.preferredDays,
          channelPreferences: profile.channelPreferences,
          attentionSpan: profile.attentionSpan,
          effectiveLeadTime: profile.effectiveLeadTime,
          stressResponse: profile.stressResponse,
          lastUpdated: profile.lastUpdated
        },
        create: {
          userId: profile.userId,
          responsiveness: profile.responsiveness,
          procrastinationTendency: profile.procrastinationTendency,
          preferredTimes: profile.preferredTimes,
          preferredDays: profile.preferredDays,
          channelPreferences: profile.channelPreferences,
          attentionSpan: profile.attentionSpan,
          effectiveLeadTime: profile.effectiveLeadTime,
          stressResponse: profile.stressResponse,
          lastUpdated: profile.lastUpdated
        }
      });
    } catch (error) {
      logger.error('Error saving behavior profile:', error);
    }
  }

  private mapToBehaviorProfile(dbProfile: any): UserBehaviorProfile {
    return {
      userId: dbProfile.userId,
      responsiveness: dbProfile.responsiveness,
      procrastinationTendency: dbProfile.procrastinationTendency,
      preferredTimes: dbProfile.preferredTimes,
      preferredDays: dbProfile.preferredDays,
      channelPreferences: dbProfile.channelPreferences,
      attentionSpan: dbProfile.attentionSpan,
      effectiveLeadTime: dbProfile.effectiveLeadTime,
      stressResponse: dbProfile.stressResponse,
      lastUpdated: dbProfile.lastUpdated
    };
  }

  private updateMovingAverage(current: number, newValue: number, alpha: number): number {
    return alpha * newValue + (1 - alpha) * current;
  }
}