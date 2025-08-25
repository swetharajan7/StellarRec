"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIIntelligenceService = void 0;
const logger_1 = require("../logger");
const database_1 = require("../database");
const UniversityMatchingEngine_1 = require("./UniversityMatchingEngine");
const ContentOptimizationEngine_1 = require("./ContentOptimizationEngine");
const IntelligentWorkflowManager_1 = require("./IntelligentWorkflowManager");
const PredictiveAnalyticsEngine_1 = require("./PredictiveAnalyticsEngine");
class AIIntelligenceService {
    constructor() {
        this.logger = new logger_1.Logger('AIIntelligenceService');
        this.db = new database_1.DatabaseService();
        this.matchingEngine = new UniversityMatchingEngine_1.UniversityMatchingEngine();
        this.contentOptimizer = new ContentOptimizationEngine_1.ContentOptimizationEngine();
        this.workflowManager = new IntelligentWorkflowManager_1.IntelligentWorkflowManager();
        this.predictiveAnalytics = new PredictiveAnalyticsEngine_1.PredictiveAnalyticsEngine();
    }
    async generateUniversityRecommendations(profile) {
        try {
            this.logger.info(`Generating university recommendations for student ${profile.id}`);
            const universities = await this.getAllUniversities();
            const matches = await this.matchingEngine.calculateMatches(profile, universities);
            const topMatches = matches
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, 50);
            const enhancedMatches = await Promise.all(topMatches.map(match => this.enhanceUniversityMatch(match, profile)));
            this.logger.info(`Generated ${enhancedMatches.length} university recommendations`);
            return enhancedMatches;
        }
        catch (error) {
            this.logger.error('Failed to generate university recommendations:', error);
            throw error;
        }
    }
    async optimizeRecommendationContent(content, targets, studentProfile) {
        try {
            this.logger.info(`Optimizing content for ${targets.length} universities`);
            const contentAnalysis = await this.contentOptimizer.analyzeContent(content);
            const optimizedVersions = {};
            for (const university of targets) {
                const optimized = await this.contentOptimizer.optimizeForUniversity(content, university, studentProfile, contentAnalysis);
                optimizedVersions[university.id] = optimized;
            }
            const improvements = await this.contentOptimizer.generateImprovements(content, targets, studentProfile);
            const culturalAdaptations = await this.contentOptimizer.generateCulturalAdaptations(content, targets);
            const qualityScore = await this.contentOptimizer.calculateQualityScore(content, optimizedVersions);
            return {
                originalContent: content,
                optimizedVersions,
                improvements,
                culturalAdaptations,
                qualityScore
            };
        }
        catch (error) {
            this.logger.error('Failed to optimize recommendation content:', error);
            throw error;
        }
    }
    async createIntelligentWorkflow(studentProfile, targetUniversities) {
        try {
            this.logger.info(`Creating intelligent workflow for student ${studentProfile.id}`);
            const recommendationPlan = await this.workflowManager.generateRecommendationPlan(studentProfile, targetUniversities);
            const automatedTasks = await this.workflowManager.generateAutomatedTasks(studentProfile, recommendationPlan);
            const milestones = await this.workflowManager.generateMilestones(studentProfile, recommendationPlan);
            const predictions = await this.workflowManager.generatePredictions(studentProfile, recommendationPlan, automatedTasks);
            const riskAssessment = await this.workflowManager.assessRisks(studentProfile, recommendationPlan, automatedTasks);
            const workflow = {
                workflowId: `workflow_${studentProfile.id}_${Date.now()}`,
                studentProfile,
                recommendationPlan,
                automatedTasks,
                milestones,
                predictions,
                riskAssessment
            };
            await this.storeWorkflow(workflow);
            this.logger.info(`Created intelligent workflow ${workflow.workflowId}`);
            return workflow;
        }
        catch (error) {
            this.logger.error('Failed to create intelligent workflow:', error);
            throw error;
        }
    }
    async predictAdmissionSuccess(studentProfile, university) {
        try {
            return await this.predictiveAnalytics.predictAdmissionSuccess(studentProfile, university);
        }
        catch (error) {
            this.logger.error('Failed to predict admission success:', error);
            throw error;
        }
    }
    async getRealTimeInsights(studentProfile) {
        try {
            const insights = await this.predictiveAnalytics.generateRealTimeInsights(studentProfile);
            return insights;
        }
        catch (error) {
            this.logger.error('Failed to get real-time insights:', error);
            throw error;
        }
    }
    async updateRecommendations(profileChanges, currentRecommendations) {
        try {
            this.logger.info('Updating recommendations based on profile changes');
            const impactAnalysis = await this.analyzeProfileChangeImpact(profileChanges, currentRecommendations);
            let updatedRecommendations = currentRecommendations;
            if (impactAnalysis.significantChange) {
                const updatedProfile = this.applyProfileChanges(profileChanges.originalProfile, profileChanges);
                updatedRecommendations = await this.generateUniversityRecommendations(updatedProfile);
            }
            return {
                originalRecommendations: currentRecommendations,
                updatedRecommendations,
                changes: impactAnalysis.changes,
                reasoning: impactAnalysis.reasoning
            };
        }
        catch (error) {
            this.logger.error('Failed to update recommendations:', error);
            throw error;
        }
    }
    async getAllUniversities() {
        const query = `
      SELECT u.*, ui.integration_type, ui.features, ui.requirements
      FROM universities u
      LEFT JOIN university_integrations ui ON u.id = ui.university_id
      WHERE u.is_active = true
    `;
        const result = await this.db.query(query);
        return result.rows.map(row => this.mapRowToUniversity(row));
    }
    async enhanceUniversityMatch(match, profile) {
        const financialFit = await this.calculateFinancialFit(match.university, profile);
        const culturalFit = await this.calculateCulturalFit(match.university, profile);
        const academicFit = await this.calculateAcademicFit(match.university, profile);
        return {
            ...match,
            financialFit,
            culturalFit,
            academicFit
        };
    }
    async calculateFinancialFit(university, profile) {
        return {
            tuitionAffordability: 0.8,
            scholarshipProbability: 0.6,
            totalCostScore: 0.7,
            financialAidEligibility: 0.9,
            returnOnInvestment: 0.8
        };
    }
    async calculateCulturalFit(university, profile) {
        return {
            locationMatch: 0.9,
            campusSizeMatch: 0.8,
            diversityMatch: 0.7,
            socialEnvironmentMatch: 0.8,
            overallCulturalFit: 0.8
        };
    }
    async calculateAcademicFit(university, profile) {
        return {
            gpaMatch: 0.9,
            testScoreMatch: 0.8,
            courseRigorMatch: 0.9,
            majorPreparation: 0.8,
            overallAcademicFit: 0.85
        };
    }
    async storeWorkflow(workflow) {
        const query = `
      INSERT INTO intelligent_workflows (
        workflow_id, student_id, workflow_data, created_at
      ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `;
        await this.db.query(query, [
            workflow.workflowId,
            workflow.studentProfile.id,
            JSON.stringify(workflow)
        ]);
    }
    mapRowToUniversity(row) {
        return {
            id: row.id,
            name: row.name,
            code: row.code,
            country: row.country,
            region: row.region,
            integrationType: row.integration_type,
            features: row.features ? JSON.parse(row.features) : {},
            requirements: row.requirements ? JSON.parse(row.requirements) : {},
        };
    }
    async analyzeProfileChangeImpact(changes, currentRecommendations) {
        return {
            significantChange: true,
            changes: [],
            reasoning: 'Profile changes detected'
        };
    }
    applyProfileChanges(originalProfile, changes) {
        return { ...originalProfile, ...changes.updates };
    }
}
exports.AIIntelligenceService = AIIntelligenceService;
ditional;
interfaces;
for (workflow; management; )
    ;
//# sourceMappingURL=AIIntelligenceService.js.map