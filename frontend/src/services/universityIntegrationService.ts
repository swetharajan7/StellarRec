import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

export interface University {
  id: string;
  name: string;
  code: string;
  country: 'US' | 'CA';
  state?: string;
  province?: string;
  integrationType: string;
  features: {
    realTimeStatus: boolean;
    bulkSubmission: boolean;
    documentUpload: boolean;
    statusWebhooks: boolean;
    customFields: boolean;
  };
  requirements: {
    requiredFields: string[];
    optionalFields: string[];
    maxRecommendationLength: number;
    supportedPrograms: string[];
    deadlineBuffer: number;
  };
  institutionType: string;
  isPublic: boolean;
  websiteUrl: string;
}

export interface SubmissionRequest {
  recommendationId: string;
  studentData: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth: Date;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    academicInfo: {
      currentInstitution: string;
      gpa: number;
      graduationDate: Date;
      major: string;
      testScores?: {
        gre?: { verbal: number; quantitative: number; analytical: number };
        gmat?: { total: number; verbal: number; quantitative: number };
        toefl?: { total: number };
        ielts?: { total: number };
      };
    };
  };
  recommenderData: {
    id: string;
    firstName: string;
    lastName: string;
    title: string;
    institution: string;
    email: string;
    phone?: string;
    relationship: string;
    yearsKnown: number;
  };
  recommendationContent: {
    content: string;
    wordCount: number;
    programType: string;
    customizations: Record<string, string>;
  };
  universities: {
    universityId: string;
    universityCode: string;
    programType: string;
    applicationDeadline: Date;
    specificRequirements?: Record<string, any>;
  }[];
  metadata: {
    submissionType: string;
    priority: string;
    deadline: Date;
    source: string;
    version: string;
  };
}

export interface SubmissionResult {
  universityId: string;
  status: 'success' | 'failed' | 'pending' | 'retry';
  submissionId?: string;
  confirmationCode?: string;
  errorMessage?: string;
  retryAfter?: Date;
  metadata: Record<string, any>;
}

export interface BulkSubmissionResult {
  recommendationId: string;
  totalUniversities: number;
  successful: number;
  failed: number;
  pending: number;
  results: SubmissionResult[];
  overallStatus: 'completed' | 'partial' | 'failed';
}

export interface SubmissionStatus {
  universityId: string;
  universityName: string;
  universityCode: string;
  integrationType: string;
  status: 'pending' | 'submitted' | 'processing' | 'delivered' | 'confirmed' | 'failed' | 'retry';
  submittedAt: string;
  confirmedAt?: string;
  errorMessage?: string;
  retryCount?: number;
  nextRetryAt?: string;
  metadata: Record<string, any>;
}

export interface IntegrationStatistics {
  totalUniversities: number;
  byIntegrationType: Record<string, number>;
  byCountry: Record<string, number>;
  byState: Record<string, number>;
}

export interface SubmissionStatistics {
  totalSubmissions: number;
  successfulSubmissions: number;
  failedSubmissions: number;
  pendingSubmissions: number;
  successRate: number;
  byIntegrationType: Record<string, {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  }>;
  byStatus: Record<string, number>;
}

class UniversityIntegrationService {
  private apiClient = axios.create({
    baseURL: `${API_BASE_URL}/university-integration`,
    timeout: 30000,
  });

  constructor() {
    // Add auth token to requests
    this.apiClient.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle responses
    this.apiClient.interceptors.response.use(
      (response) => response.data,
      (error) => {
        console.error('API Error:', error);
        throw error.response?.data || error;
      }
    );
  }

  /**
   * Search universities with filters
   */
  async searchUniversities(filters: {
    search?: string;
    country?: 'US' | 'CA';
    state?: string;
    province?: string;
    integrationType?: string;
    programType?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ universities: University[]; total: number }> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const response = await this.apiClient.get(`/universities/search?${params}`);
    return response.data;
  }

  /**
   * Get universities by integration type
   */
  async getUniversitiesByIntegrationType(integrationType: string): Promise<University[]> {
    const response = await this.apiClient.get(`/universities/integration-type/${integrationType}`);
    return response.data;
  }

  /**
   * Get universities by location
   */
  async getUniversitiesByLocation(
    country: 'US' | 'CA',
    state?: string,
    province?: string
  ): Promise<University[]> {
    const params = new URLSearchParams();
    if (state) params.append('state', state);
    if (province) params.append('province', province);

    const response = await this.apiClient.get(`/universities/location/${country}?${params}`);
    return response.data;
  }

  /**
   * Submit recommendation to multiple universities
   */
  async submitToUniversities(request: SubmissionRequest): Promise<BulkSubmissionResult> {
    const response = await this.apiClient.post('/submit', request);
    return response.data;
  }

  /**
   * Get submission status for a recommendation
   */
  async getSubmissionStatus(recommendationId: string): Promise<SubmissionStatus[]> {
    const response = await this.apiClient.get(`/status/${recommendationId}`);
    return response.data;
  }

  /**
   * Retry failed submissions
   */
  async retryFailedSubmissions(recommendationId: string): Promise<BulkSubmissionResult> {
    const response = await this.apiClient.post(`/retry/${recommendationId}`);
    return response.data;
  }

  /**
   * Get integration statistics
   */
  async getIntegrationStatistics(): Promise<IntegrationStatistics> {
    const response = await this.apiClient.get('/statistics/integrations');
    return response.data;
  }

  /**
   * Get submission statistics
   */
  async getSubmissionStatistics(filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    integrationType?: string;
    universityId?: string;
  }): Promise<SubmissionStatistics> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (value instanceof Date) {
            params.append(key, value.toISOString());
          } else {
            params.append(key, value.toString());
          }
        }
      });
    }

    const response = await this.apiClient.get(`/statistics/submissions?${params}`);
    return response.data;
  }

  /**
   * Get integration health status
   */
  async getIntegrationHealth(): Promise<{
    overall: string;
    integrations: Record<string, string>;
    timestamp: string;
  }> {
    const response = await this.apiClient.get('/health');
    return response.data;
  }

  /**
   * Test university connection (Admin only)
   */
  async testUniversityConnection(universityId: string): Promise<{
    success: boolean;
    responseTime: number;
    error?: string;
  }> {
    const response = await this.apiClient.get(`/admin/universities/${universityId}/test`);
    return response.data;
  }

  /**
   * Get rate limit status (Admin only)
   */
  async getRateLimitStatus(integrationType: string, universityId?: string): Promise<{
    minute: { current: number; limit: number; resetTime: Date };
    hour: { current: number; limit: number; resetTime: Date };
    day: { current: number; limit: number; resetTime: Date };
  }> {
    const params = universityId ? `?universityId=${universityId}` : '';
    const response = await this.apiClient.get(`/admin/rate-limits/${integrationType}${params}`);
    return response.data;
  }

  /**
   * Reset rate limits (Admin only)
   */
  async resetRateLimits(integrationType: string, universityId?: string): Promise<void> {
    await this.apiClient.post(`/admin/rate-limits/${integrationType}/reset`, {
      universityId
    });
  }

  /**
   * Update university integration configuration (Admin only)
   */
  async updateUniversityIntegration(universityId: string, config: Partial<University>): Promise<void> {
    await this.apiClient.put(`/admin/universities/${universityId}/integration`, config);
  }

  /**
   * Validate credentials (Admin only)
   */
  async validateCredentials(integrationType: string): Promise<{
    valid: boolean;
    error?: string;
    expiresAt?: Date;
  }> {
    const response = await this.apiClient.get(`/admin/credentials/${integrationType}/validate`);
    return response.data;
  }

  /**
   * Store credentials (Admin only)
   */
  async storeCredentials(integrationType: string, credentials: Record<string, any>): Promise<void> {
    await this.apiClient.post(`/admin/credentials/${integrationType}`, credentials);
  }

  /**
   * Get credentials needing rotation (Admin only)
   */
  async getCredentialsNeedingRotation(): Promise<Array<{
    integrationType: string;
    lastRotated: Date;
    expiresAt?: Date;
  }>> {
    const response = await this.apiClient.get('/admin/credentials/rotation-needed');
    return response.data;
  }

  /**
   * Rotate credentials (Admin only)
   */
  async rotateCredentials(integrationType: string): Promise<void> {
    await this.apiClient.post(`/admin/credentials/${integrationType}/rotate`);
  }

  /**
   * Bulk load universities (Admin only)
   */
  async bulkLoadUniversities(universities: Partial<University>[]): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const response = await this.apiClient.post('/admin/universities/bulk-load', {
      universities
    });
    return response.data;
  }

  /**
   * Get performance metrics (Admin only)
   */
  async getPerformanceMetrics(): Promise<{
    averageResponseTime: number;
    successRate: number;
    totalSubmissions: number;
    activeIntegrations: number;
    uptime: string;
  }> {
    const response = await this.apiClient.get('/metrics/performance');
    return response.data;
  }

  /**
   * Get usage metrics (Admin only)
   */
  async getUsageMetrics(): Promise<Record<string, {
    requests: number;
    successRate: number;
  }>> {
    const response = await this.apiClient.get('/metrics/usage');
    return response.data;
  }
}

export const universityIntegrationService = new UniversityIntegrationService();