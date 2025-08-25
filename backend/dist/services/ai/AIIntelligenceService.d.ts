export interface StudentProfile {
    id: string;
    academic: AcademicProfile;
    preferences: StudentPreferences;
    background: StudentBackground;
    goals: CareerGoals;
    timeline: ApplicationTimeline;
}
export interface AcademicProfile {
    gpa: number;
    gpaScale: number;
    testScores: {
        sat?: {
            total: number;
            ebrw: number;
            math: number;
        };
        act?: {
            composite: number;
            english: number;
            math: number;
            reading: number;
            science: number;
        };
        gre?: {
            verbal: number;
            quantitative: number;
            analytical: number;
        };
        gmat?: {
            total: number;
            verbal: number;
            quantitative: number;
        };
        toefl?: {
            total: number;
            reading: number;
            listening: number;
            speaking: number;
            writing: number;
        };
        ielts?: {
            total: number;
            listening: number;
            reading: number;
            writing: number;
            speaking: number;
        };
    };
    courseRigor: CourseRigor;
    classRank?: number;
    classSize?: number;
    currentInstitution: string;
    major: string;
    graduationDate: Date;
}
export interface CourseRigor {
    apCourses: number;
    ibCourses: number;
    honorsCourses: number;
    dualEnrollment: number;
    advancedMath: boolean;
    advancedScience: boolean;
    foreignLanguageYears: number;
}
export interface StudentPreferences {
    location: LocationPreferences;
    campusSize: 'small' | 'medium' | 'large' | 'any';
    campusType: 'urban' | 'suburban' | 'rural' | 'any';
    climate: 'cold' | 'temperate' | 'warm' | 'any';
    diversity: 'high' | 'medium' | 'low' | 'any';
    socialScene: 'party' | 'balanced' | 'academic' | 'any';
    religiousAffiliation: string | null;
    coed: boolean;
}
export interface LocationPreferences {
    preferredCountries: string[];
    preferredStates?: string[];
    preferredProvinces?: string[];
    maxDistanceFromHome?: number;
    urbanPreference: number;
}
export interface StudentBackground {
    demographics: Demographics;
    socioeconomic: SocioeconomicBackground;
    extracurriculars: ExtracurricularActivity[];
    workExperience: WorkExperience[];
    volunteering: VolunteerExperience[];
    achievements: Achievement[];
    specialCircumstances: string[];
}
export interface Demographics {
    ethnicity: string[];
    firstGeneration: boolean;
    legacy: boolean;
    internationalStudent: boolean;
    countryOfBirth: string;
    citizenship: string;
    languages: string[];
}
export interface SocioeconomicBackground {
    familyIncome: number;
    parentsEducation: string[];
    financialAidNeeded: boolean;
    workStudyInterest: boolean;
    scholarshipInterest: boolean;
}
export interface ExtracurricularActivity {
    name: string;
    type: 'academic' | 'athletic' | 'artistic' | 'community_service' | 'leadership' | 'other';
    role: string;
    yearsParticipated: number;
    hoursPerWeek: number;
    achievements: string[];
    leadership: boolean;
}
export interface WorkExperience {
    employer: string;
    position: string;
    startDate: Date;
    endDate?: Date;
    hoursPerWeek: number;
    description: string;
    skills: string[];
}
export interface VolunteerExperience {
    organization: string;
    role: string;
    startDate: Date;
    endDate?: Date;
    totalHours: number;
    description: string;
    impact: string;
}
export interface Achievement {
    name: string;
    type: 'academic' | 'athletic' | 'artistic' | 'leadership' | 'community' | 'other';
    level: 'school' | 'local' | 'state' | 'national' | 'international';
    date: Date;
    description: string;
}
export interface CareerGoals {
    intendedMajor: string;
    alternativeMajors: string[];
    careerInterests: string[];
    graduateSchoolPlans: boolean;
    professionalGoals: string;
    researchInterests: string[];
}
export interface ApplicationTimeline {
    targetApplicationDate: Date;
    preferredStartDate: Date;
    flexibilityMonths: number;
    earlyDecisionInterest: boolean;
    gapYearConsideration: boolean;
}
export interface UniversityMatch {
    university: University;
    matchScore: number;
    admissionProbability: number;
    reasoning: MatchReasoning;
    recommendations: string[];
    financialFit: FinancialFitAnalysis;
    culturalFit: CulturalFitAnalysis;
    academicFit: AcademicFitAnalysis;
}
export interface MatchReasoning {
    strengths: string[];
    concerns: string[];
    improvements: string[];
    keyFactors: string[];
}
export interface FinancialFitAnalysis {
    tuitionAffordability: number;
    scholarshipProbability: number;
    totalCostScore: number;
    financialAidEligibility: number;
    returnOnInvestment: number;
}
export interface CulturalFitAnalysis {
    locationMatch: number;
    campusSizeMatch: number;
    diversityMatch: number;
    socialEnvironmentMatch: number;
    overallCulturalFit: number;
}
export interface AcademicFitAnalysis {
    gpaMatch: number;
    testScoreMatch: number;
    courseRigorMatch: number;
    majorPreparation: number;
    overallAcademicFit: number;
}
export interface ContentOptimization {
    originalContent: string;
    optimizedVersions: Record<string, OptimizedContent>;
    improvements: ContentImprovement[];
    culturalAdaptations: CulturalAdaptation[];
    qualityScore: number;
}
export interface OptimizedContent {
    content: string;
    reasoning: string;
    keywordOptimization: string[];
    culturalAdaptations: string[];
    lengthOptimization: boolean;
    toneAdjustments: string[];
    structureImprovements: string[];
}
export interface ContentImprovement {
    type: 'keyword' | 'structure' | 'tone' | 'length' | 'cultural' | 'relevance';
    description: string;
    impact: 'high' | 'medium' | 'low';
    implementation: string;
}
export interface CulturalAdaptation {
    targetCountry: string;
    adaptationType: 'tone' | 'structure' | 'content' | 'format';
    originalElement: string;
    adaptedElement: string;
    reasoning: string;
}
export interface IntelligentWorkflow {
    workflowId: string;
    studentProfile: StudentProfile;
    recommendationPlan: RecommendationPlan;
    automatedTasks: AutomatedTask[];
    milestones: WorkflowMilestone[];
    predictions: WorkflowPredictions;
    riskAssessment: RiskAssessment;
}
export interface RecommendationPlan {
    targetUniversities: UniversityMatch[];
    applicationStrategy: ApplicationStrategy;
    timelineOptimization: TimelineOptimization;
    contentStrategy: ContentStrategy;
}
export interface ApplicationStrategy {
    portfolioBalance: PortfolioBalance;
    submissionTiming: SubmissionTiming;
    prioritization: UniversityPrioritization[];
    backupPlans: BackupPlan[];
}
export interface PortfolioBalance {
    reach: number;
    match: number;
    safety: number;
    reasoning: string;
}
export interface AutomatedTask {
    taskId: string;
    type: 'deadline_reminder' | 'content_optimization' | 'university_suggestion' | 'document_preparation' | 'progress_check';
    title: string;
    description: string;
    scheduledFor: Date;
    dependencies: string[];
    automationLevel: 'full' | 'assisted' | 'manual';
    priority: 'high' | 'medium' | 'low';
    estimatedDuration: number;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}
export interface WorkflowMilestone {
    milestoneId: string;
    name: string;
    description: string;
    targetDate: Date;
    dependencies: string[];
    completionCriteria: string[];
    status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
    progress: number;
}
export interface WorkflowPredictions {
    completionDate: Date;
    successProbability: number;
    riskFactors: string[];
    optimizationOpportunities: string[];
    timelineAdjustments: TimelineAdjustment[];
}
export interface RiskAssessment {
    overallRisk: 'low' | 'medium' | 'high';
    riskFactors: RiskFactor[];
    mitigationStrategies: MitigationStrategy[];
    monitoringPoints: MonitoringPoint[];
}
export interface RiskFactor {
    type: 'deadline' | 'academic' | 'financial' | 'competition' | 'external';
    description: string;
    probability: number;
    impact: 'low' | 'medium' | 'high';
    timeline: Date;
}
export declare class AIIntelligenceService {
    private logger;
    private db;
    private matchingEngine;
    private contentOptimizer;
    private workflowManager;
    private predictiveAnalytics;
    constructor();
    generateUniversityRecommendations(profile: StudentProfile): Promise<UniversityMatch[]>;
    optimizeRecommendationContent(content: string, targets: University[], studentProfile: StudentProfile): Promise<ContentOptimization>;
    createIntelligentWorkflow(studentProfile: StudentProfile, targetUniversities: UniversityMatch[]): Promise<IntelligentWorkflow>;
    predictAdmissionSuccess(studentProfile: StudentProfile, university: University): Promise<SuccessPrediction>;
    getRealTimeInsights(studentProfile: StudentProfile): Promise<RealTimeInsights>;
    updateRecommendations(profileChanges: ProfileUpdate, currentRecommendations: UniversityMatch[]): Promise<UpdatedRecommendations>;
    private getAllUniversities;
    private enhanceUniversityMatch;
    private calculateFinancialFit;
    private calculateCulturalFit;
    private calculateAcademicFit;
    private storeWorkflow;
    private mapRowToUniversity;
    private analyzeProfileChangeImpact;
    private applyProfileChanges;
}
export interface University {
    id: string;
    name: string;
    code: string;
    country: string;
    region: string;
    integrationType: string;
    features: Record<string, any>;
    requirements: Record<string, any>;
}
export interface SuccessPrediction {
    admissionProbability: number;
    confidenceInterval: [number, number];
    keyFactors: string[];
    improvements: string[];
    timeline: Date;
}
export interface RealTimeInsights {
    opportunities: string[];
    risks: string[];
    recommendations: string[];
    marketTrends: string[];
    personalizedTips: string[];
}
export interface ProfileUpdate {
    originalProfile: StudentProfile;
    updates: Partial<StudentProfile>;
    timestamp: Date;
    source: string;
}
export interface UpdatedRecommendations {
    originalRecommendations: UniversityMatch[];
    updatedRecommendations: UniversityMatch[];
    changes: string[];
    reasoning: string;
}
export interface ProfileChangeImpact {
    significantChange: boolean;
    changes: string[];
    reasoning: string;
}
export interface UniversityPrioritization {
    university: University;
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
    recommendedEffort: 'maximum' | 'standard' | 'minimal';
}
export interface BackupPlan {
    planId: string;
    name: string;
    description: string;
    triggerConditions: string[];
    actions: string[];
    timeline: string;
}
export interface TimelineOptimization {
    criticalDeadlines: CriticalDeadline[];
    workloadDistribution: WorkloadDistribution;
    bufferTime: BufferTimeAnalysis;
    recommendations: string[];
}
export interface ContentStrategy {
    personalStatementThemes: string[];
    universitySpecificApproaches: UniversityApproach[];
    recommendationLetterStrategy: RecommendationStrategy;
    supplementalEssayPlan: EssayPlan;
    contentCalendar: ContentCalendar;
}
export interface CriticalDeadline {
    universityId: string;
    universityName: string;
    date: Date;
    type: 'early_decision' | 'early_action' | 'regular_decision' | 'scholarship';
    priority: 'high' | 'medium' | 'low';
}
export interface WorkloadDistribution {
    weeklyHours: Record<string, number>;
    peakPeriods: string[];
    recommendations: string[];
}
export interface BufferTimeAnalysis {
    recommendedBuffer: number;
    riskAssessment: string;
    contingencyPlans: string[];
}
export interface UniversityApproach {
    universityId: string;
    approach: string;
    keyMessages: string[];
    tone: string;
}
export interface RecommendationStrategy {
    recommenders: RecommenderProfile[];
    timeline: RecommendationTimeline;
    instructions: string[];
}
export interface RecommenderProfile {
    name: string;
    relationship: string;
    strengths: string[];
    universities: string[];
}
export interface RecommendationTimeline {
    requestDate: Date;
    followUpDates: Date[];
    submissionDeadline: Date;
}
export interface EssayPlan {
    essays: EssayRequirement[];
    timeline: EssayTimeline;
    themes: string[];
}
export interface EssayRequirement {
    universityId: string;
    prompt: string;
    wordLimit: number;
    priority: 'high' | 'medium' | 'low';
    dueDate: Date;
}
export interface EssayTimeline {
    draftDeadlines: Record<string, Date>;
    reviewPeriods: Record<string, Date>;
    finalDeadlines: Record<string, Date>;
}
export interface ContentCalendar {
    milestones: ContentMilestone[];
    deadlines: ContentDeadline[];
    bufferPeriods: BufferPeriod[];
}
export interface ContentMilestone {
    name: string;
    date: Date;
    deliverables: string[];
    dependencies: string[];
}
export interface ContentDeadline {
    name: string;
    date: Date;
    type: 'essay' | 'application' | 'document' | 'recommendation';
    priority: 'high' | 'medium' | 'low';
}
export interface BufferPeriod {
    startDate: Date;
    endDate: Date;
    purpose: string;
    activities: string[];
}
export interface TimelineAdjustment {
    type: 'acceleration' | 'deceleration' | 'resequencing';
    description: string;
    impact: string;
    implementation: string;
}
export interface MitigationStrategy {
    riskId: string;
    strategy: string;
    actions: string[];
    timeline: Date;
    responsible: string;
    success_criteria: string[];
}
export interface MonitoringPoint {
    pointId: string;
    name: string;
    description: string;
    frequency: string;
    triggers: string[];
    actions: string[];
}
//# sourceMappingURL=AIIntelligenceService.d.ts.map