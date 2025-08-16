import { Logger } from '../logger';
import { DatabaseService } from '../database';
import { StudentProfile, University, SuccessPrediction, RealTimeInsights } from './AIIntelligenceService';

export interface AdmissionPredictionModel {
  modelId: string;
  version: string;
  accuracy: number;
  lastTrained: Date;
  features: string[];
  weights: Record<string, number>;
}

export interface MarketTrend {
  trend: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  timeframe: string;
  affectedUniversities: string[];
}

export interface PredictionFactors {
  academic: AcademicFactors;
  demographic: DemographicFactors;
  extracurricular: ExtracurricularFactors;
  timing: TimingFactors;
  competition: CompetitionFactors;
}

export interface AcademicFactors {
  gpaWeight: number;
  testScoreWeight: number;
  courseRigorWeight: number;
  classRankWeight: number;
  majorPreparationWeight: number;
}

export interface DemographicFactors {
  geographicDiversityBonus: number;
  firstGenerationBonus: number;
  underrepresentedMinorityBonus: number;
  internationalStudentImpact: number;
  socioeconomicFactorWeight: number;
}

export interface ExtracurricularFactors {
  leadershipWeight: number;
  communityServiceWeight: number;
  athleticWeight: number;
  artisticWeight: number;
  researchWeight: number;
}

export interface TimingFactors {
  earlyDecisionBonus: number;
  applicationTimingImpact: number;
  deadlineProximityPenalty: number;
  seasonalTrends: Record<string, number>;
}

export interface CompetitionFactors {
  applicantPoolSize: number;
  averageApplicantQuality: number;
  acceptanceRateTrend: number;
  yieldRateImpact: number;
}

export class PredictiveAnalyticsEngine {
  private logger = new Logger('PredictiveAnalyticsEngine');
  private db: DatabaseService;
  private models: Map<string, AdmissionPredictionModel> = new Map();

  constructor() {
    this.db = new DatabaseService();
    this.initializeModels();
  }

  /**
   * Predict admission success probability for a student at a specific university
   */
  async predictAdmissionSuccess(
    studentProfile: StudentProfile,
    university: University
  ): Promise<SuccessPrediction> {
    try {
      this.logger.info(`Predicting admission success for ${university.name}`);

      // Get university-specific model or use general model
      const model = this.getModelForUniversity(university);
      
      // Extract and normalize features
      const features = await this.extractPredictionFeatures(studentProfile, university);
      
      // Calculate base probability using model
      const baseProbability = this.calculateBaseProbability(features, model);
      
      // Apply contextual adjustments
      const adjustedProbability = await this.applyContextualAdjustments(
        baseProbability,
        studentProfile,
        university
      );

      // Calculate confidence interval
      const confidenceInterval = this.calculateConfidenceInterval(
        adjustedProbability,
        features,
        model
      );

      // Identify key factors
      const keyFactors = this.identifyKeyFactors(features, model, university);
      
      // Generate improvement suggestions
      const improvements = await this.generateImprovementSuggestions(
        studentProfile,
        university,
        features
      );

      // Estimate timeline
      const timeline = this.estimateDecisionTimeline(university);

      return {
        admissionProbability: Math.round(adjustedProbability * 100) / 100,
        confidenceInterval: [
          Math.round(confidenceInterval[0] * 100) / 100,
          Math.round(confidenceInterval[1] * 100) / 100
        ],
        keyFactors,
        improvements,
        timeline
      };

    } catch (error) {
      this.logger.error(`Failed to predict admission success for ${university.name}:`, error);
      throw error;
    }
  }

  /**
   * Generate real-time insights and recommendations
   */
  async generateRealTimeInsights(studentProfile: StudentProfile): Promise<RealTimeInsights> {
    try {
      this.logger.info(`Generating real-time insights for student ${studentProfile.id}`);

      // Analyze current opportunities
      const opportunities = await this.identifyOpportunities(studentProfile);
      
      // Assess current risks
      const risks = await this.assessRisks(studentProfile);
      
      // Generate personalized recommendations
      const recommendations = await this.generatePersonalizedRecommendations(studentProfile);
      
      // Analyze market trends
      const marketTrends = await this.analyzeMarketTrends(studentProfile);
      
      // Generate personalized tips
      const personalizedTips = await this.generatePersonalizedTips(studentProfile);

      return {
        opportunities,
        risks,
        recommendations,
        marketTrends,
        personalizedTips
      };

    } catch (error) {
      this.logger.error('Failed to generate real-time insights:', error);
      throw error;
    }
  }

  /**
   * Predict optimal application timing
   */
  async predictOptimalTiming(
    studentProfile: StudentProfile,
    universities: University[]
  ): Promise<TimingRecommendation[]> {
    try {
      const recommendations: TimingRecommendation[] = [];

      for (const university of universities) {
        const timing = await this.calculateOptimalTiming(studentProfile, university);
        recommendations.push(timing);
      }

      return recommendations.sort((a, b) => b.successProbability - a.successProbability);

    } catch (error) {
      this.logger.error('Failed to predict optimal timing:', error);
      throw error;
    }
  }

  /**
   * Analyze scholarship probability
   */
  async analyzeScholarshipProbability(
    studentProfile: StudentProfile,
    university: University
  ): Promise<ScholarshipAnalysis> {
    try {
      // Get available scholarships
      const scholarships = await this.getAvailableScholarships(university, studentProfile);
      
      // Calculate probabilities for each scholarship
      const scholarshipProbabilities: ScholarshipProbability[] = [];
      
      for (const scholarship of scholarships) {
        const probability = await this.calculateScholarshipProbability(
          studentProfile,
          scholarship
        );
        scholarshipProbabilities.push(probability);
      }

      // Calculate expected financial aid
      const expectedAid = this.calculateExpectedFinancialAid(scholarshipProbabilities);
      
      // Generate recommendations
      const recommendations = this.generateScholarshipRecommendations(
        scholarshipProbabilities,
        studentProfile
      );

      return {
        totalExpectedAid: expectedAid,
        scholarshipProbabilities,
        recommendations,
        applicationDeadlines: scholarships.map(s => ({
          name: s.name,
          deadline: s.deadline,
          priority: s.priority
        }))
      };

    } catch (error) {
      this.logger.error('Failed to analyze scholarship probability:', error);
      throw error;
    }
  }

  /**
   * Predict application portfolio success
   */
  async predictPortfolioSuccess(
    studentProfile: StudentProfile,
    universities: University[]
  ): Promise<PortfolioAnalysis> {
    try {
      // Calculate individual probabilities
      const individualPredictions = await Promise.all(
        universities.map(uni => this.predictAdmissionSuccess(studentProfile, uni))
      );

      // Calculate portfolio-level metrics
      const portfolioMetrics = this.calculatePortfolioMetrics(
        universities,
        individualPredictions
      );

      // Analyze portfolio balance
      const balanceAnalysis = this.analyzePortfolioBalance(
        universities,
        individualPredictions
      );

      // Generate optimization suggestions
      const optimizations = this.generatePortfolioOptimizations(
        studentProfile,
        universities,
        individualPredictions
      );

      return {
        overallSuccessProbability: portfolioMetrics.overallSuccess,
        expectedAcceptances: portfolioMetrics.expectedAcceptances,
        portfolioRisk: portfolioMetrics.risk,
        balanceAnalysis,
        optimizations,
        individualPredictions: individualPredictions.map((pred, index) => ({
          university: universities[index],
          prediction: pred
        }))
      };

    } catch (error) {
      this.logger.error('Failed to predict portfolio success:', error);
      throw error;
    }
  }

  // Private helper methods

  private async initializeModels(): Promise<void> {
    try {
      // Load pre-trained models from database or initialize default models
      const defaultModel: AdmissionPredictionModel = {
        modelId: 'general_admission_v1',
        version: '1.0.0',
        accuracy: 0.82,
        lastTrained: new Date(),
        features: [
          'gpa_normalized',
          'test_score_percentile',
          'course_rigor_score',
          'extracurricular_score',
          'leadership_score',
          'geographic_diversity',
          'demographic_factors',
          'application_timing'
        ],
        weights: {
          'gpa_normalized': 0.25,
          'test_score_percentile': 0.20,
          'course_rigor_score': 0.15,
          'extracurricular_score': 0.12,
          'leadership_score': 0.10,
          'geographic_diversity': 0.08,
          'demographic_factors': 0.06,
          'application_timing': 0.04
        }
      };

      this.models.set('general', defaultModel);
      this.logger.info('Initialized prediction models');

    } catch (error) {
      this.logger.error('Failed to initialize models:', error);
    }
  }

  private getModelForUniversity(university: University): AdmissionPredictionModel {
    // Try to get university-specific model, fall back to general model
    const universityModel = this.models.get(university.id);
    return universityModel || this.models.get('general')!;
  }

  private async extractPredictionFeatures(
    studentProfile: StudentProfile,
    university: University
  ): Promise<Record<string, number>> {
    const features: Record<string, number> = {};

    // Academic features
    features.gpa_normalized = this.normalizeGPA(
      studentProfile.academic.gpa,
      studentProfile.academic.gpaScale
    );

    features.test_score_percentile = this.calculateTestScorePercentile(
      studentProfile.academic.testScores,
      university
    );

    features.course_rigor_score = this.calculateCourseRigorScore(
      studentProfile.academic.courseRigor
    );

    // Extracurricular features
    features.extracurricular_score = this.calculateExtracurricularScore(
      studentProfile.background.extracurriculars
    );

    features.leadership_score = this.calculateLeadershipScore(
      studentProfile.background.extracurriculars,
      studentProfile.background.workExperience
    );

    // Demographic features
    features.geographic_diversity = this.calculateGeographicDiversity(
      studentProfile,
      university
    );

    features.demographic_factors = this.calculateDemographicFactors(
      studentProfile.background.demographics
    );

    // Timing features
    features.application_timing = this.calculateTimingScore(
      studentProfile.timeline,
      university
    );

    return features;
  }

  private calculateBaseProbability(
    features: Record<string, number>,
    model: AdmissionPredictionModel
  ): number {
    let probability = 0;

    for (const [feature, value] of Object.entries(features)) {
      const weight = model.weights[feature] || 0;
      probability += value * weight;
    }

    // Apply sigmoid function to normalize to 0-1 range
    return 1 / (1 + Math.exp(-probability));
  }

  private async applyContextualAdjustments(
    baseProbability: number,
    studentProfile: StudentProfile,
    university: University
  ): Promise<number> {
    let adjustedProbability = baseProbability;

    // Apply university-specific adjustments
    const universityFactors = await this.getUniversitySpecificFactors(university);
    adjustedProbability *= universityFactors.competitiveness;

    // Apply temporal adjustments (application cycle trends)
    const temporalFactors = await this.getTemporalFactors(university);
    adjustedProbability *= temporalFactors.cycleTrend;

    // Apply market condition adjustments
    const marketFactors = await this.getMarketFactors(university);
    adjustedProbability *= marketFactors.demandTrend;

    // Ensure probability stays within valid range
    return Math.max(0.01, Math.min(0.99, adjustedProbability));
  }

  private calculateConfidenceInterval(
    probability: number,
    features: Record<string, number>,
    model: AdmissionPredictionModel
  ): [number, number] {
    // Calculate confidence based on model accuracy and feature completeness
    const featureCompleteness = Object.keys(features).length / model.features.length;
    const baseConfidence = model.accuracy * featureCompleteness;
    
    // Calculate margin of error
    const marginOfError = (1 - baseConfidence) * 0.5;
    
    const lowerBound = Math.max(0, probability - marginOfError);
    const upperBound = Math.min(1, probability + marginOfError);
    
    return [lowerBound, upperBound];
  }

  private identifyKeyFactors(
    features: Record<string, number>,
    model: AdmissionPredictionModel,
    university: University
  ): string[] {
    // Calculate feature importance scores
    const featureImportance: Array<{ feature: string; importance: number }> = [];
    
    for (const [feature, value] of Object.entries(features)) {
      const weight = model.weights[feature] || 0;
      const importance = Math.abs(value * weight);
      featureImportance.push({ feature, importance });
    }

    // Sort by importance and return top factors
    const topFactors = featureImportance
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5)
      .map(f => this.translateFeatureToDescription(f.feature));

    return topFactors;
  }

  private async generateImprovementSuggestions(
    studentProfile: StudentProfile,
    university: University,
    features: Record<string, number>
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Academic improvements
    if (features.gpa_normalized < 0.8) {
      suggestions.push('Focus on improving GPA through strong performance in remaining courses');
    }

    if (features.test_score_percentile < 0.7) {
      suggestions.push('Consider retaking standardized tests to improve scores');
    }

    if (features.course_rigor_score < 0.6) {
      suggestions.push('Enroll in more challenging courses (AP, IB, or Honors)');
    }

    // Extracurricular improvements
    if (features.extracurricular_score < 0.5) {
      suggestions.push('Increase involvement in meaningful extracurricular activities');
    }

    if (features.leadership_score < 0.4) {
      suggestions.push('Seek leadership opportunities in clubs, sports, or community organizations');
    }

    // University-specific suggestions
    const universityPreferences = await this.getUniversityPreferences(university);
    if (universityPreferences.valuesResearch && !this.hasResearchExperience(studentProfile)) {
      suggestions.push('Gain research experience through internships or academic projects');
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  private estimateDecisionTimeline(university: University): Date {
    // Estimate when admission decision will be available
    const now = new Date();
    const currentMonth = now.getMonth();
    
    // Most universities release decisions between March-May
    let decisionMonth = 3; // April
    let decisionYear = now.getFullYear();
    
    // If we're past decision season, assume next year
    if (currentMonth > 5) {
      decisionYear += 1;
    }
    
    // Add some university-specific variation
    const universityDelay = this.getUniversityDecisionDelay(university);
    decisionMonth += universityDelay;
    
    return new Date(decisionYear, decisionMonth, 15); // Mid-month estimate
  }

  private async identifyOpportunities(studentProfile: StudentProfile): Promise<string[]> {
    const opportunities: string[] = [];

    // Academic opportunities
    if (studentProfile.academic.gpa >= 3.8) {
      opportunities.push('Strong GPA qualifies you for merit-based scholarships');
    }

    // Research opportunities
    if (studentProfile.goals.researchInterests.length > 0) {
      opportunities.push('Research interests align with opportunities at top research universities');
    }

    // Geographic opportunities
    if (studentProfile.preferences.location.preferredCountries.includes('international')) {
      opportunities.push('International study options available with strong profile');
    }

    // Demographic opportunities
    if (studentProfile.background.demographics.firstGeneration) {
      opportunities.push('First-generation college student programs and scholarships available');
    }

    return opportunities;
  }

  private async assessRisks(studentProfile: StudentProfile): Promise<string[]> {
    const risks: string[] = [];

    // Academic risks
    if (studentProfile.academic.gpa < 3.0) {
      risks.push('Low GPA may limit university options - consider community college pathway');
    }

    // Timeline risks
    const timeToDeadline = this.calculateTimeToDeadline(studentProfile.timeline);
    if (timeToDeadline < 30) {
      risks.push('Approaching application deadlines - prioritize most important applications');
    }

    // Financial risks
    if (studentProfile.background.socioeconomic.financialAidNeeded && 
        !studentProfile.background.socioeconomic.scholarshipInterest) {
      risks.push('Financial aid needed but not actively pursuing scholarships');
    }

    // Competition risks
    const competitionLevel = await this.assessCompetitionLevel(studentProfile);
    if (competitionLevel > 0.8) {
      risks.push('High competition in target universities - consider adding safety schools');
    }

    return risks;
  }

  private async generatePersonalizedRecommendations(
    studentProfile: StudentProfile
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Academic recommendations
    if (studentProfile.academic.testScores.sat && 
        studentProfile.academic.testScores.sat.total < 1400) {
      recommendations.push('Consider test-optional universities or SAT prep courses');
    }

    // Extracurricular recommendations
    const leadershipScore = this.calculateLeadershipScore(
      studentProfile.background.extracurriculars,
      studentProfile.background.workExperience
    );
    
    if (leadershipScore < 0.5) {
      recommendations.push('Seek leadership roles to strengthen your application profile');
    }

    // Major-specific recommendations
    if (studentProfile.goals.intendedMajor === 'Computer Science') {
      recommendations.push('Build a portfolio of coding projects and consider CS competitions');
    }

    return recommendations;
  }

  private async analyzeMarketTrends(studentProfile: StudentProfile): Promise<string[]> {
    const trends: string[] = [];

    // General market trends
    trends.push('International applications increasing - apply early for better chances');
    trends.push('STEM programs seeing high demand - consider alternative pathways');
    trends.push('Test-optional policies expanding - focus on holistic application strength');

    // Major-specific trends
    if (studentProfile.goals.intendedMajor === 'Business') {
      trends.push('Business programs emphasizing sustainability and social impact');
    }

    return trends;
  }

  private async generatePersonalizedTips(studentProfile: StudentProfile): Promise<string[]> {
    const tips: string[] = [];

    // Application tips
    tips.push('Start essays early and get multiple reviews from teachers and counselors');
    tips.push('Request recommendation letters at least 6 weeks before deadlines');
    
    // Profile-specific tips
    if (studentProfile.background.demographics.internationalStudent) {
      tips.push('Highlight cultural perspective and adaptability in your essays');
    }

    if (studentProfile.background.extracurriculars.some(e => e.type === 'community_service')) {
      tips.push('Quantify your community service impact with specific numbers and outcomes');
    }

    return tips;
  }

  // Additional helper methods for calculations

  private normalizeGPA(gpa: number, scale: number): number {
    return gpa / scale;
  }

  private calculateTestScorePercentile(
    testScores: any,
    university: University
  ): number {
    // Simplified percentile calculation
    if (testScores.sat) {
      return Math.min(testScores.sat.total / 1600, 1.0);
    }
    if (testScores.act) {
      return Math.min(testScores.act.composite / 36, 1.0);
    }
    return 0.5; // Default if no test scores
  }

  private calculateCourseRigorScore(courseRigor: any): number {
    const apWeight = 0.4;
    const ibWeight = 0.4;
    const honorsWeight = 0.2;
    
    const normalizedAP = Math.min(courseRigor.apCourses / 8, 1.0);
    const normalizedIB = Math.min(courseRigor.ibCourses / 6, 1.0);
    const normalizedHonors = Math.min(courseRigor.honorsCourses / 10, 1.0);
    
    return (normalizedAP * apWeight) + (normalizedIB * ibWeight) + (normalizedHonors * honorsWeight);
  }

  private calculateExtracurricularScore(extracurriculars: any[]): number {
    if (!extracurriculars.length) return 0;
    
    let score = 0;
    for (const activity of extracurriculars) {
      const yearWeight = Math.min(activity.yearsParticipated / 4, 1.0);
      const hourWeight = Math.min(activity.hoursPerWeek / 20, 1.0);
      const leadershipBonus = activity.leadership ? 0.2 : 0;
      
      score += (yearWeight * 0.4 + hourWeight * 0.4 + leadershipBonus) / extracurriculars.length;
    }
    
    return Math.min(score, 1.0);
  }

  private calculateLeadershipScore(extracurriculars: any[], workExperience: any[]): number {
    let leadershipCount = 0;
    let totalActivities = extracurriculars.length + workExperience.length;
    
    // Count leadership roles in extracurriculars
    leadershipCount += extracurriculars.filter(e => e.leadership).length;
    
    // Count leadership roles in work experience
    leadershipCount += workExperience.filter(w => 
      w.position.toLowerCase().includes('lead') || 
      w.position.toLowerCase().includes('manager') ||
      w.position.toLowerCase().includes('supervisor')
    ).length;
    
    return totalActivities > 0 ? leadershipCount / totalActivities : 0;
  }

  private calculateGeographicDiversity(studentProfile: StudentProfile, university: University): number {
    // Calculate geographic diversity bonus
    if (studentProfile.background.demographics.internationalStudent && university.country === 'US') {
      return 0.8; // International students add diversity
    }
    
    // Add state/regional diversity calculations here
    return 0.5; // Default neutral score
  }

  private calculateDemographicFactors(demographics: any): number {
    let score = 0.5; // Base score
    
    if (demographics.firstGeneration) score += 0.2;
    if (demographics.ethnicity.some((e: string) => ['Hispanic', 'African American', 'Native American'].includes(e))) {
      score += 0.15;
    }
    
    return Math.min(score, 1.0);
  }

  private calculateTimingScore(timeline: any, university: University): number {
    // Early applications typically have better chances
    if (timeline.earlyDecisionInterest) return 0.8;
    return 0.5; // Regular decision
  }

  private translateFeatureToDescription(feature: string): string {
    const translations: Record<string, string> = {
      'gpa_normalized': 'Strong academic performance (GPA)',
      'test_score_percentile': 'Competitive standardized test scores',
      'course_rigor_score': 'Challenging course selection',
      'extracurricular_score': 'Well-rounded extracurricular involvement',
      'leadership_score': 'Demonstrated leadership experience',
      'geographic_diversity': 'Geographic background adds diversity',
      'demographic_factors': 'Demographic background considerations',
      'application_timing': 'Strategic application timing'
    };
    
    return translations[feature] || feature;
  }

  private async getUniversitySpecificFactors(university: University): Promise<any> {
    return { competitiveness: 1.0 }; // Placeholder
  }

  private async getTemporalFactors(university: University): Promise<any> {
    return { cycleTrend: 1.0 }; // Placeholder
  }

  private async getMarketFactors(university: University): Promise<any> {
    return { demandTrend: 1.0 }; // Placeholder
  }

  private async getUniversityPreferences(university: University): Promise<any> {
    return { valuesResearch: true }; // Placeholder
  }

  private hasResearchExperience(studentProfile: StudentProfile): boolean {
    return studentProfile.background.extracurriculars.some(e => 
      e.name.toLowerCase().includes('research') || e.type === 'academic'
    );
  }

  private getUniversityDecisionDelay(university: University): number {
    return 0; // Placeholder - could vary by university type
  }

  private calculateTimeToDeadline(timeline: any): number {
    const now = new Date();
    const deadline = new Date(timeline.targetApplicationDate);
    return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async assessCompetitionLevel(studentProfile: StudentProfile): Promise<number> {
    return 0.6; // Placeholder - would analyze market competition
  }
}

// Additional interfaces for completeness
export interface TimingRecommendation {
  university: University;
  optimalSubmissionDate: Date;
  successProbability: number;
  reasoning: string;
}

export interface ScholarshipAnalysis {
  totalExpectedAid: number;
  scholarshipProbabilities: ScholarshipProbability[];
  recommendations: string[];
  applicationDeadlines: Array<{
    name: string;
    deadline: Date;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export interface ScholarshipProbability {
  scholarship: Scholarship;
  probability: number;
  expectedAmount: number;
  requirements: string[];
  competitiveness: 'low' | 'medium' | 'high';
}

export interface Scholarship {
  id: string;
  name: string;
  amount: number;
  deadline: Date;
  requirements: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface PortfolioAnalysis {
  overallSuccessProbability: number;
  expectedAcceptances: number;
  portfolioRisk: 'low' | 'medium' | 'high';
  balanceAnalysis: PortfolioBalance;
  optimizations: string[];
  individualPredictions: Array<{
    university: University;
    prediction: SuccessPrediction;
  }>;
}

export interface PortfolioBalance {
  reachSchools: number;
  matchSchools: number;
  safetySchools: number;
  recommendation: string;
}