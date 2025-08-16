import { Request, Response } from 'express';
import { Logger } from '../services/logger';
import { UniversityIntegrationHub } from '../services/universityIntegration/UniversityIntegrationHub';
import { UniversityRegistry } from '../services/universityIntegration/UniversityRegistry';
import { SubmissionTracker } from '../services/universityIntegration/SubmissionTracker';
import { RateLimiter } from '../services/universityIntegration/RateLimiter';
import { AuthenticationManager } from '../services/universityIntegration/AuthenticationManager';

export class UniversityIntegrationController {
  private logger = new Logger('UniversityIntegrationController');
  private integrationHub: UniversityIntegrationHub;
  private registry: UniversityRegistry;
  private tracker: SubmissionTracker;
  private rateLimiter: RateLimiter;
  private authManager: AuthenticationManager;

  constructor() {
    this.integrationHub = new UniversityIntegrationHub();
    this.registry = new UniversityRegistry();
    this.tracker = new SubmissionTracker();
    this.rateLimiter = new RateLimiter();
    this.authManager = new AuthenticationManager();
  }

  /**
   * Submit recommendation to multiple universities
   */
  async submitToUniversities(req: Request, res: Response): Promise<void> {
    try {
      const submissionRequest = req.body;
      
      // Validate request
      if (!submissionRequest.recommendationId || !submissionRequest.universities?.length) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: recommendationId and universities'
        });
        return;
      }

      this.logger.info(`Processing bulk submission for recommendation ${submissionRequest.recommendationId}`);

      // Submit to universities
      const result = await this.integrationHub.submitToUniversities(submissionRequest);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Bulk submission failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get submission status for a recommendation
   */
  async getSubmissionStatus(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to get submission status for ${req.params.recommendationId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Retry failed submissions
   */
  async retryFailedSubmissions(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to retry submissions for ${req.params.recommendationId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get integration statistics
   */
  async getIntegrationStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.integrationHub.getIntegrationStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.logger.error('Failed to get integration statistics:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Test university connection
   */
  async testUniversityConnection(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to test connection for university ${req.params.universityId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Search universities with integration info
   */
  async searchUniversities(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        search: req.query.search as string,
        country: req.query.country as 'US' | 'CA',
        state: req.query.state as string,
        province: req.query.province as string,
        integrationType: req.query.integrationType as string,
        programType: req.query.programType as string,
        isActive: req.query.isActive === 'true',
        limit: parseInt(req.query.limit as string) || 50,
        offset: parseInt(req.query.offset as string) || 0
      };

      const result = await this.registry.searchUniversities(filters);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      this.logger.error('Failed to search universities:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get universities by integration type
   */
  async getUniversitiesByIntegrationType(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to get universities for integration type ${req.params.integrationType}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get universities by location
   */
  async getUniversitiesByLocation(req: Request, res: Response): Promise<void> {
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

      const universities = await this.registry.getUniversitiesByLocation(
        country as 'US' | 'CA',
        state as string,
        province as string
      );

      res.json({
        success: true,
        data: universities
      });
    } catch (error) {
      this.logger.error(`Failed to get universities by location:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update university integration configuration (Admin only)
   */
  async updateUniversityIntegration(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to update integration for university ${req.params.universityId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get submission statistics
   */
  async getSubmissionStatistics(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
        integrationType: req.query.integrationType as string,
        universityId: req.query.universityId as string
      };

      const stats = await this.tracker.getSubmissionStatistics(filters);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.logger.error('Failed to get submission statistics:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(req: Request, res: Response): Promise<void> {
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

      const usage = await this.rateLimiter.getCurrentUsage(
        integrationType,
        universityId as string
      );

      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      this.logger.error(`Failed to get rate limit status for ${req.params.integrationType}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Reset rate limits (Admin only)
   */
  async resetRateLimits(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to reset rate limits for ${req.params.integrationType}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Validate credentials (Admin only)
   */
  async validateCredentials(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to validate credentials for ${req.params.integrationType}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Store credentials (Admin only)
   */
  async storeCredentials(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to store credentials for ${req.params.integrationType}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get integration health status
   */
  async getIntegrationHealth(req: Request, res: Response): Promise<void> {
    try {
      // This would check the health of all integrations
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

      // Determine overall health
      const unhealthyCount = Object.values(health.integrations).filter(status => status === 'unhealthy').length;
      if (unhealthyCount > 0) {
        health.overall = unhealthyCount >= 2 ? 'critical' : 'warning';
      }

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      this.logger.error('Failed to get integration health:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Bulk load universities (Admin only)
   */
  async bulkLoadUniversities(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error('Failed to bulk load universities:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get credentials needing rotation (Admin only)
   */
  async getCredentialsNeedingRotation(req: Request, res: Response): Promise<void> {
    try {
      const credentials = await this.authManager.getCredentialsNeedingRotation();

      res.json({
        success: true,
        data: credentials
      });
    } catch (error) {
      this.logger.error('Failed to get credentials needing rotation:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Rotate credentials (Admin only)
   */
  async rotateCredentials(req: Request, res: Response): Promise<void> {
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
    } catch (error) {
      this.logger.error(`Failed to rotate credentials for ${req.params.integrationType}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}