import { AIIntelligenceService } from '../services/ai/AIIntelligenceService';
import { PredictiveAnalyticsEngine } from '../services/ai/PredictiveAnalyticsEngine';
import { ContentOptimizationEngine } from '../services/ai/ContentOptimizationEngine';
import { IntelligentWorkflowManager } from '../services/ai/IntelligentWorkflowManager';

describe('AI Intelligence System', () => {
  let aiService: AIIntelligenceService;
  let predictiveEngine: PredictiveAnalyticsEngine;
  let contentOptimizer: ContentOptimizationEngine;
  let workflowManager: IntelligentWorkflowManager;

  const mockStudentProfile = {
    id: 'student_123',
    academic: {
      gpa: 3.8,
      gpaScale: 4.0,
      testScores: {
        sat: { total: 1450, ebrw: 720, math: 730 }
      },
      courseRigor: {
        apCourses: 6,
        ibCourses: 0,
        honorsCourses: 4,
        dualEnrollment: 2,
        advancedMath: true,
        advancedScience: true,
        foreignLanguageYears: 4
      },
      currentInstitution: 'Test High School',
      major: 'Computer Science',
      graduationDate: new Date('2024-06-01')
    },
    preferences: {
      location: {
        preferredCountries: ['US'],
        preferredStates: ['CA', 'NY'],
        maxDistanceFromHome: 3000,
        urbanPreference: 8
      },
      campusSize: 'large' as const,
      campusType: 'urban' as const,
      climate: 'temperate' as const,
      diversity: 'high' as const,
      socialScene: 'balanced' as const,
      religiousAffiliation: null,
      coed: true
    },
    background: {
      demographics: {
        ethnicity: ['Asian'],
        firstGeneration: false,
        legacy: false,
        internationalStudent: false,
        countryOfBirth: 'US',
        citizenship: 'US',
        languages: ['English']
      },
      socioeconomic: {
        familyIncome: 85000,
        parentsEducation: ['Bachelor'],
        financialAidNeeded: true,
        workStudyInterest: true,
        scholarshipInterest: true
      },
      extracurriculars: [
        {
          name: 'Computer Science Club',
          type: 'academic' as const,
          role: 'President',
          yearsParticipated: 3,
          hoursPerWeek: 5,
          achievements: ['State competition winner'],
          leadership: true
        }
      ],
      workExperience: [],
      volunteering: [],
      achievements: [],
      specialCircumstances: []
    },
    goals: {
      intendedMajor: 'Computer Science',
      alternativeMajors: ['Software Engineering'],
      careerInterests: ['Software Development'],
      graduateSchoolPlans: true,
      professionalGoals: 'Software Engineer',
      researchInterests: ['Machine Learning']
    },
    timeline: {
      targetApplicationDate: new Date('2024-01-01'),
      preferredStartDate: new Date('2024-09-01'),
      flexibilityMonths: 0,
      earlyDecisionInterest: true,
      gapYearConsideration: false
    }
  };

  const mockUniversity = {
    id: 'stanford_1',
    name: 'Stanford University',
    code: 'STANFORD',
    country: 'US',
    region: 'CA',
    integrationType: 'common_app',
    features: {},
    requirements: {}
  };

  beforeEach(() => {
    aiService = new AIIntelligenceService();
    predictiveEngine = new PredictiveAnalyticsEngine();
    contentOptimizer = new ContentOptimizationEngine();
    workflowManager = new IntelligentWorkflowManager();
  });

  describe('University Matching Engine', () => {
    test('should generate university recommendations', async () => {
      const recommendations = await aiService.generateUniversityRecommendations(mockStudentProfile);
      
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Check recommendation structure
      const firstRec = recommendations[0];
      expect(firstRec).toHaveProperty('university');
      expect(firstRec).toHaveProperty('matchScore');
      expect(firstRec).toHaveProperty('admissionProbability');
      expect(firstRec).toHaveProperty('reasoning');
      expect(firstRec.matchScore).toBeGreaterThanOrEqual(0);
      expect(firstRec.matchScore).toBeLessThanOrEqual(100);
      expect(firstRec.admissionProbability).toBeGreaterThanOrEqual(0);
      expect(firstRec.admissionProbability).toBeLessThanOrEqual(1);
    });

    test('should sort recommendations by match score', async () => {
      const recommendations = await aiService.generateUniversityRecommendations(mockStudentProfile);
      
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i-1].matchScore).toBeGreaterThanOrEqual(recommendations[i].matchScore);
      }
    });
  });

  describe('Content Optimization Engine', () => {
    const sampleContent = `
      John is an exceptional student who has demonstrated outstanding academic performance 
      throughout his high school career. He has maintained a high GPA while taking 
      challenging courses and participating in numerous extracurricular activities. 
      His leadership skills are evident through his role as president of the Computer Science Club.
    `;

    test('should analyze content characteristics', async () => {
      const analysis = await contentOptimizer.analyzeContent(sampleContent);
      
      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty('wordCount');
      expect(analysis).toHaveProperty('sentenceCount');
      expect(analysis).toHaveProperty('readabilityScore');
      expect(analysis).toHaveProperty('tone');
      expect(analysis).toHaveProperty('sentiment');
      expect(analysis).toHaveProperty('strengths');
      expect(analysis).toHaveProperty('weaknesses');
      
      expect(analysis.wordCount).toBeGreaterThan(0);
      expect(analysis.sentenceCount).toBeGreaterThan(0);
      expect(analysis.readabilityScore).toBeGreaterThanOrEqual(0);
      expect(analysis.readabilityScore).toBeLessThanOrEqual(100);
      expect(['formal', 'informal', 'academic', 'personal']).toContain(analysis.tone);
      expect(['positive', 'neutral', 'negative']).toContain(analysis.sentiment);
    });

    test('should optimize content for specific university', async () => {
      const analysis = await contentOptimizer.analyzeContent(sampleContent);
      const optimized = await contentOptimizer.optimizeForUniversity(
        sampleContent,
        mockUniversity,
        mockStudentProfile,
        analysis
      );
      
      expect(optimized).toBeDefined();
      expect(optimized).toHaveProperty('content');
      expect(optimized).toHaveProperty('reasoning');
      expect(optimized).toHaveProperty('keywordOptimization');
      expect(optimized).toHaveProperty('culturalAdaptations');
      expect(optimized).toHaveProperty('toneAdjustments');
      
      expect(optimized.content).toBeDefined();
      expect(optimized.reasoning).toBeDefined();
      expect(Array.isArray(optimized.keywordOptimization)).toBe(true);
      expect(Array.isArray(optimized.culturalAdaptations)).toBe(true);
      expect(Array.isArray(optimized.toneAdjustments)).toBe(true);
    });

    test('should generate improvement suggestions', async () => {
      const improvements = await contentOptimizer.generateImprovements(
        sampleContent,
        [mockUniversity],
        mockStudentProfile
      );
      
      expect(improvements).toBeDefined();
      expect(Array.isArray(improvements)).toBe(true);
      
      if (improvements.length > 0) {
        const firstImprovement = improvements[0];
        expect(firstImprovement).toHaveProperty('type');
        expect(firstImprovement).toHaveProperty('description');
        expect(firstImprovement).toHaveProperty('impact');
        expect(firstImprovement).toHaveProperty('implementation');
        expect(['keyword', 'structure', 'tone', 'length', 'cultural', 'relevance']).toContain(firstImprovement.type);
        expect(['high', 'medium', 'low']).toContain(firstImprovement.impact);
      }
    });

    test('should calculate quality score', async () => {
      const optimizedVersions = {
        [mockUniversity.id]: {
          content: sampleContent,
          reasoning: 'Test optimization',
          keywordOptimization: ['academic excellence'],
          culturalAdaptations: ['US academic culture'],
          lengthOptimization: false,
          toneAdjustments: [],
          structureImprovements: []
        }
      };
      
      const qualityScore = await contentOptimizer.calculateQualityScore(
        sampleContent,
        optimizedVersions
      );
      
      expect(qualityScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Predictive Analytics Engine', () => {
    test('should predict admission success', async () => {
      const prediction = await predictiveEngine.predictAdmissionSuccess(
        mockStudentProfile,
        mockUniversity
      );
      
      expect(prediction).toBeDefined();
      expect(prediction).toHaveProperty('admissionProbability');
      expect(prediction).toHaveProperty('confidenceInterval');
      expect(prediction).toHaveProperty('keyFactors');
      expect(prediction).toHaveProperty('improvements');
      expect(prediction).toHaveProperty('timeline');
      
      expect(prediction.admissionProbability).toBeGreaterThanOrEqual(0);
      expect(prediction.admissionProbability).toBeLessThanOrEqual(1);
      expect(Array.isArray(prediction.confidenceInterval)).toBe(true);
      expect(prediction.confidenceInterval.length).toBe(2);
      expect(Array.isArray(prediction.keyFactors)).toBe(true);
      expect(Array.isArray(prediction.improvements)).toBe(true);
      expect(prediction.timeline instanceof Date).toBe(true);
    });

    test('should generate real-time insights', async () => {
      const insights = await predictiveEngine.generateRealTimeInsights(mockStudentProfile);
      
      expect(insights).toBeDefined();
      expect(insights).toHaveProperty('opportunities');
      expect(insights).toHaveProperty('risks');
      expect(insights).toHaveProperty('recommendations');
      expect(insights).toHaveProperty('marketTrends');
      expect(insights).toHaveProperty('personalizedTips');
      
      expect(Array.isArray(insights.opportunities)).toBe(true);
      expect(Array.isArray(insights.risks)).toBe(true);
      expect(Array.isArray(insights.recommendations)).toBe(true);
      expect(Array.isArray(insights.marketTrends)).toBe(true);
      expect(Array.isArray(insights.personalizedTips)).toBe(true);
    });

    test('should predict optimal timing', async () => {
      const timingRecommendations = await predictiveEngine.predictOptimalTiming(
        mockStudentProfile,
        [mockUniversity]
      );
      
      expect(timingRecommendations).toBeDefined();
      expect(Array.isArray(timingRecommendations)).toBe(true);
      
      if (timingRecommendations.length > 0) {
        const firstTiming = timingRecommendations[0];
        expect(firstTiming).toHaveProperty('university');
        expect(firstTiming).toHaveProperty('optimalSubmissionDate');
        expect(firstTiming).toHaveProperty('successProbability');
        expect(firstTiming).toHaveProperty('reasoning');
        
        expect(firstTiming.optimalSubmissionDate instanceof Date).toBe(true);
        expect(firstTiming.successProbability).toBeGreaterThanOrEqual(0);
        expect(firstTiming.successProbability).toBeLessThanOrEqual(1);
      }
    });

    test('should analyze scholarship probability', async () => {
      const scholarshipAnalysis = await predictiveEngine.analyzeScholarshipProbability(
        mockStudentProfile,
        mockUniversity
      );
      
      expect(scholarshipAnalysis).toBeDefined();
      expect(scholarshipAnalysis).toHaveProperty('totalExpectedAid');
      expect(scholarshipAnalysis).toHaveProperty('scholarshipProbabilities');
      expect(scholarshipAnalysis).toHaveProperty('recommendations');
      expect(scholarshipAnalysis).toHaveProperty('applicationDeadlines');
      
      expect(scholarshipAnalysis.totalExpectedAid).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(scholarshipAnalysis.scholarshipProbabilities)).toBe(true);
      expect(Array.isArray(scholarshipAnalysis.recommendations)).toBe(true);
      expect(Array.isArray(scholarshipAnalysis.applicationDeadlines)).toBe(true);
    });

    test('should predict portfolio success', async () => {
      const portfolioAnalysis = await predictiveEngine.predictPortfolioSuccess(
        mockStudentProfile,
        [mockUniversity]
      );
      
      expect(portfolioAnalysis).toBeDefined();
      expect(portfolioAnalysis).toHaveProperty('overallSuccessProbability');
      expect(portfolioAnalysis).toHaveProperty('expectedAcceptances');
      expect(portfolioAnalysis).toHaveProperty('portfolioRisk');
      expect(portfolioAnalysis).toHaveProperty('balanceAnalysis');
      expect(portfolioAnalysis).toHaveProperty('optimizations');
      expect(portfolioAnalysis).toHaveProperty('individualPredictions');
      
      expect(portfolioAnalysis.overallSuccessProbability).toBeGreaterThanOrEqual(0);
      expect(portfolioAnalysis.overallSuccessProbability).toBeLessThanOrEqual(1);
      expect(portfolioAnalysis.expectedAcceptances).toBeGreaterThanOrEqual(0);
      expect(['low', 'medium', 'high']).toContain(portfolioAnalysis.portfolioRisk);
      expect(Array.isArray(portfolioAnalysis.optimizations)).toBe(true);
      expect(Array.isArray(portfolioAnalysis.individualPredictions)).toBe(true);
    });
  });

  describe('Intelligent Workflow Manager', () => {
    const mockUniversityMatches = [
      {
        university: mockUniversity,
        matchScore: 85,
        admissionProbability: 0.7,
        reasoning: {
          strengths: ['Strong academic profile'],
          concerns: ['High competition'],
          improvements: ['Improve test scores'],
          keyFactors: ['GPA', 'Test scores']
        },
        recommendations: ['Apply early decision'],
        financialFit: {
          tuitionAffordability: 0.8,
          scholarshipProbability: 0.6,
          totalCostScore: 0.7,
          financialAidEligibility: 0.9,
          returnOnInvestment: 0.8
        },
        culturalFit: {
          locationMatch: 0.9,
          campusSizeMatch: 0.8,
          diversityMatch: 0.7,
          socialEnvironmentMatch: 0.8,
          overallCulturalFit: 0.8
        },
        academicFit: {
          gpaMatch: 0.9,
          testScoreMatch: 0.8,
          courseRigorMatch: 0.9,
          majorPreparation: 0.8,
          overallAcademicFit: 0.85
        }
      }
    ];

    test('should generate recommendation plan', async () => {
      const plan = await workflowManager.generateRecommendationPlan(
        mockStudentProfile,
        mockUniversityMatches
      );
      
      expect(plan).toBeDefined();
      expect(plan).toHaveProperty('targetUniversities');
      expect(plan).toHaveProperty('applicationStrategy');
      expect(plan).toHaveProperty('timelineOptimization');
      expect(plan).toHaveProperty('contentStrategy');
      
      expect(Array.isArray(plan.targetUniversities)).toBe(true);
      expect(plan.applicationStrategy).toHaveProperty('portfolioBalance');
      expect(plan.applicationStrategy).toHaveProperty('submissionTiming');
      expect(plan.applicationStrategy).toHaveProperty('prioritization');
      expect(plan.applicationStrategy).toHaveProperty('backupPlans');
    });

    test('should generate automated tasks', async () => {
      const plan = await workflowManager.generateRecommendationPlan(
        mockStudentProfile,
        mockUniversityMatches
      );
      
      const tasks = await workflowManager.generateAutomatedTasks(
        mockStudentProfile,
        plan
      );
      
      expect(tasks).toBeDefined();
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      
      const firstTask = tasks[0];
      expect(firstTask).toHaveProperty('taskId');
      expect(firstTask).toHaveProperty('type');
      expect(firstTask).toHaveProperty('title');
      expect(firstTask).toHaveProperty('description');
      expect(firstTask).toHaveProperty('scheduledFor');
      expect(firstTask).toHaveProperty('dependencies');
      expect(firstTask).toHaveProperty('automationLevel');
      expect(firstTask).toHaveProperty('priority');
      expect(firstTask).toHaveProperty('estimatedDuration');
      expect(firstTask).toHaveProperty('status');
      
      expect(['deadline_reminder', 'content_optimization', 'university_suggestion', 'document_preparation', 'progress_check']).toContain(firstTask.type);
      expect(['full', 'assisted', 'manual']).toContain(firstTask.automationLevel);
      expect(['high', 'medium', 'low']).toContain(firstTask.priority);
      expect(['pending', 'in_progress', 'completed', 'skipped']).toContain(firstTask.status);
    });

    test('should generate milestones', async () => {
      const plan = await workflowManager.generateRecommendationPlan(
        mockStudentProfile,
        mockUniversityMatches
      );
      
      const milestones = await workflowManager.generateMilestones(
        mockStudentProfile,
        plan
      );
      
      expect(milestones).toBeDefined();
      expect(Array.isArray(milestones)).toBe(true);
      expect(milestones.length).toBeGreaterThan(0);
      
      const firstMilestone = milestones[0];
      expect(firstMilestone).toHaveProperty('milestoneId');
      expect(firstMilestone).toHaveProperty('name');
      expect(firstMilestone).toHaveProperty('description');
      expect(firstMilestone).toHaveProperty('targetDate');
      expect(firstMilestone).toHaveProperty('dependencies');
      expect(firstMilestone).toHaveProperty('completionCriteria');
      expect(firstMilestone).toHaveProperty('status');
      expect(firstMilestone).toHaveProperty('progress');
      
      expect(firstMilestone.targetDate instanceof Date).toBe(true);
      expect(Array.isArray(firstMilestone.dependencies)).toBe(true);
      expect(Array.isArray(firstMilestone.completionCriteria)).toBe(true);
      expect(['not_started', 'in_progress', 'completed', 'overdue']).toContain(firstMilestone.status);
      expect(firstMilestone.progress).toBeGreaterThanOrEqual(0);
      expect(firstMilestone.progress).toBeLessThanOrEqual(100);
    });

    test('should generate predictions', async () => {
      const plan = await workflowManager.generateRecommendationPlan(
        mockStudentProfile,
        mockUniversityMatches
      );
      
      const tasks = await workflowManager.generateAutomatedTasks(
        mockStudentProfile,
        plan
      );
      
      const predictions = await workflowManager.generatePredictions(
        mockStudentProfile,
        plan,
        tasks
      );
      
      expect(predictions).toBeDefined();
      expect(predictions).toHaveProperty('completionDate');
      expect(predictions).toHaveProperty('successProbability');
      expect(predictions).toHaveProperty('riskFactors');
      expect(predictions).toHaveProperty('optimizationOpportunities');
      expect(predictions).toHaveProperty('timelineAdjustments');
      
      expect(predictions.completionDate instanceof Date).toBe(true);
      expect(predictions.successProbability).toBeGreaterThanOrEqual(0);
      expect(predictions.successProbability).toBeLessThanOrEqual(1);
      expect(Array.isArray(predictions.riskFactors)).toBe(true);
      expect(Array.isArray(predictions.optimizationOpportunities)).toBe(true);
      expect(Array.isArray(predictions.timelineAdjustments)).toBe(true);
    });

    test('should assess risks', async () => {
      const plan = await workflowManager.generateRecommendationPlan(
        mockStudentProfile,
        mockUniversityMatches
      );
      
      const tasks = await workflowManager.generateAutomatedTasks(
        mockStudentProfile,
        plan
      );
      
      const riskAssessment = await workflowManager.assessRisks(
        mockStudentProfile,
        plan,
        tasks
      );
      
      expect(riskAssessment).toBeDefined();
      expect(riskAssessment).toHaveProperty('overallRisk');
      expect(riskAssessment).toHaveProperty('riskFactors');
      expect(riskAssessment).toHaveProperty('mitigationStrategies');
      expect(riskAssessment).toHaveProperty('monitoringPoints');
      
      expect(['low', 'medium', 'high']).toContain(riskAssessment.overallRisk);
      expect(Array.isArray(riskAssessment.riskFactors)).toBe(true);
      expect(Array.isArray(riskAssessment.mitigationStrategies)).toBe(true);
      expect(Array.isArray(riskAssessment.monitoringPoints)).toBe(true);
    });
  });

  describe('AI Intelligence Service Integration', () => {
    test('should create complete intelligent workflow', async () => {
      const workflow = await aiService.createIntelligentWorkflow(
        mockStudentProfile,
        mockUniversityMatches
      );
      
      expect(workflow).toBeDefined();
      expect(workflow).toHaveProperty('workflowId');
      expect(workflow).toHaveProperty('studentProfile');
      expect(workflow).toHaveProperty('recommendationPlan');
      expect(workflow).toHaveProperty('automatedTasks');
      expect(workflow).toHaveProperty('milestones');
      expect(workflow).toHaveProperty('predictions');
      expect(workflow).toHaveProperty('riskAssessment');
      
      expect(workflow.workflowId).toBeDefined();
      expect(workflow.studentProfile).toEqual(mockStudentProfile);
      expect(Array.isArray(workflow.automatedTasks)).toBe(true);
      expect(Array.isArray(workflow.milestones)).toBe(true);
    });

    test('should optimize recommendation content', async () => {
      const sampleContent = 'John is an excellent student with strong academic performance.';
      
      const optimization = await aiService.optimizeRecommendationContent(
        sampleContent,
        [mockUniversity],
        mockStudentProfile
      );
      
      expect(optimization).toBeDefined();
      expect(optimization).toHaveProperty('originalContent');
      expect(optimization).toHaveProperty('optimizedVersions');
      expect(optimization).toHaveProperty('improvements');
      expect(optimization).toHaveProperty('culturalAdaptations');
      expect(optimization).toHaveProperty('qualityScore');
      
      expect(optimization.originalContent).toBe(sampleContent);
      expect(typeof optimization.optimizedVersions).toBe('object');
      expect(Array.isArray(optimization.improvements)).toBe(true);
      expect(Array.isArray(optimization.culturalAdaptations)).toBe(true);
      expect(optimization.qualityScore).toBeGreaterThanOrEqual(0);
      expect(optimization.qualityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid student profile gracefully', async () => {
      const invalidProfile = { id: 'invalid' };
      
      await expect(
        aiService.generateUniversityRecommendations(invalidProfile as any)
      ).rejects.toThrow();
    });

    test('should handle empty content optimization gracefully', async () => {
      await expect(
        contentOptimizer.analyzeContent('')
      ).rejects.toThrow();
    });

    test('should handle invalid university data gracefully', async () => {
      const invalidUniversity = { id: 'invalid' };
      
      await expect(
        predictiveEngine.predictAdmissionSuccess(mockStudentProfile, invalidUniversity as any)
      ).rejects.toThrow();
    });
  });
});