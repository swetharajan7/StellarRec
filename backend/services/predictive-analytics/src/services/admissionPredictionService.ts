import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import * as tf from '@tensorflow/tfjs-node';
import * as ss from 'simple-statistics';
import axios from 'axios';

const prisma = new PrismaClient();

export interface AdmissionPrediction {
  userId: string;
  universityId: string;
  programId?: string;
  admissionProbability: number;
  confidence: number;
  factors: AdmissionFactor[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
  competitiveAnalysis: {
    percentileRank: number;
    strengthsVsWeaknesses: {
      strengths: string[];
      weaknesses: string[];
    };
    improvementAreas: string[];
  };
  modelVersion: string;
  predictionDate: Date;
}

export interface AdmissionFactor {
  factor: string;
  weight: number;
  userValue: number;
  averageValue: number;
  percentile: number;
  impact: 'positive' | 'negative' | 'neutral';
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface UniversityAdmissionData {
  universityId: string;
  acceptanceRate: number;
  averageGPA: number;
  averageSAT: number;
  averageACT: number;
  competitiveFactors: string[];
  historicalTrends: any[];
}

export class AdmissionPredictionService {
  private model: tf.LayersModel | null = null;
  private readonly USER_SERVICE_URL: string;
  private readonly ANALYTICS_SERVICE_URL: string;
  private readonly modelVersion = 'v2.1.0';

  constructor() {
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006';
    this.initializeModel();
  }

  async predictAdmissionProbability(
    userId: string, 
    universityId: string, 
    programId?: string
  ): Promise<AdmissionPrediction> {
    try {
      logger.info('Predicting admission probability', { userId, universityId, programId });

      // Get user profile and academic data
      const [userProfile, universityData, historicalData] = await Promise.all([
        this.getUserProfile(userId),
        this.getUniversityData(universityId),
        this.getHistoricalAdmissionData(universityId, programId)
      ]);

      // Calculate admission factors
      const factors = await this.calculateAdmissionFactors(
        userProfile, 
        universityData, 
        historicalData
      );

      // Use ML model for prediction
      const admissionProbability = await this.runMLPrediction(factors, universityData);
      
      // Calculate confidence based on data completeness and model accuracy
      const confidence = this.calculatePredictionConfidence(userProfile, factors);

      // Determine risk level
      const riskLevel = this.determineRiskLevel(admissionProbability, confidence);

      // Generate competitive analysis
      const competitiveAnalysis = await this.generateCompetitiveAnalysis(
        userProfile, 
        universityData, 
        factors
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        factors, 
        competitiveAnalysis, 
        riskLevel
      );

      const prediction: AdmissionPrediction = {
        userId,
        universityId,
        programId,
        admissionProbability,
        confidence,
        factors,
        recommendations,
        riskLevel,
        competitiveAnalysis,
        modelVersion: this.modelVersion,
        predictionDate: new Date()
      };

      // Save prediction to database
      await this.savePrediction(prediction);

      return prediction;

    } catch (error) {
      logger.error('Error predicting admission probability:', error);
      throw new Error('Failed to predict admission probability');
    }
  }

  async batchPredictAdmissions(
    userId: string, 
    universities: Array<{ universityId: string; programId?: string }>
  ): Promise<AdmissionPrediction[]> {
    try {
      const predictions = await Promise.all(
        universities.map(({ universityId, programId }) =>
          this.predictAdmissionProbability(userId, universityId, programId)
        )
      );

      // Sort by admission probability (highest first)
      return predictions.sort((a, b) => b.admissionProbability - a.admissionProbability);

    } catch (error) {
      logger.error('Error in batch admission prediction:', error);
      throw new Error('Failed to predict batch admissions');
    }
  }  
async getAdmissionTrends(
    universityId: string, 
    timeframe: 'year' | 'semester' = 'year'
  ): Promise<any> {
    try {
      const trends = await prisma.admissionTrend.findMany({
        where: { 
          universityId,
          timeframe 
        },
        orderBy: { period: 'desc' },
        take: 10
      });

      return {
        universityId,
        timeframe,
        trends: trends.map(trend => ({
          period: trend.period,
          acceptanceRate: trend.acceptanceRate,
          averageGPA: trend.averageGPA,
          averageTestScore: trend.averageTestScore,
          applicantCount: trend.applicantCount,
          competitiveIndex: trend.competitiveIndex
        }))
      };

    } catch (error) {
      logger.error('Error getting admission trends:', error);
      return { universityId, timeframe, trends: [] };
    }
  }

  async updateAdmissionModel(trainingData: any[]): Promise<boolean> {
    try {
      logger.info('Updating admission prediction model');

      if (trainingData.length < 100) {
        throw new Error('Insufficient training data');
      }

      // Prepare training data
      const { features, labels } = this.prepareTrainingData(trainingData);

      // Create and train new model
      const newModel = await this.trainAdmissionModel(features, labels);

      // Validate model performance
      const performance = await this.validateModel(newModel, features, labels);

      if (performance.accuracy > 0.75) {
        // Save the new model
        await this.saveModel(newModel);
        this.model = newModel;
        
        logger.info('Admission model updated successfully', { 
          accuracy: performance.accuracy,
          version: this.modelVersion 
        });
        
        return true;
      } else {
        logger.warn('New model performance insufficient', { accuracy: performance.accuracy });
        return false;
      }

    } catch (error) {
      logger.error('Error updating admission model:', error);
      return false;
    }
  }

  private async initializeModel(): Promise<void> {
    try {
      // Try to load existing model
      const modelPath = process.env.MODEL_PATH || './models/admission_model';
      
      try {
        this.model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
        logger.info('Admission prediction model loaded successfully');
      } catch (loadError) {
        logger.warn('Could not load existing model, creating new one');
        await this.createDefaultModel();
      }

    } catch (error) {
      logger.error('Error initializing admission model:', error);
      await this.createDefaultModel();
    }
  }

  private async createDefaultModel(): Promise<void> {
    // Create a simple neural network for admission prediction
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [15], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    logger.info('Default admission prediction model created');
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

  private async getUniversityData(universityId: string): Promise<UniversityAdmissionData> {
    try {
      // This would typically come from a university database
      const mockData: UniversityAdmissionData = {
        universityId,
        acceptanceRate: 0.15,
        averageGPA: 3.8,
        averageSAT: 1450,
        averageACT: 32,
        competitiveFactors: ['GPA', 'SAT', 'Extracurriculars', 'Essays', 'Recommendations'],
        historicalTrends: []
      };
      return mockData;
    } catch (error) {
      logger.error('Error getting university data:', error);
      throw error;
    }
  }

  private async getHistoricalAdmissionData(universityId: string, programId?: string): Promise<any[]> {
    try {
      const whereClause: any = { universityId };
      if (programId) whereClause.programId = programId;

      const historicalData = await prisma.admissionHistory.findMany({
        where: whereClause,
        orderBy: { admissionYear: 'desc' },
        take: 1000
      });

      return historicalData;
    } catch (error) {
      logger.error('Error getting historical admission data:', error);
      return [];
    }
  }

  private async calculateAdmissionFactors(
    userProfile: any,
    universityData: UniversityAdmissionData,
    historicalData: any[]
  ): Promise<AdmissionFactor[]> {
    const factors: AdmissionFactor[] = [];

    // GPA Factor
    if (userProfile.gpa) {
      factors.push({
        factor: 'GPA',
        weight: 0.35,
        userValue: userProfile.gpa,
        averageValue: universityData.averageGPA,
        percentile: this.calculatePercentile(userProfile.gpa, historicalData.map(d => d.gpa)),
        impact: userProfile.gpa >= universityData.averageGPA ? 'positive' : 'negative',
        importance: 'critical'
      });
    }

    // SAT Score Factor
    if (userProfile.satScore) {
      factors.push({
        factor: 'SAT Score',
        weight: 0.25,
        userValue: userProfile.satScore,
        averageValue: universityData.averageSAT,
        percentile: this.calculatePercentile(userProfile.satScore, historicalData.map(d => d.satScore)),
        impact: userProfile.satScore >= universityData.averageSAT ? 'positive' : 'negative',
        importance: 'critical'
      });
    }

    // Extracurricular Activities
    if (userProfile.extracurriculars) {
      const extracurricularScore = this.calculateExtracurricularScore(userProfile.extracurriculars);
      factors.push({
        factor: 'Extracurricular Activities',
        weight: 0.15,
        userValue: extracurricularScore,
        averageValue: 0.6,
        percentile: this.calculatePercentile(extracurricularScore, [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]),
        impact: extracurricularScore > 0.6 ? 'positive' : 'negative',
        importance: 'high'
      });
    }

    // Essay Quality
    if (userProfile.essayScore) {
      factors.push({
        factor: 'Essay Quality',
        weight: 0.15,
        userValue: userProfile.essayScore,
        averageValue: 0.7,
        percentile: this.calculatePercentile(userProfile.essayScore, [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]),
        impact: userProfile.essayScore > 0.7 ? 'positive' : 'negative',
        importance: 'high'
      });
    }

    // Recommendation Letters
    if (userProfile.recommendationScore) {
      factors.push({
        factor: 'Recommendation Letters',
        weight: 0.1,
        userValue: userProfile.recommendationScore,
        averageValue: 0.75,
        percentile: this.calculatePercentile(userProfile.recommendationScore, [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]),
        impact: userProfile.recommendationScore > 0.75 ? 'positive' : 'negative',
        importance: 'medium'
      });
    }

    return factors;
  }

  private async runMLPrediction(
    factors: AdmissionFactor[],
    universityData: UniversityAdmissionData
  ): Promise<number> {
    if (!this.model) {
      throw new Error('Admission prediction model not initialized');
    }

    try {
      // Prepare input features
      const features = this.prepareFeatures(factors, universityData);
      const inputTensor = tf.tensor2d([features]);

      // Run prediction
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const probability = await prediction.data();

      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();

      return probability[0];

    } catch (error) {
      logger.error('Error running ML prediction:', error);
      // Fallback to statistical method
      return this.calculateStatisticalProbability(factors, universityData);
    }
  }

  private prepareFeatures(factors: AdmissionFactor[], universityData: UniversityAdmissionData): number[] {
    const features = new Array(15).fill(0);

    factors.forEach((factor, index) => {
      if (index < 10) {
        features[index] = factor.userValue;
        features[index + 5] = factor.percentile;
      }
    });

    // Add university-specific features
    features[10] = universityData.acceptanceRate;
    features[11] = universityData.averageGPA;
    features[12] = universityData.averageSAT / 1600; // Normalize
    features[13] = universityData.averageACT / 36; // Normalize
    features[14] = universityData.competitiveFactors.length / 10; // Normalize

    return features;
  }

  private calculateStatisticalProbability(
    factors: AdmissionFactor[],
    universityData: UniversityAdmissionData
  ): number {
    // Weighted average of factor impacts
    let weightedScore = 0;
    let totalWeight = 0;

    factors.forEach(factor => {
      const normalizedScore = factor.percentile;
      weightedScore += normalizedScore * factor.weight;
      totalWeight += factor.weight;
    });

    const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0.5;
    
    // Adjust for university selectivity
    const selectivityAdjustment = 1 - universityData.acceptanceRate;
    const adjustedScore = baseScore * (1 - selectivityAdjustment * 0.3);

    return Math.max(0.01, Math.min(0.99, adjustedScore));
  }

  private calculatePercentile(value: number, dataset: number[]): number {
    const validData = dataset.filter(v => v != null && !isNaN(v));
    if (validData.length === 0) return 0.5;

    const sorted = validData.sort((a, b) => a - b);
    const rank = sorted.filter(v => v <= value).length;
    return rank / sorted.length;
  }

  private calculateExtracurricularScore(extracurriculars: any[]): number {
    if (!extracurriculars || extracurriculars.length === 0) return 0;

    let score = 0;
    extracurriculars.forEach(activity => {
      // Leadership positions get higher scores
      if (activity.leadership) score += 0.3;
      // Duration matters
      if (activity.duration > 2) score += 0.2;
      // Awards and recognition
      if (activity.awards) score += 0.2;
      // Community service
      if (activity.type === 'community_service') score += 0.15;
      // Base participation
      score += 0.1;
    });

    return Math.min(1.0, score);
  }

  private calculatePredictionConfidence(userProfile: any, factors: AdmissionFactor[]): number {
    let confidence = 0.5; // Base confidence

    // Data completeness factor
    const completenessScore = factors.length / 5; // Expecting 5 main factors
    confidence += completenessScore * 0.3;

    // Data quality factor
    const qualityScore = factors.reduce((sum, factor) => {
      return sum + (factor.userValue > 0 ? 1 : 0);
    }, 0) / factors.length;
    confidence += qualityScore * 0.2;

    return Math.min(0.95, Math.max(0.3, confidence));
  }

  private determineRiskLevel(probability: number, confidence: number): 'low' | 'medium' | 'high' {
    if (probability >= 0.7 && confidence >= 0.8) return 'low';
    if (probability >= 0.4 && confidence >= 0.6) return 'medium';
    return 'high';
  }

  private async generateCompetitiveAnalysis(
    userProfile: any,
    universityData: UniversityAdmissionData,
    factors: AdmissionFactor[]
  ): Promise<AdmissionPrediction['competitiveAnalysis']> {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const improvementAreas: string[] = [];

    factors.forEach(factor => {
      if (factor.percentile >= 0.75) {
        strengths.push(`Strong ${factor.factor} (${Math.round(factor.percentile * 100)}th percentile)`);
      } else if (factor.percentile <= 0.25) {
        weaknesses.push(`Below average ${factor.factor} (${Math.round(factor.percentile * 100)}th percentile)`);
        improvementAreas.push(`Improve ${factor.factor}`);
      }
    });

    // Calculate overall percentile rank
    const overallScore = factors.reduce((sum, factor) => sum + factor.percentile * factor.weight, 0);
    const percentileRank = Math.round(overallScore * 100);

    return {
      percentileRank,
      strengthsVsWeaknesses: { strengths, weaknesses },
      improvementAreas
    };
  }

  private generateRecommendations(
    factors: AdmissionFactor[],
    competitiveAnalysis: AdmissionPrediction['competitiveAnalysis'],
    riskLevel: string
  ): string[] {
    const recommendations: string[] = [];

    // Risk-based recommendations
    if (riskLevel === 'high') {
      recommendations.push('Consider applying to additional safety schools');
      recommendations.push('Focus on improving your strongest factors to stand out');
    } else if (riskLevel === 'medium') {
      recommendations.push('Continue strengthening your application profile');
      recommendations.push('Consider early decision if this is your top choice');
    }

    // Factor-specific recommendations
    factors.forEach(factor => {
      if (factor.impact === 'negative' && factor.importance === 'critical') {
        if (factor.factor === 'GPA') {
          recommendations.push('Focus on maintaining high grades in remaining coursework');
        } else if (factor.factor === 'SAT Score') {
          recommendations.push('Consider retaking the SAT to improve your score');
        }
      }
    });

    // Improvement area recommendations
    competitiveAnalysis.improvementAreas.forEach(area => {
      if (area.includes('Extracurricular')) {
        recommendations.push('Seek leadership opportunities in your current activities');
      } else if (area.includes('Essay')) {
        recommendations.push('Work with a counselor to strengthen your personal statement');
      }
    });

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  private prepareTrainingData(trainingData: any[]): { features: number[][], labels: number[] } {
    const features: number[][] = [];
    const labels: number[] = [];

    trainingData.forEach(data => {
      const feature = this.prepareFeatures(data.factors, data.universityData);
      features.push(feature);
      labels.push(data.admitted ? 1 : 0);
    });

    return { features, labels };
  }

  private async trainAdmissionModel(features: number[][], labels: number[]): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [15], units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    await model.fit(xs, ys, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();

    return model;
  }

  private async validateModel(model: tf.LayersModel, features: number[][], labels: number[]): Promise<{ accuracy: number }> {
    const xs = tf.tensor2d(features);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    const evaluation = model.evaluate(xs, ys) as tf.Scalar[];
    const accuracy = await evaluation[1].data();

    xs.dispose();
    ys.dispose();
    evaluation.forEach(tensor => tensor.dispose());

    return { accuracy: accuracy[0] };
  }

  private async saveModel(model: tf.LayersModel): Promise<void> {
    const modelPath = process.env.MODEL_PATH || './models/admission_model';
    await model.save(`file://${modelPath}`);
  }

  private async savePrediction(prediction: AdmissionPrediction): Promise<void> {
    try {
      await prisma.admissionPrediction.create({
        data: {
          userId: prediction.userId,
          universityId: prediction.universityId,
          programId: prediction.programId,
          admissionProbability: prediction.admissionProbability,
          confidence: prediction.confidence,
          factors: prediction.factors,
          recommendations: prediction.recommendations,
          riskLevel: prediction.riskLevel,
          competitiveAnalysis: prediction.competitiveAnalysis,
          modelVersion: prediction.modelVersion,
          predictionDate: prediction.predictionDate
        }
      });
    } catch (error) {
      logger.error('Error saving admission prediction:', error);
    }
  }
}