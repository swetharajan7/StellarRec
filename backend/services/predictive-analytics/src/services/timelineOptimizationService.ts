import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { addDays, addWeeks, addMonths, differenceInDays, format, parseISO } from 'date-fns';
import axios from 'axios';

const prisma = new PrismaClient();

export interface OptimizedTimeline {
  userId: string;
  totalDuration: number; // days
  milestones: TimelineMilestone[];
  criticalPath: string[];
  bufferTime: number; // days
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    riskFactors: string[];
    mitigation: string[];
  };
  recommendations: string[];
  lastOptimized: Date;
}

export interface TimelineMilestone {
  id: string;
  title: string;
  description: string;
  dueDate: Date;
  estimatedDuration: number; // days
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  category: 'application' | 'testing' | 'essays' | 'recommendations' | 'financial_aid';
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  completionProbability: number;
  bufferDays: number;
}

export interface DeadlineConflict {
  conflictId: string;
  milestones: string[];
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  resolutionOptions: string[];
}

export class TimelineOptimizationService {
  private readonly USER_SERVICE_URL: string;
  private readonly APPLICATION_SERVICE_URL: string;

  constructor() {
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.APPLICATION_SERVICE_URL = process.env.APPLICATION_SERVICE_URL || 'http://localhost:3004';
  }

  async optimizeTimeline(userId: string): Promise<OptimizedTimeline> {
    try {
      logger.info('Optimizing timeline', { userId });

      const [userProfile, applications, currentTimeline] = await Promise.all([
        this.getUserProfile(userId),
        this.getUserApplications(userId),
        this.getCurrentTimeline(userId)
      ]);

      // Generate optimized milestones
      const milestones = await this.generateOptimizedMilestones(
        userProfile, 
        applications, 
        currentTimeline
      );

      // Calculate critical path
      const criticalPath = this.calculateCriticalPath(milestones);

      // Assess risks
      const riskAssessment = this.assessTimelineRisks(milestones, criticalPath);

      // Calculate total duration and buffer time
      const totalDuration = this.calculateTotalDuration(milestones);
      const bufferTime = this.calculateBufferTime(milestones);

      // Generate recommendations
      const recommendations = this.generateTimelineRecommendations(
        milestones, 
        riskAssessment, 
        criticalPath
      );

      const optimizedTimeline: OptimizedTimeline = {
        userId,
        totalDuration,
        milestones,
        criticalPath,
        bufferTime,
        riskAssessment,
        recommendations,
        lastOptimized: new Date()
      };

      // Save optimized timeline
      await this.saveOptimizedTimeline(optimizedTimeline);

      return optimizedTimeline;

    } catch (error) {
      logger.error('Error optimizing timeline:', error);
      throw new Error('Failed to optimize timeline');
    }
  }

  async detectDeadlineConflicts(userId: string): Promise<DeadlineConflict[]> {
    try {
      const timeline = await this.getCurrentTimeline(userId);
      const conflicts: DeadlineConflict[] = [];

      // Sort milestones by due date
      const sortedMilestones = timeline.milestones.sort((a, b) => 
        a.dueDate.getTime() - b.dueDate.getTime()
      );

      // Check for overlapping critical tasks
      for (let i = 0; i < sortedMilestones.length - 1; i++) {
        const current = sortedMilestones[i];
        const next = sortedMilestones[i + 1];

        const currentEndDate = addDays(current.dueDate, -current.bufferDays);
        const nextStartDate = addDays(next.dueDate, -next.estimatedDuration);

        if (currentEndDate >= nextStartDate && 
            (current.priority === 'critical' || next.priority === 'critical')) {
          
          const daysDifference = differenceInDays(currentEndDate, nextStartDate);
          const severity = this.determineSeverity(daysDifference, current.priority, next.priority);

          conflicts.push({
            conflictId: `conflict_${current.id}_${next.id}`,
            milestones: [current.id, next.id],
            severity,
            description: `${current.title} and ${next.title} have overlapping timelines`,
            resolutionOptions: this.generateResolutionOptions(current, next, daysDifference)
          });
        }
      }

      return conflicts;

    } catch (error) {
      logger.error('Error detecting deadline conflicts:', error);
      return [];
    }
  }

  async adjustTimelineForDelay(
    userId: string, 
    milestoneId: string, 
    delayDays: number
  ): Promise<OptimizedTimeline> {
    try {
      logger.info('Adjusting timeline for delay', { userId, milestoneId, delayDays });

      const currentTimeline = await this.getCurrentTimeline(userId);
      const affectedMilestone = currentTimeline.milestones.find(m => m.id === milestoneId);

      if (!affectedMilestone) {
        throw new Error('Milestone not found');
      }

      // Adjust the delayed milestone
      affectedMilestone.dueDate = addDays(affectedMilestone.dueDate, delayDays);
      affectedMilestone.status = 'overdue';

      // Propagate delay to dependent milestones
      const updatedMilestones = this.propagateDelay(
        currentTimeline.milestones, 
        milestoneId, 
        delayDays
      );

      // Re-optimize the timeline
      const optimizedTimeline = await this.reoptimizeTimeline(userId, updatedMilestones);

      return optimizedTimeline;

    } catch (error) {
      logger.error('Error adjusting timeline for delay:', error);
      throw new Error('Failed to adjust timeline');
    }
  }

  async predictTimelineCompletion(userId: string): Promise<{
    completionProbability: number;
    expectedCompletionDate: Date;
    riskFactors: string[];
    recommendations: string[];
  }> {
    try {
      const timeline = await this.getCurrentTimeline(userId);
      const userBehavior = await this.getUserBehavior(userId);

      // Calculate completion probability based on historical performance
      const completionProbability = this.calculateCompletionProbability(
        timeline.milestones, 
        userBehavior
      );

      // Predict expected completion date
      const expectedCompletionDate = this.predictCompletionDate(
        timeline.milestones, 
        userBehavior
      );

      // Identify risk factors
      const riskFactors = this.identifyCompletionRisks(timeline.milestones, userBehavior);

      // Generate recommendations
      const recommendations = this.generateCompletionRecommendations(
        completionProbability, 
        riskFactors
      );

      return {
        completionProbability,
        expectedCompletionDate,
        riskFactors,
        recommendations
      };

    } catch (error) {
      logger.error('Error predicting timeline completion:', error);
      throw new Error('Failed to predict timeline completion');
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

  private async getCurrentTimeline(userId: string): Promise<OptimizedTimeline> {
    try {
      const timeline = await prisma.optimizedTimeline.findFirst({
        where: { userId },
        orderBy: { lastOptimized: 'desc' },
        include: { milestones: true }
      });

      if (timeline) {
        return {
          userId: timeline.userId,
          totalDuration: timeline.totalDuration,
          milestones: timeline.milestones.map(m => ({
            id: m.id,
            title: m.title,
            description: m.description,
            dueDate: m.dueDate,
            estimatedDuration: m.estimatedDuration,
            priority: m.priority as TimelineMilestone['priority'],
            dependencies: m.dependencies,
            category: m.category as TimelineMilestone['category'],
            status: m.status as TimelineMilestone['status'],
            completionProbability: m.completionProbability,
            bufferDays: m.bufferDays
          })),
          criticalPath: timeline.criticalPath,
          bufferTime: timeline.bufferTime,
          riskAssessment: timeline.riskAssessment as any,
          recommendations: timeline.recommendations,
          lastOptimized: timeline.lastOptimized
        };
      }

      // Return default timeline if none exists
      return this.createDefaultTimeline(userId);

    } catch (error) {
      logger.error('Error getting current timeline:', error);
      return this.createDefaultTimeline(userId);
    }
  }

  private createDefaultTimeline(userId: string): OptimizedTimeline {
    const now = new Date();
    const milestones: TimelineMilestone[] = [
      {
        id: 'research_universities',
        title: 'Research Universities',
        description: 'Research and create list of target universities',
        dueDate: addWeeks(now, 2),
        estimatedDuration: 7,
        priority: 'high',
        dependencies: [],
        category: 'application',
        status: 'not_started',
        completionProbability: 0.9,
        bufferDays: 3
      },
      {
        id: 'standardized_tests',
        title: 'Complete Standardized Tests',
        description: 'Take SAT/ACT and achieve target scores',
        dueDate: addMonths(now, 2),
        estimatedDuration: 30,
        priority: 'critical',
        dependencies: [],
        category: 'testing',
        status: 'not_started',
        completionProbability: 0.8,
        bufferDays: 14
      },
      {
        id: 'essays_draft',
        title: 'Draft Personal Essays',
        description: 'Write first drafts of all required essays',
        dueDate: addMonths(now, 3),
        estimatedDuration: 21,
        priority: 'critical',
        dependencies: ['research_universities'],
        category: 'essays',
        status: 'not_started',
        completionProbability: 0.7,
        bufferDays: 7
      }
    ];

    return {
      userId,
      totalDuration: 120,
      milestones,
      criticalPath: ['standardized_tests', 'essays_draft'],
      bufferTime: 24,
      riskAssessment: {
        overallRisk: 'medium',
        riskFactors: ['Limited time for test preparation'],
        mitigation: ['Start test prep immediately', 'Consider test prep courses']
      },
      recommendations: ['Begin university research immediately', 'Register for standardized tests'],
      lastOptimized: now
    };
  }

  private async generateOptimizedMilestones(
    userProfile: any,
    applications: any[],
    currentTimeline: OptimizedTimeline
  ): Promise<TimelineMilestone[]> {
    const milestones: TimelineMilestone[] = [];
    const now = new Date();

    // Generate milestones for each application
    applications.forEach(app => {
      const appDeadline = parseISO(app.deadline);
      
      // Application submission milestone
      milestones.push({
        id: `submit_${app.id}`,
        title: `Submit Application - ${app.universityName}`,
        description: `Complete and submit application to ${app.universityName}`,
        dueDate: addDays(appDeadline, -3), // 3 days before deadline
        estimatedDuration: 2,
        priority: 'critical',
        dependencies: [`essays_${app.id}`, `recommendations_${app.id}`],
        category: 'application',
        status: app.status === 'submitted' ? 'completed' : 'not_started',
        completionProbability: 0.95,
        bufferDays: 1
      });

      // Essay milestones
      milestones.push({
        id: `essays_${app.id}`,
        title: `Complete Essays - ${app.universityName}`,
        description: `Write and finalize all required essays`,
        dueDate: addDays(appDeadline, -14),
        estimatedDuration: 10,
        priority: 'critical',
        dependencies: ['essays_draft'],
        category: 'essays',
        status: 'not_started',
        completionProbability: 0.8,
        bufferDays: 3
      });

      // Recommendation milestones
      milestones.push({
        id: `recommendations_${app.id}`,
        title: `Secure Recommendations - ${app.universityName}`,
        description: `Obtain all required recommendation letters`,
        dueDate: addDays(appDeadline, -21),
        estimatedDuration: 14,
        priority: 'high',
        dependencies: [],
        category: 'recommendations',
        status: 'not_started',
        completionProbability: 0.9,
        bufferDays: 7
      });
    });

    // Add common milestones from current timeline
    currentTimeline.milestones.forEach(milestone => {
      if (!milestones.find(m => m.id === milestone.id)) {
        milestones.push(milestone);
      }
    });

    // Optimize milestone scheduling
    return this.optimizeMilestoneScheduling(milestones);
  }

  private optimizeMilestoneScheduling(milestones: TimelineMilestone[]): TimelineMilestone[] {
    // Sort by priority and dependencies
    const optimized = [...milestones];
    
    // Adjust dates based on dependencies
    optimized.forEach(milestone => {
      milestone.dependencies.forEach(depId => {
        const dependency = optimized.find(m => m.id === depId);
        if (dependency) {
          const minStartDate = addDays(dependency.dueDate, 1);
          if (milestone.dueDate < minStartDate) {
            const adjustment = differenceInDays(minStartDate, milestone.dueDate);
            milestone.dueDate = addDays(milestone.dueDate, adjustment);
          }
        }
      });
    });

    return optimized.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }

  private calculateCriticalPath(milestones: TimelineMilestone[]): string[] {
    const criticalPath: string[] = [];
    const visited = new Set<string>();

    // Find milestones with no dependencies (starting points)
    const startingMilestones = milestones.filter(m => m.dependencies.length === 0);

    // Traverse dependency graph to find critical path
    const findLongestPath = (milestoneId: string, currentPath: string[]): string[] => {
      if (visited.has(milestoneId)) return currentPath;
      
      visited.add(milestoneId);
      const milestone = milestones.find(m => m.id === milestoneId);
      if (!milestone) return currentPath;

      const newPath = [...currentPath, milestoneId];
      
      // Find dependent milestones
      const dependents = milestones.filter(m => m.dependencies.includes(milestoneId));
      
      if (dependents.length === 0) return newPath;

      // Find the longest path among dependents
      let longestPath = newPath;
      dependents.forEach(dependent => {
        const path = findLongestPath(dependent.id, newPath);
        if (path.length > longestPath.length) {
          longestPath = path;
        }
      });

      return longestPath;
    };

    // Find the longest critical path
    let longestOverallPath: string[] = [];
    startingMilestones.forEach(milestone => {
      const path = findLongestPath(milestone.id, []);
      if (path.length > longestOverallPath.length) {
        longestOverallPath = path;
      }
    });

    return longestOverallPath;
  }

  private assessTimelineRisks(
    milestones: TimelineMilestone[], 
    criticalPath: string[]
  ): OptimizedTimeline['riskAssessment'] {
    const riskFactors: string[] = [];
    const mitigation: string[] = [];

    // Check for tight deadlines
    const tightDeadlines = milestones.filter(m => m.bufferDays < 2);
    if (tightDeadlines.length > 0) {
      riskFactors.push('Multiple milestones with insufficient buffer time');
      mitigation.push('Increase buffer time for critical milestones');
    }

    // Check for low completion probabilities
    const lowProbability = milestones.filter(m => m.completionProbability < 0.7);
    if (lowProbability.length > 0) {
      riskFactors.push('Some milestones have low completion probability');
      mitigation.push('Focus additional effort on high-risk milestones');
    }

    // Check critical path length
    if (criticalPath.length > 5) {
      riskFactors.push('Long critical path with many dependencies');
      mitigation.push('Consider parallelizing some tasks');
    }

    // Determine overall risk
    let overallRisk: 'low' | 'medium' | 'high' = 'low';
    if (riskFactors.length >= 3) overallRisk = 'high';
    else if (riskFactors.length >= 1) overallRisk = 'medium';

    return { overallRisk, riskFactors, mitigation };
  }

  private calculateTotalDuration(milestones: TimelineMilestone[]): number {
    if (milestones.length === 0) return 0;

    const earliestStart = Math.min(...milestones.map(m => m.dueDate.getTime()));
    const latestEnd = Math.max(...milestones.map(m => m.dueDate.getTime()));

    return differenceInDays(new Date(latestEnd), new Date(earliestStart));
  }

  private calculateBufferTime(milestones: TimelineMilestone[]): number {
    return milestones.reduce((total, milestone) => total + milestone.bufferDays, 0);
  }

  private generateTimelineRecommendations(
    milestones: TimelineMilestone[],
    riskAssessment: OptimizedTimeline['riskAssessment'],
    criticalPath: string[]
  ): string[] {
    const recommendations: string[] = [];

    // Risk-based recommendations
    if (riskAssessment.overallRisk === 'high') {
      recommendations.push('Consider extending timeline or reducing scope');
      recommendations.push('Focus on critical path milestones first');
    }

    // Critical path recommendations
    const criticalMilestones = milestones.filter(m => criticalPath.includes(m.id));
    const overdueCritical = criticalMilestones.filter(m => m.status === 'overdue');
    if (overdueCritical.length > 0) {
      recommendations.push('Address overdue critical milestones immediately');
    }

    // Buffer time recommendations
    const lowBuffer = milestones.filter(m => m.bufferDays < 2);
    if (lowBuffer.length > 0) {
      recommendations.push('Increase buffer time for tight deadlines');
    }

    // Completion probability recommendations
    const lowProbability = milestones.filter(m => m.completionProbability < 0.7);
    if (lowProbability.length > 0) {
      recommendations.push('Allocate additional resources to high-risk tasks');
    }

    return recommendations.slice(0, 5);
  }

  private determineSeverity(
    daysDifference: number, 
    priority1: TimelineMilestone['priority'], 
    priority2: TimelineMilestone['priority']
  ): DeadlineConflict['severity'] {
    if (daysDifference > 7 && (priority1 === 'critical' || priority2 === 'critical')) {
      return 'severe';
    }
    if (daysDifference > 3) return 'moderate';
    return 'minor';
  }

  private generateResolutionOptions(
    milestone1: TimelineMilestone,
    milestone2: TimelineMilestone,
    daysDifference: number
  ): string[] {
    return [
      `Extend ${milestone1.title} deadline by ${daysDifference} days`,
      `Start ${milestone2.title} earlier`,
      `Reduce scope of one or both milestones`,
      `Allocate additional resources to parallel execution`
    ];
  }

  private propagateDelay(
    milestones: TimelineMilestone[],
    delayedMilestoneId: string,
    delayDays: number
  ): TimelineMilestone[] {
    const updated = [...milestones];
    const toUpdate = new Set<string>();

    // Find all milestones that depend on the delayed one
    const findDependents = (milestoneId: string) => {
      updated.forEach(milestone => {
        if (milestone.dependencies.includes(milestoneId) && !toUpdate.has(milestone.id)) {
          toUpdate.add(milestone.id);
          findDependents(milestone.id);
        }
      });
    };

    findDependents(delayedMilestoneId);

    // Update dependent milestones
    updated.forEach(milestone => {
      if (toUpdate.has(milestone.id)) {
        milestone.dueDate = addDays(milestone.dueDate, delayDays);
      }
    });

    return updated;
  }

  private async reoptimizeTimeline(
    userId: string, 
    updatedMilestones: TimelineMilestone[]
  ): Promise<OptimizedTimeline> {
    // Re-run optimization with updated milestones
    const criticalPath = this.calculateCriticalPath(updatedMilestones);
    const riskAssessment = this.assessTimelineRisks(updatedMilestones, criticalPath);
    const totalDuration = this.calculateTotalDuration(updatedMilestones);
    const bufferTime = this.calculateBufferTime(updatedMilestones);
    const recommendations = this.generateTimelineRecommendations(
      updatedMilestones, 
      riskAssessment, 
      criticalPath
    );

    return {
      userId,
      totalDuration,
      milestones: updatedMilestones,
      criticalPath,
      bufferTime,
      riskAssessment,
      recommendations,
      lastOptimized: new Date()
    };
  }

  private async getUserBehavior(userId: string): Promise<any> {
    // Mock implementation - would get actual user behavior data
    return {
      averageTaskCompletionTime: 1.2, // multiplier
      onTimeCompletionRate: 0.8,
      procrastinationTendency: 0.3
    };
  }

  private calculateCompletionProbability(
    milestones: TimelineMilestone[],
    userBehavior: any
  ): number {
    const avgProbability = milestones.reduce((sum, m) => sum + m.completionProbability, 0) / milestones.length;
    const behaviorAdjustment = userBehavior.onTimeCompletionRate;
    
    return Math.min(0.95, avgProbability * behaviorAdjustment);
  }

  private predictCompletionDate(
    milestones: TimelineMilestone[],
    userBehavior: any
  ): Date {
    const latestMilestone = milestones.reduce((latest, current) => 
      current.dueDate > latest.dueDate ? current : latest
    );

    const delayMultiplier = userBehavior.averageTaskCompletionTime || 1.0;
    const additionalDays = Math.floor(latestMilestone.estimatedDuration * (delayMultiplier - 1));

    return addDays(latestMilestone.dueDate, additionalDays);
  }

  private identifyCompletionRisks(
    milestones: TimelineMilestone[],
    userBehavior: any
  ): string[] {
    const risks: string[] = [];

    if (userBehavior.procrastinationTendency > 0.5) {
      risks.push('High procrastination tendency');
    }

    if (userBehavior.onTimeCompletionRate < 0.7) {
      risks.push('Low historical on-time completion rate');
    }

    const criticalMilestones = milestones.filter(m => m.priority === 'critical');
    if (criticalMilestones.length > 3) {
      risks.push('Multiple critical milestones');
    }

    return risks;
  }

  private generateCompletionRecommendations(
    completionProbability: number,
    riskFactors: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (completionProbability < 0.7) {
      recommendations.push('Consider extending timeline or reducing scope');
      recommendations.push('Implement daily progress tracking');
    }

    if (riskFactors.includes('High procrastination tendency')) {
      recommendations.push('Break large tasks into smaller, manageable chunks');
      recommendations.push('Set up accountability partnerships');
    }

    if (riskFactors.includes('Multiple critical milestones')) {
      recommendations.push('Prioritize the most important milestones');
      recommendations.push('Consider delegating or getting help with some tasks');
    }

    return recommendations;
  }

  private async saveOptimizedTimeline(timeline: OptimizedTimeline): Promise<void> {
    try {
      await prisma.optimizedTimeline.upsert({
        where: { userId: timeline.userId },
        update: {
          totalDuration: timeline.totalDuration,
          criticalPath: timeline.criticalPath,
          bufferTime: timeline.bufferTime,
          riskAssessment: timeline.riskAssessment,
          recommendations: timeline.recommendations,
          lastOptimized: timeline.lastOptimized,
          milestones: {
            deleteMany: {},
            create: timeline.milestones.map(m => ({
              id: m.id,
              title: m.title,
              description: m.description,
              dueDate: m.dueDate,
              estimatedDuration: m.estimatedDuration,
              priority: m.priority,
              dependencies: m.dependencies,
              category: m.category,
              status: m.status,
              completionProbability: m.completionProbability,
              bufferDays: m.bufferDays
            }))
          }
        },
        create: {
          userId: timeline.userId,
          totalDuration: timeline.totalDuration,
          criticalPath: timeline.criticalPath,
          bufferTime: timeline.bufferTime,
          riskAssessment: timeline.riskAssessment,
          recommendations: timeline.recommendations,
          lastOptimized: timeline.lastOptimized,
          milestones: {
            create: timeline.milestones.map(m => ({
              id: m.id,
              title: m.title,
              description: m.description,
              dueDate: m.dueDate,
              estimatedDuration: m.estimatedDuration,
              priority: m.priority,
              dependencies: m.dependencies,
              category: m.category,
              status: m.status,
              completionProbability: m.completionProbability,
              bufferDays: m.bufferDays
            }))
          }
        }
      });

      logger.info('Optimized timeline saved', { userId: timeline.userId });

    } catch (error) {
      logger.error('Error saving optimized timeline:', error);
    }
  }
}