import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import * as ss from 'simple-statistics';
import axios from 'axios';

const prisma = new PrismaClient();

export interface SuccessFactor {
  factor: string;
  importance: number; // 0-1
  correlation: number; // -1 to 1
  impact: 'positive' | 'negative';
  category: 'academic' | 'personal' | 'extracurricular' | 'demographic' | 'behavioral';
  description: string;
  recommendations: string[];
  evidenceStrength: 'weak' | 'moderate' | 'strong';
}

export interface SuccessAnalysis {
  userId: string;
  overallSuccessScore: number;
  confidence: number;
  keyFactors: SuccessFactor[];
  riskFactors: SuccessFactor[];
  recommendations: string[];
  benchmarkComparison: {
    percentileRank: number;
    similarProfiles: number;
    successRate: number;
  };
  improvementPlan: {
    shortTerm: string[];
    longTerm: string[];
    priority: string[];
  };
}

export interface FactorAnalysisResult {
  factors: SuccessFactor[];
  correlationMatrix: number[][];
  featureImportance: Record<string, number>;
  modelAccuracy: number;
  sampleSize: number;
}

export class SuccessFactorService {
  private readonly USER_SERVICE_URL: string;
  private readonly ANALYTICS_SERVICE_URL: string;
  private factorWeights: Map<string, number> = new Map();

  constructor() {
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006';
    this.initializeFactorWeights();
  }

  async analyzeSuccessFactors(userId: string): Promise<SuccessAnalysis> {
    try {
      logger.info('Analyzing success factors', { userId });

      // Get user data and historical success patterns
      const [userProfile, userBehavior, historicalData] = await Promise.all([
        this.getUserProfile(userId),
        this.getUserBehavior(userId),
        this.getHistoricalSuccessData()
      ]);

      // Calculate success factors
      const keyFactors = await this.calculateUserSuccessFactors(userProfile, userBehavior, historicalData);
      
      // Identify risk factors
      const riskFactors = keyFactors.filter(factor => 
        factor.impact === 'negative' && factor.importance > 0.6
      );

      // Calculate overall success score
      const overallSuccessScore = this.calculateOverallSuccessScore(keyFactors);
      
      // Calculate confidence
      const confidence = this.calculateAnalysisConfidence(userProfile, userBehavior);

      // Get benchmark comparison
      const benchmarkComparison = await this.getBenchmarkComparison(userId, keyFactors);

      // Generate recommendations and improvement plan
      const recommendations = this.generateSuccessRecommendations(keyFactors, riskFactors);
      const improvementPlan = this.createImprovementPlan(keyFactors, riskFactors);

      return {
        userId,
        overallSuccessScore,
        confidence,
        keyFactors,
        riskFactors,
        recommendations,
        benchmarkComparison,
        improvementPlan
      };

    } catch (error) {
      logger.error('Error analyzing success factors:', error);
      throw new Error('Failed to analyze success factors');
    }
  }

  async identifySuccessPatterns(
    userSegment?: string,
    sampleSize: number = 1000
  ): Promise<FactorAnalysisResult> {
    try {
      logger.info('Identifying success patterns', { userSegment, sampleSize });

      // Get historical success data
      const successData = await this.getHistoricalSuccessData(userSegment, sampleSize);
      
      if (successData.length < 50) {
        throw new Error('Insufficient data for pattern analysis');
      }

      // Extract features and outcomes
      const features = this.extractFeatures(successData);
      const outcomes = successData.map(data => data.successful ? 1 : 0);

      // Calculate correlations
      const correlations = await this.calculateFactorCorrelations(features, outcomes);
      
      // Build correlation matrix
      const correlationMatrix = this.buildCorrelationMatrix(features);
      
      // Calculate feature importance using random forest approach (simplified)
      const featureImportance = this.calculateFeatureImportance(features, outcomes);
      
      // Create success factors
      const factors = this.createSuccessFactors(correlations, featureImportance);
      
      // Calculate model accuracy
      const modelAccuracy = this.calculateModelAccuracy(features, outcomes);

      return {
        factors,
        correlationMatrix,
        featureImportance,
        modelAccuracy,
        sampleSize: successData.length
      };

    } catch (error) {
      logger.error('Error identifying success patterns:', error);
      throw new Error('Failed to identify success patterns');
    }
  }

  async getFactorRecommendations(
    userId: string,
    targetFactor: string
  ): Promise<string[]> {
    try {
      const userProfile = await this.getUserProfile(userId);
      const factorValue = this.extractFactorValue(userProfile, targetFactor);
      
      const recommendations: string[] = [];

      switch (targetFactor.toLowerCase()) {
        case 'gpa':
          if (factorValue < 3.5) {
            recommendations.push('Focus on core academic subjects');
            recommendations.push('Seek tutoring for challenging courses');
            recommendations.push('Develop better study habits and time management');
          }
          break;
        case 'test_scores':
          if (factorValue < 0.7) {
            recommendations.push('Take practice tests regularly');
            recommendations.push('Consider test prep courses or tutoring');
            recommendations.push('Focus on your weaker subject areas');
          }
          break;
        case 'extracurriculars':
          if (factorValue < 0.6) {
            recommendations.push('Join clubs related to your interests');
            recommendations.push('Seek leadership opportunities');
            recommendations.push('Engage in community service');
          }
          break;
        case 'essays':
          if (factorValue < 0.7) {
            recommendations.push('Start essay drafts early');
            recommendations.push('Get feedback from teachers and counselors');
            recommendations.push('Focus on authentic storytelling');
          }
          break;
        default:
          recommendations.push(`Work on improving your ${targetFactor}`);
      }

      return recommendations;

    } catch (error) {
      logger.error('Error getting factor recommendations:', error);
      return [];
    }
  }

  async trackFactorProgress(
    userId: string,
    factor: string,
    newValue: number
  ): Promise<void> {
    try {
      await prisma.factorProgress.create({
        data: {
          userId,
          factor,
          value: newValue,
          timestamp: new Date()
        }
      });

      logger.info('Factor progress tracked', { userId, factor, newValue });

    } catch (error) {
      logger.error('Error tracking factor progress:', error);
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

  private async getUserBehavior(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.ANALYTICS_SERVICE_URL}/api/v1/behavior/profile`, {
        headers: { 'X-User-ID': userId }
      });
      return response.data;
    } catch (error) {
      logger.warn('Failed to get user behavior:', error);
      return {};
    }
  }

  private async getHistoricalSuccessData(userSegment?: string, limit: number = 1000): Promise<any[]> {
    try {
      const whereClause: any = {};
      if (userSegment) {
        whereClause.userSegment = userSegment;
      }

      const data = await prisma.successHistory.findMany({
        where: whereClause,
        take: limit,
        orderBy: { createdAt: 'desc' }
      });

      return data;

    } catch (error) {
      logger.error('Error getting historical success data:', error);
      return [];
    }
  }

  private async calculateUserSuccessFactors(
    userProfile: any,
    userBehavior: any,
    historicalData: any[]
  ): Promise<SuccessFactor[]> {
    const factors: SuccessFactor[] = [];

    // Academic Performance Factor
    if (userProfile.gpa) {
      const gpaCorrelation = this.calculateFactorCorrelation('gpa', historicalData);
      factors.push({
        factor: 'Academic Performance (GPA)',
        importance: 0.35,
        correlation: gpaCorrelation,
        impact: userProfile.gpa >= 3.5 ? 'positive' : 'negative',
        category: 'academic',
        description: `Your GPA of ${userProfile.gpa} compared to successful applicants`,
        recommendations: userProfile.gpa < 3.5 ? 
          ['Focus on improving grades in core subjects', 'Seek academic support if needed'] :
          ['Maintain your strong academic performance'],
        evidenceStrength: Math.abs(gpaCorrelation) > 0.6 ? 'strong' : 'moderate'
      });
    }

    // Test Scores Factor
    if (userProfile.testScores) {
      const testCorrelation = this.calculateFactorCorrelation('testScores', historicalData);
      const testScore = userProfile.testScores.sat || userProfile.testScores.act * 36 || 0;
      factors.push({
        factor: 'Standardized Test Scores',
        importance: 0.25,
        correlation: testCorrelation,
        impact: testScore >= 1400 ? 'positive' : 'negative',
        category: 'academic',
        description: `Your test scores compared to successful applicants`,
        recommendations: testScore < 1400 ? 
          ['Consider retaking standardized tests', 'Use test prep resources'] :
          ['Your test scores are competitive'],
        evidenceStrength: Math.abs(testCorrelation) > 0.5 ? 'strong' : 'moderate'
      });
    }

    // Platform Engagement Factor
    if (userBehavior.engagementScore) {
      factors.push({
        factor: 'Platform Engagement',
        importance: 0.15,
        correlation: 0.4,
        impact: userBehavior.engagementScore > 0.6 ? 'positive' : 'negative',
        category: 'behavioral',
        description: 'Your engagement with platform resources and tools',
        recommendations: userBehavior.engagementScore < 0.6 ? 
          ['Increase use of platform resources', 'Engage more with recommendations'] :
          ['Continue your active engagement'],
        evidenceStrength: 'moderate'
      });
    }

    // Application Completeness Factor
    const completenessScore = this.calculateApplicationCompleteness(userProfile);
    factors.push({
      factor: 'Application Completeness',
      importance: 0.2,
      correlation: 0.6,
      impact: completenessScore > 0.8 ? 'positive' : 'negative',
      category: 'personal',
      description: 'Completeness and quality of your application materials',
      recommendations: completenessScore < 0.8 ? 
        ['Complete all application sections', 'Review and improve essay quality'] :
        ['Your application is well-prepared'],
      evidenceStrength: 'strong'
    });

    // Timeline Adherence Factor
    const timelineScore = await this.calculateTimelineAdherence(userProfile.userId);
    factors.push({
      factor: 'Timeline Adherence',
      importance: 0.05,
      correlation: 0.3,
      impact: timelineScore > 0.8 ? 'positive' : 'negative',
      category: 'behavioral',
      description: 'Your adherence to application deadlines and milestones',
      recommendations: timelineScore < 0.8 ? 
        ['Create a structured timeline', 'Set regular milestones'] :
        ['Excellent timeline management'],
      evidenceStrength: 'moderate'
    });

    return factors;
  }

  private calculateFactorCorrelation(factor: string, historicalData: any[]): number {
    // Simplified correlation calculation
    const correlations: Record<string, number> = {
      'gpa': 0.7,
      'testScores': 0.6,
      'extracurriculars': 0.4,
      'essays': 0.5,
      'recommendations': 0.3
    };

    return correlations[factor] || 0.3;
  }

  private calculateApplicationCompleteness(userProfile: any): number {
    let completeness = 0;
    let totalSections = 0;

    const sections = [
      'personalInfo', 'academicHistory', 'testScores', 
      'extracurriculars', 'essays', 'recommendations'
    ];

    sections.forEach(section => {
      totalSections++;
      if (userProfile[section] && this.isSectionComplete(userProfile[section], section)) {
        completeness++;
      }
    });

    return totalSections > 0 ? completeness / totalSections : 0;
  }

  private isSectionComplete(sectionData: any, sectionType: string): boolean {
    if (!sectionData) return false;

    switch (sectionType) {
      case 'personalInfo':
        return !!(sectionData.name && sectionData.email && sectionData.address);
      case 'academicHistory':
        return !!(sectionData.gpa && sectionData.transcripts);
      case 'testScores':
        return !!(sectionData.sat || sectionData.act);
      case 'extracurriculars':
        return Array.isArray(sectionData) && sectionData.length > 0;
      case 'essays':
        return Array.isArray(sectionData) && sectionData.every((essay: any) => essay.content && essay.content.length > 100);
      case 'recommendations':
        return Array.isArray(sectionData) && sectionData.length >= 2;
      default:
        return true;
    }
  }

  private async calculateTimelineAdherence(userId: string): Promise<number> {
    // Mock implementation - would calculate based on actual timeline data
    return 0.85;
  }

  private calculateOverallSuccessScore(factors: SuccessFactor[]): number {
    let weightedScore = 0;
    let totalWeight = 0;

    factors.forEach(factor => {
      const factorScore = factor.impact === 'positive' ? 
        Math.abs(factor.correlation) : 
        1 - Math.abs(factor.correlation);
      
      weightedScore += factorScore * factor.importance;
      totalWeight += factor.importance;
    });

    return totalWeight > 0 ? weightedScore / totalWeight : 0.5;
  }

  private calculateAnalysisConfidence(userProfile: any, userBehavior: any): number {
    let confidence = 0.5;

    // Data completeness
    const profileCompleteness = this.calculateApplicationCompleteness(userProfile);
    confidence += profileCompleteness * 0.3;

    // Behavior data availability
    if (userBehavior.interactions && userBehavior.interactions.length > 10) {
      confidence += 0.2;
    }

    return Math.min(0.95, confidence);
  }

  private async getBenchmarkComparison(userId: string, factors: SuccessFactor[]): Promise<any> {
    // Mock implementation
    return {
      percentileRank: 75,
      similarProfiles: 150,
      successRate: 0.68
    };
  }

  private generateSuccessRecommendations(
    keyFactors: SuccessFactor[],
    riskFactors: SuccessFactor[]
  ): string[] {
    const recommendations: string[] = [];

    // Address risk factors first
    riskFactors.forEach(factor => {
      recommendations.push(...factor.recommendations);
    });

    // Leverage strengths
    const strengths = keyFactors.filter(f => f.impact === 'positive' && f.importance > 0.3);
    if (strengths.length > 0) {
      recommendations.push(`Continue leveraging your strengths in ${strengths.map(s => s.factor).join(', ')}`);
    }

    return [...new Set(recommendations)].slice(0, 8); // Remove duplicates and limit
  }

  private createImprovementPlan(
    keyFactors: SuccessFactor[],
    riskFactors: SuccessFactor[]
  ): SuccessAnalysis['improvementPlan'] {
    const shortTerm: string[] = [];
    const longTerm: string[] = [];
    const priority: string[] = [];

    riskFactors.forEach(factor => {
      if (factor.category === 'behavioral' || factor.category === 'personal') {
        shortTerm.push(`Address ${factor.factor} within 30 days`);
      } else {
        longTerm.push(`Improve ${factor.factor} over the next semester`);
      }

      if (factor.importance > 0.7) {
        priority.push(factor.factor);
      }
    });

    return { shortTerm, longTerm, priority };
  }

  private extractFeatures(successData: any[]): Record<string, number[]> {
    const features: Record<string, number[]> = {
      gpa: [],
      satScore: [],
      actScore: [],
      extracurricularCount: [],
      leadershipPositions: [],
      communityService: [],
      workExperience: [],
      essayQuality: [],
      recommendationStrength: [],
      timelineAdherence: []
    };

    successData.forEach(data => {
      features.gpa.push(data.gpa || 0);
      features.satScore.push(data.satScore || 0);
      features.actScore.push(data.actScore || 0);
      features.extracurricularCount.push(data.extracurriculars?.length || 0);
      features.leadershipPositions.push(data.leadershipCount || 0);
      features.communityService.push(data.communityServiceHours || 0);
      features.workExperience.push(data.workExperience ? 1 : 0);
      features.essayQuality.push(data.essayScore || 0);
      features.recommendationStrength.push(data.recommendationScore || 0);
      features.timelineAdherence.push(data.timelineScore || 0);
    });

    return features;
  }

  private async calculateFactorCorrelations(
    features: Record<string, number[]>,
    outcomes: number[]
  ): Promise<Record<string, number>> {
    const correlations: Record<string, number> = {};

    Object.entries(features).forEach(([factor, values]) => {
      if (values.length === outcomes.length) {
        try {
          const correlation = ss.sampleCorrelation(values, outcomes);
          correlations[factor] = isNaN(correlation) ? 0 : correlation;
        } catch (error) {
          correlations[factor] = 0;
        }
      }
    });

    return correlations;
  }

  private buildCorrelationMatrix(features: Record<string, number[]>): number[][] {
    const factorNames = Object.keys(features);
    const matrix: number[][] = [];

    factorNames.forEach((factor1, i) => {
      matrix[i] = [];
      factorNames.forEach((factor2, j) => {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          try {
            const correlation = ss.sampleCorrelation(features[factor1], features[factor2]);
            matrix[i][j] = isNaN(correlation) ? 0 : correlation;
          } catch (error) {
            matrix[i][j] = 0;
          }
        }
      });
    });

    return matrix;
  }

  private calculateFeatureImportance(
    features: Record<string, number[]>,
    outcomes: number[]
  ): Record<string, number> {
    const importance: Record<string, number> = {};

    // Simplified feature importance using correlation strength
    Object.entries(features).forEach(([factor, values]) => {
      try {
        const correlation = ss.sampleCorrelation(values, outcomes);
        importance[factor] = Math.abs(isNaN(correlation) ? 0 : correlation);
      } catch (error) {
        importance[factor] = 0;
      }
    });

    // Normalize importance scores
    const maxImportance = Math.max(...Object.values(importance));
    if (maxImportance > 0) {
      Object.keys(importance).forEach(factor => {
        importance[factor] = importance[factor] / maxImportance;
      });
    }

    return importance;
  }

  private createSuccessFactors(
    correlations: Record<string, number>,
    featureImportance: Record<string, number>
  ): SuccessFactor[] {
    const factors: SuccessFactor[] = [];

    Object.entries(correlations).forEach(([factor, correlation]) => {
      const importance = featureImportance[factor] || 0;
      
      if (importance > 0.1) { // Only include factors with some importance
        factors.push({
          factor: this.formatFactorName(factor),
          importance,
          correlation,
          impact: correlation > 0 ? 'positive' : 'negative',
          category: this.categorizeSuccessFactor(factor),
          description: this.getFactorDescription(factor),
          recommendations: this.getFactorRecommendations(factor, correlation),
          evidenceStrength: Math.abs(correlation) > 0.6 ? 'strong' : 
                           Math.abs(correlation) > 0.3 ? 'moderate' : 'weak'
        });
      }
    });

    return factors.sort((a, b) => b.importance - a.importance);
  }

  private calculateModelAccuracy(features: Record<string, number[]>, outcomes: number[]): number {
    // Simplified accuracy calculation using correlation
    const correlations = Object.values(features).map(values => {
      try {
        return Math.abs(ss.sampleCorrelation(values, outcomes));
      } catch {
        return 0;
      }
    });

    return correlations.reduce((sum, corr) => sum + corr, 0) / correlations.length;
  }

  private formatFactorName(factor: string): string {
    const nameMap: Record<string, string> = {
      'gpa': 'Academic Performance (GPA)',
      'satScore': 'SAT Score',
      'actScore': 'ACT Score',
      'extracurricularCount': 'Extracurricular Activities',
      'leadershipPositions': 'Leadership Experience',
      'communityService': 'Community Service',
      'workExperience': 'Work Experience',
      'essayQuality': 'Essay Quality',
      'recommendationStrength': 'Recommendation Letters',
      'timelineAdherence': 'Timeline Management'
    };

    return nameMap[factor] || factor;
  }

  private categorizeSuccessFactor(factor: string): SuccessFactor['category'] {
    const categoryMap: Record<string, SuccessFactor['category']> = {
      'gpa': 'academic',
      'satScore': 'academic',
      'actScore': 'academic',
      'extracurricularCount': 'extracurricular',
      'leadershipPositions': 'extracurricular',
      'communityService': 'extracurricular',
      'workExperience': 'personal',
      'essayQuality': 'personal',
      'recommendationStrength': 'personal',
      'timelineAdherence': 'behavioral'
    };

    return categoryMap[factor] || 'personal';
  }

  private getFactorDescription(factor: string): string {
    const descriptions: Record<string, string> = {
      'gpa': 'Academic performance as measured by cumulative GPA',
      'satScore': 'Standardized test performance on the SAT',
      'actScore': 'Standardized test performance on the ACT',
      'extracurricularCount': 'Number and quality of extracurricular activities',
      'leadershipPositions': 'Leadership roles and responsibilities',
      'communityService': 'Community service and volunteer work',
      'workExperience': 'Relevant work and internship experience',
      'essayQuality': 'Quality and impact of personal essays',
      'recommendationStrength': 'Strength of recommendation letters',
      'timelineAdherence': 'Adherence to application timelines and deadlines'
    };

    return descriptions[factor] || 'Factor contributing to admission success';
  }

  private getFactorRecommendations(factor: string, correlation: number): string[] {
    const isPositive = correlation > 0;
    
    const recommendationMap: Record<string, string[]> = {
      'gpa': isPositive ? 
        ['Maintain strong academic performance', 'Focus on challenging courses'] :
        ['Improve study habits', 'Seek academic support'],
      'satScore': isPositive ?
        ['Continue test preparation', 'Take the test when ready'] :
        ['Increase test prep time', 'Consider test prep courses'],
      'extracurricularCount': isPositive ?
        ['Continue meaningful activities', 'Seek leadership roles'] :
        ['Join relevant clubs and activities', 'Focus on quality over quantity']
    };

    return recommendationMap[factor] || ['Focus on improving this area'];
  }

  private extractFactorValue(userProfile: any, factor: string): number {
    switch (factor.toLowerCase()) {
      case 'gpa':
        return userProfile.gpa || 0;
      case 'test_scores':
        return (userProfile.testScores?.sat || 0) / 1600;
      case 'extracurriculars':
        return this.calculateExtracurricularScore(userProfile.extracurriculars);
      case 'essays':
        return userProfile.essayScore || 0;
      default:
        return 0;
    }
  }

  private calculateExtracurricularScore(extracurriculars: any[]): number {
    if (!extracurriculars || extracurriculars.length === 0) return 0;

    let score = 0;
    extracurriculars.forEach(activity => {
      score += 0.2; // Base score
      if (activity.leadership) score += 0.3;
      if (activity.awards) score += 0.2;
      if (activity.duration > 1) score += 0.1;
    });

    return Math.min(1.0, score);
  }

  private initializeFactorWeights(): void {
    this.factorWeights.set('gpa', 0.35);
    this.factorWeights.set('testScores', 0.25);
    this.factorWeights.set('extracurriculars', 0.15);
    this.factorWeights.set('essays', 0.15);
    this.factorWeights.set('recommendations', 0.1);
  }
}