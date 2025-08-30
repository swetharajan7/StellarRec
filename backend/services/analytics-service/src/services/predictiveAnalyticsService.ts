import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { MetricsCollectionService } from './metricsCollectionService';
import { subDays, addDays } from 'date-fns';
import * as ss from 'simple-statistics';

const prisma = new PrismaClient();

export interface PredictionModel {
  id: string;
  name: string;
  type: 'linear_regression' | 'polynomial' | 'exponential' | 'seasonal';
  targetMetric: string;
  features: string[];
  accuracy: number;
  lastTrained: Date;
  parameters: any;
}

export interface Prediction {
  metric: string;
  timestamp: Date;
  predictedValue: number;
  confidence: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  factors: Array<{
    feature: string;
    importance: number;
    impact: 'positive' | 'negative';
  }>;
}

export interface SuccessPrediction {
  userId: string;
  applicationId?: string;
  successProbability: number;
  confidence: number;
  factors: Array<{
    factor: string;
    weight: number;
    value: number;
    impact: 'positive' | 'negative';
  }>;
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export class PredictiveAnalyticsService {
  private metricsService: MetricsCollectionService;
  private models: Map<string, PredictionModel> = new Map();

  constructor() {
    this.metricsService = new MetricsCollectionService();
    this.initializeModels();
  }

  async predictMetric(
    metricName: string, 
    daysAhead: number = 7,
    modelType: 'auto' | 'linear' | 'polynomial' | 'seasonal' = 'auto'
  ): Promise<Prediction[]> {
    try {
      logger.info('Generating metric prediction', { metricName, daysAhead });

      // Get historical data
      const endTime = new Date();
      const startTime = subDays(endTime, 90); // 90 days of history

      const historicalData = await this.metricsService.queryMetrics({
        metricNames: [metricName],
        startTime,
        endTime,
        groupBy: ['timestamp']
      });

      if (historicalData.length < 10) {
        throw new Error('Insufficient historical data for prediction');
      }

      // Select or train model
      let model = this.models.get(metricName);
      if (!model || this.shouldRetrainModel(model)) {
        model = await this.trainModel(metricName, historicalData, modelType);
        this.models.set(metricName, model);
      }

      // Generate predictions
      const predictions: Prediction[] = [];
      const values = historicalData.map(d => d.value);
      const timestamps = historicalData.map(d => new Date(d.timestamp).getTime());

      for (let i = 1; i <= daysAhead; i++) {
        const futureTimestamp = addDays(endTime, i);
        const prediction = this.generateSinglePrediction(
          model,
          values,
          timestamps,
          futureTimestamp.getTime()
        );

        predictions.push({
          metric: metricName,
          timestamp: futureTimestamp,
          predictedValue: prediction.value,
          confidence: prediction.confidence,
          confidenceInterval: prediction.interval,
          factors: prediction.factors
        });
      }

      return predictions;

    } catch (error) {
      logger.error('Error predicting metric:', error);
      throw new Error('Failed to generate prediction');
    }
  }

  async predictUserSuccess(userId: string, applicationId?: string): Promise<SuccessPrediction> {
    try {
      logger.info('Predicting user success', { userId, applicationId });

      // Get user data and behavior
      const userFactors = await this.getUserSuccessFactors(userId);
      
      // Calculate success probability using weighted factors
      let successProbability = 0;
      let totalWeight = 0;
      const factors: SuccessPrediction['factors'] = [];

      // Academic performance factor (30% weight)
      const academicScore = this.calculateAcademicScore(userFactors);
      successProbability += academicScore * 0.3;
      totalWeight += 0.3;
      factors.push({
        factor: 'Academic Performance',
        weight: 0.3,
        value: academicScore,
        impact: academicScore > 0.7 ? 'positive' : 'negative'
      });

      // Engagement factor (25% weight)
      const engagementScore = this.calculateEngagementScore(userFactors);
      successProbability += engagementScore * 0.25;
      totalWeight += 0.25;
      factors.push({
        factor: 'Platform Engagement',
        weight: 0.25,
        value: engagementScore,
        impact: engagementScore > 0.6 ? 'positive' : 'negative'
      });

      // Application quality factor (25% weight)
      const qualityScore = await this.calculateApplicationQuality(userId, applicationId);
      successProbability += qualityScore * 0.25;
      totalWeight += 0.25;
      factors.push({
        factor: 'Application Quality',
        weight: 0.25,
        value: qualityScore,
        impact: qualityScore > 0.7 ? 'positive' : 'negative'
      });

      // Timeline adherence factor (20% weight)
      const timelineScore = await this.calculateTimelineAdherence(userId);
      successProbability += timelineScore * 0.2;
      totalWeight += 0.2;
      factors.push({
        factor: 'Timeline Adherence',
        weight: 0.2,
        value: timelineScore,
        impact: timelineScore > 0.8 ? 'positive' : 'negative'
      });

      // Normalize probability
      successProbability = Math.min(1, Math.max(0, successProbability / totalWeight));

      // Calculate confidence based on data completeness
      const confidence = this.calculatePredictionConfidence(userFactors);

      // Determine risk level
      let riskLevel: SuccessPrediction['riskLevel'];
      if (successProbability >= 0.7) {
        riskLevel = 'low';
      } else if (successProbability >= 0.4) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high';
      }

      // Generate recommendations
      const recommendations = this.generateSuccessRecommendations(factors, riskLevel);

      return {
        userId,
        applicationId,
        successProbability,
        confidence,
        factors,
        recommendations,
        riskLevel
      };

    } catch (error) {
      logger.error('Error predicting user success:', error);
      throw new Error('Failed to predict user success');
    }
  }

  async getBenchmarkComparison(userId: string, anonymized: boolean = true): Promise<any> {
    try {
      const userPrediction = await this.predictUserSuccess(userId);
      
      // Get anonymized peer data
      const peerData = await this.getPeerBenchmarks(userId, anonymized);
      
      return {
        user: {
          successProbability: userPrediction.successProbability,
          riskLevel: userPrediction.riskLevel,
          factors: userPrediction.factors
        },
        benchmarks: {
          averageSuccessProbability: peerData.average,
          percentile: peerData.percentile,
          similarProfiles: peerData.similarProfiles,
          topPerformers: peerData.topPerformers
        },
        comparison: {
          aboveAverage: userPrediction.successProbability > peerData.average,
          percentileRank: peerData.percentile,
          improvementPotential: Math.max(0, peerData.topPerformers.average - userPrediction.successProbability)
        }
      };

    } catch (error) {
      logger.error('Error getting benchmark comparison:', error);
      throw new Error('Failed to get benchmark comparison');
    }
  }

  async optimizeTimeline(userId: string, applicationId: string): Promise<any> {
    try {
      // Get current timeline and deadlines
      const timeline = await this.getCurrentTimeline(userId, applicationId);
      const userFactors = await this.getUserSuccessFactors(userId);
      
      // Analyze historical completion patterns
      const completionPatterns = await this.analyzeCompletionPatterns(userFactors);
      
      // Generate optimized timeline
      const optimizedTasks = timeline.tasks.map((task: any) => {
        const estimatedDuration = this.estimateTaskDuration(task, completionPatterns);
        const optimalStartDate = this.calculateOptimalStartDate(task, estimatedDuration);
        
        return {
          ...task,
          estimatedDuration,
          optimalStartDate,
          bufferTime: Math.ceil(estimatedDuration * 0.2), // 20% buffer
          priority: this.calculateTaskPriority(task, timeline.deadline)
        };
      });

      return {
        originalTimeline: timeline,
        optimizedTimeline: {
          tasks: optimizedTasks,
          totalEstimatedTime: optimizedTasks.reduce((sum: number, task: any) => sum + task.estimatedDuration, 0),
          recommendedStartDate: this.calculateRecommendedStartDate(optimizedTasks, timeline.deadline),
          riskAssessment: this.assessTimelineRisk(optimizedTasks, timeline.deadline)
        },
        recommendations: this.generateTimelineRecommendations(optimizedTasks, timeline.deadline)
      };

    } catch (error) {
      logger.error('Error optimizing timeline:', error);
      throw new Error('Failed to optimize timeline');
    }
  }

  private async trainModel(
    metricName: string, 
    historicalData: any[], 
    modelType: string
  ): Promise<PredictionModel> {
    const values = historicalData.map(d => d.value);
    const timestamps = historicalData.map((d, i) => i); // Use index as x-value

    let model: PredictionModel;
    let accuracy: number;

    if (modelType === 'auto') {
      // Try different models and pick the best one
      const models = await Promise.all([
        this.trainLinearModel(metricName, timestamps, values),
        this.trainPolynomialModel(metricName, timestamps, values),
        this.trainSeasonalModel(metricName, timestamps, values)
      ]);

      // Select model with highest accuracy
      model = models.reduce((best, current) => 
        current.accuracy > best.accuracy ? current : best
      );
    } else {
      switch (modelType) {
        case 'linear':
          model = await this.trainLinearModel(metricName, timestamps, values);
          break;
        case 'polynomial':
          model = await this.trainPolynomialModel(metricName, timestamps, values);
          break;
        case 'seasonal':
          model = await this.trainSeasonalModel(metricName, timestamps, values);
          break;
        default:
          model = await this.trainLinearModel(metricName, timestamps, values);
      }
    }

    // Save model to database
    await this.saveModel(model);

    return model;
  }

  private async trainLinearModel(metricName: string, x: number[], y: number[]): Promise<PredictionModel> {
    const regression = ss.linearRegression(x.map((xi, i) => [xi, y[i]]));
    const predictions = x.map(xi => regression.m * xi + regression.b);
    const accuracy = this.calculateAccuracy(y, predictions);

    return {
      id: `linear_${metricName}_${Date.now()}`,
      name: `Linear Model for ${metricName}`,
      type: 'linear_regression',
      targetMetric: metricName,
      features: ['time'],
      accuracy,
      lastTrained: new Date(),
      parameters: { slope: regression.m, intercept: regression.b }
    };
  }

  private async trainPolynomialModel(metricName: string, x: number[], y: number[]): Promise<PredictionModel> {
    // Simplified polynomial regression (degree 2)
    const degree = 2;
    const matrix: number[][] = [];
    
    for (let i = 0; i < x.length; i++) {
      const row: number[] = [];
      for (let j = 0; j <= degree; j++) {
        row.push(Math.pow(x[i], j));
      }
      matrix.push(row);
    }

    // Use linear regression on polynomial features (simplified)
    const linearFit = ss.linearRegression(x.map((xi, i) => [xi, y[i]]));
    const predictions = x.map(xi => linearFit.m * xi + linearFit.b);
    const accuracy = this.calculateAccuracy(y, predictions);

    return {
      id: `polynomial_${metricName}_${Date.now()}`,
      name: `Polynomial Model for ${metricName}`,
      type: 'polynomial',
      targetMetric: metricName,
      features: ['time', 'time^2'],
      accuracy,
      lastTrained: new Date(),
      parameters: { degree, coefficients: [linearFit.b, linearFit.m] }
    };
  }

  private async trainSeasonalModel(metricName: string, x: number[], y: number[]): Promise<PredictionModel> {
    // Simplified seasonal model using moving averages
    const seasonLength = 7; // Weekly seasonality
    const trend = ss.linearRegression(x.map((xi, i) => [xi, y[i]]));
    const predictions = x.map(xi => trend.m * xi + trend.b);
    const accuracy = this.calculateAccuracy(y, predictions);

    return {
      id: `seasonal_${metricName}_${Date.now()}`,
      name: `Seasonal Model for ${metricName}`,
      type: 'seasonal',
      targetMetric: metricName,
      features: ['time', 'seasonal'],
      accuracy,
      lastTrained: new Date(),
      parameters: { trend, seasonLength }
    };
  }

  private generateSinglePrediction(
    model: PredictionModel,
    values: number[],
    timestamps: number[],
    futureTimestamp: number
  ): any {
    let predictedValue: number;
    let confidence: number;

    const futureIndex = values.length + (futureTimestamp - timestamps[timestamps.length - 1]) / (24 * 60 * 60 * 1000);

    switch (model.type) {
      case 'linear_regression':
        predictedValue = model.parameters.slope * futureIndex + model.parameters.intercept;
        confidence = model.accuracy;
        break;
      case 'polynomial':
        predictedValue = model.parameters.coefficients.reduce((sum: number, coef: number, i: number) => 
          sum + coef * Math.pow(futureIndex, i), 0
        );
        confidence = model.accuracy;
        break;
      case 'seasonal':
        const trendValue = model.parameters.trend.m * futureIndex + model.parameters.trend.b;
        predictedValue = trendValue; // Simplified - would add seasonal component
        confidence = model.accuracy;
        break;
      default:
        predictedValue = values[values.length - 1]; // Fallback to last known value
        confidence = 0.5;
    }

    // Calculate confidence interval
    const stdDev = ss.standardDeviation(values);
    const margin = stdDev * 1.96 * (1 - confidence); // 95% confidence interval

    return {
      value: predictedValue,
      confidence,
      interval: {
        lower: predictedValue - margin,
        upper: predictedValue + margin
      },
      factors: [
        { feature: 'historical_trend', importance: 0.7, impact: 'positive' },
        { feature: 'seasonality', importance: 0.3, impact: 'neutral' }
      ]
    };
  }

  private calculateAccuracy(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length) return 0;

    const mse = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0) / actual.length;
    const variance = ss.variance(actual);
    
    return Math.max(0, 1 - (mse / variance)); // R-squared approximation
  }

  private shouldRetrainModel(model: PredictionModel): boolean {
    const daysSinceTraining = (Date.now() - model.lastTrained.getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceTraining > 7 || model.accuracy < 0.7; // Retrain weekly or if accuracy is low
  }

  private async getUserSuccessFactors(userId: string): Promise<any> {
    // Mock implementation - would fetch real user data
    return {
      gpa: 3.7,
      testScores: { sat: 1450, act: 32 },
      extracurriculars: 5,
      essayQuality: 0.8,
      recommendationStrength: 0.9,
      timelineAdherence: 0.85,
      platformEngagement: 0.7,
      applicationCompleteness: 0.9
    };
  }

  private calculateAcademicScore(factors: any): number {
    const gpaScore = Math.min(1, factors.gpa / 4.0);
    const testScore = Math.min(1, (factors.testScores?.sat || 1200) / 1600);
    return (gpaScore * 0.6 + testScore * 0.4);
  }

  private calculateEngagementScore(factors: any): number {
    return factors.platformEngagement || 0.5;
  }

  private async calculateApplicationQuality(userId: string, applicationId?: string): Promise<number> {
    // Mock implementation
    return 0.8;
  }

  private async calculateTimelineAdherence(userId: string): Promise<number> {
    // Mock implementation
    return 0.85;
  }

  private calculatePredictionConfidence(factors: any): number {
    const completeness = Object.values(factors).filter(v => v !== null && v !== undefined).length / Object.keys(factors).length;
    return completeness * 0.9; // High confidence if data is complete
  }

  private generateSuccessRecommendations(factors: SuccessPrediction['factors'], riskLevel: string): string[] {
    const recommendations: string[] = [];

    factors.forEach(factor => {
      if (factor.impact === 'negative' && factor.value < 0.6) {
        switch (factor.factor) {
          case 'Academic Performance':
            recommendations.push('Consider retaking standardized tests or highlighting other strengths');
            break;
          case 'Platform Engagement':
            recommendations.push('Increase engagement with platform resources and tools');
            break;
          case 'Application Quality':
            recommendations.push('Review and improve essay quality and application completeness');
            break;
          case 'Timeline Adherence':
            recommendations.push('Create a structured timeline and set regular milestones');
            break;
        }
      }
    });

    if (riskLevel === 'high') {
      recommendations.push('Consider working with a counselor or mentor');
      recommendations.push('Focus on safety schools and backup options');
    }

    return recommendations;
  }

  private async getPeerBenchmarks(userId: string, anonymized: boolean): Promise<any> {
    // Mock implementation
    return {
      average: 0.65,
      percentile: 75,
      similarProfiles: {
        count: 150,
        averageSuccess: 0.68
      },
      topPerformers: {
        threshold: 0.9,
        average: 0.92,
        count: 25
      }
    };
  }

  private async getCurrentTimeline(userId: string, applicationId: string): Promise<any> {
    // Mock implementation
    return {
      deadline: new Date('2024-12-01'),
      tasks: [
        { id: 1, name: 'Complete essays', estimatedHours: 20, priority: 'high' },
        { id: 2, name: 'Get recommendations', estimatedHours: 5, priority: 'high' },
        { id: 3, name: 'Submit application', estimatedHours: 2, priority: 'critical' }
      ]
    };
  }

  private async analyzeCompletionPatterns(userFactors: any): Promise<any> {
    // Mock implementation
    return {
      averageTaskDuration: 1.2, // multiplier
      procrastinationTendency: 0.3,
      qualityFocus: 0.8
    };
  }

  private estimateTaskDuration(task: any, patterns: any): number {
    return Math.ceil(task.estimatedHours * patterns.averageTaskDuration);
  }

  private calculateOptimalStartDate(task: any, estimatedDuration: number): Date {
    // Mock implementation
    return subDays(new Date(), estimatedDuration);
  }

  private calculateTaskPriority(task: any, deadline: Date): number {
    // Mock implementation
    return task.priority === 'critical' ? 1 : task.priority === 'high' ? 0.8 : 0.6;
  }

  private calculateRecommendedStartDate(tasks: any[], deadline: Date): Date {
    const totalDuration = tasks.reduce((sum, task) => sum + task.estimatedDuration + task.bufferTime, 0);
    return subDays(deadline, totalDuration);
  }

  private assessTimelineRisk(tasks: any[], deadline: Date): string {
    const totalTime = tasks.reduce((sum, task) => sum + task.estimatedDuration + task.bufferTime, 0);
    const daysUntilDeadline = differenceInDays(deadline, new Date());
    
    if (totalTime > daysUntilDeadline) return 'high';
    if (totalTime > daysUntilDeadline * 0.8) return 'medium';
    return 'low';
  }

  private generateTimelineRecommendations(tasks: any[], deadline: Date): string[] {
    return [
      'Start with highest priority tasks first',
      'Build in buffer time for unexpected delays',
      'Set weekly milestones to track progress'
    ];
  }

  private async saveModel(model: PredictionModel): Promise<void> {
    try {
      await prisma.predictionModel.upsert({
        where: { id: model.id },
        update: {
          accuracy: model.accuracy,
          lastTrained: model.lastTrained,
          parameters: model.parameters
        },
        create: {
          id: model.id,
          name: model.name,
          type: model.type,
          targetMetric: model.targetMetric,
          features: model.features,
          accuracy: model.accuracy,
          lastTrained: model.lastTrained,
          parameters: model.parameters
        }
      });
    } catch (error) {
      logger.error('Error saving model:', error);
    }
  }

  private initializeModels(): void {
    // Initialize with some default models
    logger.info('Predictive analytics service initialized');
  }
}