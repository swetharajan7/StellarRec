import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { BehaviorTrackingService, UserBehaviorProfile } from './behaviorTrackingService';
import axios from 'axios';

const prisma = new PrismaClient();

export interface PersonalizationContext {
  userId: string;
  userType: 'student' | 'recommender';
  currentPage?: string;
  sessionId?: string;
  location?: string;
  device?: string;
  timeOfDay?: string;
  preferences?: Record<string, any>;
}

export interface PersonalizedContent {
  id: string;
  type: string;
  title: string;
  description: string;
  score: number;
  reasoning: string[];
  metadata: Record<string, any>;
  personalizationFactors: {
    behaviorMatch: number;
    profileMatch: number;
    contextMatch: number;
    trendingBoost: number;
    diversityScore: number;
  };
}

export interface PersonalizationResponse {
  content: PersonalizedContent[];
  totalCount: number;
  personalizationStrategy: string;
  confidence: number;
  metadata: {
    userProfile: any;
    appliedFilters: string[];
    diversityMetrics: any;
  };
}

export class PersonalizationService {
  private behaviorService: BehaviorTrackingService;
  private readonly USER_SERVICE_URL: string;
  private readonly SEARCH_SERVICE_URL: string;

  constructor() {
    this.behaviorService = new BehaviorTrackingService();
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'http://localhost:3003';
  }

  async personalizeContent(
    context: PersonalizationContext,
    candidateContent: any[],
    limit: number = 20
  ): Promise<PersonalizationResponse> {
    try {
      logger.info('Personalizing content', { 
        userId: context.userId, 
        contentCount: candidateContent.length,
        limit 
      });

      // Get user behavior profile and preferences
      const [behaviorProfile, userProfile] = await Promise.all([
        this.behaviorService.getUserBehaviorProfile(context.userId),
        this.getUserProfile(context.userId)
      ]);

      // Determine personalization strategy
      const strategy = this.selectPersonalizationStrategy(behaviorProfile, userProfile, context);
      
      // Score and rank content based on personalization
      const scoredContent = await this.scoreContent(
        candidateContent,
        behaviorProfile,
        userProfile,
        context,
        strategy
      );

      // Apply diversity filtering
      const diversifiedContent = this.applyDiversityFiltering(scoredContent, context);
      
      // Calculate confidence score
      const confidence = this.calculatePersonalizationConfidence(behaviorProfile, userProfile);

      return {
        content: diversifiedContent.slice(0, limit),
        totalCount: scoredContent.length,
        personalizationStrategy: strategy,
        confidence,
        metadata: {
          userProfile: this.sanitizeUserProfile(userProfile),
          appliedFilters: this.getAppliedFilters(strategy, behaviorProfile, userProfile),
          diversityMetrics: this.calculateDiversityMetrics(diversifiedContent)
        }
      };

    } catch (error) {
      logger.error('Error personalizing content:', error);
      throw new Error('Failed to personalize content');
    }
  }

  async getPersonalizedFeed(
    context: PersonalizationContext,
    contentTypes?: string[],
    limit: number = 20
  ): Promise<PersonalizationResponse> {
    try {
      // Get candidate content from various sources
      const candidateContent = await this.getCandidateContent(context, contentTypes, limit * 3);
      
      // Personalize the content
      return this.personalizeContent(context, candidateContent, limit);

    } catch (error) {
      logger.error('Error getting personalized feed:', error);
      throw new Error('Failed to get personalized feed');
    }
  }

  async getPersonalizedRecommendations(
    context: PersonalizationContext,
    recommendationType: 'similar' | 'trending' | 'popular' | 'new',
    limit: number = 10
  ): Promise<PersonalizedContent[]> {
    try {
      let candidateContent: any[] = [];

      switch (recommendationType) {
        case 'similar':
          candidateContent = await this.getSimilarContent(context, limit * 2);
          break;
        case 'trending':
          candidateContent = await this.getTrendingContent(context, limit * 2);
          break;
        case 'popular':
          candidateContent = await this.getPopularContent(context, limit * 2);
          break;
        case 'new':
          candidateContent = await this.getNewContent(context, limit * 2);
          break;
      }

      const personalized = await this.personalizeContent(context, candidateContent, limit);
      return personalized.content;

    } catch (error) {
      logger.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  async updateUserPreferences(
    userId: string,
    preferences: Record<string, any>
  ): Promise<void> {
    try {
      await prisma.userPersonalization.upsert({
        where: { userId },
        update: {
          preferences,
          lastUpdated: new Date()
        },
        create: {
          userId,
          preferences,
          lastUpdated: new Date()
        }
      });

      logger.info('User preferences updated', { userId });

    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw new Error('Failed to update user preferences');
    }
  }

  async getPersonalizationInsights(userId: string): Promise<any> {
    try {
      const [behaviorProfile, userProfile, personalizationData] = await Promise.all([
        this.behaviorService.getUserBehaviorProfile(userId),
        this.getUserProfile(userId),
        prisma.userPersonalization.findUnique({ where: { userId } })
      ]);

      return {
        behaviorInsights: behaviorProfile ? {
          primaryInterests: behaviorProfile.interests.slice(0, 5),
          contentPreferences: Object.entries(behaviorProfile.preferences.contentTypes)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3),
          engagementLevel: this.categorizeEngagementLevel(behaviorProfile.patterns.averageEngagement),
          activePatterns: this.getActivePatterns(behaviorProfile.patterns)
        } : null,
        profileInsights: userProfile ? {
          academicLevel: userProfile.academicLevel,
          fieldOfStudy: userProfile.fieldOfStudy,
          interests: userProfile.interests,
          location: userProfile.location
        } : null,
        personalizationSettings: personalizationData?.preferences || {},
        recommendations: {
          improvementSuggestions: this.generateImprovementSuggestions(behaviorProfile, userProfile),
          contentSuggestions: await this.generateContentSuggestions(userId, behaviorProfile)
        }
      };

    } catch (error) {
      logger.error('Error getting personalization insights:', error);
      return null;
    }
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.USER_SERVICE_URL}/api/v1/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      logger.warn('Failed to get user profile:', error);
      return null;
    }
  }

  private selectPersonalizationStrategy(
    behaviorProfile: UserBehaviorProfile | null,
    userProfile: any,
    context: PersonalizationContext
  ): string {
    // New users with minimal data
    if (!behaviorProfile || behaviorProfile.recentActivity.length < 5) {
      return 'profile_based';
    }

    // Users with rich behavior data
    if (behaviorProfile.recentActivity.length > 50) {
      return 'hybrid_advanced';
    }

    // Users with moderate behavior data
    if (behaviorProfile.recentActivity.length > 20) {
      return 'behavior_weighted';
    }

    // Users with some profile data
    if (userProfile && userProfile.interests && userProfile.interests.length > 0) {
      return 'profile_enhanced';
    }

    return 'popularity_based';
  }

  private async scoreContent(
    content: any[],
    behaviorProfile: UserBehaviorProfile | null,
    userProfile: any,
    context: PersonalizationContext,
    strategy: string
  ): Promise<PersonalizedContent[]> {
    return content.map(item => {
      const factors = this.calculatePersonalizationFactors(
        item,
        behaviorProfile,
        userProfile,
        context,
        strategy
      );

      const score = this.calculateOverallScore(factors, strategy);
      const reasoning = this.generateReasoning(factors, item, strategy);

      return {
        id: item.id,
        type: item.type || 'unknown',
        title: item.title,
        description: item.description,
        score,
        reasoning,
        metadata: item.metadata || {},
        personalizationFactors: factors
      };
    }).sort((a, b) => b.score - a.score);
  }

  private calculatePersonalizationFactors(
    item: any,
    behaviorProfile: UserBehaviorProfile | null,
    userProfile: any,
    context: PersonalizationContext,
    strategy: string
  ): PersonalizedContent['personalizationFactors'] {
    const factors = {
      behaviorMatch: 0,
      profileMatch: 0,
      contextMatch: 0,
      trendingBoost: 0,
      diversityScore: 0
    };

    // Behavior matching
    if (behaviorProfile) {
      factors.behaviorMatch = this.calculateBehaviorMatch(item, behaviorProfile);
    }

    // Profile matching
    if (userProfile) {
      factors.profileMatch = this.calculateProfileMatch(item, userProfile);
    }

    // Context matching
    factors.contextMatch = this.calculateContextMatch(item, context);

    // Trending boost
    factors.trendingBoost = this.calculateTrendingBoost(item);

    // Diversity score
    factors.diversityScore = this.calculateDiversityScore(item, context);

    return factors;
  }

  private calculateBehaviorMatch(item: any, behaviorProfile: UserBehaviorProfile): number {
    let score = 0;
    let factors = 0;

    // Content type preference
    if (behaviorProfile.preferences.contentTypes[item.type]) {
      score += behaviorProfile.preferences.contentTypes[item.type];
      factors++;
    }

    // Category preference
    if (item.category && behaviorProfile.preferences.categories[item.category]) {
      score += behaviorProfile.preferences.categories[item.category];
      factors++;
    }

    // Interest alignment
    if (item.tags && behaviorProfile.interests) {
      const matchingInterests = item.tags.filter((tag: string) => 
        behaviorProfile.interests.includes(tag)
      ).length;
      if (matchingInterests > 0) {
        score += matchingInterests / item.tags.length;
        factors++;
      }
    }

    return factors > 0 ? score / factors : 0;
  }

  private calculateProfileMatch(item: any, userProfile: any): number {
    let score = 0;
    let factors = 0;

    // Academic level match
    if (userProfile.academicLevel && item.academicLevel) {
      if (Array.isArray(item.academicLevel)) {
        if (item.academicLevel.includes(userProfile.academicLevel)) {
          score += 1;
        }
      } else if (item.academicLevel === userProfile.academicLevel) {
        score += 1;
      }
      factors++;
    }

    // Field of study match
    if (userProfile.fieldOfStudy && item.fieldOfStudy) {
      const userFields = Array.isArray(userProfile.fieldOfStudy) 
        ? userProfile.fieldOfStudy 
        : [userProfile.fieldOfStudy];
      const itemFields = Array.isArray(item.fieldOfStudy) 
        ? item.fieldOfStudy 
        : [item.fieldOfStudy];
      
      const matches = userFields.filter((field: string) => 
        itemFields.some((itemField: string) => 
          field.toLowerCase().includes(itemField.toLowerCase()) ||
          itemField.toLowerCase().includes(field.toLowerCase())
        )
      ).length;

      if (matches > 0) {
        score += matches / Math.max(userFields.length, itemFields.length);
        factors++;
      }
    }

    // Location preference
    if (userProfile.preferredLocations && item.location) {
      if (userProfile.preferredLocations.includes(item.location)) {
        score += 1;
        factors++;
      }
    }

    // Interest alignment
    if (userProfile.interests && item.tags) {
      const matchingInterests = userProfile.interests.filter((interest: string) => 
        item.tags.some((tag: string) => 
          tag.toLowerCase().includes(interest.toLowerCase()) ||
          interest.toLowerCase().includes(tag.toLowerCase())
        )
      ).length;

      if (matchingInterests > 0) {
        score += matchingInterests / userProfile.interests.length;
        factors++;
      }
    }

    return factors > 0 ? score / factors : 0;
  }

  private calculateContextMatch(item: any, context: PersonalizationContext): number {
    let score = 0;
    let factors = 0;

    // Time-based relevance
    if (item.deadline) {
      const deadline = new Date(item.deadline);
      const now = new Date();
      const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysUntilDeadline > 0 && daysUntilDeadline <= 30) {
        score += Math.max(0, 1 - (daysUntilDeadline / 30)); // Higher score for closer deadlines
        factors++;
      }
    }

    // Device/platform relevance
    if (context.device && item.metadata?.deviceOptimized) {
      if (item.metadata.deviceOptimized.includes(context.device)) {
        score += 1;
        factors++;
      }
    }

    // Location relevance
    if (context.location && item.location) {
      if (item.location === context.location) {
        score += 1;
        factors++;
      }
    }

    return factors > 0 ? score / factors : 0.5; // Default neutral score
  }

  private calculateTrendingBoost(item: any): number {
    // Simplified trending calculation - would integrate with trending service
    if (item.metadata?.trendingScore) {
      return item.metadata.trendingScore;
    }
    
    // Fallback based on recency and engagement
    if (item.createdAt) {
      const age = Date.now() - new Date(item.createdAt).getTime();
      const daysSinceCreated = age / (1000 * 60 * 60 * 24);
      
      if (daysSinceCreated <= 7) {
        return Math.max(0, 1 - (daysSinceCreated / 7));
      }
    }

    return 0;
  }

  private calculateDiversityScore(item: any, context: PersonalizationContext): number {
    // Simplified diversity calculation
    // In production, would track recently shown content and penalize similar items
    return 0.8; // Default diversity score
  }

  private calculateOverallScore(
    factors: PersonalizedContent['personalizationFactors'],
    strategy: string
  ): number {
    const weights = this.getStrategyWeights(strategy);
    
    return (
      factors.behaviorMatch * weights.behavior +
      factors.profileMatch * weights.profile +
      factors.contextMatch * weights.context +
      factors.trendingBoost * weights.trending +
      factors.diversityScore * weights.diversity
    );
  }

  private getStrategyWeights(strategy: string): Record<string, number> {
    const weights: Record<string, Record<string, number>> = {
      'profile_based': {
        behavior: 0.1,
        profile: 0.5,
        context: 0.2,
        trending: 0.1,
        diversity: 0.1
      },
      'behavior_weighted': {
        behavior: 0.4,
        profile: 0.3,
        context: 0.15,
        trending: 0.1,
        diversity: 0.05
      },
      'hybrid_advanced': {
        behavior: 0.35,
        profile: 0.25,
        context: 0.2,
        trending: 0.1,
        diversity: 0.1
      },
      'profile_enhanced': {
        behavior: 0.25,
        profile: 0.4,
        context: 0.2,
        trending: 0.1,
        diversity: 0.05
      },
      'popularity_based': {
        behavior: 0.1,
        profile: 0.2,
        context: 0.1,
        trending: 0.5,
        diversity: 0.1
      }
    };

    return weights[strategy] || weights['hybrid_advanced'];
  }

  private generateReasoning(
    factors: PersonalizedContent['personalizationFactors'],
    item: any,
    strategy: string
  ): string[] {
    const reasoning: string[] = [];

    if (factors.behaviorMatch > 0.7) {
      reasoning.push('Matches your browsing patterns and interests');
    }

    if (factors.profileMatch > 0.7) {
      reasoning.push('Aligns with your academic profile and preferences');
    }

    if (factors.contextMatch > 0.7) {
      reasoning.push('Relevant to your current context and timing');
    }

    if (factors.trendingBoost > 0.7) {
      reasoning.push('Currently trending and popular');
    }

    if (reasoning.length === 0) {
      reasoning.push('Recommended based on general popularity');
    }

    return reasoning;
  }

  private applyDiversityFiltering(
    content: PersonalizedContent[],
    context: PersonalizationContext
  ): PersonalizedContent[] {
    // Simple diversity filtering - ensure variety in content types and categories
    const diversified: PersonalizedContent[] = [];
    const seenTypes = new Set<string>();
    const seenCategories = new Set<string>();
    const maxPerType = Math.ceil(content.length / 4); // Max 25% of any single type
    const typeCount: Record<string, number> = {};

    for (const item of content) {
      const currentTypeCount = typeCount[item.type] || 0;
      
      if (currentTypeCount < maxPerType) {
        diversified.push(item);
        typeCount[item.type] = currentTypeCount + 1;
        seenTypes.add(item.type);
        if (item.metadata?.category) {
          seenCategories.add(item.metadata.category);
        }
      }
    }

    return diversified;
  }

  private calculatePersonalizationConfidence(
    behaviorProfile: UserBehaviorProfile | null,
    userProfile: any
  ): number {
    let confidence = 0;
    let factors = 0;

    // Behavior data confidence
    if (behaviorProfile) {
      const activityCount = behaviorProfile.recentActivity.length;
      confidence += Math.min(1, activityCount / 50); // Full confidence at 50+ activities
      factors++;
    }

    // Profile data confidence
    if (userProfile) {
      let profileCompleteness = 0;
      const profileFields = ['academicLevel', 'fieldOfStudy', 'interests', 'location'];
      profileFields.forEach(field => {
        if (userProfile[field]) profileCompleteness++;
      });
      confidence += profileCompleteness / profileFields.length;
      factors++;
    }

    return factors > 0 ? confidence / factors : 0.3; // Minimum confidence
  }

  private async getCandidateContent(
    context: PersonalizationContext,
    contentTypes?: string[],
    limit: number = 60
  ): Promise<any[]> {
    try {
      // Get content from search service
      const searchParams: any = {
        limit,
        sort: 'relevance:desc'
      };

      if (contentTypes) {
        searchParams.type = contentTypes;
      }

      const response = await axios.get(`${this.SEARCH_SERVICE_URL}/api/v1/search`, {
        params: searchParams
      });

      return response.data.documents || [];

    } catch (error) {
      logger.error('Error getting candidate content:', error);
      return [];
    }
  }

  private async getSimilarContent(context: PersonalizationContext, limit: number): Promise<any[]> {
    // Get content similar to user's recent interactions
    const behaviorProfile = await this.behaviorService.getUserBehaviorProfile(context.userId);
    if (!behaviorProfile || behaviorProfile.recentActivity.length === 0) {
      return [];
    }

    // Get recently viewed content IDs
    const recentContentIds = behaviorProfile.recentActivity
      .slice(0, 5)
      .map(activity => activity.contentId);

    // Find similar content (simplified implementation)
    return [];
  }

  private async getTrendingContent(context: PersonalizationContext, limit: number): Promise<any[]> {
    try {
      const response = await axios.get(`${this.SEARCH_SERVICE_URL}/api/v1/trending`, {
        params: { limit }
      });
      return response.data.trending || [];
    } catch (error) {
      logger.error('Error getting trending content:', error);
      return [];
    }
  }

  private async getPopularContent(context: PersonalizationContext, limit: number): Promise<any[]> {
    try {
      const popularContent = await this.behaviorService.getContentPopularity('all', '7d');
      return popularContent.slice(0, limit);
    } catch (error) {
      logger.error('Error getting popular content:', error);
      return [];
    }
  }

  private async getNewContent(context: PersonalizationContext, limit: number): Promise<any[]> {
    try {
      const response = await axios.get(`${this.SEARCH_SERVICE_URL}/api/v1/search`, {
        params: {
          limit,
          sort: 'createdAt:desc'
        }
      });
      return response.data.documents || [];
    } catch (error) {
      logger.error('Error getting new content:', error);
      return [];
    }
  }

  private sanitizeUserProfile(userProfile: any): any {
    if (!userProfile) return {};
    
    const { password, email, ...sanitized } = userProfile;
    return sanitized;
  }

  private getAppliedFilters(
    strategy: string,
    behaviorProfile: UserBehaviorProfile | null,
    userProfile: any
  ): string[] {
    const filters = [`Strategy: ${strategy}`];
    
    if (behaviorProfile) {
      filters.push('Behavior-based filtering');
    }
    
    if (userProfile) {
      filters.push('Profile-based filtering');
    }
    
    return filters;
  }

  private calculateDiversityMetrics(content: PersonalizedContent[]): any {
    const types = new Set(content.map(item => item.type));
    const categories = new Set(content.map(item => item.metadata?.category).filter(Boolean));
    
    return {
      typeVariety: types.size,
      categoryVariety: categories.size,
      averageScore: content.reduce((sum, item) => sum + item.score, 0) / content.length
    };
  }

  private categorizeEngagementLevel(averageEngagement: number): 'low' | 'medium' | 'high' {
    if (averageEngagement < 0.1) return 'low';
    if (averageEngagement < 0.3) return 'medium';
    return 'high';
  }

  private getActivePatterns(patterns: UserBehaviorProfile['patterns']): string[] {
    const activePatterns: string[] = [];
    
    // Find peak activity hour
    const peakHour = patterns.activeHours.indexOf(Math.max(...patterns.activeHours));
    if (peakHour < 6) activePatterns.push('Night owl');
    else if (peakHour < 12) activePatterns.push('Morning person');
    else if (peakHour < 18) activePatterns.push('Afternoon active');
    else activePatterns.push('Evening active');

    // Find peak activity day
    const peakDay = patterns.activeDays.indexOf(Math.max(...patterns.activeDays));
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    activePatterns.push(`Most active on ${days[peakDay]}`);

    return activePatterns;
  }

  private generateImprovementSuggestions(
    behaviorProfile: UserBehaviorProfile | null,
    userProfile: any
  ): string[] {
    const suggestions: string[] = [];

    if (!behaviorProfile || behaviorProfile.recentActivity.length < 10) {
      suggestions.push('Interact more with content to improve recommendations');
    }

    if (!userProfile || !userProfile.interests || userProfile.interests.length === 0) {
      suggestions.push('Add interests to your profile for better personalization');
    }

    if (behaviorProfile && behaviorProfile.patterns.averageEngagement < 0.1) {
      suggestions.push('Try saving or sharing content you find interesting');
    }

    return suggestions;
  }

  private async generateContentSuggestions(
    userId: string,
    behaviorProfile: UserBehaviorProfile | null
  ): Promise<string[]> {
    const suggestions: string[] = [];

    if (behaviorProfile) {
      // Suggest content types user hasn't explored much
      const contentTypes = Object.keys(behaviorProfile.preferences.contentTypes);
      const allTypes = ['university', 'program', 'scholarship', 'opportunity'];
      const unexplored = allTypes.filter(type => !contentTypes.includes(type));
      
      if (unexplored.length > 0) {
        suggestions.push(`Explore ${unexplored[0]} content`);
      }

      // Suggest based on interests
      if (behaviorProfile.interests.length > 0) {
        suggestions.push(`Check out trending content in ${behaviorProfile.interests[0]}`);
      }
    }

    return suggestions;
  }
}