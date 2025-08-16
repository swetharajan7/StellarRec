import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

export interface StudentProfile {
  id: string;
  academic: {
    gpa: number;
    gpaScale: number;
    testScores: {
      sat?: { total: number; ebrw: number; math: number };
      act?: { composite: number; english: number; math: number; reading: number; science: number };
      gre?: { verbal: number; quantitative: number; analytical: number };
      toefl?: { total: number; reading: number; listening: number; speaking: number; writing: number };
      ielts?: { total: number; listening: number; reading: number; writing: number; speaking: number };
    };
    courseRigor: {
      apCourses: number;
      ibCourses: number;
      honorsCourses: number;
      dualEnrollment: number;
      advancedMath: boolean;
      advancedScience: boolean;
      foreignLanguageYears: number;
    };
    currentInstitution: string;
    major: string;
    graduationDate: Date;
  };
  preferences: {
    location: {
      preferredCountries: string[];
      preferredStates?: string[];
      maxDistanceFromHome?: number;
      urbanPreference: number;
    };
    campusSize: 'small' | 'medium' | 'large' | 'any';
    campusType: 'urban' | 'suburban' | 'rural' | 'any';
    climate: 'cold' | 'temperate' | 'warm' | 'any';
    diversity: 'high' | 'medium' | 'low' | 'any';
    socialScene: 'party' | 'balanced' | 'academic' | 'any';
    religiousAffiliation: string | null;
    coed: boolean;
  };
  background: {
    demographics: {
      ethnicity: string[];
      firstGeneration: boolean;
      legacy: boolean;
      internationalStudent: boolean;
      countryOfBirth: string;
      citizenship: string;
      languages: string[];
    };
    socioeconomic: {
      familyIncome: number;
      parentsEducation: string[];
      financialAidNeeded: boolean;
      workStudyInterest: boolean;
      scholarshipInterest: boolean;
    };
    extracurriculars: ExtracurricularActivity[];
    workExperience: WorkExperience[];
    volunteering: VolunteerExperience[];
    achievements: Achievement[];
    specialCircumstances: string[];
  };
  goals: {
    intendedMajor: string;
    alternativeMajors: string[];
    careerInterests: string[];
    graduateSchoolPlans: boolean;
    professionalGoals: string;
    researchInterests: string[];
  };
  timeline: {
    targetApplicationDate: Date;
    preferredStartDate: Date;
    flexibilityMonths: number;
    earlyDecisionInterest: boolean;
    gapYearConsideration: boolean;
  };
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

export interface UniversityMatch {
  university: University;
  matchScore: number;
  admissionProbability: number;
  reasoning: {
    strengths: string[];
    concerns: string[];
    improvements: string[];
    keyFactors: string[];
  };
  recommendations: string[];
  financialFit: {
    tuitionAffordability: number;
    scholarshipProbability: number;
    totalCostScore: number;
    financialAidEligibility: number;
    returnOnInvestment: number;
  };
  culturalFit: {
    locationMatch: number;
    campusSizeMatch: number;
    diversityMatch: number;
    socialEnvironmentMatch: number;
    overallCulturalFit: number;
  };
  academicFit: {
    gpaMatch: number;
    testScoreMatch: number;
    courseRigorMatch: number;
    majorPreparation: number;
    overallAcademicFit: number;
  };
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

export interface RealTimeInsights {
  opportunities: string[];
  risks: string[];
  recommendations: string[];
  marketTrends: string[];
  personalizedTips: string[];
}

export interface SuccessPrediction {
  admissionProbability: number;
  confidenceInterval: [number, number];
  keyFactors: string[];
  improvements: string[];
  timeline: Date;
}

export interface IntelligentWorkflow {
  workflowId: string;
  studentProfile: StudentProfile;
  recommendationPlan: any;
  automatedTasks: AutomatedTask[];
  milestones: WorkflowMilestone[];
  predictions: any;
  riskAssessment: any;
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

export interface ContentAnalysis {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  readabilityScore: number;
  keywordDensity: Record<string, number>;
  tone: 'formal' | 'informal' | 'academic' | 'personal';
  sentiment: 'positive' | 'neutral' | 'negative';
  strengths: string[];
  weaknesses: string[];
}

export interface PortfolioAnalysis {
  overallSuccessProbability: number;
  expectedAcceptances: number;
  portfolioRisk: 'low' | 'medium' | 'high';
  balanceAnalysis: any;
  optimizations: string[];
  individualPredictions: Array<{
    university: University;
    prediction: SuccessPrediction;
  }>;
}

export interface ScholarshipAnalysis {
  totalExpectedAid: number;
  scholarshipProbabilities: any[];
  recommendations: string[];
  applicationDeadlines: Array<{
    name: string;
    deadline: Date;
    priority: 'high' | 'medium' | 'low';
  }>;
}

export interface TimingRecommendation {
  university: University;
  optimalSubmissionDate: Date;
  successProbability: number;
  reasoning: string;
}

class AIIntelligenceService {
  private apiClient = axios.create({
    baseURL: `${API_BASE_URL}/ai-intelligence`,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  constructor() {
    // Add request interceptor for authentication
    this.apiClient.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('AI Intelligence API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate intelligent university recommendations
   */
  async generateUniversityRecommendations(studentProfile: StudentProfile): Promise<UniversityMatch[]> {
    try {
      const response = await this.apiClient.post('/university-recommendations', {
        studentProfile,
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to generate university recommendations:', error);
      throw new Error('Failed to generate university recommendations');
    }
  }

  /**
   * Optimize content for specific universities
   */
  async optimizeContent(
    content: string,
    targetUniversities: University[],
    studentProfile: StudentProfile
  ): Promise<ContentOptimization> {
    try {
      const response = await this.apiClient.post('/content-optimization', {
        content,
        targetUniversities,
        studentProfile,
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to optimize content:', error);
      throw new Error('Failed to optimize content');
    }
  }

  /**
   * Create intelligent workflow
   */
  async createIntelligentWorkflow(
    studentProfile: StudentProfile,
    targetUniversities: UniversityMatch[]
  ): Promise<IntelligentWorkflow> {
    try {
      const response = await this.apiClient.post('/intelligent-workflow', {
        studentProfile,
        targetUniversities,
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to create intelligent workflow:', error);
      throw new Error('Failed to create intelligent workflow');
    }
  }

  /**
   * Predict admission success
   */
  async predictAdmissionSuccess(
    studentProfile: StudentProfile,
    university: University
  ): Promise<SuccessPrediction> {
    try {
      const response = await this.apiClient.post('/admission-prediction', {
        studentProfile,
        university,
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to predict admission success:', error);
      throw new Error('Failed to predict admission success');
    }
  }

  /**
   * Get real-time insights
   */
  async getRealTimeInsights(studentId: string): Promise<RealTimeInsights> {
    try {
      const response = await this.apiClient.get(`/real-time-insights/${studentId}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get real-time insights:', error);
      throw new Error('Failed to get real-time insights');
    }
  }

  /**
   * Analyze application portfolio
   */
  async analyzePortfolio(
    studentProfile: StudentProfile,
    universities: University[]
  ): Promise<PortfolioAnalysis> {
    try {
      const response = await this.apiClient.post('/portfolio-analysis', {
        studentProfile,
        universities,
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to analyze portfolio:', error);
      throw new Error('Failed to analyze portfolio');
    }
  }

  /**
   * Analyze scholarship opportunities
   */
  async analyzeScholarships(
    studentProfile: StudentProfile,
    university: University
  ): Promise<ScholarshipAnalysis> {
    try {
      const response = await this.apiClient.post('/scholarship-analysis', {
        studentProfile,
        university,
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to analyze scholarships:', error);
      throw new Error('Failed to analyze scholarships');
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<IntelligentWorkflow> {
    try {
      const response = await this.apiClient.get(`/workflow/${workflowId}`);
      return response.data.data;
    } catch (error) {
      console.error('Failed to get workflow:', error);
      throw new Error('Failed to get workflow');
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(
    workflowId: string,
    taskId: string,
    status: string,
    progress?: number
  ): Promise<void> {
    try {
      await this.apiClient.put(`/workflow/${workflowId}/tasks`, {
        taskId,
        status,
        progress,
      });
    } catch (error) {
      console.error('Failed to update task status:', error);
      throw new Error('Failed to update task status');
    }
  }

  /**
   * Analyze content quality
   */
  async analyzeContent(content: string): Promise<ContentAnalysis> {
    try {
      const response = await this.apiClient.post('/content-analysis', {
        content,
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to analyze content:', error);
      throw new Error('Failed to analyze content');
    }
  }

  /**
   * Optimize application timing
   */
  async optimizeTiming(
    studentProfile: StudentProfile,
    universities: University[]
  ): Promise<TimingRecommendation[]> {
    try {
      const response = await this.apiClient.post('/timing-optimization', {
        studentProfile,
        universities,
      });
      return response.data.data;
    } catch (error) {
      console.error('Failed to optimize timing:', error);
      throw new Error('Failed to optimize timing');
    }
  }
}

export default new AIIntelligenceService();