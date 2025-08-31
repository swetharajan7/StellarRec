import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import * as ss from 'simple-statistics';
import axios from 'axios';

const prisma = new PrismaClient();

export interface BenchmarkComparison {
  userId: string;
  overallPercentile: number;
  categoryPercentiles: Record<string, number>;
  peerGroup: {
    size: number;
    averageSuccessRate: number;
    topPerformers: number;
  };
  competitivePosition: 'top' | 'above_average' | 'average' | 'below_average' | 'bottom';
  strengthsVsWeaknesses: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
  };
  recommendations: string[];
}

export interface PeerAnalysis {
  similarProfiles: number;
  successRate: number;
  averageMetrics: Record<string, number>;
  distributionData: Record<string, number[]>;
}

export class BenchmarkAnalysisService {
  private readonly USER_SERVICE_URL: string;
  private readonly ANALYTICS_SERVICE_URL: string;

  constructor() {
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006';
  }

  async generateBenchmarkComparison(userId: string): Promise<BenchmarkComparison> {
    try {
      logger.info('Generating benchmark comparison', { userId });

      const [userProfile, peerData] = await Promise.all([
        this.getUserProfile(userId),
        this.getPeerGroupData(userId)
      ]);

      const overallPercentile = this.calculateOverallPercentile(userProfile, peerData);
      const categoryPercentiles = this.calculateCategoryPercentiles(userProfile, peerData);
      const competitivePosition = this.determineCompetitivePosition(overallPercentile);
      const strengthsVsWeaknesses = this.analyzeStrengthsWeaknesses(categoryPercentiles);
      const recommendations = this.generateBenchmarkRecommendations(
        categoryPercentiles, 
        competitivePosition
      );

      return {
        userId,
        overallPercentile,
        categoryPercentiles,
        peerGroup: {
          size: peerData.similarProfiles,
          averageSuccessRate: peerData.successRate,
          topPerformers: Math.floor(peerData.similarProfiles * 0.1)
        },
        competitivePosition,
        strengthsVsWeaknesses,
        recommendations
      };

    } catch (error) {
      logger.error('Error generating benchmark comparison:', error);
      throw new Error('Failed to generate benchmark comparison');
    }
  }

  async getPeerAnalysis(userId: string, filters?: any): Promise<PeerAnalysis> {
    try {
      const userProfile = await this.getUserProfile(userId);
      const peerData = await this.findSimilarProfiles(userProfile, filters);

      return {
        similarProfiles: peerData.length,
        successRate: this.calculateSuccessRate(peerData),
        averageMetrics: this.calculateAverageMetrics(peerData),
        distributionData: this.calculateDistributions(peerData)
      };

    } catch (error) {
      logger.error('Error getting peer analysis:', error);
      throw new Error('Failed to get peer analysis');
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

  private async getPeerGroupData(userId: string): Promise<PeerAnalysis> {
    try {
      const userProfile = await this.getUserProfile(userId);
      const similarProfiles = await this.findSimilarProfiles(userProfile);

      return {
        similarProfiles: similarProfiles.length,
        successRate: this.calculateSuccessRate(similarProfiles),
        averageMetrics: this.calculateAverageMetrics(similarProfiles),
        distributionData: this.calculateDistributions(similarProfiles)
      };

    } catch (error) {
      logger.error('Error getting peer group data:', error);
      return {
        similarProfiles: 0,
        successRate: 0,
        averageMetrics: {},
        distributionData: {}
      };
    }
  }

  private async findSimilarProfiles(userProfile: any, filters?: any): Promise<any[]> {
    try {
      // Find users with similar characteristics
      const whereClause: any = {};

      // GPA range (±0.3)
      if (userProfile.gpa) {
        whereClause.gpa = {
          gte: userProfile.gpa - 0.3,
          lte: userProfile.gpa + 0.3
        };
      }

      // Similar test score range
      if (userProfile.testScores?.sat) {
        whereClause.satScore = {
          gte: userProfile.testScores.sat - 100,
          lte: userProfile.testScores.sat + 100
        };
      }

      // Same intended major category
      if (userProfile.intendedMajor) {
        whereClause.majorCategory = this.getMajorCategory(userProfile.intendedMajor);
      }

      // Apply additional filters
      if (filters) {
        Object.assign(whereClause, filters);
      }

      const similarProfiles = await prisma.userProfile.findMany({
        where: whereClause,
        take: 500,
        include: {
          admissionResults: true,
          extracurriculars: true
        }
      });

      return similarProfiles;

    } catch (error) {
      logger.error('Error finding similar profiles:', error);
      return [];
    }
  }

  private calculateOverallPercentile(userProfile: any, peerData: PeerAnalysis): number {
    const userScore = this.calculateCompositeScore(userProfile);
    
    // Mock calculation - in real implementation, would use actual peer data
    const peerScores = Array.from({ length: peerData.similarProfiles }, () => 
      Math.random() * 100
    );
    
    const rank = peerScores.filter(score => score <= userScore).length;
    return peerData.similarProfiles > 0 ? rank / peerData.similarProfiles : 0.5;
  }

  private calculateCategoryPercentiles(userProfile: any, peerData: PeerAnalysis): Record<string, number> {
    const categories = {
      'Academic Performance': this.calculateAcademicPercentile(userProfile, peerData),
      'Test Scores': this.calculateTestScorePercentile(userProfile, peerData),
      'Extracurriculars': this.calculateExtracurricularPercentile(userProfile, peerData),
      'Leadership': this.calculateLeadershipPercentile(userProfile, peerData),
      'Community Service': this.calculateServicePercentile(userProfile, peerData)
    };

    return categories;
  }

  private calculateCompositeScore(profile: any): number {
    let score = 0;
    let weights = 0;

    if (profile.gpa) {
      score += (profile.gpa / 4.0) * 35;
      weights += 35;
    }

    if (profile.testScores?.sat) {
      score += (profile.testScores.sat / 1600) * 25;
      weights += 25;
    }

    if (profile.extracurriculars) {
      const extScore = this.calculateExtracurricularScore(profile.extracurriculars);
      score += extScore * 20;
      weights += 20;
    }

    return weights > 0 ? (score / weights) * 100 : 50;
  }

  private calculateAcademicPercentile(userProfile: any, peerData: PeerAnalysis): number {
    if (!userProfile.gpa) return 0.5;
    
    // Mock calculation
    const avgGPA = peerData.averageMetrics.gpa || 3.5;
    const stdDev = 0.4;
    
    return this.normalCDF(userProfile.gpa, avgGPA, stdDev);
  }

  private calculateTestScorePercentile(userProfile: any, peerData: PeerAnalysis): number {
    const testScore = userProfile.testScores?.sat || userProfile.testScores?.act * 36;
    if (!testScore) return 0.5;

    const avgScore = peerData.averageMetrics.testScore || 1200;
    const stdDev = 150;

    return this.normalCDF(testScore, avgScore, stdDev);
  }

  private calculateExtracurricularPercentile(userProfile: any, peerData: PeerAnalysis): number {
    if (!userProfile.extracurriculars) return 0.3;

    const userScore = this.calculateExtracurricularScore(userProfile.extracurriculars);
    const avgScore = peerData.averageMetrics.extracurricularScore || 0.6;
    const stdDev = 0.2;

    return this.normalCDF(userScore, avgScore, stdDev);
  }

  private calculateLeadershipPercentile(userProfile: any, peerData: PeerAnalysis): number {
    if (!userProfile.extracurriculars) return 0.3;

    const leadershipCount = userProfile.extracurriculars.filter((activity: any) => 
      activity.leadership
    ).length;

    const avgLeadership = peerData.averageMetrics.leadershipCount || 1.5;
    const stdDev = 1.0;

    return this.normalCDF(leadershipCount, avgLeadership, stdDev);
  }

  private calculateServicePercentile(userProfile: any, peerData: PeerAnalysis): number {
    const serviceHours = userProfile.communityServiceHours || 0;
    const avgHours = peerData.averageMetrics.communityServiceHours || 50;
    const stdDev = 30;

    return this.normalCDF(serviceHours, avgHours, stdDev);
  }

  private calculateExtracurricularScore(extracurriculars: any[]): number {
    if (!extracurriculars || extracurriculars.length === 0) return 0;

    let score = 0;
    extracurriculars.forEach(activity => {
      score += 0.1; // Base participation
      if (activity.leadership) score += 0.2;
      if (activity.awards) score += 0.15;
      if (activity.duration > 2) score += 0.1;
      if (activity.impact === 'high') score += 0.1;
    });

    return Math.min(1.0, score);
  }

  private normalCDF(x: number, mean: number, stdDev: number): number {
    const z = (x - mean) / stdDev;
    return 0.5 * (1 + this.erf(z / Math.sqrt(2)));
  }

  private erf(x: number): number {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  private determineCompetitivePosition(percentile: number): BenchmarkComparison['competitivePosition'] {
    if (percentile >= 0.9) return 'top';
    if (percentile >= 0.7) return 'above_average';
    if (percentile >= 0.3) return 'average';
    if (percentile >= 0.1) return 'below_average';
    return 'bottom';
  }

  private analyzeStrengthsWeaknesses(categoryPercentiles: Record<string, number>): BenchmarkComparison['strengthsVsWeaknesses'] {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const opportunities: string[] = [];

    Object.entries(categoryPercentiles).forEach(([category, percentile]) => {
      if (percentile >= 0.8) {
        strengths.push(`Excellent ${category} (${Math.round(percentile * 100)}th percentile)`);
      } else if (percentile >= 0.6) {
        strengths.push(`Strong ${category} (${Math.round(percentile * 100)}th percentile)`);
      } else if (percentile <= 0.3) {
        weaknesses.push(`Below average ${category} (${Math.round(percentile * 100)}th percentile)`);
        opportunities.push(`Significant improvement potential in ${category}`);
      } else if (percentile <= 0.5) {
        opportunities.push(`Room for improvement in ${category}`);
      }
    });

    return { strengths, weaknesses, opportunities };
  }

  private generateBenchmarkRecommendations(
    categoryPercentiles: Record<string, number>,
    competitivePosition: BenchmarkComparison['competitivePosition']
  ): string[] {
    const recommendations: string[] = [];

    // Position-based recommendations
    switch (competitivePosition) {
      case 'top':
        recommendations.push('Maintain your excellent performance across all areas');
        recommendations.push('Consider applying to highly selective institutions');
        break;
      case 'above_average':
        recommendations.push('You are well-positioned for competitive schools');
        recommendations.push('Focus on strengthening any remaining weak areas');
        break;
      case 'average':
        recommendations.push('Target a mix of reach, match, and safety schools');
        recommendations.push('Identify and improve your strongest areas');
        break;
      case 'below_average':
        recommendations.push('Focus on significant improvement in key areas');
        recommendations.push('Consider gap year or community college pathway');
        break;
      case 'bottom':
        recommendations.push('Substantial improvement needed across multiple areas');
        recommendations.push('Work with counselors to develop improvement plan');
        break;
    }

    // Category-specific recommendations
    Object.entries(categoryPercentiles).forEach(([category, percentile]) => {
      if (percentile <= 0.3) {
        switch (category) {
          case 'Academic Performance':
            recommendations.push('Focus on improving GPA through strong final semester performance');
            break;
          case 'Test Scores':
            recommendations.push('Invest in test preparation and consider retaking standardized tests');
            break;
          case 'Extracurriculars':
            recommendations.push('Engage in meaningful extracurricular activities with leadership potential');
            break;
          case 'Leadership':
            recommendations.push('Seek leadership opportunities in current activities');
            break;
          case 'Community Service':
            recommendations.push('Increase community service involvement');
            break;
        }
      }
    });

    return [...new Set(recommendations)].slice(0, 6);
  }

  private calculateSuccessRate(profiles: any[]): number {
    if (profiles.length === 0) return 0;

    const successful = profiles.filter(profile => 
      profile.admissionResults?.some((result: any) => result.admitted)
    ).length;

    return successful / profiles.length;
  }

  private calculateAverageMetrics(profiles: any[]): Record<string, number> {
    if (profiles.length === 0) return {};

    const metrics: Record<string, number[]> = {
      gpa: [],
      testScore: [],
      extracurricularScore: [],
      leadershipCount: [],
      communityServiceHours: []
    };

    profiles.forEach(profile => {
      if (profile.gpa) metrics.gpa.push(profile.gpa);
      if (profile.satScore) metrics.testScore.push(profile.satScore);
      if (profile.extracurriculars) {
        metrics.extracurricularScore.push(this.calculateExtracurricularScore(profile.extracurriculars));
        metrics.leadershipCount.push(
          profile.extracurriculars.filter((activity: any) => activity.leadership).length
        );
      }
      if (profile.communityServiceHours) {
        metrics.communityServiceHours.push(profile.communityServiceHours);
      }
    });

    const averages: Record<string, number> = {};
    Object.entries(metrics).forEach(([key, values]) => {
      averages[key] = values.length > 0 ? ss.mean(values) : 0;
    });

    return averages;
  }

  private calculateDistributions(profiles: any[]): Record<string, number[]> {
    const distributions: Record<string, number[]> = {
      gpa: [],
      testScore: [],
      extracurricularCount: []
    };

    profiles.forEach(profile => {
      if (profile.gpa) distributions.gpa.push(profile.gpa);
      if (profile.satScore) distributions.testScore.push(profile.satScore);
      if (profile.extracurriculars) {
        distributions.extracurricularCount.push(profile.extracurriculars.length);
      }
    });

    return distributions;
  }

  private getMajorCategory(major: string): string {
    const categories: Record<string, string> = {
      'computer science': 'STEM',
      'engineering': 'STEM',
      'mathematics': 'STEM',
      'physics': 'STEM',
      'chemistry': 'STEM',
      'biology': 'STEM',
      'english': 'Liberal Arts',
      'history': 'Liberal Arts',
      'philosophy': 'Liberal Arts',
      'psychology': 'Social Sciences',
      'economics': 'Social Sciences',
      'political science': 'Social Sciences',
      'business': 'Business',
      'finance': 'Business',
      'marketing': 'Business'
    };

    const lowerMajor = major.toLowerCase();
    for (const [key, category] of Object.entries(categories)) {
      if (lowerMajor.includes(key)) {
        return category;
      }
    }

    return 'Other';
  }
}