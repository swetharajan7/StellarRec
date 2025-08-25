"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonAppAdapter = void 0;
const UniversityAdapter_1 = require("./UniversityAdapter");
const logger_1 = require("../../logger");
const axios_1 = __importDefault(require("axios"));
class CommonAppAdapter extends UniversityAdapter_1.UniversityAdapter {
    constructor(authManager, rateLimiter) {
        super(authManager, rateLimiter);
        this.logger = new logger_1.Logger('CommonAppAdapter');
        this.BASE_URL = 'https://api.commonapp.org/v2';
        this.httpClient = axios_1.default.create({
            baseURL: this.BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'StellarRec/1.0'
            }
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.httpClient.interceptors.request.use(async (config) => {
            const auth = await this.authManager.getCredentials('commonapp');
            if (auth?.apiKey) {
                config.headers['Authorization'] = `Bearer ${auth.apiKey}`;
            }
            return config;
        });
        this.httpClient.interceptors.response.use((response) => response, (error) => {
            this.logger.error('CommonApp API error:', {
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url
            });
            return Promise.reject(error);
        });
    }
    async submit(data) {
        try {
            await this.rateLimiter.checkRateLimit('commonapp', data.university.universityId);
            const commonAppPayload = this.transformToCommonAppFormat(data);
            this.logger.info(`Submitting recommendation to CommonApp for ${data.university.universityCode}`);
            const response = await this.httpClient.post('/recommendations', commonAppPayload);
            if (response.status === 201 || response.status === 200) {
                return {
                    status: 'success',
                    submissionId: response.data.recommendation_id,
                    confirmationCode: response.data.confirmation_code,
                    metadata: {
                        commonAppId: response.data.recommendation_id,
                        submittedAt: response.data.submitted_at,
                        universityNotified: response.data.university_notified,
                        trackingUrl: response.data.tracking_url
                    }
                };
            }
            else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        }
        catch (error) {
            this.logger.error(`CommonApp submission failed for ${data.university.universityCode}:`, error);
            const isRetryable = this.isRetryableError(error);
            return {
                status: isRetryable ? 'retry' : 'failed',
                errorMessage: error.message,
                metadata: {
                    errorCode: error.response?.status,
                    errorDetails: error.response?.data,
                    isRetryable
                }
            };
        }
    }
    async getSubmissionStatus(submissionId) {
        try {
            const response = await this.httpClient.get(`/recommendations/${submissionId}/status`);
            return {
                status: this.mapCommonAppStatus(response.data.status),
                lastUpdated: new Date(response.data.last_updated),
                universityStatus: response.data.university_status,
                metadata: {
                    commonAppStatus: response.data.status,
                    universityReceived: response.data.university_received,
                    processingStage: response.data.processing_stage,
                    trackingUrl: response.data.tracking_url
                }
            };
        }
        catch (error) {
            this.logger.error(`Failed to get CommonApp status for ${submissionId}:`, error);
            throw error;
        }
    }
    async testConnection(config) {
        try {
            const response = await this.httpClient.get('/health');
            if (response.status !== 200) {
                throw new Error(`Health check failed with status ${response.status}`);
            }
        }
        catch (error) {
            throw new Error(`CommonApp connection test failed: ${error.message}`);
        }
    }
    transformToCommonAppFormat(data) {
        return {
            applicant: {
                common_app_id: data.student.id,
                first_name: data.student.firstName,
                last_name: data.student.lastName,
                email: data.student.email,
                date_of_birth: data.student.dateOfBirth.toISOString().split('T')[0],
                address: {
                    street: data.student.address.street,
                    city: data.student.address.city,
                    state: data.student.address.state,
                    postal_code: data.student.address.zipCode,
                    country: data.student.address.country
                }
            },
            recommender: {
                first_name: data.recommender.firstName,
                last_name: data.recommender.lastName,
                title: data.recommender.title,
                institution: data.recommender.institution,
                email: data.recommender.email,
                phone: data.recommender.phone,
                relationship: data.recommender.relationship,
                years_known: data.recommender.yearsKnown
            },
            application: {
                university_code: data.university.universityCode,
                program_type: data.university.programType,
                application_deadline: data.university.applicationDeadline.toISOString(),
                entry_term: this.determineEntryTerm(data.university.applicationDeadline),
                specific_requirements: data.university.specificRequirements || {}
            },
            recommendation: {
                content: data.recommendation.content,
                word_count: data.recommendation.wordCount,
                program_specific_content: data.recommendation.customizations,
                rating_scales: this.generateRatingScales(data),
                additional_comments: data.recommendation.customizations?.additional_comments
            },
            submission_metadata: {
                source_platform: 'StellarRec',
                submission_type: data.metadata.submissionType,
                priority: data.metadata.priority,
                version: data.metadata.version,
                submitted_via: 'api'
            }
        };
    }
    generateRatingScales(data) {
        return {
            academic_achievement: 'excellent',
            intellectual_promise: 'excellent',
            quality_of_writing: 'excellent',
            creative_original_thought: 'very_good',
            productive_class_discussion: 'excellent',
            respect_accorded_by_faculty: 'excellent',
            disciplined_work_habits: 'excellent',
            maturity: 'excellent',
            motivation: 'excellent',
            leadership: 'very_good',
            integrity: 'excellent',
            reaction_to_setbacks: 'good',
            concern_for_others: 'excellent',
            self_confidence: 'excellent',
            initiative_independence: 'very_good',
            overall_rating: 'excellent'
        };
    }
    determineEntryTerm(deadline) {
        const month = deadline.getMonth() + 1;
        if (month >= 1 && month <= 5) {
            return `Fall ${deadline.getFullYear()}`;
        }
        else if (month >= 6 && month <= 8) {
            return `Spring ${deadline.getFullYear() + 1}`;
        }
        else {
            return `Fall ${deadline.getFullYear() + 1}`;
        }
    }
    mapCommonAppStatus(commonAppStatus) {
        const statusMap = {
            'submitted': 'pending',
            'processing': 'pending',
            'delivered': 'success',
            'received_by_university': 'success',
            'failed': 'failed',
            'rejected': 'failed',
            'incomplete': 'pending',
            'under_review': 'pending'
        };
        return statusMap[commonAppStatus] || 'pending';
    }
    isRetryableError(error) {
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return true;
        }
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return error.response && retryableStatuses.includes(error.response.status);
    }
    async getSupportedUniversities() {
        try {
            const response = await this.httpClient.get('/universities');
            return response.data.universities.map((uni) => ({
                code: uni.code,
                name: uni.name,
                country: uni.country,
                programTypes: uni.supported_programs || ['undergraduate']
            }));
        }
        catch (error) {
            this.logger.error('Failed to get CommonApp supported universities:', error);
            return [];
        }
    }
    async validateUniversitySupport(universityCode, programType) {
        try {
            const response = await this.httpClient.get(`/universities/${universityCode}/requirements`);
            const supportsProgram = response.data.supported_programs.includes(programType);
            return {
                supported: supportsProgram,
                requirements: response.data.recommendation_requirements,
                deadlines: response.data.application_deadlines
            };
        }
        catch (error) {
            this.logger.error(`Failed to validate CommonApp support for ${universityCode}:`, error);
            return { supported: false };
        }
    }
    async bulkSubmit(submissions) {
        try {
            const batchPayload = {
                recommendations: submissions.map(data => this.transformToCommonAppFormat(data))
            };
            const response = await this.httpClient.post('/recommendations/batch', batchPayload);
            return response.data.results.map((result, index) => ({
                status: result.success ? 'success' : 'failed',
                submissionId: result.recommendation_id,
                confirmationCode: result.confirmation_code,
                errorMessage: result.error_message,
                metadata: {
                    batchId: response.data.batch_id,
                    originalIndex: index,
                    ...result.metadata
                }
            }));
        }
        catch (error) {
            this.logger.error('CommonApp bulk submission failed:', error);
            return submissions.map(() => ({
                status: 'failed',
                errorMessage: error.message,
                metadata: { bulkSubmissionFailed: true }
            }));
        }
    }
}
exports.CommonAppAdapter = CommonAppAdapter;
//# sourceMappingURL=CommonAppAdapter.js.map