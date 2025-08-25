"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversityIntegrationHub = void 0;
const logger_1 = require("../logger");
const CommonAppAdapter_1 = require("./adapters/CommonAppAdapter");
const CoalitionAppAdapter_1 = require("./adapters/CoalitionAppAdapter");
const UCSystemAdapter_1 = require("./adapters/UCSystemAdapter");
const OUACAdapter_1 = require("./adapters/OUACAdapter");
const EmailAdapter_1 = require("./adapters/EmailAdapter");
const UniversityRegistry_1 = require("./UniversityRegistry");
const SubmissionTracker_1 = require("./SubmissionTracker");
const RateLimiter_1 = require("./RateLimiter");
const AuthenticationManager_1 = require("./AuthenticationManager");
class UniversityIntegrationHub {
    constructor() {
        this.logger = new logger_1.Logger('UniversityIntegrationHub');
        this.adapters = new Map();
        this.registry = new UniversityRegistry_1.UniversityRegistry();
        this.tracker = new SubmissionTracker_1.SubmissionTracker();
        this.rateLimiter = new RateLimiter_1.RateLimiter();
        this.authManager = new AuthenticationManager_1.AuthenticationManager();
        this.initializeAdapters();
    }
    initializeAdapters() {
        this.registerAdapter('commonapp', new CommonAppAdapter_1.CommonAppAdapter(this.authManager, this.rateLimiter));
        this.registerAdapter('coalition', new CoalitionAppAdapter_1.CoalitionAppAdapter(this.authManager, this.rateLimiter));
        this.registerAdapter('uc_system', new UCSystemAdapter_1.UCSystemAdapter(this.authManager, this.rateLimiter));
        this.registerAdapter('ouac', new OUACAdapter_1.OUACAdapter(this.authManager, this.rateLimiter));
        this.registerAdapter('email', new EmailAdapter_1.EmailAdapter(this.authManager, this.rateLimiter));
        this.logger.info(`Initialized ${this.adapters.size} university adapters`);
    }
    registerAdapter(type, adapter) {
        this.adapters.set(type, adapter);
    }
    async submitToUniversities(request) {
        this.logger.info(`Starting bulk submission for recommendation ${request.recommendationId} to ${request.universities.length} universities`);
        const results = [];
        let successful = 0;
        let failed = 0;
        let pending = 0;
        const concurrencyLimit = 5;
        const chunks = this.chunkArray(request.universities, concurrencyLimit);
        for (const chunk of chunks) {
            const chunkPromises = chunk.map(university => this.submitToSingleUniversity(request, university));
            const chunkResults = await Promise.allSettled(chunkPromises);
            for (const result of chunkResults) {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                    switch (result.value.status) {
                        case 'success':
                            successful++;
                            break;
                        case 'failed':
                            failed++;
                            break;
                        case 'pending':
                        case 'retry':
                            pending++;
                            break;
                    }
                }
                else {
                    failed++;
                    results.push({
                        universityId: 'unknown',
                        status: 'failed',
                        errorMessage: result.reason?.message || 'Unknown error',
                        metadata: {}
                    });
                }
            }
            if (chunks.indexOf(chunk) < chunks.length - 1) {
                await this.delay(1000);
            }
        }
        const bulkResult = {
            recommendationId: request.recommendationId,
            totalUniversities: request.universities.length,
            successful,
            failed,
            pending,
            results,
            overallStatus: failed === 0 ? 'completed' : (successful > 0 ? 'partial' : 'failed')
        };
        await this.tracker.storeBulkSubmissionResult(bulkResult);
        this.logger.info(`Bulk submission completed: ${successful} successful, ${failed} failed, ${pending} pending`);
        return bulkResult;
    }
    async submitToSingleUniversity(request, university) {
        try {
            const universityConfig = await this.registry.getUniversityConfig(university.universityId);
            if (!universityConfig) {
                throw new Error(`University configuration not found: ${university.universityId}`);
            }
            await this.rateLimiter.checkRateLimit(universityConfig.integrationType, university.universityId);
            const adapter = this.getAdapter(universityConfig.integrationType);
            if (!adapter) {
                throw new Error(`No adapter available for integration type: ${universityConfig.integrationType}`);
            }
            const submissionData = await this.prepareSubmissionData(request, university, universityConfig);
            this.logger.info(`Submitting to ${university.universityCode} via ${universityConfig.integrationType}`);
            const result = await adapter.submit(submissionData);
            await this.tracker.trackSubmission({
                recommendationId: request.recommendationId,
                universityId: university.universityId,
                submissionId: result.submissionId,
                status: result.status,
                submittedAt: new Date(),
                metadata: result.metadata
            });
            return {
                universityId: university.universityId,
                status: result.status,
                submissionId: result.submissionId,
                confirmationCode: result.confirmationCode,
                metadata: result.metadata
            };
        }
        catch (error) {
            this.logger.error(`Submission failed for ${university.universityCode}:`, error);
            return {
                universityId: university.universityId,
                status: 'failed',
                errorMessage: error.message,
                metadata: { error: error.stack }
            };
        }
    }
    async getSubmissionStatus(recommendationId) {
        return await this.tracker.getSubmissionsByRecommendation(recommendationId);
    }
    async retryFailedSubmissions(recommendationId) {
        const failedSubmissions = await this.tracker.getFailedSubmissions(recommendationId);
        if (failedSubmissions.length === 0) {
            throw new Error('No failed submissions found for retry');
        }
        const universities = [];
        for (const submission of failedSubmissions) {
            const universityConfig = await this.registry.getUniversityConfig(submission.universityId);
            if (universityConfig) {
                universities.push({
                    universityId: submission.universityId,
                    universityCode: universityConfig.code,
                    programType: submission.metadata.programType || 'graduate',
                    applicationDeadline: new Date(submission.metadata.deadline || Date.now() + 30 * 24 * 60 * 60 * 1000),
                });
            }
        }
        const originalRequest = await this.tracker.getOriginalRequest(recommendationId);
        return await this.submitToUniversities({
            ...originalRequest,
            universities
        });
    }
    getAdapter(integrationType) {
        return this.adapters.get(integrationType);
    }
    async prepareSubmissionData(request, university, config) {
        return {
            student: request.studentData,
            recommender: request.recommenderData,
            recommendation: request.recommendationContent,
            university: university,
            config: config,
            metadata: request.metadata
        };
    }
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    async getIntegrationStats() {
        return await this.registry.getIntegrationStatistics();
    }
    async testUniversityConnection(universityId) {
        const startTime = Date.now();
        try {
            const config = await this.registry.getUniversityConfig(universityId);
            if (!config) {
                throw new Error('University configuration not found');
            }
            const adapter = this.getAdapter(config.integrationType);
            if (!adapter) {
                throw new Error('No adapter available');
            }
            await adapter.testConnection(config);
            return {
                success: true,
                responseTime: Date.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                responseTime: Date.now() - startTime,
                error: error.message
            };
        }
    }
}
exports.UniversityIntegrationHub = UniversityIntegrationHub;
//# sourceMappingURL=UniversityIntegrationHub.js.map