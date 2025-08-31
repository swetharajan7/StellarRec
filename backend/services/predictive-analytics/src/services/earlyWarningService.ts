import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { addDays, differenceInDays, isBefore, isAfter } from 'date-fns';
import axios from 'axios';
import * as cron from 'node-cron';

const prisma = new PrismaClient();

export interface EarlyWarning {
  id: string;
  userId: string;
  type: 'deadline_risk' | 'performance_decline' | 'completion_risk' | 'quality_concern' | 'resource_shortage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  affectedItems: string[];
  riskScore: number; // 0-1
  timeToImpact: number; // days
  recommendations: string[];
  actionRequired: boolean;
  createdAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
}

export interface RiskAssessment {
  userId: string;
  overallRiskScore: number;
  riskCategories: {
    deadlineRisk: number;
    performanceRisk: number;
    completionRisk: number;
    qualityRisk: number;
  };
  activeWarnings: EarlyWarning[];
  trendAnalysis: {
    riskTrend: 'improving' | 'stable' | 'declining';
    keyFactors: string[];
  };
  recommendations: string[];
}

export interface AlertConfiguration {
  userId: string;
  enabledAlerts: string[];
  severityThreshold: 'low' | 'medium' | 'high';
  notificationChannels: ('email' | 'sms' | 'push')[];
  quietHours: {
    start: string;
    end: string;
  };
}

export class EarlyWarningService {
  private readonly USER_SERVICE_URL: string;
  private readonly APPLICATION_SERVICE_URL: string;
  private readonly NOTIFICATION_SERVICE_URL: string;
  private monitoringActive = false;

  constructor() {
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.APPLICATION_SERVICE_URL = process.env.APPLICATION_SERVICE_URL || 'http://localhost:3004';
    this.NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009';
    this.startMonitoring();
  }

  async assessRisks(userId: string): Promise<RiskAssessment> {
    try {
      logger.info('Assessing risks for user', { userId });

      const [userProfile, applications, timeline, historicalData] = await Promise.all([
        this.getUserProfile(userId),
        this.getUserApplications(userId),
        this.getUserTimeline(userId),
        this.getHistoricalPerformance(userId)
      ]);

      // Calculate risk scores for different categories
      const deadlineRisk = await this.assessDeadlineRisk(applications, timeline);
      const performanceRisk = await this.assessPerformanceRisk(userProfile, historicalData);
      const completionRisk = await this.assessCompletionRisk(timeline, historicalData);
      const qualityRisk = await this.assessQualityRisk(userProfile, applications);

      const overallRiskScore = this.calculateOverallRisk({
        deadlineRisk,
        performanceRisk,
        completionRisk,
        qualityRisk
      });

      // Generate active warnings
      const activeWarnings = await this.generateWarnings(userId, {
        deadlineRisk,
        performanceRisk,
        completionRisk,
        qualityRisk
      });

      // Analyze trends
      const trendAnalysis = await this.analyzeTrends(userId, historicalData);

      // Generate recommendations
      const recommendations = this.generateRiskRecommendations({
        deadlineRisk,
        performanceRisk,
        completionRisk,
        qualityRisk
      }, activeWarnings);

      return {
        userId,
        overallRiskScore,
        riskCategories: {
          deadlineRisk,
          performanceRisk,
          completionRisk,
          qualityRisk
        },
        activeWarnings,
        trendAnalysis,
        recommendations
      };

    } catch (error) {
      logger.error('Error assessing risks:', error);
      throw new Error('Failed to assess risks');
    }
  }

  async createWarning(warning: Omit<EarlyWarning, 'id' | 'createdAt' | 'status'>): Promise<EarlyWarning> {
    try {
      const newWarning: EarlyWarning = {
        ...warning,
        id: `warning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        status: 'active'
      };

      // Save to database
      await this.saveWarning(newWarning);

      // Send notifications if required
      if (newWarning.actionRequired || newWarning.severity === 'critical') {
        await this.sendWarningNotification(newWarning);
      }

      logger.info('Warning created', { warningId: newWarning.id, userId: newWarning.userId });

      return newWarning;

    } catch (error) {
      logger.error('Error creating warning:', error);
      throw new Error('Failed to create warning');
    }
  }

  async resolveWarning(warningId: string, userId: string): Promise<void> {
    try {
      await prisma.earlyWarning.update({
        where: { id: warningId, userId },
        data: {
          status: 'resolved',
          resolvedAt: new Date()
        }
      });

      logger.info('Warning resolved', { warningId, userId });

    } catch (error) {
      logger.error('Error resolving warning:', error);
      throw new Error('Failed to resolve warning');
    }
  }

  async getActiveWarnings(userId: string): Promise<EarlyWarning[]> {
    try {
      const warnings = await prisma.earlyWarning.findMany({
        where: {
          userId,
          status: { in: ['active', 'acknowledged'] }
        },
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      return warnings.map(w => ({
        id: w.id,
        userId: w.userId,
        type: w.type as EarlyWarning['type'],
        severity: w.severity as EarlyWarning['severity'],
        title: w.title,
        description: w.description,
        affectedItems: w.affectedItems,
        riskScore: w.riskScore,
        timeToImpact: w.timeToImpact,
        recommendations: w.recommendations,
        actionRequired: w.actionRequired,
        createdAt: w.createdAt,
        resolvedAt: w.resolvedAt || undefined,
        status: w.status as EarlyWarning['status']
      }));

    } catch (error) {
      logger.error('Error getting active warnings:', error);
      return [];
    }
  }

  async configureAlerts(userId: string, config: AlertConfiguration): Promise<void> {
    try {
      await prisma.alertConfiguration.upsert({
        where: { userId },
        update: {
          enabledAlerts: config.enabledAlerts,
          severityThreshold: config.severityThreshold,
          notificationChannels: config.notificationChannels,
          quietHours: config.quietHours
        },
        create: {
          userId,
          enabledAlerts: config.enabledAlerts,
          severityThreshold: config.severityThreshold,
          notificationChannels: config.notificationChannels,
          quietHours: config.quietHours
        }
      });

      logger.info('Alert configuration updated', { userId });

    } catch (error) {
      logger.error('Error configuring alerts:', error);
      throw new Error('Failed to configure alerts');
    }
  }

  private startMonitoring(): void {
    if (this.monitoringActive) return;

    // Run risk assessment every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.runPeriodicRiskAssessment();
      } catch (error) {
        logger.error('Error in periodic risk assessment:', error);
      }
    });

    // Run deadline checks every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      try {
        await this.runDeadlineChecks();
      } catch (error) {
        logger.error('Error in deadline checks:', error);
      }
    });

    this.monitoringActive = true;
    logger.info('Early warning monitoring started');
  }

  private async runPeriodicRiskAssessment(): Promise<void> {
    try {
      // Get all active users
      const activeUsers = await this.getActiveUsers();

      for (const userId of activeUsers) {
        try {
          await this.assessRisks(userId);
        } catch (error) {
          logger.warn('Error assessing risks for user', { userId, error: error.message });
        }
      }

      logger.info('Periodic risk assessment completed', { usersProcessed: activeUsers.length });

    } catch (error) {
      logger.error('Error in periodic risk assessment:', error);
    }
  }

  private async runDeadlineChecks(): Promise<void> {
    try {
      const upcomingDeadlines = await this.getUpcomingDeadlines();

      for (const deadline of upcomingDeadlines) {
        const daysUntilDeadline = differenceInDays(deadline.date, new Date());
        
        if (daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
          await this.createWarning({
            userId: deadline.userId,
            type: 'deadline_risk',
            severity: daysUntilDeadline <= 3 ? 'high' : 'medium',
            title: `Upcoming Deadline: ${deadline.title}`,
            description: `${deadline.title} is due in ${daysUntilDeadline} days`,
            affectedItems: [deadline.id],
            riskScore: 1 - (daysUntilDeadline / 7),
            timeToImpact: daysUntilDeadline,
            recommendations: [
              'Review completion status',
              'Allocate additional time if needed',
              'Prepare submission materials'
            ],
            actionRequired: daysUntilDeadline <= 3
          });
        }
      }

    } catch (error) {
      logger.error('Error in deadline checks:', error);
    }
  }

  private async assessDeadlineRisk(applications: any[], timeline: any): Promise<number> {
    let riskScore = 0;
    let totalDeadlines = 0;

    applications.forEach(app => {
      totalDeadlines++;
      const daysUntilDeadline = differenceInDays(new Date(app.deadline), new Date());
      
      if (daysUntilDeadline < 0) {
        riskScore += 1; // Overdue
      } else if (daysUntilDeadline <= 7) {
        riskScore += 0.8; // Very close
      } else if (daysUntilDeadline <= 14) {
        riskScore += 0.5; // Close
      } else if (daysUntilDeadline <= 30) {
        riskScore += 0.2; // Approaching
      }
    });

    return totalDeadlines > 0 ? riskScore / totalDeadlines : 0;
  }

  private async assessPerformanceRisk(userProfile: any, historicalData: any[]): Promise<number> {
    let riskScore = 0;

    // Check GPA trend
    if (historicalData.length > 1) {
      const recentGPA = historicalData[0]?.gpa || userProfile.gpa;
      const previousGPA = historicalData[1]?.gpa;
      
      if (previousGPA && recentGPA < previousGPA) {
        riskScore += 0.3; // Declining GPA
      }
    }

    // Check test score performance
    if (userProfile.testScores) {
      const targetScore = userProfile.targetTestScore || 1400;
      const actualScore = userProfile.testScores.sat || userProfile.testScores.act * 36;
      
      if (actualScore < targetScore * 0.9) {
        riskScore += 0.4; // Below target
      }
    }

    // Check engagement metrics
    const engagementScore = userProfile.engagementScore || 0.5;
    if (engagementScore < 0.3) {
      riskScore += 0.3; // Low engagement
    }

    return Math.min(1, riskScore);
  }

  private async assessCompletionRisk(timeline: any, historicalData: any[]): Promise<number> {
    if (!timeline || !timeline.milestones) return 0.5;

    let riskScore = 0;
    let totalMilestones = timeline.milestones.length;

    timeline.milestones.forEach((milestone: any) => {
      if (milestone.status === 'overdue') {
        riskScore += 0.8;
      } else if (milestone.completionProbability < 0.5) {
        riskScore += 0.6;
      } else if (milestone.completionProbability < 0.7) {
        riskScore += 0.3;
      }
    });

    return totalMilestones > 0 ? riskScore / totalMilestones : 0;
  }

  private async assessQualityRisk(userProfile: any, applications: any[]): Promise<number> {
    let riskScore = 0;
    let factors = 0;

    // Check essay quality
    if (userProfile.essayScore) {
      factors++;
      if (userProfile.essayScore < 0.6) {
        riskScore += 0.7;
      } else if (userProfile.essayScore < 0.8) {
        riskScore += 0.3;
      }
    }

    // Check recommendation status
    applications.forEach(app => {
      factors++;
      const recommendationCount = app.recommendations?.length || 0;
      const requiredRecommendations = app.requiredRecommendations || 2;
      
      if (recommendationCount < requiredRecommendations) {
        riskScore += 0.5;
      }
    });

    // Check application completeness
    applications.forEach(app => {
      factors++;
      const completeness = this.calculateApplicationCompleteness(app);
      if (completeness < 0.8) {
        riskScore += 0.4;
      }
    });

    return factors > 0 ? riskScore / factors : 0;
  }

  private calculateOverallRisk(riskCategories: {
    deadlineRisk: number;
    performanceRisk: number;
    completionRisk: number;
    qualityRisk: number;
  }): number {
    const weights = {
      deadlineRisk: 0.3,
      performanceRisk: 0.25,
      completionRisk: 0.25,
      qualityRisk: 0.2
    };

    return (
      riskCategories.deadlineRisk * weights.deadlineRisk +
      riskCategories.performanceRisk * weights.performanceRisk +
      riskCategories.completionRisk * weights.completionRisk +
      riskCategories.qualityRisk * weights.qualityRisk
    );
  }

  private async generateWarnings(userId: string, riskCategories: any): Promise<EarlyWarning[]> {
    const warnings: EarlyWarning[] = [];

    // Deadline risk warnings
    if (riskCategories.deadlineRisk > 0.7) {
      warnings.push({
        id: `deadline_${Date.now()}`,
        userId,
        type: 'deadline_risk',
        severity: riskCategories.deadlineRisk > 0.9 ? 'critical' : 'high',
        title: 'High Deadline Risk Detected',
        description: 'Multiple deadlines are approaching with insufficient preparation time',
        affectedItems: [],
        riskScore: riskCategories.deadlineRisk,
        timeToImpact: 7,
        recommendations: [
          'Review all upcoming deadlines',
          'Prioritize most critical applications',
          'Consider extending timeline if possible'
        ],
        actionRequired: true,
        createdAt: new Date(),
        status: 'active'
      });
    }

    // Performance risk warnings
    if (riskCategories.performanceRisk > 0.6) {
      warnings.push({
        id: `performance_${Date.now()}`,
        userId,
        type: 'performance_decline',
        severity: riskCategories.performanceRisk > 0.8 ? 'high' : 'medium',
        title: 'Performance Decline Detected',
        description: 'Academic or engagement metrics show declining trend',
        affectedItems: [],
        riskScore: riskCategories.performanceRisk,
        timeToImpact: 14,
        recommendations: [
          'Review study habits and time management',
          'Seek academic support if needed',
          'Increase platform engagement'
        ],
        actionRequired: riskCategories.performanceRisk > 0.8,
        createdAt: new Date(),
        status: 'active'
      });
    }

    // Completion risk warnings
    if (riskCategories.completionRisk > 0.6) {
      warnings.push({
        id: `completion_${Date.now()}`,
        userId,
        type: 'completion_risk',
        severity: riskCategories.completionRisk > 0.8 ? 'high' : 'medium',
        title: 'Application Completion Risk',
        description: 'Low probability of completing applications on time',
        affectedItems: [],
        riskScore: riskCategories.completionRisk,
        timeToImpact: 21,
        recommendations: [
          'Break down large tasks into smaller steps',
          'Set daily progress goals',
          'Consider getting help with applications'
        ],
        actionRequired: riskCategories.completionRisk > 0.8,
        createdAt: new Date(),
        status: 'active'
      });
    }

    return warnings;
  }

  private async analyzeTrends(userId: string, historicalData: any[]): Promise<{
    riskTrend: 'improving' | 'stable' | 'declining';
    keyFactors: string[];
  }> {
    if (historicalData.length < 2) {
      return { riskTrend: 'stable', keyFactors: [] };
    }

    const recent = historicalData[0];
    const previous = historicalData[1];
    const keyFactors: string[] = [];

    let improvingFactors = 0;
    let decliningFactors = 0;

    // Analyze GPA trend
    if (recent.gpa && previous.gpa) {
      if (recent.gpa > previous.gpa) {
        improvingFactors++;
        keyFactors.push('GPA improving');
      } else if (recent.gpa < previous.gpa) {
        decliningFactors++;
        keyFactors.push('GPA declining');
      }
    }

    // Analyze engagement trend
    if (recent.engagementScore && previous.engagementScore) {
      if (recent.engagementScore > previous.engagementScore) {
        improvingFactors++;
        keyFactors.push('Engagement increasing');
      } else if (recent.engagementScore < previous.engagementScore) {
        decliningFactors++;
        keyFactors.push('Engagement decreasing');
      }
    }

    let riskTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (improvingFactors > decliningFactors) {
      riskTrend = 'improving';
    } else if (decliningFactors > improvingFactors) {
      riskTrend = 'declining';
    }

    return { riskTrend, keyFactors };
  }

  private generateRiskRecommendations(
    riskCategories: any,
    activeWarnings: EarlyWarning[]
  ): string[] {
    const recommendations: string[] = [];

    if (riskCategories.deadlineRisk > 0.5) {
      recommendations.push('Create a detailed timeline with buffer time');
      recommendations.push('Set up daily progress tracking');
    }

    if (riskCategories.performanceRisk > 0.5) {
      recommendations.push('Schedule regular study sessions');
      recommendations.push('Seek academic support or tutoring');
    }

    if (riskCategories.completionRisk > 0.5) {
      recommendations.push('Break large tasks into smaller, manageable steps');
      recommendations.push('Consider getting help with application preparation');
    }

    if (riskCategories.qualityRisk > 0.5) {
      recommendations.push('Allocate more time for essay writing and revision');
      recommendations.push('Secure strong recommendation letters early');
    }

    if (activeWarnings.length > 3) {
      recommendations.push('Focus on addressing the most critical warnings first');
    }

    return [...new Set(recommendations)].slice(0, 5);
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

  private async getUserApplications(userId: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.APPLICATION_SERVICE_URL}/api/v1/applications`, {
        headers: { 'X-User-ID': userId }
      });
      return response.data;
    } catch (error) {
      logger.warn('Failed to get user applications:', error);
      return [];
    }
  }

  private async getUserTimeline(userId: string): Promise<any> {
    try {
      // This would typically call the timeline service
      return { milestones: [] };
    } catch (error) {
      logger.warn('Failed to get user timeline:', error);
      return { milestones: [] };
    }
  }

  private async getHistoricalPerformance(userId: string): Promise<any[]> {
    try {
      const data = await prisma.performanceHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10
      });
      return data;
    } catch (error) {
      logger.warn('Failed to get historical performance:', error);
      return [];
    }
  }

  private async getActiveUsers(): Promise<string[]> {
    try {
      // Get users who have been active in the last 30 days
      const activeUsers = await prisma.userActivity.findMany({
        where: {
          lastActivity: {
            gte: addDays(new Date(), -30)
          }
        },
        select: { userId: true }
      });

      return activeUsers.map(u => u.userId);
    } catch (error) {
      logger.error('Error getting active users:', error);
      return [];
    }
  }

  private async getUpcomingDeadlines(): Promise<any[]> {
    try {
      const deadlines = await prisma.applicationDeadline.findMany({
        where: {
          date: {
            gte: new Date(),
            lte: addDays(new Date(), 14)
          }
        },
        include: {
          application: {
            select: { userId: true }
          }
        }
      });

      return deadlines.map(d => ({
        id: d.id,
        userId: d.application.userId,
        title: d.title,
        date: d.date
      }));
    } catch (error) {
      logger.error('Error getting upcoming deadlines:', error);
      return [];
    }
  }

  private calculateApplicationCompleteness(application: any): number {
    let completed = 0;
    let total = 0;

    const sections = [
      'personalInfo', 'academicHistory', 'testScores',
      'essays', 'recommendations', 'extracurriculars'
    ];

    sections.forEach(section => {
      total++;
      if (application[section] && this.isSectionComplete(application[section], section)) {
        completed++;
      }
    });

    return total > 0 ? completed / total : 0;
  }

  private isSectionComplete(sectionData: any, sectionType: string): boolean {
    if (!sectionData) return false;

    switch (sectionType) {
      case 'personalInfo':
        return !!(sectionData.name && sectionData.email);
      case 'academicHistory':
        return !!(sectionData.gpa && sectionData.transcripts);
      case 'testScores':
        return !!(sectionData.sat || sectionData.act);
      case 'essays':
        return Array.isArray(sectionData) && sectionData.length > 0;
      case 'recommendations':
        return Array.isArray(sectionData) && sectionData.length >= 2;
      case 'extracurriculars':
        return Array.isArray(sectionData) && sectionData.length > 0;
      default:
        return true;
    }
  }

  private async saveWarning(warning: EarlyWarning): Promise<void> {
    try {
      await prisma.earlyWarning.create({
        data: {
          id: warning.id,
          userId: warning.userId,
          type: warning.type,
          severity: warning.severity,
          title: warning.title,
          description: warning.description,
          affectedItems: warning.affectedItems,
          riskScore: warning.riskScore,
          timeToImpact: warning.timeToImpact,
          recommendations: warning.recommendations,
          actionRequired: warning.actionRequired,
          createdAt: warning.createdAt,
          status: warning.status
        }
      });
    } catch (error) {
      logger.error('Error saving warning:', error);
    }
  }

  private async sendWarningNotification(warning: EarlyWarning): Promise<void> {
    try {
      // Get user's alert configuration
      const config = await prisma.alertConfiguration.findUnique({
        where: { userId: warning.userId }
      });

      if (!config || !config.enabledAlerts.includes(warning.type)) {
        return; // User has disabled this type of alert
      }

      // Check severity threshold
      const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      if (severityLevels[warning.severity] < severityLevels[config.severityThreshold]) {
        return; // Below threshold
      }

      // Send notification via configured channels
      const notificationData = {
        userId: warning.userId,
        title: warning.title,
        message: warning.description,
        severity: warning.severity,
        actionRequired: warning.actionRequired
      };

      for (const channel of config.notificationChannels) {
        try {
          await axios.post(`${this.NOTIFICATION_SERVICE_URL}/api/v1/send/${channel}`, notificationData);
        } catch (error) {
          logger.warn(`Failed to send ${channel} notification:`, error);
        }
      }

    } catch (error) {
      logger.error('Error sending warning notification:', error);
    }
  }
}