import { Router } from 'express';
import { AIIntelligenceController } from '../controllers/aiIntelligenceController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();
const aiController = new AIIntelligenceController();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/ai-intelligence/university-recommendations:
 *   post:
 *     summary: Generate intelligent university recommendations
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentProfile
 *             properties:
 *               studentProfile:
 *                 $ref: '#/components/schemas/StudentProfile'
 *     responses:
 *       200:
 *         description: University recommendations generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UniversityMatch'
 */
router.post('/university-recommendations', [
  body('studentProfile').isObject().notEmpty(),
  body('studentProfile.id').isString().notEmpty(),
  body('studentProfile.academic').isObject().notEmpty(),
  body('studentProfile.preferences').isObject().notEmpty(),
  validateRequest
], aiController.generateUniversityRecommendations.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/content-optimization:
 *   post:
 *     summary: Optimize recommendation content for specific universities
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *               - targetUniversities
 *               - studentProfile
 *             properties:
 *               content:
 *                 type: string
 *                 description: Original recommendation content
 *               targetUniversities:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/University'
 *               studentProfile:
 *                 $ref: '#/components/schemas/StudentProfile'
 *     responses:
 *       200:
 *         description: Content optimization completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ContentOptimization'
 */
router.post('/content-optimization', [
  body('content').isString().isLength({ min: 50 }),
  body('targetUniversities').isArray().isLength({ min: 1 }),
  body('studentProfile').isObject().notEmpty(),
  validateRequest
], aiController.optimizeContent.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/intelligent-workflow:
 *   post:
 *     summary: Create intelligent workflow for student application process
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentProfile
 *               - targetUniversities
 *             properties:
 *               studentProfile:
 *                 $ref: '#/components/schemas/StudentProfile'
 *               targetUniversities:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/UniversityMatch'
 *     responses:
 *       200:
 *         description: Intelligent workflow created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/IntelligentWorkflow'
 */
router.post('/intelligent-workflow', [
  body('studentProfile').isObject().notEmpty(),
  body('targetUniversities').isArray().isLength({ min: 1 }),
  validateRequest
], aiController.createIntelligentWorkflow.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/admission-prediction:
 *   post:
 *     summary: Predict admission success probability
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentProfile
 *               - university
 *             properties:
 *               studentProfile:
 *                 $ref: '#/components/schemas/StudentProfile'
 *               university:
 *                 $ref: '#/components/schemas/University'
 *     responses:
 *       200:
 *         description: Admission prediction completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SuccessPrediction'
 */
router.post('/admission-prediction', [
  body('studentProfile').isObject().notEmpty(),
  body('university').isObject().notEmpty(),
  body('university.id').isString().notEmpty(),
  validateRequest
], aiController.predictAdmissionSuccess.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/real-time-insights/{studentId}:
 *   get:
 *     summary: Get real-time insights and recommendations
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student profile ID
 *     responses:
 *       200:
 *         description: Real-time insights retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/RealTimeInsights'
 */
router.get('/real-time-insights/:studentId', [
  param('studentId').isString().notEmpty(),
  validateRequest
], aiController.getRealTimeInsights.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/portfolio-analysis:
 *   post:
 *     summary: Analyze application portfolio success probability
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentProfile
 *               - universities
 *             properties:
 *               studentProfile:
 *                 $ref: '#/components/schemas/StudentProfile'
 *               universities:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/University'
 *     responses:
 *       200:
 *         description: Portfolio analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PortfolioAnalysis'
 */
router.post('/portfolio-analysis', [
  body('studentProfile').isObject().notEmpty(),
  body('universities').isArray().isLength({ min: 1 }),
  validateRequest
], aiController.analyzePortfolio.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/scholarship-analysis:
 *   post:
 *     summary: Analyze scholarship opportunities and probabilities
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentProfile
 *               - university
 *             properties:
 *               studentProfile:
 *                 $ref: '#/components/schemas/StudentProfile'
 *               university:
 *                 $ref: '#/components/schemas/University'
 *     responses:
 *       200:
 *         description: Scholarship analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ScholarshipAnalysis'
 */
router.post('/scholarship-analysis', [
  body('studentProfile').isObject().notEmpty(),
  body('university').isObject().notEmpty(),
  validateRequest
], aiController.analyzeScholarships.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/workflow/{workflowId}:
 *   get:
 *     summary: Get intelligent workflow by ID
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *     responses:
 *       200:
 *         description: Workflow retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/IntelligentWorkflow'
 */
router.get('/workflow/:workflowId', [
  param('workflowId').isString().notEmpty(),
  validateRequest
], aiController.getWorkflow.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/workflow/{workflowId}/tasks:
 *   put:
 *     summary: Update workflow task status
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workflowId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskId
 *               - status
 *             properties:
 *               taskId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, in_progress, completed, skipped]
 *               progress:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Task status updated successfully
 */
router.put('/workflow/:workflowId/tasks', [
  param('workflowId').isString().notEmpty(),
  body('taskId').isString().notEmpty(),
  body('status').isIn(['pending', 'in_progress', 'completed', 'skipped']),
  body('progress').optional().isNumeric().isFloat({ min: 0, max: 100 }),
  validateRequest
], aiController.updateTaskStatus.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/content-analysis:
 *   post:
 *     summary: Analyze content quality and characteristics
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Content to analyze
 *     responses:
 *       200:
 *         description: Content analysis completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ContentAnalysis'
 */
router.post('/content-analysis', [
  body('content').isString().isLength({ min: 10 }),
  validateRequest
], aiController.analyzeContent.bind(aiController));

/**
 * @swagger
 * /api/ai-intelligence/timing-optimization:
 *   post:
 *     summary: Optimize application timing for maximum success
 *     tags: [AI Intelligence]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentProfile
 *               - universities
 *             properties:
 *               studentProfile:
 *                 $ref: '#/components/schemas/StudentProfile'
 *               universities:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/University'
 *     responses:
 *       200:
 *         description: Timing optimization completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TimingRecommendation'
 */
router.post('/timing-optimization', [
  body('studentProfile').isObject().notEmpty(),
  body('universities').isArray().isLength({ min: 1 }),
  validateRequest
], aiController.optimizeTiming.bind(aiController));

export default router;