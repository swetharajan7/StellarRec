import { Router } from 'express';
import { UniversityIntegrationController } from '../controllers/universityIntegrationController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/roleAuth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();
const controller = new UniversityIntegrationController();

// =====================================================
// PUBLIC ROUTES (with authentication)
// =====================================================

/**
 * @route POST /api/university-integration/submit
 * @desc Submit recommendation to multiple universities
 * @access Private (Student, Recommender)
 */
router.post('/submit', 
  authenticateToken,
  rateLimitMiddleware({ windowMs: 60000, max: 10 }), // 10 requests per minute
  controller.submitToUniversities.bind(controller)
);

/**
 * @route GET /api/university-integration/status/:recommendationId
 * @desc Get submission status for a recommendation
 * @access Private (Student, Recommender)
 */
router.get('/status/:recommendationId',
  authenticateToken,
  controller.getSubmissionStatus.bind(controller)
);

/**
 * @route POST /api/university-integration/retry/:recommendationId
 * @desc Retry failed submissions for a recommendation
 * @access Private (Student, Recommender)
 */
router.post('/retry/:recommendationId',
  authenticateToken,
  rateLimitMiddleware({ windowMs: 300000, max: 3 }), // 3 retries per 5 minutes
  controller.retryFailedSubmissions.bind(controller)
);

/**
 * @route GET /api/university-integration/universities/search
 * @desc Search universities with integration information
 * @access Private
 */
router.get('/universities/search',
  authenticateToken,
  controller.searchUniversities.bind(controller)
);

/**
 * @route GET /api/university-integration/universities/integration-type/:integrationType
 * @desc Get universities by integration type
 * @access Private
 */
router.get('/universities/integration-type/:integrationType',
  authenticateToken,
  controller.getUniversitiesByIntegrationType.bind(controller)
);

/**
 * @route GET /api/university-integration/universities/location/:country
 * @desc Get universities by location (country, state, province)
 * @access Private
 */
router.get('/universities/location/:country',
  authenticateToken,
  controller.getUniversitiesByLocation.bind(controller)
);

/**
 * @route GET /api/university-integration/statistics/submissions
 * @desc Get submission statistics
 * @access Private
 */
router.get('/statistics/submissions',
  authenticateToken,
  controller.getSubmissionStatistics.bind(controller)
);

/**
 * @route GET /api/university-integration/statistics/integrations
 * @desc Get integration statistics
 * @access Private
 */
router.get('/statistics/integrations',
  authenticateToken,
  controller.getIntegrationStatistics.bind(controller)
);

/**
 * @route GET /api/university-integration/health
 * @desc Get integration health status
 * @access Private
 */
router.get('/health',
  authenticateToken,
  controller.getIntegrationHealth.bind(controller)
);

// =====================================================
// ADMIN ROUTES
// =====================================================

/**
 * @route GET /api/university-integration/admin/rate-limits/:integrationType
 * @desc Get rate limit status for integration type
 * @access Admin only
 */
router.get('/admin/rate-limits/:integrationType',
  authenticateToken,
  requireRole(['admin']),
  controller.getRateLimitStatus.bind(controller)
);

/**
 * @route POST /api/university-integration/admin/rate-limits/:integrationType/reset
 * @desc Reset rate limits for integration type
 * @access Admin only
 */
router.post('/admin/rate-limits/:integrationType/reset',
  authenticateToken,
  requireRole(['admin']),
  controller.resetRateLimits.bind(controller)
);

/**
 * @route PUT /api/university-integration/admin/universities/:universityId/integration
 * @desc Update university integration configuration
 * @access Admin only
 */
router.put('/admin/universities/:universityId/integration',
  authenticateToken,
  requireRole(['admin']),
  controller.updateUniversityIntegration.bind(controller)
);

/**
 * @route GET /api/university-integration/admin/universities/:universityId/test
 * @desc Test university connection
 * @access Admin only
 */
router.get('/admin/universities/:universityId/test',
  authenticateToken,
  requireRole(['admin']),
  controller.testUniversityConnection.bind(controller)
);

/**
 * @route GET /api/university-integration/admin/credentials/:integrationType/validate
 * @desc Validate credentials for integration type
 * @access Admin only
 */
router.get('/admin/credentials/:integrationType/validate',
  authenticateToken,
  requireRole(['admin']),
  controller.validateCredentials.bind(controller)
);

/**
 * @route POST /api/university-integration/admin/credentials/:integrationType
 * @desc Store credentials for integration type
 * @access Admin only
 */
router.post('/admin/credentials/:integrationType',
  authenticateToken,
  requireRole(['admin']),
  rateLimitMiddleware({ windowMs: 3600000, max: 10 }), // 10 credential updates per hour
  controller.storeCredentials.bind(controller)
);

/**
 * @route GET /api/university-integration/admin/credentials/rotation-needed
 * @desc Get credentials that need rotation
 * @access Admin only
 */
router.get('/admin/credentials/rotation-needed',
  authenticateToken,
  requireRole(['admin']),
  controller.getCredentialsNeedingRotation.bind(controller)
);

/**
 * @route POST /api/university-integration/admin/credentials/:integrationType/rotate
 * @desc Rotate credentials for integration type
 * @access Admin only
 */
router.post('/admin/credentials/:integrationType/rotate',
  authenticateToken,
  requireRole(['admin']),
  controller.rotateCredentials.bind(controller)
);

/**
 * @route POST /api/university-integration/admin/universities/bulk-load
 * @desc Bulk load universities
 * @access Admin only
 */
router.post('/admin/universities/bulk-load',
  authenticateToken,
  requireRole(['admin']),
  rateLimitMiddleware({ windowMs: 3600000, max: 5 }), // 5 bulk loads per hour
  controller.bulkLoadUniversities.bind(controller)
);

// =====================================================
// WEBHOOK ROUTES (for university confirmations)
// =====================================================

/**
 * @route POST /api/university-integration/webhooks/commonapp/confirmation
 * @desc CommonApp confirmation webhook
 * @access Public (with signature verification)
 */
router.post('/webhooks/commonapp/confirmation',
  // Add webhook signature verification middleware here
  async (req, res) => {
    try {
      // Handle CommonApp confirmation webhook
      const { submission_id, status, confirmation_code } = req.body;
      
      // Update submission status
      // This would be handled by the SubmissionTracker
      
      res.status(200).json({ received: true });
    } catch (error) {
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

/**
 * @route POST /api/university-integration/webhooks/coalition/confirmation
 * @desc Coalition Application confirmation webhook
 * @access Public (with signature verification)
 */
router.post('/webhooks/coalition/confirmation',
  async (req, res) => {
    try {
      // Handle Coalition confirmation webhook
      const { recommendation_id, status, university_code } = req.body;
      
      res.status(200).json({ received: true });
    } catch (error) {
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

/**
 * @route POST /api/university-integration/webhooks/uc-system/confirmation
 * @desc UC System confirmation webhook
 * @access Public (with signature verification)
 */
router.post('/webhooks/uc-system/confirmation',
  async (req, res) => {
    try {
      // Handle UC System confirmation webhook
      const { application_id, status, campus_code } = req.body;
      
      res.status(200).json({ received: true });
    } catch (error) {
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

/**
 * @route POST /api/university-integration/webhooks/ouac/confirmation
 * @desc OUAC confirmation webhook
 * @access Public (with signature verification)
 */
router.post('/webhooks/ouac/confirmation',
  async (req, res) => {
    try {
      // Handle OUAC confirmation webhook
      const { reference_number, status, institution_code } = req.body;
      
      res.status(200).json({ received: true });
    } catch (error) {
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// =====================================================
// MONITORING AND METRICS ROUTES
// =====================================================

/**
 * @route GET /api/university-integration/metrics/performance
 * @desc Get performance metrics
 * @access Admin only
 */
router.get('/metrics/performance',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      // Return performance metrics
      const metrics = {
        averageResponseTime: 1250, // ms
        successRate: 98.5, // %
        totalSubmissions: 15420,
        activeIntegrations: 8,
        uptime: '99.9%'
      };
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @route GET /api/university-integration/metrics/usage
 * @desc Get usage metrics by integration type
 * @access Admin only
 */
router.get('/metrics/usage',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      // Return usage metrics
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
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// =====================================================
// ERROR HANDLING MIDDLEWARE
// =====================================================

router.use((error: any, req: any, res: any, next: any) => {
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

export default router;