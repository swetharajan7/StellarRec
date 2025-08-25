"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiIntelligenceController_1 = require("../controllers/aiIntelligenceController");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const express_validator_1 = require("express-validator");
const router = (0, express_1.Router)();
const aiController = new aiIntelligenceController_1.AIIntelligenceController();
router.use(auth_1.authenticateToken);
router.post('/university-recommendations', [
    (0, express_validator_1.body)('studentProfile').isObject().notEmpty(),
    (0, express_validator_1.body)('studentProfile.id').isString().notEmpty(),
    (0, express_validator_1.body)('studentProfile.academic').isObject().notEmpty(),
    (0, express_validator_1.body)('studentProfile.preferences').isObject().notEmpty(),
    validation_1.validateRequest
], aiController.generateUniversityRecommendations.bind(aiController));
router.post('/content-optimization', [
    (0, express_validator_1.body)('content').isString().isLength({ min: 50 }),
    (0, express_validator_1.body)('targetUniversities').isArray().isLength({ min: 1 }),
    (0, express_validator_1.body)('studentProfile').isObject().notEmpty(),
    validation_1.validateRequest
], aiController.optimizeContent.bind(aiController));
router.post('/intelligent-workflow', [
    (0, express_validator_1.body)('studentProfile').isObject().notEmpty(),
    (0, express_validator_1.body)('targetUniversities').isArray().isLength({ min: 1 }),
    validation_1.validateRequest
], aiController.createIntelligentWorkflow.bind(aiController));
router.post('/admission-prediction', [
    (0, express_validator_1.body)('studentProfile').isObject().notEmpty(),
    (0, express_validator_1.body)('university').isObject().notEmpty(),
    (0, express_validator_1.body)('university.id').isString().notEmpty(),
    validation_1.validateRequest
], aiController.predictAdmissionSuccess.bind(aiController));
router.get('/real-time-insights/:studentId', [
    (0, express_validator_1.param)('studentId').isString().notEmpty(),
    validation_1.validateRequest
], aiController.getRealTimeInsights.bind(aiController));
router.post('/portfolio-analysis', [
    (0, express_validator_1.body)('studentProfile').isObject().notEmpty(),
    (0, express_validator_1.body)('universities').isArray().isLength({ min: 1 }),
    validation_1.validateRequest
], aiController.analyzePortfolio.bind(aiController));
router.post('/scholarship-analysis', [
    (0, express_validator_1.body)('studentProfile').isObject().notEmpty(),
    (0, express_validator_1.body)('university').isObject().notEmpty(),
    validation_1.validateRequest
], aiController.analyzeScholarships.bind(aiController));
router.get('/workflow/:workflowId', [
    (0, express_validator_1.param)('workflowId').isString().notEmpty(),
    validation_1.validateRequest
], aiController.getWorkflow.bind(aiController));
router.put('/workflow/:workflowId/tasks', [
    (0, express_validator_1.param)('workflowId').isString().notEmpty(),
    (0, express_validator_1.body)('taskId').isString().notEmpty(),
    (0, express_validator_1.body)('status').isIn(['pending', 'in_progress', 'completed', 'skipped']),
    (0, express_validator_1.body)('progress').optional().isNumeric().isFloat({ min: 0, max: 100 }),
    validation_1.validateRequest
], aiController.updateTaskStatus.bind(aiController));
router.post('/content-analysis', [
    (0, express_validator_1.body)('content').isString().isLength({ min: 10 }),
    validation_1.validateRequest
], aiController.analyzeContent.bind(aiController));
router.post('/timing-optimization', [
    (0, express_validator_1.body)('studentProfile').isObject().notEmpty(),
    (0, express_validator_1.body)('universities').isArray().isLength({ min: 1 }),
    validation_1.validateRequest
], aiController.optimizeTiming.bind(aiController));
exports.default = router;
//# sourceMappingURL=aiIntelligence.js.map