// StellarRec Shared Types

export interface User {
  id: string;
  email: string;
  role: UserRole;
  profile: StudentProfile | RecommenderProfile | InstitutionProfile;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'student' | 'recommender' | 'institution' | 'admin';

export interface StudentProfile {
  userId: string;
  firstName: string;
  lastName: string;
  gpa?: number;
  graduationYear?: number;
  academicInterests: string[];
  targetPrograms: string[];
  testScores?: TestScores;
  profileData: Record<string, any>;
}

export interface RecommenderProfile {
  userId: string;
  firstName: string;
  lastName: string;
  title?: string;
  institution?: string;
  department?: string;
  expertiseAreas: string[];
  profileData: Record<string, any>;
}

export interface InstitutionProfile {
  userId: string;
  institutionName: string;
  contactEmail: string;
  integrationConfig: UniversityIntegration;
  profileData: Record<string, any>;
}

export interface TestScores {
  sat?: {
    total: number;
    math: number;
    verbal: number;
  };
  gre?: {
    total: number;
    verbal: number;
    quantitative: number;
    analytical: number;
  };
  toefl?: {
    total: number;
    reading: number;
    listening: number;
    speaking: number;
    writing: number;
  };
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'limited';
    dataSharing: boolean;
  };
  language: string;
  timezone: string;
}

export interface University {
  id: string;
  name: string;
  location: {
    city: string;
    state: string;
    country: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  ranking: {
    overall?: number;
    byProgram: Record<string, number>;
  };
  admissionRequirements: {
    minGPA: number;
    testScores: {
      SAT?: { min: number; max: number };
      GRE?: { min: number; max: number };
      TOEFL?: { min: number };
    };
    essays: EssayRequirement[];
    recommendations: number;
  };
  programs: Program[];
  deadlines: Record<string, Date>;
  integrationConfig: UniversityIntegration;
  metadata: Record<string, any>;
}

export interface Program {
  id: string;
  name: string;
  degree: 'bachelor' | 'master' | 'phd' | 'certificate';
  department: string;
  description: string;
  requirements: ProgramRequirements;
  duration: string;
  tuition?: {
    inState?: number;
    outOfState?: number;
    international?: number;
  };
}

export interface ProgramRequirements {
  prerequisites: string[];
  minGPA: number;
  testScores?: TestScores;
  essays: EssayRequirement[];
  recommendations: number;
  portfolio?: boolean;
  interview?: boolean;
}

export interface EssayRequirement {
  id: string;
  title: string;
  prompt: string;
  wordLimit: number;
  required: boolean;
}

export interface UniversityIntegration {
  apiEndpoint?: string;
  authMethod: 'api_key' | 'oauth' | 'basic' | 'none';
  credentials?: Record<string, string>;
  deliveryMethods: DeliveryMethod[];
  dataFormat: 'json' | 'xml' | 'csv' | 'pdf';
}

export type DeliveryMethod = 'api' | 'email' | 'portal' | 'ftp' | 'webhook';

export interface Application {
  id: string;
  studentId: string;
  universityId: string;
  programId: string;
  status: ApplicationStatus;
  components: ApplicationComponent[];
  progressPercentage: number;
  deadline: Date;
  submittedAt?: Date;
  timeline: TimelineEvent[];
  createdAt: Date;
  updatedAt: Date;
}

export type ApplicationStatus = 'draft' | 'in_progress' | 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'waitlisted';

export interface ApplicationComponent {
  id: string;
  applicationId: string;
  componentType: ComponentType;
  status: ComponentStatus;
  data: Record<string, any>;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ComponentType = 'personal_info' | 'academic_history' | 'test_scores' | 'essays' | 'recommendations' | 'portfolio' | 'financial_aid';
export type ComponentStatus = 'pending' | 'in_progress' | 'completed' | 'approved' | 'rejected';

export interface TimelineEvent {
  id: string;
  applicationId: string;
  eventType: string;
  title: string;
  description?: string;
  dueDate?: Date;
  completedAt?: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'completed' | 'overdue';
}

export interface RecommendationLetter {
  id: string;
  studentId: string;
  recommenderId: string;
  title: string;
  content: string;
  status: LetterStatus;
  templateId?: string;
  aiSuggestions: AISuggestion[];
  deliveries: LetterDelivery[];
  collaborators: Collaborator[];
  versions: LetterVersion[];
  createdAt: Date;
  updatedAt: Date;
}

export type LetterStatus = 'draft' | 'in_review' | 'approved' | 'delivered' | 'expired';

export interface AISuggestion {
  id: string;
  type: 'grammar' | 'style' | 'content' | 'structure';
  suggestion: string;
  confidence: number;
  applied: boolean;
  position?: {
    start: number;
    end: number;
  };
}

export interface LetterDelivery {
  id: string;
  letterId: string;
  universityId: string;
  deliveryMethod: DeliveryMethod;
  status: DeliveryStatus;
  deliveredAt?: Date;
  confirmationId?: string;
  errorMessage?: string;
  retryCount: number;
}

export type DeliveryStatus = 'pending' | 'in_transit' | 'delivered' | 'failed' | 'expired';

export interface Collaborator {
  userId: string;
  role: 'editor' | 'reviewer' | 'viewer';
  permissions: string[];
  invitedAt: Date;
  acceptedAt?: Date;
}

export interface LetterVersion {
  id: string;
  letterId: string;
  version: number;
  content: string;
  changes: string;
  createdBy: string;
  createdAt: Date;
}

export interface UniversityMatch {
  universityId: string;
  matchPercentage: number;
  confidence: number;
  reasoning: MatchReasoning;
  category: 'safety' | 'target' | 'reach';
  factors: MatchFactor[];
}

export interface MatchReasoning {
  academicFit: number;
  interestAlignment: number;
  locationPreference: number;
  admissionProbability: number;
  overallScore: number;
}

export interface MatchFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface EssayAnalysis {
  id: string;
  content: string;
  scores: {
    clarity: number;
    impact: number;
    relevance: number;
    grammar: number;
    originality: number;
    overall: number;
  };
  suggestions: EssaySuggestion[];
  wordCount: number;
  readabilityScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  keyTopics: string[];
}

export interface EssaySuggestion {
  type: 'grammar' | 'style' | 'content' | 'structure' | 'vocabulary';
  message: string;
  severity: 'low' | 'medium' | 'high';
  position?: {
    start: number;
    end: number;
  };
  replacement?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    timestamp: string;
    requestId: string;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  search?: string;
  filters?: Record<string, any>;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Error Types
export class APIError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export enum ErrorCodes {
  // Authentication
  INVALID_CREDENTIALS = 'AUTH_001',
  TOKEN_EXPIRED = 'AUTH_002',
  INSUFFICIENT_PERMISSIONS = 'AUTH_003',
  
  // Validation
  INVALID_INPUT = 'VAL_001',
  MISSING_REQUIRED_FIELD = 'VAL_002',
  INVALID_FORMAT = 'VAL_003',
  
  // Business Logic
  APPLICATION_DEADLINE_PASSED = 'BIZ_001',
  LETTER_ALREADY_SUBMITTED = 'BIZ_002',
  UNIVERSITY_NOT_FOUND = 'BIZ_003',
  
  // System
  INTERNAL_SERVER_ERROR = 'SYS_001',
  SERVICE_UNAVAILABLE = 'SYS_002',
  RATE_LIMIT_EXCEEDED = 'SYS_003'
}