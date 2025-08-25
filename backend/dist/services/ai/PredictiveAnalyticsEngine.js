"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictiveAnalyticsEngine = void 0;
const logger_1 = require("../logger");
const database_1 = require("../database");
class PredictiveAnalyticsEngine {
    constructor() {
        this.logger = new logger_1.Logger('PredictiveAnalyticsEngine');
        this.models = new Map();
        this.db = new database_1.DatabaseService();
        this.initializeModels();
    }
    async predictAdmissionSuccess(studentProfile, university) {
        try {
            this.logger.info(`Predicting admission success for ${university.name}`);
            const model = this.getModelForUniversity(university);
            const features = await this.extractPredictionFeatures(studentProfile, university);
            const baseProbability = this.calculateBaseProbability(features, model);
            const adjustedProbability = await this.applyContextualAdjustments(baseProbability, studentProfile, university);
            const confidenceInterval = this.calculateConfidenceInterval(adjustedProbability, features, model);
            const keyFactors = this.identifyKeyFactors(features, model, university);
            const improvements = await this.generateImprovementSuggestions(studentProfile, university, features);
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
        }
        catch (error) {
            this.logger.error(`Failed to predict admission success for ${university.name}:`, error);
            throw error;
        }
    }
    async generateRealTimeInsights(studentProfile) {
        try {
            this.logger.info(`Generating real-time insights for student ${studentProfile.id}`);
            const opportunities = await this.identifyOpportunities(studentProfile);
            const risks = await this.assessRisks(studentProfile);
            const recommendations = await this.generatePersonalizedRecommendations(studentProfile);
            const marketTrends = await this.analyzeMarketTrends(studentProfile);
            const personalizedTips = await this.generatePersonalizedTips(studentProfile);
            return {
                opportunities,
                risks,
                recommendations,
                marketTrends,
                personalizedTips
            };
        }
        catch (error) {
            this.logger.error('Failed to generate real-time insights:', error);
            throw error;
        }
    }
    async predictOptimalTiming(studentProfile, universities) {
        try {
            const recommendations = [];
            for (const university of universities) {
                const timing = await this.calculateOptimalTiming(studentProfile, university);
                recommendations.push(timing);
            }
            return recommendations.sort((a, b) => b.successProbability - a.successProbability);
        }
        catch (error) {
            this.logger.error('Failed to predict optimal timing:', error);
            throw error;
        }
    }
    async analyzeScholarshipProbability(studentProfile, university) {
        try {
            const scholarships = await this.getAvailableScholarships(university, studentProfile);
            const scholarshipProbabilities = [];
            for (const scholarship of scholarships) {
                const probability = await this.calculateScholarshipProbability(studentProfile, scholarship);
                scholarshipProbabilities.push(probability);
            }
            const expectedAid = this.calculateExpectedFinancialAid(scholarshipProbabilities);
            const recommendations = this.generateScholarshipRecommendations(scholarshipProbabilities, studentProfile);
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
        }
        catch (error) {
            this.logger.error('Failed to analyze scholarship probability:', error);
            throw error;
        }
    }
    async predictPortfolioSuccess(studentProfile, universities) {
        try {
            const individualPredictions = await Promise.all(universities.map(uni => this.predictAdmissionSuccess(studentProfile, uni)));
            const portfolioMetrics = this.calculatePortfolioMetrics(universities, individualPredictions);
            const balanceAnalysis = this.analyzePortfolioBalance(universities, individualPredictions);
            const optimizations = this.generatePortfolioOptimizations(studentProfile, universities, individualPredictions);
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
        }
        catch (error) {
            this.logger.error('Failed to predict portfolio success:', error);
            throw error;
        }
    }
    async initializeModels() {
        try {
            const defaultModel = {
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
        }
        catch (error) {
            this.logger.error('Failed to initialize models:', error);
        }
    }
    getModelForUniversity(university) {
        const universityModel = this.models.get(university.id);
        return universityModel || this.models.get('general');
    }
    async extractPredictionFeatures(studentProfile, university) {
        const features = {};
        features.gpa_normalized = this.normalizeGPA(studentProfile.academic.gpa, studentProfile.academic.gpaScale);
        features.test_score_percentile = this.calculateTestScorePercentile(studentProfile.academic.testScores, university);
        features.course_rigor_score = this.calculateCourseRigorScore(studentProfile.academic.courseRigor);
        features.extracurricular_score = this.calculateExtracurricularScore(studentProfile.background.extracurriculars);
        features.leadership_score = this.calculateLeadershipScore(studentProfile.background.extracurriculars, studentProfile.background.workExperience);
        features.geographic_diversity = this.calculateGeographicDiversity(studentProfile, university);
        features.demographic_factors = this.calculateDemographicFactors(studentProfile.background.demographics);
        features.application_timing = this.calculateTimingScore(studentProfile.timeline, university);
        return features;
    }
    calculateBaseProbability(features, model) {
        let probability = 0;
        for (const [feature, value] of Object.entries(features)) {
            const weight = model.weights[feature] || 0;
            probability += value * weight;
        }
        return 1 / (1 + Math.exp(-probability));
    }
    async applyContextualAdjustments(baseProbability, studentProfile, university) {
        let adjustedProbability = baseProbability;
        const universityFactors = await this.getUniversitySpecificFactors(university);
        adjustedProbability *= universityFactors.competitiveness;
        const temporalFactors = await this.getTemporalFactors(university);
        adjustedProbability *= temporalFactors.cycleTrend;
        const marketFactors = await this.getMarketFactors(university);
        adjustedProbability *= marketFactors.demandTrend;
        return Math.max(0.01, Math.min(0.99, adjustedProbability));
    }
    calculateConfidenceInterval(probability, features, model) {
        const featureCompleteness = Object.keys(features).length / model.features.length;
        const baseConfidence = model.accuracy * featureCompleteness;
        const marginOfError = (1 - baseConfidence) * 0.5;
        const lowerBound = Math.max(0, probability - marginOfError);
        const upperBound = Math.min(1, probability + marginOfError);
        return [lowerBound, upperBound];
    }
    identifyKeyFactors(features, model, university) {
        const featureImportance = [];
        for (const [feature, value] of Object.entries(features)) {
            const weight = model.weights[feature] || 0;
            const importance = Math.abs(value * weight);
            featureImportance.push({ feature, importance });
        }
        const topFactors = featureImportance
            .sort((a, b) => b.importance - a.importance)
            .slice(0, 5)
            .map(f => this.translateFeatureToDescription(f.feature));
        return topFactors;
    }
    async generateImprovementSuggestions(studentProfile, university, features) {
        const suggestions = [];
        if (features.gpa_normalized < 0.8) {
            suggestions.push('Focus on improving GPA through strong performance in remaining courses');
        }
        if (features.test_score_percentile < 0.7) {
            suggestions.push('Consider retaking standardized tests to improve scores');
        }
        if (features.course_rigor_score < 0.6) {
            suggestions.push('Enroll in more challenging courses (AP, IB, or Honors)');
        }
        if (features.extracurricular_score < 0.5) {
            suggestions.push('Increase involvement in meaningful extracurricular activities');
        }
        if (features.leadership_score < 0.4) {
            suggestions.push('Seek leadership opportunities in clubs, sports, or community organizations');
        }
        const universityPreferences = await this.getUniversityPreferences(university);
        if (universityPreferences.valuesResearch && !this.hasResearchExperience(studentProfile)) {
            suggestions.push('Gain research experience through internships or academic projects');
        }
        return suggestions.slice(0, 5);
    }
    estimateDecisionTimeline(university) {
        const now = new Date();
        const currentMonth = now.getMonth();
        let decisionMonth = 3;
        let decisionYear = now.getFullYear();
        if (currentMonth > 5) {
            decisionYear += 1;
        }
        const universityDelay = this.getUniversityDecisionDelay(university);
        decisionMonth += universityDelay;
        return new Date(decisionYear, decisionMonth, 15);
    }
    async identifyOpportunities(studentProfile) {
        const opportunities = [];
        if (studentProfile.academic.gpa >= 3.8) {
            opportunities.push('Strong GPA qualifies you for merit-based scholarships');
        }
        if (studentProfile.goals.researchInterests.length > 0) {
            opportunities.push('Research interests align with opportunities at top research universities');
        }
        if (studentProfile.preferences.location.preferredCountries.includes('international')) {
            opportunities.push('International study options available with strong profile');
        }
        if (studentProfile.background.demographics.firstGeneration) {
            opportunities.push('First-generation college student programs and scholarships available');
        }
        return opportunities;
    }
    async assessRisks(studentProfile) {
        const risks = [];
        if (studentProfile.academic.gpa < 3.0) {
            risks.push('Low GPA may limit university options - consider community college pathway');
        }
        const timeToDeadline = this.calculateTimeToDeadline(studentProfile.timeline);
        if (timeToDeadline < 30) {
            risks.push('Approaching application deadlines - prioritize most important applications');
        }
        if (studentProfile.background.socioeconomic.financialAidNeeded &&
            !studentProfile.background.socioeconomic.scholarshipInterest) {
            risks.push('Financial aid needed but not actively pursuing scholarships');
        }
        const competitionLevel = await this.assessCompetitionLevel(studentProfile);
        if (competitionLevel > 0.8) {
            risks.push('High competition in target universities - consider adding safety schools');
        }
        return risks;
    }
    async generatePersonalizedRecommendations(studentProfile) {
        const recommendations = [];
        if (studentProfile.academic.testScores.sat &&
            studentProfile.academic.testScores.sat.total < 1400) {
            recommendations.push('Consider test-optional universities or SAT prep courses');
        }
        const leadershipScore = this.calculateLeadershipScore(studentProfile.background.extracurriculars, studentProfile.background.workExperience);
        if (leadershipScore < 0.5) {
            recommendations.push('Seek leadership roles to strengthen your application profile');
        }
        if (studentProfile.goals.intendedMajor === 'Computer Science') {
            recommendations.push('Build a portfolio of coding projects and consider CS competitions');
        }
        return recommendations;
    }
    async analyzeMarketTrends(studentProfile) {
        const trends = [];
        trends.push('International applications increasing - apply early for better chances');
        trends.push('STEM programs seeing high demand - consider alternative pathways');
        trends.push('Test-optional policies expanding - focus on holistic application strength');
        if (studentProfile.goals.intendedMajor === 'Business') {
            trends.push('Business programs emphasizing sustainability and social impact');
        }
        return trends;
    }
    async generatePersonalizedTips(studentProfile) {
        const tips = [];
        tips.push('Start essays early and get multiple reviews from teachers and counselors');
        tips.push('Request recommendation letters at least 6 weeks before deadlines');
        if (studentProfile.background.demographics.internationalStudent) {
            tips.push('Highlight cultural perspective and adaptability in your essays');
        }
        if (studentProfile.background.extracurriculars.some(e => e.type === 'community_service')) {
            tips.push('Quantify your community service impact with specific numbers and outcomes');
        }
        return tips;
    }
    normalizeGPA(gpa, scale) {
        return gpa / scale;
    }
    calculateTestScorePercentile(testScores, university) {
        if (testScores.sat) {
            return Math.min(testScores.sat.total / 1600, 1.0);
        }
        if (testScores.act) {
            return Math.min(testScores.act.composite / 36, 1.0);
        }
        return 0.5;
    }
    calculateCourseRigorScore(courseRigor) {
        const apWeight = 0.4;
        const ibWeight = 0.4;
        const honorsWeight = 0.2;
        const normalizedAP = Math.min(courseRigor.apCourses / 8, 1.0);
        const normalizedIB = Math.min(courseRigor.ibCourses / 6, 1.0);
        const normalizedHonors = Math.min(courseRigor.honorsCourses / 10, 1.0);
        return (normalizedAP * apWeight) + (normalizedIB * ibWeight) + (normalizedHonors * honorsWeight);
    }
    calculateExtracurricularScore(extracurriculars) {
        if (!extracurriculars.length)
            return 0;
        let score = 0;
        for (const activity of extracurriculars) {
            const yearWeight = Math.min(activity.yearsParticipated / 4, 1.0);
            const hourWeight = Math.min(activity.hoursPerWeek / 20, 1.0);
            const leadershipBonus = activity.leadership ? 0.2 : 0;
            score += (yearWeight * 0.4 + hourWeight * 0.4 + leadershipBonus) / extracurriculars.length;
        }
        return Math.min(score, 1.0);
    }
    calculateLeadershipScore(extracurriculars, workExperience) {
        let leadershipCount = 0;
        let totalActivities = extracurriculars.length + workExperience.length;
        leadershipCount += extracurriculars.filter(e => e.leadership).length;
        leadershipCount += workExperience.filter(w => w.position.toLowerCase().includes('lead') ||
            w.position.toLowerCase().includes('manager') ||
            w.position.toLowerCase().includes('supervisor')).length;
        return totalActivities > 0 ? leadershipCount / totalActivities : 0;
    }
    calculateGeographicDiversity(studentProfile, university) {
        if (studentProfile.background.demographics.internationalStudent && university.country === 'US') {
            return 0.8;
        }
        return 0.5;
    }
    calculateDemographicFactors(demographics) {
        let score = 0.5;
        if (demographics.firstGeneration)
            score += 0.2;
        if (demographics.ethnicity.some((e) => ['Hispanic', 'African American', 'Native American'].includes(e))) {
            score += 0.15;
        }
        return Math.min(score, 1.0);
    }
    calculateTimingScore(timeline, university) {
        if (timeline.earlyDecisionInterest)
            return 0.8;
        return 0.5;
    }
    translateFeatureToDescription(feature) {
        const translations = {
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
    async getUniversitySpecificFactors(university) {
        return { competitiveness: 1.0 };
    }
    async getTemporalFactors(university) {
        return { cycleTrend: 1.0 };
    }
    async getMarketFactors(university) {
        return { demandTrend: 1.0 };
    }
    async getUniversityPreferences(university) {
        return { valuesResearch: true };
    }
    hasResearchExperience(studentProfile) {
        return studentProfile.background.extracurriculars.some(e => e.name.toLowerCase().includes('research') || e.type === 'academic');
    }
    getUniversityDecisionDelay(university) {
        return 0;
    }
    calculateTimeToDeadline(timeline) {
        const now = new Date();
        const deadline = new Date(timeline.targetApplicationDate);
        return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
    async assessCompetitionLevel(studentProfile) {
        return 0.6;
    }
}
exports.PredictiveAnalyticsEngine = PredictiveAnalyticsEngine;
//# sourceMappingURL=PredictiveAnalyticsEngine.js.map