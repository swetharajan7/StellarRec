"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversityIntegrationController = void 0;
const logger_1 = require("../services/logger");
const UniversityIntegrationHub_1 = require("../services/universityIntegration/UniversityIntegrationHub");
const UniversityRegistry_1 = require("../services/universityIntegration/UniversityRegistry");
const SubmissionTracker_1 = require("../services/universityIntegration/SubmissionTracker");
const RateLimiter_1 = require("../services/universityIntegration/RateLimiter");
const AuthenticationManager_1 = require("../services/universityIntegration/AuthenticationManager");
class UniversityIntegrationController {
    constructor() {
        this.logger = new logger_1.Logger('UniversityIntegrationController');
        this.integrationHub = new UniversityIntegrationHub_1.UniversityIntegrationHub();
        this.registry = new UniversityRegistry_1.UniversityRegistry();
        this.tracker = new SubmissionTracker_1.SubmissionTracker();
        this.rateLimiter = new RateLimiter_1.RateLimiter();
        this.authManager = new AuthenticationManager_1.AuthenticationManager();
    }
    async submitToUniversities(req, res) {
        try {
            const submissionRequest = req.body;
            if (!submissionRequest.recommendationId || !submissionRequest.universities?.length) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: recommendationId and universities'
                });
                return;
            }
            this.logger.info(`Processing bulk submission for recommendation ${submissionRequest.recommendationId}`);
            const result = await this.integrationHub.submitToUniversities(submissionRequest);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            this.logger.error('Bulk submission failed:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getSubmissionStatus(req, res) {
        try {
            const { recommendationId } = req.params;
            if (!recommendationId) {
                res.status(400).json({
                    success: false,
                    error: 'Recommendation ID is required'
                });
                return;
            }
            const submissions = await this.integrationHub.getSubmissionStatus(recommendationId);
            res.json({
                success: true,
                data: submissions
            });
        }
        catch (error) {
            this.logger.error(`Failed to get submission status for ${req.params.recommendationId}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async retryFailedSubmissions(req, res) {
        try {
            const { recommendationId } = req.params;
            if (!recommendationId) {
                res.status(400).json({
                    success: false,
                    error: 'Recommendation ID is required'
                });
                return;
            }
            const result = await this.integrationHub.retryFailedSubmissions(recommendationId);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            this.logger.error(`Failed to retry submissions for ${req.params.recommendationId}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getIntegrationStatistics(req, res) {
        try {
            const stats = await this.integrationHub.getIntegrationStats();
            res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            this.logger.error('Failed to get integration statistics:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async testUniversityConnection(req, res) {
        try {
            const { universityId } = req.params;
            if (!universityId) {
                res.status(400).json({
                    success: false,
                    error: 'University ID is required'
                });
                return;
            }
            const result = await this.integrationHub.testUniversityConnection(universityId);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            this.logger.error(`Failed to test connection for university ${req.params.universityId}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async searchUniversities(req, res) {
        try {
            const filters = {
                search: req.query.search,
                country: req.query.country,
                state: req.query.state,
                province: req.query.province,
                integrationType: req.query.integrationType,
                programType: req.query.programType,
                isActive: req.query.isActive === 'true',
                limit: parseInt(req.query.limit) || 50,
                offset: parseInt(req.query.offset) || 0
            };
            const result = await this.registry.searchUniversities(filters);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            this.logger.error('Failed to search universities:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getUniversitiesByIntegrationType(req, res) {
        try {
            const { integrationType } = req.params;
            if (!integrationType) {
                res.status(400).json({
                    success: false,
                    error: 'Integration type is required'
                });
                return;
            }
            const universities = await this.registry.getUniversitiesByIntegrationType(integrationType);
            res.json({
                success: true,
                data: universities
            });
        }
        catch (error) {
            this.logger.error(`Failed to get universities for integration type ${req.params.integrationType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getUniversitiesByLocation(req, res) {
        try {
            const { country } = req.params;
            const { state, province } = req.query;
            if (!country || !['US', 'CA'].includes(country)) {
                res.status(400).json({
                    success: false,
                    error: 'Valid country (US or CA) is required'
                });
                return;
            }
            const universities = await this.registry.getUniversitiesByLocation(country, state, province);
            res.json({
                success: true,
                data: universities
            });
        }
        catch (error) {
            this.logger.error(`Failed to get universities by location:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async updateUniversityIntegration(req, res) {
        try {
            const { universityId } = req.params;
            const config = req.body;
            if (!universityId) {
                res.status(400).json({
                    success: false,
                    error: 'University ID is required'
                });
                return;
            }
            await this.registry.upsertUniversityIntegration(universityId, config);
            res.json({
                success: true,
                message: 'University integration configuration updated'
            });
        }
        catch (error) {
            this.logger.error(`Failed to update integration for university ${req.params.universityId}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getSubmissionStatistics(req, res) {
        try {
            const filters = {
                dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom) : undefined,
                dateTo: req.query.dateTo ? new Date(req.query.dateTo) : undefined,
                integrationType: req.query.integrationType,
                universityId: req.query.universityId
            };
            const stats = await this.tracker.getSubmissionStatistics(filters);
            res.json({
                success: true,
                data: stats
            });
        }
        catch (error) {
            this.logger.error('Failed to get submission statistics:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getRateLimitStatus(req, res) {
        try {
            const { integrationType } = req.params;
            const { universityId } = req.query;
            if (!integrationType) {
                res.status(400).json({
                    success: false,
                    error: 'Integration type is required'
                });
                return;
            }
            const usage = await this.rateLimiter.getCurrentUsage(integrationType, universityId);
            res.json({
                success: true,
                data: usage
            });
        }
        catch (error) {
            this.logger.error(`Failed to get rate limit status for ${req.params.integrationType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async resetRateLimits(req, res) {
        try {
            const { integrationType } = req.params;
            const { universityId } = req.body;
            if (!integrationType) {
                res.status(400).json({
                    success: false,
                    error: 'Integration type is required'
                });
                return;
            }
            await this.rateLimiter.resetRateLimits(integrationType, universityId);
            res.json({
                success: true,
                message: 'Rate limits reset successfully'
            });
        }
        catch (error) {
            this.logger.error(`Failed to reset rate limits for ${req.params.integrationType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async validateCredentials(req, res) {
        try {
            const { integrationType } = req.params;
            if (!integrationType) {
                res.status(400).json({
                    success: false,
                    error: 'Integration type is required'
                });
                return;
            }
            const result = await this.authManager.validateCredentials(integrationType);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            this.logger.error(`Failed to validate credentials for ${req.params.integrationType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async storeCredentials(req, res) {
        try {
            const { integrationType } = req.params;
            const credentials = req.body;
            if (!integrationType) {
                res.status(400).json({
                    success: false,
                    error: 'Integration type is required'
                });
                return;
            }
            await this.authManager.storeCredentials(integrationType, credentials);
            res.json({
                success: true,
                message: 'Credentials stored successfully'
            });
        }
        catch (error) {
            this.logger.error(`Failed to store credentials for ${req.params.integrationType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getIntegrationHealth(req, res) {
        try {
            const healthChecks = await Promise.allSettled([
                this.integrationHub.testUniversityConnection('test-commonapp'),
                this.integrationHub.testUniversityConnection('test-coalition'),
                this.integrationHub.testUniversityConnection('test-uc-system'),
                this.integrationHub.testUniversityConnection('test-ouac')
            ]);
            const health = {
                overall: 'healthy',
                integrations: {
                    commonapp: healthChecks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
                    coalition: healthChecks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
                    uc_system: healthChecks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
                    ouac: healthChecks[3].status === 'fulfilled' ? 'healthy' : 'unhealthy'
                },
                timestamp: new Date().toISOString()
            };
            const unhealthyCount = Object.values(health.integrations).filter(status => status === 'unhealthy').length;
            if (unhealthyCount > 0) {
                health.overall = unhealthyCount >= 2 ? 'critical' : 'warning';
            }
            res.json({
                success: true,
                data: health
            });
        }
        catch (error) {
            this.logger.error('Failed to get integration health:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async bulkLoadUniversities(req, res) {
        try {
            const universities = req.body.universities;
            if (!Array.isArray(universities)) {
                res.status(400).json({
                    success: false,
                    error: 'Universities array is required'
                });
                return;
            }
            const result = await this.registry.bulkLoadUniversities(universities);
            res.json({
                success: true,
                data: result
            });
        }
        catch (error) {
            this.logger.error('Failed to bulk load universities:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async getCredentialsNeedingRotation(req, res) {
        try {
            const credentials = await this.authManager.getCredentialsNeedingRotation();
            res.json({
                success: true,
                data: credentials
            });
        }
        catch (error) {
            this.logger.error('Failed to get credentials needing rotation:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async rotateCredentials(req, res) {
        try {
            const { integrationType } = req.params;
            if (!integrationType) {
                res.status(400).json({
                    success: false,
                    error: 'Integration type is required'
                });
                return;
            }
            await this.authManager.rotateCredentials(integrationType);
            res.json({
                success: true,
                message: 'Credential rotation initiated'
            });
        }
        catch (error) {
            this.logger.error(`Failed to rotate credentials for ${req.params.integrationType}:`, error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}
exports.UniversityIntegrationController = UniversityIntegrationController;
//# sourceMappingURL=universityIntegrationController.js.map