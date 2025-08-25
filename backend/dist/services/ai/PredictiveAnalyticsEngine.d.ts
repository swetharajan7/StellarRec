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
export declare class PredictiveAnalyticsEngine {
    private logger;
    private db;
    private models;
    constructor();
    predictAdmissionSuccess(studentProfile: StudentProfile, university: University): Promise<SuccessPrediction>;
    generateRealTimeInsights(studentProfile: StudentProfile): Promise<RealTimeInsights>;
    predictOptimalTiming(studentProfile: StudentProfile, universities: University[]): Promise<TimingRecommendation[]>;
    analyzeScholarshipProbability(studentProfile: StudentProfile, university: University): Promise<ScholarshipAnalysis>;
    predictPortfolioSuccess(studentProfile: StudentProfile, universities: University[]): Promise<PortfolioAnalysis>;
    private initializeModels;
    private getModelForUniversity;
    private extractPredictionFeatures;
    private calculateBaseProbability;
    private applyContextualAdjustments;
    private calculateConfidenceInterval;
    private identifyKeyFactors;
    private generateImprovementSuggestions;
    private estimateDecisionTimeline;
    private identifyOpportunities;
    private assessRisks;
    private generatePersonalizedRecommendations;
    private analyzeMarketTrends;
    private generatePersonalizedTips;
    private normalizeGPA;
    private calculateTestScorePercentile;
    private calculateCourseRigorScore;
    private calculateExtracurricularScore;
    private calculateLeadershipScore;
    private calculateGeographicDiversity;
    private calculateDemographicFactors;
    private calculateTimingScore;
    private translateFeatureToDescription;
    private getUniversitySpecificFactors;
    private getTemporalFactors;
    private getMarketFactors;
    private getUniversityPreferences;
    private hasResearchExperience;
    private getUniversityDecisionDelay;
    private calculateTimeToDeadline;
    private assessCompetitionLevel;
}
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
//# sourceMappingURL=PredictiveAnalyticsEngine.d.ts.map