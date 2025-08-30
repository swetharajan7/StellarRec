import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import axios from 'axios';

const prisma = new PrismaClient();

export interface RecommendationRequest {
  userId: string;
  userType: 'student' | 'recommender';
  contentType: 'university' | 'program' | 'scholarship' | 'opportunity';
  limit?: number;
  excludeIds?: string[];
  context?: {
    academicLevel?: string;
    fieldOfStudy?: string;
    location?: string;
    budget?: number;
    gpa?: number;
    testScores?: Record<string, number>;
    interests?: string[];
    preferences?: Record<string, any>;
  };
}

export interface RecommendationResult {
  id: string;
  type: string;
  title: string;
  description: string;
  score: number;
  confidence: number;
  reasoning: string[];
  metadata: Record<string, any>;
  tags: string[];
  url?: string;
  imageUrl?: string;
}

export interface RecommendationResponse {
  recommendations: RecommendationResult[];
  totalCount: number;
  algorithmUsed: string;
  processingTime: number;
  metadata: {
    userProfile: Record<string, any>;
    contextFactors: string[];
    diversityScore: number;
  };
}

export class RecommendationService {
  private readonly AI_SERVICE_URL: string;
  private readonly SEARCH_SERVICE_URL: string;
  private readonly USER_SERVICE_URL: string;

  constructor() {
    this.AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:3002';
    this.SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'http://localhost:3003';
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
  }

  async getPersonalizedRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    const startTime = Date.now();
    
    try {
      logger.info('Generating personalized recommendations', { 
        userId: request.userId, 
        contentType: request.contentType 
      });

      // Get user profile and behavior data
      const userProfile = await this.getUserProfile(request.userId);
      const userBehavior = await this.getUserBehavior(request.userId);
      
      // Determine the best recommendation algorithm
      const algorithm = this.selectRecommendationAlgorithm(userProfile, userBehavior, request);
      
      // Generate recommendations based on the selected algorithm
      let recommendations: RecommendationResult[];
      
      switch (algorithm) {
        case 'collaborative_filtering':
          recommendations = await this.generateCollaborativeRecommendations(request, userProfile, userBehavior);
          break;
        case 'content_based':
          recommendations = await this.generateContentBasedRecommendations(request, userProfile);
          break;
        case 'hybrid':
          recommendations = await this.generateHybridRecommendations(request, userProfile, userBehavior);
          break;
        case 'popularity_based':
          recommendations = await this.generatePopularityBasedRecommendations(request);
          break;
        default:
          recommendations = await this.generateHybridRecommendations(request, userProfile, userBehavior);
      }

      // Apply diversity and filtering
      recommendations = await this.applyDiversityFiltering(recommendations, request);
      
      // Calculate confidence scores
      recommendations = this.calculateConfidenceScores(recommendations, userProfile, userBehavior);
      
      // Log recommendation for analytics
      await this.logRecommendation(request.userId, recommendations, algorithm);

      const processingTime = Date.now() - startTime;
      
      return {
        recommendations: recommendations.slice(0, request.limit || 10),
        totalCount: recommendations.length,
        algorithmUsed: algorithm,
        processingTime,
        metadata: {
          userProfile: this.sanitizeUserProfile(userProfile),
          contextFactors: this.extractContextFactors(request, userProfile),
          diversityScore: this.calculateDiversityScore(recommendations)
        }
      };

    } catch (error) {
      logger.error('Error generating personalized recommendations:', error);
      throw new Error('Failed to generate recommendations');
    }
  }

  async getUniversityRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    const enhancedRequest = { ...request, contentType: 'university' as const };
    
    try {
      // Get AI-powered university matching
      const aiRecommendations = await this.getAIUniversityMatches(enhancedRequest);
      
      // Combine with personalized recommendations
      const personalizedRecommendations = await this.getPersonalizedRecommendations(enhancedRequest);
      
      // Merge and rank results
      const mergedRecommendations = this.mergeRecommendations(
        aiRecommendations.recommendations,
        personalizedRecommendations.recommendations
      );

      return {
        ...personalizedRecommendations,
        recommendations: mergedRecommendations,
        algorithmUsed: 'ai_enhanced_hybrid'
      };

    } catch (error) {
      logger.error('Error generating university recommendations:', error);
      // Fallback to standard personalized recommendations
      return this.getPersonalizedRecommendations(enhancedRequest);
    }
  }

  async getProgramRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    const enhancedRequest = { ...request, contentType: 'program' as const };
    return this.getPersonalizedRecommendations(enhancedRequest);
  }

  async getScholarshipRecommendations(request: RecommendationRequest): Promise<RecommendationResponse> {
    const enhancedRequest = { ...request, contentType: 'scholarship' as const };
    
    try {
      // Get user's financial profile for scholarship matching
      const financialProfile = await this.getUserFinancialProfile(request.userId);
      
      // Enhance context with financial information
      enhancedRequest.context = {
        ...enhancedRequest.context,
        ...financialProfile
      };

      return this.getPersonalizedRecommendations(enhancedRequest);

    } catch (error) {
      logger.error('Error generating scholarship recommendations:', error);
      return this.getPersonalizedRecommendations(enhancedRequest);
    }
  }

  async getSimilarContent(contentId: string, contentType: string, limit: number = 5): Promise<RecommendationResult[]> {
    try {
      // Get content details
      const content = await this.getContentDetails(contentId, contentType);
      if (!content) {
        throw new Error('Content not found');
      }

      // Find similar content using content-based filtering
      const similarContent = await this.findSimilarContent(content, contentType, limit);
      
      return similarContent.map(item => ({
        id: item.id,
        type: contentType,
        title: item.title,
        description: item.description,
        score: item.similarity_score,
        confidence: item.similarity_score * 0.8, // Slightly lower confidence for similarity
        reasoning: [`Similar to ${content.title}`, `Shared characteristics: ${item.shared_features.join(', ')}`],
        metadata: item.metadata,
        tags: item.tags || [],
        url: item.url,
        imageUrl: item.imageUrl
      }));

    } catch (error) {
      logger.error('Error finding similar content:', error);
      throw new Error('Failed to find similar content');
    }
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.USER_SERVICE_URL}/api/v1/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      logger.warn('Failed to get user profile, using defaults:', error);
      return { id: userId, preferences: {}, interests: [] };
    }
  }

  private async getUserBehavior(userId: string): Promise<any> {
    try {
      const behavior = await prisma.userBehavior.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 100
      });
      return this.aggregateBehaviorData(behavior);
    } catch (error) {
      logger.warn('Failed to get user behavior:', error);
      return { interactions: [], preferences: {}, patterns: {} };
    }
  }

  private selectRecommendationAlgorithm(userProfile: any, userBehavior: any, request: RecommendationRequest): string {
    // New users with minimal data
    if (!userBehavior.interactions || userBehavior.interactions.length < 5) {
      return 'popularity_based';
    }

    // Users with rich interaction data
    if (userBehavior.interactions.length > 50) {
      return 'hybrid';
    }

    // Users with profile data but limited interactions
    if (userProfile.interests && userProfile.interests.length > 0) {
      return 'content_based';
    }

    // Users with some interaction data
    if (userBehavior.interactions.length >= 10) {
      return 'collaborative_filtering';
    }

    return 'content_based';
  }

  private async generateCollaborativeRecommendations(
    request: RecommendationRequest, 
    userProfile: any, 
    userBehavior: any
  ): Promise<RecommendationResult[]> {
    try {
      // Find similar users based on behavior patterns
      const similarUsers = await this.findSimilarUsers(request.userId, userBehavior);
      
      // Get content liked by similar users
      const recommendations = await this.getContentFromSimilarUsers(
        similarUsers, 
        request.contentType, 
        request.excludeIds || []
      );

      return recommendations.map(item => ({
        id: item.id,
        type: request.contentType,
        title: item.title,
        description: item.description,
        score: item.collaborative_score,
        confidence: item.collaborative_score * 0.9,
        reasoning: [
          `Recommended by users with similar interests`,
          `${item.similar_user_count} similar users liked this`,
          `Match strength: ${(item.collaborative_score * 100).toFixed(0)}%`
        ],
        metadata: item.metadata,
        tags: item.tags || [],
        url: item.url,
        imageUrl: item.imageUrl
      }));

    } catch (error) {
      logger.error('Error in collaborative filtering:', error);
      return [];
    }
  }

  private async generateContentBasedRecommendations(
    request: RecommendationRequest, 
    userProfile: any
  ): Promise<RecommendationResult[]> {
    try {
      // Build user preference vector from profile and past interactions
      const userVector = await this.buildUserPreferenceVector(request.userId, userProfile);
      
      // Find content matching user preferences
      const matchingContent = await this.findContentByPreferences(
        userVector, 
        request.contentType, 
        request.context,
        request.excludeIds || []
      );

      return matchingContent.map(item => ({
        id: item.id,
        type: request.contentType,
        title: item.title,
        description: item.description,
        score: item.content_score,
        confidence: item.content_score * 0.85,
        reasoning: [
          `Matches your interests in ${item.matching_interests.join(', ')}`,
          `Content similarity: ${(item.content_score * 100).toFixed(0)}%`,
          `Based on your profile preferences`
        ],
        metadata: item.metadata,
        tags: item.tags || [],
        url: item.url,
        imageUrl: item.imageUrl
      }));

    } catch (error) {
      logger.error('Error in content-based filtering:', error);
      return [];
    }
  }

  private async generateHybridRecommendations(
    request: RecommendationRequest, 
    userProfile: any, 
    userBehavior: any
  ): Promise<RecommendationResult[]> {
    try {
      // Get recommendations from both approaches
      const [collaborativeRecs, contentBasedRecs] = await Promise.all([
        this.generateCollaborativeRecommendations(request, userProfile, userBehavior),
        this.generateContentBasedRecommendations(request, userProfile)
      ]);

      // Merge and rerank recommendations
      const hybridRecommendations = this.mergeRecommendations(collaborativeRecs, contentBasedRecs);
      
      // Apply hybrid scoring
      return hybridRecommendations.map(item => ({
        ...item,
        score: this.calculateHybridScore(item, userProfile, userBehavior),
        confidence: this.calculateHybridConfidence(item, userProfile, userBehavior),
        reasoning: [
          ...item.reasoning,
          'Hybrid recommendation combining multiple factors'
        ]
      }));

    } catch (error) {
      logger.error('Error in hybrid recommendations:', error);
      return [];
    }
  }

  private async generatePopularityBasedRecommendations(
    request: RecommendationRequest
  ): Promise<RecommendationResult[]> {
    try {
      // Get trending/popular content for the content type
      const popularContent = await this.getPopularContent(
        request.contentType, 
        request.context,
        request.excludeIds || []
      );

      return popularContent.map(item => ({
        id: item.id,
        type: request.contentType,
        title: item.title,
        description: item.description,
        score: item.popularity_score,
        confidence: item.popularity_score * 0.7, // Lower confidence for popularity-based
        reasoning: [
          `Popular among ${request.userType}s`,
          `${item.interaction_count} recent interactions`,
          `Trending in ${item.category || 'your area'}`
        ],
        metadata: item.metadata,
        tags: item.tags || [],
        url: item.url,
        imageUrl: item.imageUrl
      }));

    } catch (error) {
      logger.error('Error in popularity-based recommendations:', error);
      return [];
    }
  }

  private async getAIUniversityMatches(request: RecommendationRequest): Promise<RecommendationResponse> {
    try {
      const response = await axios.post(`${this.AI_SERVICE_URL}/api/v1/matching/universities`, {
        userId: request.userId,
        context: request.context,
        limit: request.limit
      });
      
      return response.data;
    } catch (error) {
      logger.warn('AI service unavailable, falling back to standard recommendations:', error);
      throw error;
    }
  }

  private async getUserFinancialProfile(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.USER_SERVICE_URL}/api/v1/users/${userId}/financial-profile`);
      return response.data;
    } catch (error) {
      logger.warn('Failed to get financial profile:', error);
      return {};
    }
  }

  // Helper methods (simplified implementations)
  private aggregateBehaviorData(behavior: any[]): any {
    return {
      interactions: behavior,
      preferences: {},
      patterns: {}
    };
  }

  private async findSimilarUsers(userId: string, userBehavior: any): Promise<any[]> {
    // Simplified implementation - would use ML clustering in production
    return [];
  }

  private async getContentFromSimilarUsers(similarUsers: any[], contentType: string, excludeIds: string[]): Promise<any[]> {
    // Simplified implementation
    return [];
  }

  private async buildUserPreferenceVector(userId: string, userProfile: any): Promise<any> {
    // Simplified implementation
    return {};
  }

  private async findContentByPreferences(userVector: any, contentType: string, context: any, excludeIds: string[]): Promise<any[]> {
    // Simplified implementation
    return [];
  }

  private mergeRecommendations(recs1: RecommendationResult[], recs2: RecommendationResult[]): RecommendationResult[] {
    const merged = [...recs1, ...recs2];
    const unique = merged.filter((item, index, self) => 
      index === self.findIndex(t => t.id === item.id)
    );
    return unique.sort((a, b) => b.score - a.score);
  }

  private calculateHybridScore(item: RecommendationResult, userProfile: any, userBehavior: any): number {
    // Weighted combination of different scores
    return item.score;
  }

  private calculateHybridConfidence(item: RecommendationResult, userProfile: any, userBehavior: any): number {
    return item.confidence;
  }

  private async getPopularContent(contentType: string, context: any, excludeIds: string[]): Promise<any[]> {
    // Get popular content from search service or database
    return [];
  }

  private async getContentDetails(contentId: string, contentType: string): Promise<any> {
    // Get content details from appropriate service
    return null;
  }

  private async findSimilarContent(content: any, contentType: string, limit: number): Promise<any[]> {
    // Find similar content using content-based similarity
    return [];
  }

  private async applyDiversityFiltering(recommendations: RecommendationResult[], request: RecommendationRequest): Promise<RecommendationResult[]> {
    // Apply diversity to avoid too similar recommendations
    return recommendations;
  }

  private calculateConfidenceScores(recommendations: RecommendationResult[], userProfile: any, userBehavior: any): RecommendationResult[] {
    return recommendations;
  }

  private async logRecommendation(userId: string, recommendations: RecommendationResult[], algorithm: string): Promise<void> {
    try {
      await prisma.recommendationLog.create({
        data: {
          userId,
          algorithm,
          recommendationIds: recommendations.map(r => r.id),
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.warn('Failed to log recommendation:', error);
    }
  }

  private sanitizeUserProfile(userProfile: any): any {
    // Remove sensitive information
    const { password, email, ...sanitized } = userProfile;
    return sanitized;
  }

  private extractContextFactors(request: RecommendationRequest, userProfile: any): string[] {
    const factors = [];
    if (request.context?.academicLevel) factors.push('Academic Level');
    if (request.context?.fieldOfStudy) factors.push('Field of Study');
    if (request.context?.location) factors.push('Location');
    if (userProfile.interests?.length > 0) factors.push('User Interests');
    return factors;
  }

  private calculateDiversityScore(recommendations: RecommendationResult[]): number {
    // Calculate how diverse the recommendations are
    return 0.8; // Simplified
  }
}