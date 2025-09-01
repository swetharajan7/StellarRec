import { logger } from '../utils/logger';

export interface RankingFactors {
  textRelevance: number;
  popularity: number;
  recency: number;
  authority: number;
  userPreference: number;
  clickThroughRate: number;
  completeness: number;
}

export interface RankingConfig {
  weights: RankingFactors;
  boosts: {
    titleMatch: number;
    exactMatch: number;
    phraseMatch: number;
    synonymMatch: number;
  };
  penalties: {
    duplicateContent: number;
    lowQuality: number;
    outdated: number;
  };
}

export interface DocumentScore {
  documentId: string;
  baseScore: number;
  adjustedScore: number;
  factors: RankingFactors;
  explanation: string[];
}

export class RankingService {
  private config: RankingConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): RankingConfig {
    return {
      weights: {
        textRelevance: 0.4,
        popularity: 0.15,
        recency: 0.1,
        authority: 0.15,
        userPreference: 0.1,
        clickThroughRate: 0.05,
        completeness: 0.05
      },
      boosts: {
        titleMatch: 2.0,
        exactMatch: 1.8,
        phraseMatch: 1.5,
        synonymMatch: 1.2
      },
      penalties: {
        duplicateContent: 0.5,
        lowQuality: 0.7,
        outdated: 0.8
      }
    };
  }

  calculateRelevanceScore(
    document: any,
    query: string,
    userContext?: {
      userId?: string;
      preferences?: string[];
      searchHistory?: string[];
      location?: string;
    }
  ): DocumentScore {
    const factors: RankingFactors = {
      textRelevance: this.calculateTextRelevance(document, query),
      popularity: this.calculatePopularity(document),
      recency: this.calculateRecency(document),
      authority: this.calculateAuthority(document),
      userPreference: this.calculateUserPreference(document, userContext),
      clickThroughRate: this.calculateClickThroughRate(document),
      completeness: this.calculateCompleteness(document)
    };

    const baseScore = document._score || 1.0;
    const adjustedScore = this.combineFactors(baseScore, factors);
    const explanation = this.generateExplanation(factors, baseScore, adjustedScore);

    return {
      documentId: document._id,
      baseScore,
      adjustedScore,
      factors,
      explanation
    };
  }

  private calculateTextRelevance(document: any, query: string): number {
    const source = document._source;
    const queryLower = query.toLowerCase();
    let score = 0;

    // Title relevance (highest weight)
    if (source.title) {
      const titleLower = source.title.toLowerCase();
      if (titleLower === queryLower) {
        score += this.config.boosts.exactMatch;
      } else if (titleLower.includes(queryLower)) {
        score += this.config.boosts.phraseMatch;
      } else if (this.hasWordMatch(titleLower, queryLower)) {
        score += this.config.boosts.titleMatch;
      }
    }

    // Description relevance
    if (source.description) {
      const descLower = source.description.toLowerCase();
      if (descLower.includes(queryLower)) {
        score += 0.8;
      } else if (this.hasWordMatch(descLower, queryLower)) {
        score += 0.5;
      }
    }

    // Content relevance
    if (source.content) {
      const contentLower = source.content.toLowerCase();
      const wordMatches = this.countWordMatches(contentLower, queryLower);
      score += Math.min(wordMatches * 0.1, 1.0);
    }

    // Tags relevance
    if (source.tags && Array.isArray(source.tags)) {
      const tagMatches = source.tags.filter((tag: string) => 
        tag.toLowerCase().includes(queryLower)
      ).length;
      score += tagMatches * 0.3;
    }

    // Category relevance
    if (source.category) {
      const categoryLower = source.category.toLowerCase();
      if (categoryLower.includes(queryLower)) {
        score += 0.4;
      }
    }

    return Math.min(score / 5, 1.0); // Normalize to 0-1
  }

  private calculatePopularity(document: any): number {
    const source = document._source;
    let score = 0;

    // View count
    if (source.viewCount) {
      score += Math.log10(source.viewCount + 1) / 6; // Log scale, max ~1.0 for 1M views
    }

    // Like/rating count
    if (source.likeCount) {
      score += Math.log10(source.likeCount + 1) / 5;
    }

    // Share count
    if (source.shareCount) {
      score += Math.log10(source.shareCount + 1) / 4;
    }

    // University/program ranking (for educational content)
    if (source.ranking) {
      // Inverse ranking score (lower rank number = higher score)
      score += Math.max(0, (1000 - source.ranking) / 1000);
    }

    // Acceptance rate (for universities - lower is more prestigious)
    if (source.acceptanceRate) {
      score += Math.max(0, (100 - source.acceptanceRate) / 100);
    }

    return Math.min(score, 1.0);
  }

  private calculateRecency(document: any): number {
    const source = document._source;
    const now = new Date();
    
    let dateToUse: Date;
    if (source.updatedAt) {
      dateToUse = new Date(source.updatedAt);
    } else if (source.createdAt) {
      dateToUse = new Date(source.createdAt);
    } else {
      return 0.5; // Neutral score for unknown dates
    }

    const daysDiff = (now.getTime() - dateToUse.getTime()) / (1000 * 60 * 60 * 24);

    // Recency decay function
    if (daysDiff <= 7) return 1.0;      // Last week: full score
    if (daysDiff <= 30) return 0.9;     // Last month: 90%
    if (daysDiff <= 90) return 0.7;     // Last 3 months: 70%
    if (daysDiff <= 365) return 0.5;    // Last year: 50%
    if (daysDiff <= 730) return 0.3;    // Last 2 years: 30%
    return 0.1;                         // Older: 10%
  }

  private calculateAuthority(document: any): number {
    const source = document._source;
    let score = 0.5; // Base authority score

    // Author authority
    if (source.author) {
      // This would typically come from an author authority database
      // For now, use simple heuristics
      if (source.authorVerified) score += 0.2;
      if (source.authorExpertise) score += 0.1;
    }

    // Source authority (for universities, official sources)
    if (source.sourceType) {
      switch (source.sourceType) {
        case 'official':
        case 'university':
          score += 0.3;
          break;
        case 'verified':
          score += 0.2;
          break;
        case 'community':
          score += 0.1;
          break;
      }
    }

    // Domain authority (if URL is available)
    if (source.url) {
      const domain = this.extractDomain(source.url);
      score += this.getDomainAuthority(domain);
    }

    // Citation count (for academic content)
    if (source.citationCount) {
      score += Math.min(Math.log10(source.citationCount + 1) / 4, 0.2);
    }

    return Math.min(score, 1.0);
  }

  private calculateUserPreference(document: any, userContext?: any): number {
    if (!userContext) return 0.5;

    const source = document._source;
    let score = 0.5;

    // User interests matching
    if (userContext.preferences && source.tags) {
      const matchingInterests = userContext.preferences.filter((pref: string) =>
        source.tags.some((tag: string) => 
          tag.toLowerCase().includes(pref.toLowerCase())
        )
      );
      score += matchingInterests.length * 0.1;
    }

    // Location preference
    if (userContext.location && source.location) {
      if (source.location.toLowerCase().includes(userContext.location.toLowerCase())) {
        score += 0.2;
      }
    }

    // Search history relevance
    if (userContext.searchHistory && source.title) {
      const historyMatches = userContext.searchHistory.filter((query: string) =>
        source.title.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(source.title.toLowerCase())
      );
      score += historyMatches.length * 0.05;
    }

    // User type preference (student vs recommender)
    if (userContext.userType && source.targetAudience) {
      if (source.targetAudience.includes(userContext.userType)) {
        score += 0.15;
      }
    }

    return Math.min(score, 1.0);
  }

  private calculateClickThroughRate(document: any): number {
    // This would come from analytics data
    // For now, use mock data based on document type and popularity
    const source = document._source;
    let baseCTR = 0.1; // 10% base CTR

    // Adjust based on document type
    switch (source.type) {
      case 'university':
        baseCTR = 0.15;
        break;
      case 'program':
        baseCTR = 0.12;
        break;
      case 'scholarship':
        baseCTR = 0.18;
        break;
      case 'document':
        baseCTR = 0.08;
        break;
    }

    // Adjust based on popularity indicators
    if (source.viewCount) {
      baseCTR += Math.min(Math.log10(source.viewCount + 1) / 50, 0.1);
    }

    return Math.min(baseCTR, 0.5); // Cap at 50%
  }

  private calculateCompleteness(document: any): number {
    const source = document._source;
    let score = 0;
    let totalFields = 0;

    // Check for essential fields
    const essentialFields = [
      'title', 'description', 'category', 'tags'
    ];

    const optionalFields = [
      'content', 'author', 'url', 'imageUrl', 'location'
    ];

    // Essential fields (weighted more heavily)
    for (const field of essentialFields) {
      totalFields += 2;
      if (source[field] && source[field].toString().trim().length > 0) {
        score += 2;
      }
    }

    // Optional fields
    for (const field of optionalFields) {
      totalFields += 1;
      if (source[field] && source[field].toString().trim().length > 0) {
        score += 1;
      }
    }

    // Bonus for rich content
    if (source.content && source.content.length > 500) {
      score += 1;
      totalFields += 1;
    }

    if (source.tags && Array.isArray(source.tags) && source.tags.length > 3) {
      score += 1;
      totalFields += 1;
    }

    return totalFields > 0 ? score / totalFields : 0.5;
  }

  private combineFactors(baseScore: number, factors: RankingFactors): number {
    const weights = this.config.weights;
    
    let adjustedScore = baseScore;

    // Apply weighted factors
    adjustedScore *= (
      factors.textRelevance * weights.textRelevance +
      factors.popularity * weights.popularity +
      factors.recency * weights.recency +
      factors.authority * weights.authority +
      factors.userPreference * weights.userPreference +
      factors.clickThroughRate * weights.clickThroughRate +
      factors.completeness * weights.completeness
    );

    return Math.max(adjustedScore, 0.01); // Minimum score
  }

  private generateExplanation(
    factors: RankingFactors,
    baseScore: number,
    adjustedScore: number
  ): string[] {
    const explanation: string[] = [];
    const weights = this.config.weights;

    explanation.push(`Base relevance score: ${baseScore.toFixed(3)}`);

    if (factors.textRelevance > 0.7) {
      explanation.push(`High text relevance (${(factors.textRelevance * 100).toFixed(1)}%)`);
    }

    if (factors.popularity > 0.6) {
      explanation.push(`Popular content (${(factors.popularity * 100).toFixed(1)}%)`);
    }

    if (factors.recency > 0.8) {
      explanation.push(`Recent content (${(factors.recency * 100).toFixed(1)}%)`);
    }

    if (factors.authority > 0.7) {
      explanation.push(`Authoritative source (${(factors.authority * 100).toFixed(1)}%)`);
    }

    if (factors.userPreference > 0.6) {
      explanation.push(`Matches user preferences (${(factors.userPreference * 100).toFixed(1)}%)`);
    }

    if (factors.clickThroughRate > 0.2) {
      explanation.push(`High engagement (${(factors.clickThroughRate * 100).toFixed(1)}% CTR)`);
    }

    if (factors.completeness > 0.8) {
      explanation.push(`Complete information (${(factors.completeness * 100).toFixed(1)}%)`);
    }

    explanation.push(`Final score: ${adjustedScore.toFixed(3)}`);

    return explanation;
  }

  private hasWordMatch(text: string, query: string): boolean {
    const textWords = text.split(/\s+/);
    const queryWords = query.split(/\s+/);
    
    return queryWords.some(queryWord => 
      textWords.some(textWord => 
        textWord.includes(queryWord) || queryWord.includes(textWord)
      )
    );
  }

  private countWordMatches(text: string, query: string): number {
    const textWords = text.split(/\s+/);
    const queryWords = query.split(/\s+/);
    
    let matches = 0;
    for (const queryWord of queryWords) {
      for (const textWord of textWords) {
        if (textWord.includes(queryWord) || queryWord.includes(textWord)) {
          matches++;
        }
      }
    }
    
    return matches;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  private getDomainAuthority(domain: string): number {
    // Mock domain authority scores
    const authorityScores: Record<string, number> = {
      'harvard.edu': 0.3,
      'stanford.edu': 0.3,
      'mit.edu': 0.3,
      'yale.edu': 0.25,
      'princeton.edu': 0.25,
      'columbia.edu': 0.25,
      'berkeley.edu': 0.2,
      'ucla.edu': 0.2,
      'uchicago.edu': 0.2,
      'upenn.edu': 0.2,
      'gov': 0.25,
      'edu': 0.15,
      'org': 0.1
    };

    // Check for exact domain match
    if (authorityScores[domain]) {
      return authorityScores[domain];
    }

    // Check for TLD match
    const tld = domain.split('.').pop() || '';
    return authorityScores[tld] || 0.05;
  }

  updateConfig(newConfig: Partial<RankingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Ranking configuration updated');
  }

  getConfig(): RankingConfig {
    return { ...this.config };
  }

  // Batch scoring for multiple documents
  calculateBatchScores(
    documents: any[],
    query: string,
    userContext?: any
  ): DocumentScore[] {
    return documents.map(doc => 
      this.calculateRelevanceScore(doc, query, userContext)
    );
  }

  // A/B testing support
  calculateScoreWithVariant(
    document: any,
    query: string,
    variant: 'control' | 'experimental',
    userContext?: any
  ): DocumentScore {
    const originalConfig = this.config;

    if (variant === 'experimental') {
      // Apply experimental configuration
      this.config = {
        ...this.config,
        weights: {
          ...this.config.weights,
          popularity: 0.2, // Increase popularity weight
          recency: 0.15,   // Increase recency weight
          userPreference: 0.15 // Increase personalization
        }
      };
    }

    const score = this.calculateRelevanceScore(document, query, userContext);
    
    // Restore original configuration
    this.config = originalConfig;
    
    return score;
  }
}