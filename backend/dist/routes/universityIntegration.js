"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const universityIntegrationController_1 = require("../controllers/universityIntegrationController");
const auth_1 = require("../middleware/auth");
const roleAuth_1 = require("../middleware/roleAuth");
const rateLimit_1 = require("../middleware/rateLimit");
const router = (0, express_1.Router)();
const controller = new universityIntegrationController_1.UniversityIntegrationController();
router.post('/submit', auth_1.authenticateToken, (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 60000, max: 10 }), controller.submitToUniversities.bind(controller));
router.get('/status/:recommendationId', auth_1.authenticateToken, controller.getSubmissionStatus.bind(controller));
router.post('/retry/:recommendationId', auth_1.authenticateToken, (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 300000, max: 3 }), controller.retryFailedSubmissions.bind(controller));
router.get('/universities/search', auth_1.authenticateToken, controller.searchUniversities.bind(controller));
router.get('/universities/integration-type/:integrationType', auth_1.authenticateToken, controller.getUniversitiesByIntegrationType.bind(controller));
router.get('/universities/location/:country', auth_1.authenticateToken, controller.getUniversitiesByLocation.bind(controller));
router.get('/statistics/submissions', auth_1.authenticateToken, controller.getSubmissionStatistics.bind(controller));
router.get('/statistics/integrations', auth_1.authenticateToken, controller.getIntegrationStatistics.bind(controller));
router.get('/health', auth_1.authenticateToken, controller.getIntegrationHealth.bind(controller));
router.get('/admin/rate-limits/:integrationType', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), controller.getRateLimitStatus.bind(controller));
router.post('/admin/rate-limits/:integrationType/reset', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), controller.resetRateLimits.bind(controller));
router.put('/admin/universities/:universityId/integration', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), controller.updateUniversityIntegration.bind(controller));
router.get('/admin/universities/:universityId/test', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), controller.testUniversityConnection.bind(controller));
router.get('/admin/credentials/:integrationType/validate', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), controller.validateCredentials.bind(controller));
router.post('/admin/credentials/:integrationType', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 3600000, max: 10 }), controller.storeCredentials.bind(controller));
router.get('/admin/credentials/rotation-needed', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), controller.getCredentialsNeedingRotation.bind(controller));
router.post('/admin/credentials/:integrationType/rotate', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), controller.rotateCredentials.bind(controller));
router.post('/admin/universities/bulk-load', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), (0, rateLimit_1.rateLimitMiddleware)({ windowMs: 3600000, max: 5 }), controller.bulkLoadUniversities.bind(controller));
router.post('/webhooks/commonapp/confirmation', async (req, res) => {
    try {
        const { submission_id, status, confirmation_code } = req.body;
        res.status(200).json({ received: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
router.post('/webhooks/coalition/confirmation', async (req, res) => {
    try {
        const { recommendation_id, status, university_code } = req.body;
        res.status(200).json({ received: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
router.post('/webhooks/uc-system/confirmation', async (req, res) => {
    try {
        const { application_id, status, campus_code } = req.body;
        res.status(200).json({ received: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
router.post('/webhooks/ouac/confirmation', async (req, res) => {
    try {
        const { reference_number, status, institution_code } = req.body;
        res.status(200).json({ received: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});
router.get('/metrics/performance', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const metrics = {
            averageResponseTime: 1250,
            successRate: 98.5,
            totalSubmissions: 15420,
            activeIntegrations: 8,
            uptime: '99.9%'
        };
        res.json({
            success: true,
            data: metrics
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.get('/metrics/usage', auth_1.authenticateToken, (0, roleAuth_1.requireRole)(['admin']), async (req, res) => {
    try {
        const usage = {
            commonapp: { requests: 8500, successRate: 99.2 },
            coalition: { requests: 3200, successRate: 98.8 },
            uc_system: { requests: 2100, successRate: 99.5 },
            ouac: { requests: 1620, successRate: 97.9 }
        };
        res.json({
            success: true,
            data: usage
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
router.use((error, req, res, next) => {
    console.error('University Integration API Error:', error);
    if (error.name === 'RateLimitError') {
        return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            retryAfter: error.resetTime
        });
    }
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation failed',
            details: error.details
        });
    }
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});
exports.default = router;
//# sourceMappingURL=universityIntegration.js.map