import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import axios from 'axios';

const prisma = new PrismaClient();

export interface OpportunityFilter {
  type?: string[];
  category?: string[];
  eligibility?: string[];
  deadline?: {
    from?: Date;
    to?: Date;
  };
  amount?: {
    min?: number;
    max?: number;
  };
  location?: string[];
  academicLevel?: string[];
  fieldOfStudy?: string[];
}

export interface Opportunity {
  id: string;
  type: 'scholarship' | 'grant' | 'fellowship' | 'internship' | 'program' | 'competition';
  title: string;
  description: string;
  provider: string;
  amount?: number;
  currency?: string;
  deadline: Date;
  eligibility: string[];
  requirements: string[];
  benefits: string[];
  applicationUrl: string;
  category: string;
  location: string;
  academicLevel: string[];
  fieldOfStudy: string[];
  tags: string[];
  matchScore?: number;
  reasoning?: string[];
  metadata: Record<string, any>;
}

export interface DiscoveryResponse {
  opportunities: Opportunity[];
  totalCount: number;
  filters: {
    types: string[];
    categories: string[];
    locations: string[];
    academicLevels: string[];
    fieldsOfStudy: string[];
  };
  recommendations: Opportunity[];
}

export class DiscoveryService {
  private readonly SEARCH_SERVICE_URL: string;
  private readonly USER_SERVICE_URL: string;

  constructor() {
    this.SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'http://localhost:3003';
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
  }

  async discoverOpportunities(
    userId?: string,
    filters?: OpportunityFilter,
    limit: number = 20,
    offset: number = 0
  ): Promise<DiscoveryResponse> {
    try {
      logger.info('Discovering opportunities', { userId, filters, limit, offset });

      // Get all opportunities matching filters
      const opportunities = await this.getFilteredOpportunities(filters, limit + 50, offset);
      
      // If user is provided, personalize and score opportunities
      let personalizedOpportunities = opportunities;
      if (userId) {
        personalizedOpportunities = await this.personalizeOpportunities(userId, opportunities);
      }

      // Get filter options for UI
      const filterOptions = await this.getFilterOptions();
      
      // Get personalized recommendations
      const recommendations = userId 
        ? await this.getPersonalizedRecommendations(userId, 5)
        : [];

      return {
        opportunities: personalizedOpportunities.slice(0, limit),
        totalCount: opportunities.length,
        filters: filterOptions,
        recommendations
      };

    } catch (error) {
      logger.error('Error discovering opportunities:', error);
      throw new Error('Failed to discover opportunities');
    }
  }

  async getScholarshipOpportunities(
    userId?: string,
    filters?: OpportunityFilter,
    limit: number = 20
  ): Promise<Opportunity[]> {
    const scholarshipFilters = {
      ...filters,
      type: ['scholarship']
    };

    const response = await this.discoverOpportunities(userId, scholarshipFilters, limit);
    return response.opportunities;
  }

  async getGrantOpportunities(
    userId?: string,
    filters?: OpportunityFilter,
    limit: number = 20
  ): Promise<Opportunity[]> {
    const grantFilters = {
      ...filters,
      type: ['grant', 'fellowship']
    };

    const response = await this.discoverOpportunities(userId, grantFilters, limit);
    return response.opportunities;
  }

  async getInternshipOpportunities(
    userId?: string,
    filters?: OpportunityFilter,
    limit: number = 20
  ): Promise<Opportunity[]> {
    const internshipFilters = {
      ...filters,
      type: ['internship']
    };

    const response = await this.discoverOpportunities(userId, internshipFilters, limit);
    return response.opportunities;
  }

  async getCompetitionOpportunities(
    userId?: string,
    filters?: OpportunityFilter,
    limit: number = 20
  ): Promise<Opportunity[]> {
    const competitionFilters = {
      ...filters,
      type: ['competition']
    };

    const response = await this.discoverOpportunities(userId, competitionFilters, limit);
    return response.opportunities;
  }

  async getUrgentOpportunities(
    userId?: string,
    daysUntilDeadline: number = 30,
    limit: number = 10
  ): Promise<Opportunity[]> {
    const urgentDeadline = new Date();
    urgentDeadline.setDate(urgentDeadline.getDate() + daysUntilDeadline);

    const filters: OpportunityFilter = {
      deadline: {
        from: new Date(),
        to: urgentDeadline
      }
    };

    const response = await this.discoverOpportunities(userId, filters, limit);
    return response.opportunities.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  }

  async getHighValueOpportunities(
    userId?: string,
    minAmount: number = 5000,
    limit: number = 10
  ): Promise<Opportunity[]> {
    const filters: OpportunityFilter = {
      amount: {
        min: minAmount
      }
    };

    const response = await this.discoverOpportunities(userId, filters, limit);
    return response.opportunities.sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }

  async searchOpportunities(
    query: string,
    userId?: string,
    filters?: OpportunityFilter,
    limit: number = 20
  ): Promise<Opportunity[]> {
    try {
      // Use search service for full-text search
      const searchResponse = await axios.get(`${this.SEARCH_SERVICE_URL}/api/v1/search`, {
        params: {
          q: query,
          type: ['opportunity'],
          limit,
          ...this.convertFiltersToSearchParams(filters)
        }
      });

      const searchResults = searchResponse.data.documents || [];
      
      // Convert search results to opportunities
      const opportunities = searchResults.map((doc: any) => this.convertSearchResultToOpportunity(doc));
      
      // Personalize if user provided
      if (userId) {
        return this.personalizeOpportunities(userId, opportunities);
      }

      return opportunities;

    } catch (error) {
      logger.error('Error searching opportunities:', error);
      // Fallback to database search
      return this.fallbackSearch(query, filters, limit);
    }
  }

  async getOpportunityById(id: string, userId?: string): Promise<Opportunity | null> {
    try {
      const opportunity = await prisma.opportunity.findUnique({
        where: { id }
      });

      if (!opportunity) {
        return null;
      }

      const convertedOpportunity = this.convertDbToOpportunity(opportunity);
      
      // Add personalization if user provided
      if (userId) {
        const personalized = await this.personalizeOpportunities(userId, [convertedOpportunity]);
        return personalized[0] || convertedOpportunity;
      }

      return convertedOpportunity;

    } catch (error) {
      logger.error('Error getting opportunity by ID:', error);
      return null;
    }
  }

  async getSimilarOpportunities(
    opportunityId: string,
    userId?: string,
    limit: number = 5
  ): Promise<Opportunity[]> {
    try {
      const opportunity = await this.getOpportunityById(opportunityId);
      if (!opportunity) {
        return [];
      }

      // Find similar opportunities based on category, field of study, and type
      const similarOpportunities = await prisma.opportunity.findMany({
        where: {
          id: { not: opportunityId },
          OR: [
            { category: opportunity.category },
            { type: opportunity.type },
            { fieldOfStudy: { hasSome: opportunity.fieldOfStudy } }
          ]
        },
        take: limit * 2 // Get more to allow for filtering
      });

      const converted = similarOpportunities.map(opp => this.convertDbToOpportunity(opp));
      
      // Calculate similarity scores
      const scored = converted.map(opp => ({
        ...opp,
        matchScore: this.calculateSimilarityScore(opportunity, opp)
      })).sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

      const result = scored.slice(0, limit);
      
      // Personalize if user provided
      if (userId) {
        return this.personalizeOpportunities(userId, result);
      }

      return result;

    } catch (error) {
      logger.error('Error getting similar opportunities:', error);
      return [];
    }
  }

  private async getFilteredOpportunities(
    filters?: OpportunityFilter,
    limit: number = 20,
    offset: number = 0
  ): Promise<Opportunity[]> {
    const whereClause: any = {};

    if (filters) {
      if (filters.type) {
        whereClause.type = { in: filters.type };
      }
      if (filters.category) {
        whereClause.category = { in: filters.category };
      }
      if (filters.location) {
        whereClause.location = { in: filters.location };
      }
      if (filters.academicLevel) {
        whereClause.academicLevel = { hasSome: filters.academicLevel };
      }
      if (filters.fieldOfStudy) {
        whereClause.fieldOfStudy = { hasSome: filters.fieldOfStudy };
      }
      if (filters.deadline) {
        whereClause.deadline = {};
        if (filters.deadline.from) {
          whereClause.deadline.gte = filters.deadline.from;
        }
        if (filters.deadline.to) {
          whereClause.deadline.lte = filters.deadline.to;
        }
      }
      if (filters.amount) {
        whereClause.amount = {};
        if (filters.amount.min) {
          whereClause.amount.gte = filters.amount.min;
        }
        if (filters.amount.max) {
          whereClause.amount.lte = filters.amount.max;
        }
      }
    }

    const opportunities = await prisma.opportunity.findMany({
      where: whereClause,
      orderBy: { deadline: 'asc' },
      take: limit,
      skip: offset
    });

    return opportunities.map(opp => this.convertDbToOpportunity(opp));
  }

  private async personalizeOpportunities(userId: string, opportunities: Opportunity[]): Promise<Opportunity[]> {
    try {
      // Get user profile
      const userProfile = await this.getUserProfile(userId);
      
      // Calculate match scores and add reasoning
      const personalized = opportunities.map(opportunity => {
        const matchData = this.calculateMatchScore(userProfile, opportunity);
        return {
          ...opportunity,
          matchScore: matchData.score,
          reasoning: matchData.reasoning
        };
      });

      // Sort by match score
      return personalized.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

    } catch (error) {
      logger.error('Error personalizing opportunities:', error);
      return opportunities;
    }
  }

  private async getUserProfile(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.USER_SERVICE_URL}/api/v1/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      logger.warn('Failed to get user profile:', error);
      return {};
    }
  }

  private calculateMatchScore(userProfile: any, opportunity: Opportunity): { score: number; reasoning: string[] } {
    let score = 0;
    const reasoning: string[] = [];
    const factors: { weight: number; score: number; reason: string }[] = [];

    // Academic level match
    if (userProfile.academicLevel && opportunity.academicLevel.includes(userProfile.academicLevel)) {
      factors.push({ weight: 0.3, score: 1.0, reason: `Matches your academic level (${userProfile.academicLevel})` });
    }

    // Field of study match
    if (userProfile.fieldOfStudy && opportunity.fieldOfStudy.some((field: string) => 
      field.toLowerCase().includes(userProfile.fieldOfStudy.toLowerCase()) ||
      userProfile.fieldOfStudy.toLowerCase().includes(field.toLowerCase())
    )) {
      factors.push({ weight: 0.25, score: 1.0, reason: `Relevant to your field of study` });
    }

    // Location preference
    if (userProfile.preferredLocations && userProfile.preferredLocations.includes(opportunity.location)) {
      factors.push({ weight: 0.15, score: 1.0, reason: `In your preferred location (${opportunity.location})` });
    }

    // GPA requirement (if applicable)
    if (opportunity.requirements.some((req: string) => req.toLowerCase().includes('gpa')) && userProfile.gpa) {
      const gpaMatch = this.checkGpaRequirement(opportunity.requirements, userProfile.gpa);
      if (gpaMatch.eligible) {
        factors.push({ weight: 0.1, score: gpaMatch.score, reason: gpaMatch.reason });
      }
    }

    // Interest alignment
    if (userProfile.interests && opportunity.tags) {
      const interestMatch = this.calculateInterestMatch(userProfile.interests, opportunity.tags);
      if (interestMatch.score > 0) {
        factors.push({ weight: 0.2, score: interestMatch.score, reason: interestMatch.reason });
      }
    }

    // Calculate weighted score
    const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
    if (totalWeight > 0) {
      score = factors.reduce((sum, factor) => sum + (factor.weight * factor.score), 0) / totalWeight;
      reasoning.push(...factors.map(f => f.reason));
    } else {
      score = 0.5; // Default score when no matching factors
      reasoning.push('General opportunity that may be of interest');
    }

    return { score, reasoning };
  }

  private checkGpaRequirement(requirements: string[], userGpa: number): { eligible: boolean; score: number; reason: string } {
    // Simplified GPA requirement checking
    const gpaReq = requirements.find(req => req.toLowerCase().includes('gpa'));
    if (!gpaReq) {
      return { eligible: true, score: 0.8, reason: 'No specific GPA requirement' };
    }

    // Extract GPA requirement (simplified)
    const gpaMatch = gpaReq.match(/(\d+\.?\d*)/);
    if (gpaMatch) {
      const requiredGpa = parseFloat(gpaMatch[1]);
      if (userGpa >= requiredGpa) {
        const excess = userGpa - requiredGpa;
        const score = Math.min(1.0, 0.7 + (excess * 0.1));
        return { eligible: true, score, reason: `Exceeds GPA requirement (${requiredGpa})` };
      } else {
        return { eligible: false, score: 0, reason: `Does not meet GPA requirement (${requiredGpa})` };
      }
    }

    return { eligible: true, score: 0.8, reason: 'GPA requirement unclear' };
  }

  private calculateInterestMatch(userInterests: string[], opportunityTags: string[]): { score: number; reason: string } {
    const matches = userInterests.filter(interest => 
      opportunityTags.some(tag => 
        tag.toLowerCase().includes(interest.toLowerCase()) ||
        interest.toLowerCase().includes(tag.toLowerCase())
      )
    );

    if (matches.length === 0) {
      return { score: 0, reason: '' };
    }

    const score = Math.min(1.0, matches.length / userInterests.length);
    const reason = `Aligns with your interests: ${matches.join(', ')}`;
    
    return { score, reason };
  }

  private calculateSimilarityScore(opportunity1: Opportunity, opportunity2: Opportunity): number {
    let score = 0;
    let factors = 0;

    // Type similarity
    if (opportunity1.type === opportunity2.type) {
      score += 0.3;
    }
    factors++;

    // Category similarity
    if (opportunity1.category === opportunity2.category) {
      score += 0.25;
    }
    factors++;

    // Field of study overlap
    const fieldOverlap = opportunity1.fieldOfStudy.filter(field => 
      opportunity2.fieldOfStudy.includes(field)
    ).length;
    if (fieldOverlap > 0) {
      score += 0.25 * (fieldOverlap / Math.max(opportunity1.fieldOfStudy.length, opportunity2.fieldOfStudy.length));
    }
    factors++;

    // Academic level overlap
    const levelOverlap = opportunity1.academicLevel.filter(level => 
      opportunity2.academicLevel.includes(level)
    ).length;
    if (levelOverlap > 0) {
      score += 0.2 * (levelOverlap / Math.max(opportunity1.academicLevel.length, opportunity2.academicLevel.length));
    }
    factors++;

    return score / factors;
  }

  private async getFilterOptions(): Promise<any> {
    try {
      const [types, categories, locations, academicLevels, fieldsOfStudy] = await Promise.all([
        prisma.opportunity.findMany({ select: { type: true }, distinct: ['type'] }),
        prisma.opportunity.findMany({ select: { category: true }, distinct: ['category'] }),
        prisma.opportunity.findMany({ select: { location: true }, distinct: ['location'] }),
        prisma.opportunity.findMany({ select: { academicLevel: true } }),
        prisma.opportunity.findMany({ select: { fieldOfStudy: true } })
      ]);

      return {
        types: types.map(t => t.type),
        categories: categories.map(c => c.category),
        locations: locations.map(l => l.location),
        academicLevels: [...new Set(academicLevels.flatMap(a => a.academicLevel))],
        fieldsOfStudy: [...new Set(fieldsOfStudy.flatMap(f => f.fieldOfStudy))]
      };

    } catch (error) {
      logger.error('Error getting filter options:', error);
      return {
        types: [],
        categories: [],
        locations: [],
        academicLevels: [],
        fieldsOfStudy: []
      };
    }
  }

  private async getPersonalizedRecommendations(userId: string, limit: number): Promise<Opportunity[]> {
    // Get user's recent interactions to recommend similar opportunities
    try {
      const recentInteractions = await prisma.userBehavior.findMany({
        where: {
          userId,
          contentType: 'opportunity',
          action: { in: ['view', 'save', 'apply'] }
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      if (recentInteractions.length === 0) {
        return [];
      }

      // Get opportunities similar to recently viewed ones
      const contentIds = recentInteractions.map(i => i.contentId);
      const recommendations: Opportunity[] = [];

      for (const contentId of contentIds.slice(0, 3)) { // Limit to avoid too many requests
        const similar = await this.getSimilarOpportunities(contentId, userId, 2);
        recommendations.push(...similar);
      }

      // Remove duplicates and limit
      const unique = recommendations.filter((opp, index, self) => 
        index === self.findIndex(o => o.id === opp.id)
      );

      return unique.slice(0, limit);

    } catch (error) {
      logger.error('Error getting personalized recommendations:', error);
      return [];
    }
  }

  private convertFiltersToSearchParams(filters?: OpportunityFilter): any {
    if (!filters) return {};

    const params: any = {};
    
    if (filters.type) params.type = filters.type;
    if (filters.category) params.category = filters.category;
    if (filters.location) params.location = filters.location;
    if (filters.academicLevel) params.academicLevel = filters.academicLevel;
    if (filters.fieldOfStudy) params.fieldOfStudy = filters.fieldOfStudy;
    
    return params;
  }

  private convertSearchResultToOpportunity(doc: any): Opportunity {
    return {
      id: doc.id,
      type: doc.type || 'opportunity',
      title: doc.title,
      description: doc.description,
      provider: doc.provider || 'Unknown',
      amount: doc.amount,
      currency: doc.currency || 'USD',
      deadline: new Date(doc.deadline),
      eligibility: doc.eligibility || [],
      requirements: doc.requirements || [],
      benefits: doc.benefits || [],
      applicationUrl: doc.applicationUrl || doc.url || '',
      category: doc.category,
      location: doc.location,
      academicLevel: doc.academicLevel || [],
      fieldOfStudy: doc.fieldOfStudy || [],
      tags: doc.tags || [],
      metadata: doc.metadata || {}
    };
  }

  private convertDbToOpportunity(dbOpp: any): Opportunity {
    return {
      id: dbOpp.id,
      type: dbOpp.type,
      title: dbOpp.title,
      description: dbOpp.description,
      provider: dbOpp.provider,
      amount: dbOpp.amount,
      currency: dbOpp.currency,
      deadline: dbOpp.deadline,
      eligibility: dbOpp.eligibility,
      requirements: dbOpp.requirements,
      benefits: dbOpp.benefits,
      applicationUrl: dbOpp.applicationUrl,
      category: dbOpp.category,
      location: dbOpp.location,
      academicLevel: dbOpp.academicLevel,
      fieldOfStudy: dbOpp.fieldOfStudy,
      tags: dbOpp.tags,
      metadata: dbOpp.metadata || {}
    };
  }

  private async fallbackSearch(query: string, filters?: OpportunityFilter, limit: number = 20): Promise<Opportunity[]> {
    // Simple database search as fallback
    const whereClause: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { provider: { contains: query, mode: 'insensitive' } }
      ]
    };

    // Apply filters
    if (filters?.type) {
      whereClause.type = { in: filters.type };
    }

    const opportunities = await prisma.opportunity.findMany({
      where: whereClause,
      take: limit,
      orderBy: { deadline: 'asc' }
    });

    return opportunities.map(opp => this.convertDbToOpportunity(opp));
  }
}