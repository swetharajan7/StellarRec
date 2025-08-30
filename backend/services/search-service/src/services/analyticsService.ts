import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface SearchAnalytics {
  searchId: string;
  userId?: string;
  sessionId?: string;
  query: string;
  filters?: any;
  resultsCount: number;
  processingTime: number;
  clickedResults?: string[];
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  location?: string;
}

export interface QueryPerformance {
  query: string;
  avgProcessingTime: number;
  totalSearches: number;
  avgResultsCount: number;
  clickThroughRate: number;
  lastSearched: Date;
}

export interface SearchTrends {
  period: 'hour' | 'day' | 'week' | 'month';
  queries: Array<{
    query: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
  }>;
  categories: Array<{
    category: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  filters: Array<{
    filter: string;
    value: string;
    count: number;
  }>;
}

export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}

  async logSearch(analytics: SearchAnalytics): Promise<void> {
    try {
      await this.prisma.search_analytics.create({
        data: {
          id: uuidv4(),
          search_id: analytics.searchId,
          user_id: analytics.userId,
          session_id: analytics.sessionId,
          query: analytics.query,
          filters: analytics.filters || {},
          results_count: analytics.resultsCount,
          processing_time: analytics.processingTime,
          clicked_results: analytics.clickedResults || [],
          timestamp: analytics.timestamp,
          user_agent: analytics.userAgent,
          ip_address: analytics.ipAddress,
          location: analytics.location
        }
      });

      logger.info(`Search analytics logged: ${analytics.searchId}`);
    } catch (error) {
      logger.error('Failed to log search analytics:', error);
    }
  }

  async logClick(searchId: string, documentId: string, position: number, userId?: string): Promise<void> {
    try {
      await this.prisma.search_clicks.create({
        data: {
          id: uuidv4(),
          search_id: searchId,
          document_id: documentId,
          position: position,
          user_id: userId,
          timestamp: new Date()
        }
      });

      // Update the search analytics record with clicked results
      await this.prisma.search_analytics.updateMany({
        where: { search_id: searchId },
        data: {
          clicked_results: {
            push: documentId
          }
        }
      });

      logger.info(`Click logged: ${searchId} -> ${documentId}`);
    } catch (error) {
      logger.error('Failed to log click:', error);
    }
  }

  async getPopularQueries(limit: number = 20, timeframe: 'day' | 'week' | 'month' = 'week'): Promise<Array<{
    query: string;
    count: number;
    avgResultsCount: number;
    clickThroughRate: number;
  }>> {
    try {
      const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframeDays);

      const popularQueries = await this.prisma.search_analytics.groupBy({
        by: ['query'],
        where: {
          timestamp: {
            gte: startDate
          },
          query: {
            not: ''
          }
        },
        _count: {
          query: true
        },
        _avg: {
          results_count: true
        },
        orderBy: {
          _count: {
            query: 'desc'
          }
        },
        take: limit
      });

      // Calculate click-through rates
      const results = await Promise.all(
        popularQueries.map(async (item) => {
          const totalSearches = item._count.query;
          const searchesWithClicks = await this.prisma.search_analytics.count({
            where: {
              query: item.query,
              timestamp: {
                gte: startDate
              },
              clicked_results: {
                not: {
                  equals: []
                }
              }
            }
          });

          return {
            query: item.query,
            count: totalSearches,
            avgResultsCount: Math.round(item._avg.results_count || 0),
            clickThroughRate: totalSearches > 0 ? (searchesWithClicks / totalSearches) * 100 : 0
          };
        })
      );

      return results;
    } catch (error) {
      logger.error('Failed to get popular queries:', error);
      return [];
    }
  }

  async getSearchTrends(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<SearchTrends> {
    try {
      const now = new Date();
      let startDate: Date;
      let previousStartDate: Date;

      switch (period) {
        case 'hour':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
          break;
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 2 * 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          previousStartDate = new Date(now.getTime() - 2 * 30 * 24 * 60 * 60 * 1000);
          break;
      }

      // Get current period queries
      const currentQueries = await this.prisma.search_analytics.groupBy({
        by: ['query'],
        where: {
          timestamp: {
            gte: startDate
          },
          query: {
            not: ''
          }
        },
        _count: {
          query: true
        },
        orderBy: {
          _count: {
            query: 'desc'
          }
        },
        take: 20
      });

      // Get previous period queries for comparison
      const previousQueries = await this.prisma.search_analytics.groupBy({
        by: ['query'],
        where: {
          timestamp: {
            gte: previousStartDate,
            lt: startDate
          },
          query: {
            not: ''
          }
        },
        _count: {
          query: true
        }
      });

      // Calculate trends
      const previousQueryMap = new Map(
        previousQueries.map(q => [q.query, q._count.query])
      );

      const queries = currentQueries.map(current => {
        const currentCount = current._count.query;
        const previousCount = previousQueryMap.get(current.query) || 0;
        
        let trend: 'up' | 'down' | 'stable' = 'stable';
        let changePercent = 0;

        if (previousCount > 0) {
          changePercent = ((currentCount - previousCount) / previousCount) * 100;
          if (changePercent > 10) trend = 'up';
          else if (changePercent < -10) trend = 'down';
        } else if (currentCount > 0) {
          trend = 'up';
          changePercent = 100;
        }

        return {
          query: current.query,
          count: currentCount,
          trend,
          changePercent: Math.round(changePercent)
        };
      });

      // Get category trends (simplified - would need actual category data)
      const categories = [
        { category: 'universities', count: 150, trend: 'up' as const },
        { category: 'programs', count: 120, trend: 'stable' as const },
        { category: 'scholarships', count: 80, trend: 'up' as const },
        { category: 'applications', count: 60, trend: 'down' as const }
      ];

      // Get filter usage trends
      const filters = [
        { filter: 'location', value: 'United States', count: 200 },
        { filter: 'type', value: 'university', count: 180 },
        { filter: 'category', value: 'engineering', count: 150 },
        { filter: 'difficulty', value: 'moderate', count: 120 }
      ];

      return {
        period,
        queries,
        categories,
        filters
      };

    } catch (error) {
      logger.error('Failed to get search trends:', error);
      return {
        period,
        queries: [],
        categories: [],
        filters: []
      };
    }
  }

  async getQueryPerformance(query: string): Promise<QueryPerformance | null> {
    try {
      const analytics = await this.prisma.search_analytics.aggregate({
        where: { query },
        _avg: {
          processing_time: true,
          results_count: true
        },
        _count: {
          query: true
        },
        _max: {
          timestamp: true
        }
      });

      if (!analytics._count.query) {
        return null;
      }

      // Calculate click-through rate
      const searchesWithClicks = await this.prisma.search_analytics.count({
        where: {
          query,
          clicked_results: {
            not: {
              equals: []
            }
          }
        }
      });

      return {
        query,
        avgProcessingTime: Math.round(analytics._avg.processing_time || 0),
        totalSearches: analytics._count.query,
        avgResultsCount: Math.round(analytics._avg.results_count || 0),
        clickThroughRate: (searchesWithClicks / analytics._count.query) * 100,
        lastSearched: analytics._max.timestamp || new Date()
      };

    } catch (error) {
      logger.error('Failed to get query performance:', error);
      return null;
    }
  }

  async getSearchStats(timeframe: 'day' | 'week' | 'month' = 'week'): Promise<{
    totalSearches: number;
    uniqueQueries: number;
    avgProcessingTime: number;
    avgResultsCount: number;
    topCategories: Array<{ category: string; count: number }>;
    topFilters: Array<{ filter: string; count: number }>;
    clickThroughRate: number;
  }> {
    try {
      const timeframeDays = timeframe === 'day' ? 1 : timeframe === 'week' ? 7 : 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframeDays);

      const [totalStats, uniqueQueries, searchesWithClicks] = await Promise.all([
        this.prisma.search_analytics.aggregate({
          where: {
            timestamp: {
              gte: startDate
            }
          },
          _count: {
            id: true
          },
          _avg: {
            processing_time: true,
            results_count: true
          }
        }),
        this.prisma.search_analytics.groupBy({
          by: ['query'],
          where: {
            timestamp: {
              gte: startDate
            },
            query: {
              not: ''
            }
          }
        }),
        this.prisma.search_analytics.count({
          where: {
            timestamp: {
              gte: startDate
            },
            clicked_results: {
              not: {
                equals: []
              }
            }
          }
        })
      ]);

      // Mock data for categories and filters (would come from actual filter analysis)
      const topCategories = [
        { category: 'universities', count: 45 },
        { category: 'programs', count: 38 },
        { category: 'scholarships', count: 25 },
        { category: 'applications', count: 18 }
      ];

      const topFilters = [
        { filter: 'location', count: 120 },
        { filter: 'type', count: 95 },
        { filter: 'category', count: 78 },
        { filter: 'difficulty', count: 56 }
      ];

      return {
        totalSearches: totalStats._count.id,
        uniqueQueries: uniqueQueries.length,
        avgProcessingTime: Math.round(totalStats._avg.processing_time || 0),
        avgResultsCount: Math.round(totalStats._avg.results_count || 0),
        topCategories,
        topFilters,
        clickThroughRate: totalStats._count.id > 0 ? (searchesWithClicks / totalStats._count.id) * 100 : 0
      };

    } catch (error) {
      logger.error('Failed to get search stats:', error);
      return {
        totalSearches: 0,
        uniqueQueries: 0,
        avgProcessingTime: 0,
        avgResultsCount: 0,
        topCategories: [],
        topFilters: [],
        clickThroughRate: 0
      };
    }
  }

  async getFailedQueries(limit: number = 20): Promise<Array<{
    query: string;
    count: number;
    avgResultsCount: number;
    lastSearched: Date;
  }>> {
    try {
      const failedQueries = await this.prisma.search_analytics.groupBy({
        by: ['query'],
        where: {
          results_count: {
            lte: 2 // Consider queries with 2 or fewer results as "failed"
          },
          query: {
            not: ''
          }
        },
        _count: {
          query: true
        },
        _avg: {
          results_count: true
        },
        _max: {
          timestamp: true
        },
        orderBy: {
          _count: {
            query: 'desc'
          }
        },
        take: limit
      });

      return failedQueries.map(item => ({
        query: item.query,
        count: item._count.query,
        avgResultsCount: Math.round(item._avg.results_count || 0),
        lastSearched: item._max.timestamp || new Date()
      }));

    } catch (error) {
      logger.error('Failed to get failed queries:', error);
      return [];
    }
  }

  async getUserSearchHistory(userId: string, limit: number = 50): Promise<Array<{
    searchId: string;
    query: string;
    resultsCount: number;
    timestamp: Date;
    clickedResults: string[];
  }>> {
    try {
      const searches = await this.prisma.search_analytics.findMany({
        where: { user_id: userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          search_id: true,
          query: true,
          results_count: true,
          timestamp: true,
          clicked_results: true
        }
      });

      return searches.map(search => ({
        searchId: search.search_id,
        query: search.query,
        resultsCount: search.results_count,
        timestamp: search.timestamp,
        clickedResults: search.clicked_results as string[]
      }));

    } catch (error) {
      logger.error('Failed to get user search history:', error);
      return [];
    }
  }

  async optimizeQuery(query: string): Promise<{
    originalQuery: string;
    optimizedQuery: string;
    suggestions: string[];
    expectedImprovement: number;
  }> {
    try {
      // Analyze query performance
      const performance = await this.getQueryPerformance(query);
      
      // Get similar successful queries
      const similarQueries = await this.prisma.search_analytics.findMany({
        where: {
          query: {
            contains: query.split(' ')[0] // Simple similarity based on first word
          },
          results_count: {
            gte: 10 // Only consider queries with good results
          }
        },
        orderBy: {
          results_count: 'desc'
        },
        take: 5,
        distinct: ['query']
      });

      const suggestions = similarQueries.map(s => s.query);
      
      // Simple optimization rules
      let optimizedQuery = query;
      
      // Remove common stop words that might hurt search
      const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
      const words = query.toLowerCase().split(' ');
      const filteredWords = words.filter(word => !stopWords.includes(word));
      
      if (filteredWords.length < words.length && filteredWords.length > 0) {
        optimizedQuery = filteredWords.join(' ');
      }

      // Add common synonyms
      const synonyms: Record<string, string> = {
        'college': 'university',
        'school': 'university',
        'course': 'program',
        'degree': 'program',
        'grant': 'scholarship',
        'funding': 'scholarship'
      };

      for (const [original, replacement] of Object.entries(synonyms)) {
        if (optimizedQuery.toLowerCase().includes(original)) {
          optimizedQuery = optimizedQuery.replace(new RegExp(original, 'gi'), replacement);
        }
      }

      const expectedImprovement = performance && performance.avgResultsCount < 5 ? 25 : 10;

      return {
        originalQuery: query,
        optimizedQuery,
        suggestions,
        expectedImprovement
      };

    } catch (error) {
      logger.error('Failed to optimize query:', error);
      return {
        originalQuery: query,
        optimizedQuery: query,
        suggestions: [],
        expectedImprovement: 0
      };
    }
  }

  async cleanupOldAnalytics(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.search_analytics.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      logger.info(`Cleaned up ${result.count} old analytics records`);
      return result.count;

    } catch (error) {
      logger.error('Failed to cleanup old analytics:', error);
      return 0;
    }
  }
}