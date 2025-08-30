import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import axios from 'axios';

const prisma = new PrismaClient();

export interface TrendingItem {
  id: string;
  type: string;
  title: string;
  description: string;
  trendingScore: number;
  changeRate: number;
  timeframe: string;
  category: string;
  metadata: Record<string, any>;
  tags: string[];
  url?: string;
  imageUrl?: string;
  stats: {
    views: number;
    interactions: number;
    shares: number;
    growth: number;
  };
}

export interface TrendingResponse {
  trending: TrendingItem[];
  timeframe: string;
  lastUpdated: Date;
  totalItems: number;
  categories: string[];
}

export class TrendingService {
  private readonly SEARCH_SERVICE_URL: string;
  private readonly ANALYTICS_REFRESH_INTERVAL = 300000; // 5 minutes

  constructor() {
    this.SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'http://localhost:3003';
    this.startTrendingAnalytics();
  }

  async getTrendingContent(
    contentType?: string,
    timeframe: string = '24h',
    category?: string,
    limit: number = 20
  ): Promise<TrendingResponse> {
    try {
      logger.info('Getting trending content', { contentType, timeframe, category, limit });

      // Get trending data from database
      const trendingData = await this.getTrendingFromDatabase(contentType, timeframe, category, limit);
      
      // If no recent data, calculate fresh trending scores
      if (trendingData.length === 0 || this.isDataStale(trendingData[0]?.lastCalculated)) {
        await this.calculateTrendingScores(timeframe);
        return this.getTrendingContent(contentType, timeframe, category, limit);
      }

      // Transform to response format
      const trending = await this.transformTrendingData(trendingData);
      
      // Get unique categories
      const categories = [...new Set(trending.map(item => item.category))];

      return {
        trending: trending.slice(0, limit),
        timeframe,
        lastUpdated: trendingData[0]?.lastCalculated || new Date(),
        totalItems: trending.length,
        categories
      };

    } catch (error) {
      logger.error('Error getting trending content:', error);
      throw new Error('Failed to get trending content');
    }
  }

  async getTrendingUniversities(timeframe: string = '24h', limit: number = 10): Promise<TrendingItem[]> {
    const response = await this.getTrendingContent('university', timeframe, undefined, limit);
    return response.trending;
  }

  async getTrendingPrograms(timeframe: string = '24h', limit: number = 10): Promise<TrendingItem[]> {
    const response = await this.getTrendingContent('program', timeframe, undefined, limit);
    return response.trending;
  }

  async getTrendingScholarships(timeframe: string = '24h', limit: number = 10): Promise<TrendingItem[]> {
    const response = await this.getTrendingContent('scholarship', timeframe, undefined, limit);
    return response.trending;
  }

  async getTrendingByCategory(category: string, timeframe: string = '24h', limit: number = 10): Promise<TrendingItem[]> {
    const response = await this.getTrendingContent(undefined, timeframe, category, limit);
    return response.trending;
  }

  async getPopularSearches(timeframe: string = '24h', limit: number = 10): Promise<any[]> {
    try {
      // Get popular searches from search service
      const response = await axios.get(`${this.SEARCH_SERVICE_URL}/api/v1/analytics/popular-queries`, {
        params: { timeframe, limit }
      });

      return response.data.popularQueries || [];

    } catch (error) {
      logger.error('Error getting popular searches:', error);
      return [];
    }
  }

  async getEmergingContent(contentType?: string, limit: number = 10): Promise<TrendingItem[]> {
    try {
      // Get content with high growth rates but lower absolute numbers
      const emergingData = await prisma.trendingContent.findMany({
        where: {
          ...(contentType && { contentType }),
          changeRate: { gt: 2.0 }, // High growth rate
          trendingScore: { lt: 0.7 } // But not yet mainstream
        },
        orderBy: { changeRate: 'desc' },
        take: limit
      });

      return this.transformTrendingData(emergingData);

    } catch (error) {
      logger.error('Error getting emerging content:', error);
      return [];
    }
  }

  async getViralContent(timeframe: string = '24h', limit: number = 10): Promise<TrendingItem[]> {
    try {
      // Get content with extremely high engagement rates
      const viralData = await prisma.trendingContent.findMany({
        where: {
          trendingScore: { gt: 0.9 }, // Very high trending score
          changeRate: { gt: 5.0 }, // Explosive growth
          timeframe
        },
        orderBy: { trendingScore: 'desc' },
        take: limit
      });

      return this.transformTrendingData(viralData);

    } catch (error) {
      logger.error('Error getting viral content:', error);
      return [];
    }
  }

  async updateTrendingScores(): Promise<void> {
    try {
      logger.info('Updating trending scores');
      
      const timeframes = ['1h', '6h', '24h', '7d'];
      
      for (const timeframe of timeframes) {
        await this.calculateTrendingScores(timeframe);
      }

      logger.info('Trending scores updated successfully');

    } catch (error) {
      logger.error('Error updating trending scores:', error);
    }
  }

  private async getTrendingFromDatabase(
    contentType?: string,
    timeframe: string = '24h',
    category?: string,
    limit: number = 20
  ): Promise<any[]> {
    return prisma.trendingContent.findMany({
      where: {
        ...(contentType && { contentType }),
        ...(category && { category }),
        timeframe
      },
      orderBy: { trendingScore: 'desc' },
      take: limit
    });
  }

  private async calculateTrendingScores(timeframe: string): Promise<void> {
    try {
      // Get interaction data for the timeframe
      const interactions = await this.getInteractionData(timeframe);
      
      // Calculate trending scores for each content item
      const trendingScores = this.calculateScores(interactions, timeframe);
      
      // Save to database
      await this.saveTrendingScores(trendingScores, timeframe);

    } catch (error) {
      logger.error('Error calculating trending scores:', error);
    }
  }

  private async getInteractionData(timeframe: string): Promise<any[]> {
    const timeframeDuration = this.getTimeframeDuration(timeframe);
    const startTime = new Date(Date.now() - timeframeDuration);

    try {
      // Get interaction data from behavior tracking
      const interactions = await prisma.userBehavior.findMany({
        where: {
          timestamp: { gte: startTime },
          action: { in: ['view', 'click', 'share', 'save', 'apply'] }
        },
        include: {
          content: true
        }
      });

      return interactions;

    } catch (error) {
      logger.error('Error getting interaction data:', error);
      return [];
    }
  }

  private calculateScores(interactions: any[], timeframe: string): Map<string, any> {
    const contentScores = new Map();
    const timeframeDuration = this.getTimeframeDuration(timeframe);
    const now = Date.now();

    // Group interactions by content
    const contentInteractions = new Map();
    
    interactions.forEach(interaction => {
      const contentId = interaction.contentId;
      if (!contentInteractions.has(contentId)) {
        contentInteractions.set(contentId, {
          content: interaction.content,
          interactions: [],
          views: 0,
          clicks: 0,
          shares: 0,
          saves: 0,
          applies: 0
        });
      }

      const contentData = contentInteractions.get(contentId);
      contentData.interactions.push(interaction);
      contentData[interaction.action + 's']++;
    });

    // Calculate trending scores
    contentInteractions.forEach((data, contentId) => {
      const score = this.calculateTrendingScore(data, timeframeDuration, now);
      const changeRate = this.calculateChangeRate(data, timeframeDuration);
      
      contentScores.set(contentId, {
        contentId,
        contentType: data.content?.type || 'unknown',
        category: data.content?.category || 'general',
        trendingScore: score,
        changeRate,
        stats: {
          views: data.views,
          interactions: data.interactions.length,
          shares: data.shares,
          growth: changeRate
        },
        metadata: data.content || {}
      });
    });

    return contentScores;
  }

  private calculateTrendingScore(data: any, timeframeDuration: number, now: number): number {
    const totalInteractions = data.interactions.length;
    const recentWeight = 0.7; // Weight for recency
    const volumeWeight = 0.3; // Weight for volume

    // Calculate recency score (more recent interactions score higher)
    let recencyScore = 0;
    data.interactions.forEach((interaction: any) => {
      const age = now - interaction.timestamp.getTime();
      const recencyFactor = Math.max(0, 1 - (age / timeframeDuration));
      recencyScore += recencyFactor;
    });
    recencyScore = recencyScore / totalInteractions;

    // Calculate volume score (normalized by typical volume)
    const volumeScore = Math.min(1, totalInteractions / 100); // Normalize to 0-1

    // Combine scores
    const trendingScore = (recencyScore * recentWeight) + (volumeScore * volumeWeight);
    
    return Math.min(1, trendingScore);
  }

  private calculateChangeRate(data: any, timeframeDuration: number): number {
    if (data.interactions.length < 2) return 1.0;

    // Split timeframe in half to compare growth
    const midpoint = Date.now() - (timeframeDuration / 2);
    
    const recentInteractions = data.interactions.filter((i: any) => 
      i.timestamp.getTime() > midpoint
    ).length;
    
    const olderInteractions = data.interactions.filter((i: any) => 
      i.timestamp.getTime() <= midpoint
    ).length;

    if (olderInteractions === 0) return 10.0; // New content with interactions
    
    return recentInteractions / olderInteractions;
  }

  private async saveTrendingScores(scores: Map<string, any>, timeframe: string): Promise<void> {
    const trendingData = Array.from(scores.values()).map(score => ({
      contentId: score.contentId,
      contentType: score.contentType,
      category: score.category,
      trendingScore: score.trendingScore,
      changeRate: score.changeRate,
      timeframe,
      stats: score.stats,
      metadata: score.metadata,
      lastCalculated: new Date()
    }));

    // Delete old data for this timeframe
    await prisma.trendingContent.deleteMany({
      where: { timeframe }
    });

    // Insert new data
    await prisma.trendingContent.createMany({
      data: trendingData
    });
  }

  private async transformTrendingData(data: any[]): Promise<TrendingItem[]> {
    return data.map(item => ({
      id: item.contentId,
      type: item.contentType,
      title: item.metadata?.title || 'Unknown',
      description: item.metadata?.description || '',
      trendingScore: item.trendingScore,
      changeRate: item.changeRate,
      timeframe: item.timeframe,
      category: item.category,
      metadata: item.metadata || {},
      tags: item.metadata?.tags || [],
      url: item.metadata?.url,
      imageUrl: item.metadata?.imageUrl,
      stats: item.stats || {
        views: 0,
        interactions: 0,
        shares: 0,
        growth: item.changeRate
      }
    }));
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

  private isDataStale(lastCalculated?: Date): boolean {
    if (!lastCalculated) return true;
    
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    return Date.now() - lastCalculated.getTime() > staleThreshold;
  }

  private startTrendingAnalytics(): void {
    // Update trending scores periodically
    setInterval(() => {
      this.updateTrendingScores().catch(error => {
        logger.error('Error in trending analytics update:', error);
      });
    }, this.ANALYTICS_REFRESH_INTERVAL);

    logger.info('Trending analytics started');
  }
}