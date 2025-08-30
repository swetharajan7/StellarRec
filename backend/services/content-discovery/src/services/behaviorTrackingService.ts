import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface BehaviorEvent {
  userId: string;
  sessionId?: string;
  action: 'view' | 'click' | 'search' | 'save' | 'share' | 'apply' | 'like' | 'dislike' | 'bookmark';
  contentType: 'university' | 'program' | 'scholarship' | 'opportunity' | 'article' | 'guide';
  contentId: string;
  metadata?: Record<string, any>;
  context?: {
    page?: string;
    referrer?: string;
    userAgent?: string;
    location?: string;
    duration?: number;
    position?: number;
  };
  timestamp?: Date;
}

export interface UserBehaviorProfile {
  userId: string;
  preferences: {
    contentTypes: Record<string, number>;
    categories: Record<string, number>;
    locations: Record<string, number>;
    academicLevels: Record<string, number>;
    fieldsOfStudy: Record<string, number>;
  };
  patterns: {
    activeHours: number[];
    activeDays: number[];
    sessionDuration: number;
    averageEngagement: number;
    searchFrequency: number;
  };
  interests: string[];
  recentActivity: BehaviorEvent[];
  lastUpdated: Date;
}

export interface BehaviorInsights {
  userId: string;
  insights: {
    primaryInterests: string[];
    preferredContentTypes: string[];
    engagementLevel: 'low' | 'medium' | 'high';
    searchPatterns: string[];
    recommendations: string[];
  };
  confidence: number;
  dataPoints: number;
}

export class BehaviorTrackingService {
  private readonly BATCH_SIZE = 100;
  private readonly PROFILE_UPDATE_INTERVAL = 300000; // 5 minutes
  private behaviorQueue: BehaviorEvent[] = [];

  constructor() {
    this.startBatchProcessor();
    this.startProfileUpdater();
  }

  async trackBehavior(event: BehaviorEvent): Promise<void> {
    try {
      // Add timestamp if not provided
      if (!event.timestamp) {
        event.timestamp = new Date();
      }

      // Add to queue for batch processing
      this.behaviorQueue.push(event);

      // If queue is full, process immediately
      if (this.behaviorQueue.length >= this.BATCH_SIZE) {
        await this.processBehaviorBatch();
      }

      logger.debug('Behavior tracked', { 
        userId: event.userId, 
        action: event.action, 
        contentType: event.contentType 
      });

    } catch (error) {
      logger.error('Error tracking behavior:', error);
    }
  }

  async trackMultipleBehaviors(events: BehaviorEvent[]): Promise<void> {
    try {
      // Add timestamps and queue all events
      const timestampedEvents = events.map(event => ({
        ...event,
        timestamp: event.timestamp || new Date()
      }));

      this.behaviorQueue.push(...timestampedEvents);

      // Process if queue is large
      if (this.behaviorQueue.length >= this.BATCH_SIZE) {
        await this.processBehaviorBatch();
      }

    } catch (error) {
      logger.error('Error tracking multiple behaviors:', error);
    }
  }

  async getUserBehaviorProfile(userId: string): Promise<UserBehaviorProfile | null> {
    try {
      // Try to get cached profile first
      const cachedProfile = await prisma.userBehaviorProfile.findUnique({
        where: { userId }
      });

      if (cachedProfile && this.isProfileFresh(cachedProfile.lastUpdated)) {
        return this.deserializeBehaviorProfile(cachedProfile);
      }

      // Generate fresh profile
      return this.generateBehaviorProfile(userId);

    } catch (error) {
      logger.error('Error getting user behavior profile:', error);
      return null;
    }
  }

  async getBehaviorInsights(userId: string): Promise<BehaviorInsights | null> {
    try {
      const profile = await this.getUserBehaviorProfile(userId);
      if (!profile) {
        return null;
      }

      return this.generateBehaviorInsights(profile);

    } catch (error) {
      logger.error('Error getting behavior insights:', error);
      return null;
    }
  }

  async getUserSimilarities(userId: string, limit: number = 10): Promise<string[]> {
    try {
      const userProfile = await this.getUserBehaviorProfile(userId);
      if (!userProfile) {
        return [];
      }

      // Find users with similar behavior patterns
      const similarUsers = await this.findSimilarUsers(userProfile, limit);
      return similarUsers.map(user => user.userId);

    } catch (error) {
      logger.error('Error finding similar users:', error);
      return [];
    }
  }

  async getContentPopularity(
    contentType: string, 
    timeframe: string = '24h'
  ): Promise<Array<{ contentId: string; score: number; interactions: number }>> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startTime = new Date(Date.now() - timeframeDuration);

      const popularContent = await prisma.userBehavior.groupBy({
        by: ['contentId'],
        where: {
          contentType,
          timestamp: { gte: startTime }
        },
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 50
      });

      return popularContent.map(item => ({
        contentId: item.contentId,
        score: this.calculatePopularityScore(item._count.id, timeframeDuration),
        interactions: item._count.id
      }));

    } catch (error) {
      logger.error('Error getting content popularity:', error);
      return [];
    }
  }

  async getEngagementMetrics(
    userId?: string,
    timeframe: string = '24h'
  ): Promise<any> {
    try {
      const timeframeDuration = this.getTimeframeDuration(timeframe);
      const startTime = new Date(Date.now() - timeframeDuration);

      const whereClause: any = {
        timestamp: { gte: startTime }
      };

      if (userId) {
        whereClause.userId = userId;
      }

      const [totalInteractions, uniqueUsers, actionBreakdown] = await Promise.all([
        prisma.userBehavior.count({ where: whereClause }),
        prisma.userBehavior.findMany({
          where: whereClause,
          select: { userId: true },
          distinct: ['userId']
        }),
        prisma.userBehavior.groupBy({
          by: ['action'],
          where: whereClause,
          _count: { id: true }
        })
      ]);

      return {
        totalInteractions,
        uniqueUsers: uniqueUsers.length,
        actionBreakdown: actionBreakdown.reduce((acc, item) => {
          acc[item.action] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        timeframe
      };

    } catch (error) {
      logger.error('Error getting engagement metrics:', error);
      return {
        totalInteractions: 0,
        uniqueUsers: 0,
        actionBreakdown: {},
        timeframe
      };
    }
  }

  async cleanupOldBehaviorData(daysToKeep: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const deletedCount = await prisma.userBehavior.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });

      logger.info(`Cleaned up ${deletedCount.count} old behavior records`);

    } catch (error) {
      logger.error('Error cleaning up old behavior data:', error);
    }
  }

  private async processBehaviorBatch(): Promise<void> {
    if (this.behaviorQueue.length === 0) return;

    try {
      const batch = this.behaviorQueue.splice(0, this.BATCH_SIZE);
      
      // Insert batch into database
      await prisma.userBehavior.createMany({
        data: batch.map(event => ({
          userId: event.userId,
          sessionId: event.sessionId,
          action: event.action,
          contentType: event.contentType,
          contentId: event.contentId,
          metadata: event.metadata || {},
          context: event.context || {},
          timestamp: event.timestamp || new Date()
        }))
      });

      logger.debug(`Processed behavior batch of ${batch.length} events`);

    } catch (error) {
      logger.error('Error processing behavior batch:', error);
      // Re-queue failed events (simplified - in production, might want more sophisticated retry logic)
    }
  }

  private async generateBehaviorProfile(userId: string): Promise<UserBehaviorProfile> {
    try {
      // Get user's behavior data from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const behaviors = await prisma.userBehavior.findMany({
        where: {
          userId,
          timestamp: { gte: thirtyDaysAgo }
        },
        orderBy: { timestamp: 'desc' }
      });

      const profile: UserBehaviorProfile = {
        userId,
        preferences: this.calculatePreferences(behaviors),
        patterns: this.calculatePatterns(behaviors),
        interests: this.extractInterests(behaviors),
        recentActivity: behaviors.slice(0, 20), // Last 20 activities
        lastUpdated: new Date()
      };

      // Cache the profile
      await this.cacheBehaviorProfile(profile);

      return profile;

    } catch (error) {
      logger.error('Error generating behavior profile:', error);
      throw error;
    }
  }

  private calculatePreferences(behaviors: any[]): UserBehaviorProfile['preferences'] {
    const preferences = {
      contentTypes: {} as Record<string, number>,
      categories: {} as Record<string, number>,
      locations: {} as Record<string, number>,
      academicLevels: {} as Record<string, number>,
      fieldsOfStudy: {} as Record<string, number>
    };

    behaviors.forEach(behavior => {
      // Content types
      preferences.contentTypes[behavior.contentType] = 
        (preferences.contentTypes[behavior.contentType] || 0) + 1;

      // Extract other preferences from metadata
      if (behavior.metadata) {
        if (behavior.metadata.category) {
          preferences.categories[behavior.metadata.category] = 
            (preferences.categories[behavior.metadata.category] || 0) + 1;
        }
        if (behavior.metadata.location) {
          preferences.locations[behavior.metadata.location] = 
            (preferences.locations[behavior.metadata.location] || 0) + 1;
        }
        if (behavior.metadata.academicLevel) {
          preferences.academicLevels[behavior.metadata.academicLevel] = 
            (preferences.academicLevels[behavior.metadata.academicLevel] || 0) + 1;
        }
        if (behavior.metadata.fieldOfStudy) {
          preferences.fieldsOfStudy[behavior.metadata.fieldOfStudy] = 
            (preferences.fieldsOfStudy[behavior.metadata.fieldOfStudy] || 0) + 1;
        }
      }
    });

    // Normalize preferences to percentages
    Object.keys(preferences).forEach(key => {
      const total = Object.values(preferences[key as keyof typeof preferences]).reduce((sum, count) => sum + count, 0);
      if (total > 0) {
        Object.keys(preferences[key as keyof typeof preferences]).forEach(subKey => {
          preferences[key as keyof typeof preferences][subKey] = 
            preferences[key as keyof typeof preferences][subKey] / total;
        });
      }
    });

    return preferences;
  }

  private calculatePatterns(behaviors: any[]): UserBehaviorProfile['patterns'] {
    const patterns = {
      activeHours: new Array(24).fill(0),
      activeDays: new Array(7).fill(0),
      sessionDuration: 0,
      averageEngagement: 0,
      searchFrequency: 0
    };

    if (behaviors.length === 0) return patterns;

    // Calculate active hours and days
    behaviors.forEach(behavior => {
      const date = new Date(behavior.timestamp);
      patterns.activeHours[date.getHours()]++;
      patterns.activeDays[date.getDay()]++;
    });

    // Normalize to percentages
    const totalBehaviors = behaviors.length;
    patterns.activeHours = patterns.activeHours.map(count => count / totalBehaviors);
    patterns.activeDays = patterns.activeDays.map(count => count / totalBehaviors);

    // Calculate session duration (simplified)
    const sessions = this.groupBehaviorsBySessions(behaviors);
    if (sessions.length > 0) {
      const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
      patterns.sessionDuration = totalDuration / sessions.length;
    }

    // Calculate engagement metrics
    const engagementActions = ['save', 'share', 'apply', 'like', 'bookmark'];
    const engagementCount = behaviors.filter(b => engagementActions.includes(b.action)).length;
    patterns.averageEngagement = engagementCount / totalBehaviors;

    // Calculate search frequency
    const searchCount = behaviors.filter(b => b.action === 'search').length;
    patterns.searchFrequency = searchCount / totalBehaviors;

    return patterns;
  }

  private extractInterests(behaviors: any[]): string[] {
    const interestCounts: Record<string, number> = {};

    behaviors.forEach(behavior => {
      if (behavior.metadata?.tags) {
        behavior.metadata.tags.forEach((tag: string) => {
          interestCounts[tag] = (interestCounts[tag] || 0) + 1;
        });
      }
      if (behavior.metadata?.category) {
        interestCounts[behavior.metadata.category] = 
          (interestCounts[behavior.metadata.category] || 0) + 1;
      }
    });

    // Return top interests
    return Object.entries(interestCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([interest]) => interest);
  }

  private groupBehaviorsBySessions(behaviors: any[]): Array<{ duration: number; behaviors: any[] }> {
    // Simplified session grouping - group behaviors within 30 minutes of each other
    const sessions: Array<{ duration: number; behaviors: any[] }> = [];
    const sessionTimeout = 30 * 60 * 1000; // 30 minutes

    let currentSession: any[] = [];
    let lastTimestamp: Date | null = null;

    behaviors.forEach(behavior => {
      const timestamp = new Date(behavior.timestamp);
      
      if (!lastTimestamp || timestamp.getTime() - lastTimestamp.getTime() > sessionTimeout) {
        // Start new session
        if (currentSession.length > 0) {
          const duration = lastTimestamp!.getTime() - new Date(currentSession[0].timestamp).getTime();
          sessions.push({ duration, behaviors: currentSession });
        }
        currentSession = [behavior];
      } else {
        // Continue current session
        currentSession.push(behavior);
      }
      
      lastTimestamp = timestamp;
    });

    // Add final session
    if (currentSession.length > 0 && lastTimestamp) {
      const duration = lastTimestamp.getTime() - new Date(currentSession[0].timestamp).getTime();
      sessions.push({ duration, behaviors: currentSession });
    }

    return sessions;
  }

  private generateBehaviorInsights(profile: UserBehaviorProfile): BehaviorInsights {
    const insights = {
      primaryInterests: profile.interests.slice(0, 5),
      preferredContentTypes: Object.entries(profile.preferences.contentTypes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([type]) => type),
      engagementLevel: this.categorizeEngagementLevel(profile.patterns.averageEngagement),
      searchPatterns: this.analyzeSearchPatterns(profile),
      recommendations: this.generateRecommendations(profile)
    };

    const dataPoints = profile.recentActivity.length;
    const confidence = Math.min(1, dataPoints / 50); // Full confidence at 50+ data points

    return {
      userId: profile.userId,
      insights,
      confidence,
      dataPoints
    };
  }

  private categorizeEngagementLevel(averageEngagement: number): 'low' | 'medium' | 'high' {
    if (averageEngagement < 0.1) return 'low';
    if (averageEngagement < 0.3) return 'medium';
    return 'high';
  }

  private analyzeSearchPatterns(profile: UserBehaviorProfile): string[] {
    const patterns: string[] = [];

    // Analyze active hours
    const peakHour = profile.patterns.activeHours.indexOf(Math.max(...profile.patterns.activeHours));
    if (peakHour < 6) patterns.push('Night owl - most active late at night');
    else if (peakHour < 12) patterns.push('Morning person - most active in the morning');
    else if (peakHour < 18) patterns.push('Afternoon researcher - most active in the afternoon');
    else patterns.push('Evening browser - most active in the evening');

    // Analyze search frequency
    if (profile.patterns.searchFrequency > 0.3) {
      patterns.push('Heavy searcher - frequently uses search functionality');
    } else if (profile.patterns.searchFrequency > 0.1) {
      patterns.push('Moderate searcher - occasionally uses search');
    } else {
      patterns.push('Browser - prefers browsing over searching');
    }

    return patterns;
  }

  private generateRecommendations(profile: UserBehaviorProfile): string[] {
    const recommendations: string[] = [];

    // Based on engagement level
    if (profile.patterns.averageEngagement < 0.1) {
      recommendations.push('Try saving interesting content for later review');
      recommendations.push('Share content with friends to increase engagement');
    }

    // Based on content preferences
    const topContentType = Object.entries(profile.preferences.contentTypes)[0];
    if (topContentType) {
      recommendations.push(`Explore more ${topContentType[0]} content based on your interests`);
    }

    // Based on interests
    if (profile.interests.length > 0) {
      recommendations.push(`Check out trending content in ${profile.interests[0]}`);
    }

    return recommendations;
  }

  private async findSimilarUsers(userProfile: UserBehaviorProfile, limit: number): Promise<any[]> {
    // Simplified similarity calculation - in production, would use more sophisticated ML algorithms
    try {
      const otherProfiles = await prisma.userBehaviorProfile.findMany({
        where: {
          userId: { not: userProfile.userId }
        },
        take: 100 // Limit for performance
      });

      const similarities = otherProfiles.map(profile => ({
        userId: profile.userId,
        similarity: this.calculateProfileSimilarity(userProfile, this.deserializeBehaviorProfile(profile))
      }));

      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

    } catch (error) {
      logger.error('Error finding similar users:', error);
      return [];
    }
  }

  private calculateProfileSimilarity(profile1: UserBehaviorProfile, profile2: UserBehaviorProfile): number {
    // Simplified cosine similarity calculation
    let similarity = 0;
    let factors = 0;

    // Compare content type preferences
    const contentTypeSimilarity = this.calculatePreferenceSimilarity(
      profile1.preferences.contentTypes,
      profile2.preferences.contentTypes
    );
    similarity += contentTypeSimilarity;
    factors++;

    // Compare interests
    const commonInterests = profile1.interests.filter(interest => 
      profile2.interests.includes(interest)
    ).length;
    const interestSimilarity = commonInterests / Math.max(profile1.interests.length, profile2.interests.length, 1);
    similarity += interestSimilarity;
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  private calculatePreferenceSimilarity(prefs1: Record<string, number>, prefs2: Record<string, number>): number {
    const keys = new Set([...Object.keys(prefs1), ...Object.keys(prefs2)]);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    keys.forEach(key => {
      const val1 = prefs1[key] || 0;
      const val2 = prefs2[key] || 0;
      dotProduct += val1 * val2;
      norm1 += val1 * val1;
      norm2 += val2 * val2;
    });

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  private async cacheBehaviorProfile(profile: UserBehaviorProfile): Promise<void> {
    try {
      await prisma.userBehaviorProfile.upsert({
        where: { userId: profile.userId },
        update: {
          preferences: profile.preferences,
          patterns: profile.patterns,
          interests: profile.interests,
          recentActivity: profile.recentActivity,
          lastUpdated: profile.lastUpdated
        },
        create: {
          userId: profile.userId,
          preferences: profile.preferences,
          patterns: profile.patterns,
          interests: profile.interests,
          recentActivity: profile.recentActivity,
          lastUpdated: profile.lastUpdated
        }
      });
    } catch (error) {
      logger.error('Error caching behavior profile:', error);
    }
  }

  private deserializeBehaviorProfile(cached: any): UserBehaviorProfile {
    return {
      userId: cached.userId,
      preferences: cached.preferences,
      patterns: cached.patterns,
      interests: cached.interests,
      recentActivity: cached.recentActivity,
      lastUpdated: cached.lastUpdated
    };
  }

  private isProfileFresh(lastUpdated: Date): boolean {
    const staleThreshold = 60 * 60 * 1000; // 1 hour
    return Date.now() - lastUpdated.getTime() < staleThreshold;
  }

  private calculatePopularityScore(interactions: number, timeframeDuration: number): number {
    // Normalize popularity score based on timeframe
    const hoursInTimeframe = timeframeDuration / (60 * 60 * 1000);
    const interactionsPerHour = interactions / hoursInTimeframe;
    
    // Logarithmic scaling to prevent extreme values
    return Math.min(1, Math.log10(interactionsPerHour + 1) / 2);
  }

  private getTimeframeDuration(timeframe: string): number {
    const durations: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    return durations[timeframe] || durations['24h'];
  }

  private startBatchProcessor(): void {
    // Process behavior queue every 30 seconds
    setInterval(() => {
      if (this.behaviorQueue.length > 0) {
        this.processBehaviorBatch().catch(error => {
          logger.error('Error in batch processor:', error);
        });
      }
    }, 30000);
  }

  private startProfileUpdater(): void {
    // Update user profiles periodically
    setInterval(() => {
      this.updateStaleProfiles().catch(error => {
        logger.error('Error updating stale profiles:', error);
      });
    }, this.PROFILE_UPDATE_INTERVAL);
  }

  private async updateStaleProfiles(): Promise<void> {
    try {
      const staleThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      
      const staleProfiles = await prisma.userBehaviorProfile.findMany({
        where: {
          lastUpdated: { lt: staleThreshold }
        },
        take: 10 // Limit to avoid overwhelming the system
      });

      for (const profile of staleProfiles) {
        await this.generateBehaviorProfile(profile.userId);
      }

      if (staleProfiles.length > 0) {
        logger.info(`Updated ${staleProfiles.length} stale behavior profiles`);
      }

    } catch (error) {
      logger.error('Error updating stale profiles:', error);
    }
  }
}