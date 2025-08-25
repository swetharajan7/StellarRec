import { StudentProfile, UniversityMatch, RecommendationPlan, AutomatedTask, WorkflowMilestone, WorkflowPredictions, RiskAssessment } from './AIIntelligenceService';
export interface WorkflowTemplate {
    templateId: string;
    name: string;
    description: string;
    targetProfile: string;
    estimatedDuration: number;
    milestones: MilestoneTemplate[];
    tasks: TaskTemplate[];
    dependencies: WorkflowDependency[];
}
export interface MilestoneTemplate {
    name: string;
    description: string;
    daysFromStart: number;
    criticalPath: boolean;
    dependencies: string[];
    completionCriteria: string[];
}
export interface TaskTemplate {
    type: string;
    title: string;
    description: string;
    estimatedDuration: number;
    priority: 'high' | 'medium' | 'low';
    automationLevel: 'full' | 'assisted' | 'manual';
    dependencies: string[];
    triggerConditions: string[];
}
export interface WorkflowDependency {
    taskId: string;
    dependsOn: string[];
    type: 'blocking' | 'soft';
}
export interface WorkflowOptimization {
    type: 'timeline' | 'resource' | 'quality' | 'risk';
    description: string;
    impact: 'high' | 'medium' | 'low';
    implementation: string;
    estimatedSavings: number;
}
export declare class IntelligentWorkflowManager {
    private logger;
    private db;
    private workflowTemplates;
    constructor();
    generateRecommendationPlan(studentProfile: StudentProfile, targetUniversities: UniversityMatch[]): Promise<RecommendationPlan>;
    generateAutomatedTasks(studentProfile: StudentProfile, recommendationPlan: RecommendationPlan): Promise<AutomatedTask[]>;
    generateMilestones(studentProfile: StudentProfile, recommendationPlan: RecommendationPlan): Promise<WorkflowMilestone[]>;
    generatePredictions(studentProfile: StudentProfile, recommendationPlan: RecommendationPlan, automatedTasks: AutomatedTask[]): Promise<WorkflowPredictions>;
    assessRisks(studentProfile: StudentProfile, recommendationPlan: RecommendationPlan, automatedTasks: AutomatedTask[]): Promise<RiskAssessment>;
    optimizeWorkflow(automatedTasks: AutomatedTask[], constraints: WorkflowConstraints): Promise<WorkflowOptimization[]>;
    private initializeWorkflowTemplates;
    private generateApplicationStrategy;
    private analyzePortfolioBalance;
    private optimizeSubmissionTiming;
    private prioritizeUniversities;
    private createBackupPlans;
    private generateContentStrategy;
    private generateDocumentTasks;
    private generateUniversityTasks;
    private generateContentTasks;
    private generateDeadlineTasks;
    private generateMonitoringTasks;
    private optimizeTaskSchedule;
    private addDays;
    private calculateSubmissionDeadline;
    private calculateCompletionDate;
    private calculateSuccessProbability;
    private identifyRiskFactors;
    private findOptimizationOpportunities;
    private generateTimelineAdjustments;
    private identifyComprehensiveRiskFactors;
    private calculateOverallRisk;
    private generateMitigationStrategies;
    private createMonitoringPoints;
    private identifyCriticalDeadlines;
    private distributeWorkload;
    private calculateBufferTime;
    private identifyPersonalStatementThemes;
    private generateUniversityApproaches;
    private planRecommendationLetters;
    private planSupplementalEssays;
    private createContentCalendar;
    private calculateApplicationDate;
    private optimizeResources;
    private optimizeQuality;
    private optimizeRisks;
}
export interface WorkflowConstraints {
    maxDailyHours: number;
    availableDays: string[];
    priorityDeadlines: Date[];
}
export interface MitigationStrategy {
    riskId: string;
    strategy: string;
    actions: string[];
    timeline: Date;
    responsible: string;
    success_criteria: string[];
}
//# sourceMappingURL=IntelligentWorkflowManager.d.ts.map