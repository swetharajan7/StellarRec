import { Router, Request, Response } from 'express';
import { param, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { UniversityIntegrationService } from '../services/universityIntegrationService';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();
const integrationService = new UniversityIntegrationService(prisma);

// POST /webhooks/university/:integrationId - Receive webhook data
router.post('/university/:integrationId',
  param('integrationId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const integrationId = req.params.integrationId;
      const webhookData = req.body;

      logger.info(`Webhook received for integration: ${integrationId}`);

      // Verify integration exists and is active
      const integration = await prisma.university_integrations.findFirst({
        where: {
          id: integrationId,
          is_active: true,
          integration_type: 'webhook'
        }
      });

      if (!integration) {
        logger.warn(`Webhook received for inactive/invalid integration: ${integrationId}`);
        return res.status(404).json({ error: 'Integration not found or inactive' });
      }

      // Validate webhook signature if configured
      if (integration.credentials?.webhook_secret) {
        const signature = req.headers['x-webhook-signature'] as string;
        if (!signature || !validateWebhookSignature(webhookData, signature, integration.credentials.webhook_secret)) {
          logger.warn(`Invalid webhook signature for integration: ${integrationId}`);
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      }

      // Process webhook data
      const result = await processWebhookData(integration, webhookData);

      // Log webhook event
      await prisma.webhook_logs.create({
        data: {
          integration_id: integrationId,
          event_type: webhookData.event_type || 'data_update',
          payload: webhookData,
          processing_status: result.success ? 'success' : 'failed',
          processing_errors: result.errors,
          created_at: new Date()
        }
      });

      if (result.success) {
        res.json({
          message: 'Webhook processed successfully',
          records_processed: result.records_processed
        });
      } else {
        res.status(400).json({
          error: 'Webhook processing failed',
          details: result.errors
        });
      }
    } catch (error) {
      logger.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /webhooks/logs/:integrationId - Get webhook logs
router.get('/logs/:integrationId',
  param('integrationId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const integrationId = req.params.integrationId;
      const limit = parseInt(req.query.limit as string) || 50;

      const logs = await prisma.webhook_logs.findMany({
        where: { integration_id: integrationId },
        orderBy: { created_at: 'desc' },
        take: limit
      });

      res.json({
        webhook_logs: logs,
        total: logs.length
      });
    } catch (error) {
      logger.error('Error fetching webhook logs:', error);
      res.status(500).json({ error: 'Failed to fetch webhook logs' });
    }
  }
);

// POST /webhooks/test/:integrationId - Test webhook endpoint
router.post('/test/:integrationId',
  param('integrationId').isUUID(),
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const integrationId = req.params.integrationId;

      // Verify integration exists
      const integration = await prisma.university_integrations.findFirst({
        where: {
          id: integrationId,
          integration_type: 'webhook'
        }
      });

      if (!integration) {
        return res.status(404).json({ error: 'Webhook integration not found' });
      }

      // Create test webhook log
      await prisma.webhook_logs.create({
        data: {
          integration_id: integrationId,
          event_type: 'test',
          payload: { test: true, timestamp: new Date() },
          processing_status: 'success',
          processing_errors: [],
          created_at: new Date()
        }
      });

      res.json({
        message: 'Webhook test successful',
        integration_id: integrationId,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error testing webhook:', error);
      res.status(500).json({ error: 'Failed to test webhook' });
    }
  }
);

function validateWebhookSignature(payload: any, signature: string, secret: string): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`)
    );
  } catch (error) {
    logger.error('Error validating webhook signature:', error);
    return false;
  }
}

async function processWebhookData(integration: any, webhookData: any) {
  const result = {
    success: false,
    records_processed: 0,
    errors: [] as string[]
  };

  try {
    // Process different types of webhook events
    switch (webhookData.event_type) {
      case 'program_update':
        await processProgramUpdate(integration.university_id, webhookData.data, result);
        break;
      case 'deadline_update':
        await processDeadlineUpdate(integration.university_id, webhookData.data, result);
        break;
      case 'requirement_update':
        await processRequirementUpdate(integration.university_id, webhookData.data, result);
        break;
      case 'bulk_update':
        await processBulkUpdate(integration.university_id, webhookData.data, result);
        break;
      default:
        result.errors.push(`Unknown event type: ${webhookData.event_type}`);
        return result;
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(`Processing error: ${error.message}`);
    return result;
  }
}

async function processProgramUpdate(universityId: string, data: any, result: any) {
  try {
    const program = await prisma.programs.findFirst({
      where: {
        university_id: universityId,
        external_id: data.program_id
      }
    });

    if (program) {
      await prisma.programs.update({
        where: { id: program.id },
        data: {
          name: data.name || program.name,
          description: data.description || program.description,
          requirements: data.requirements || program.requirements,
          tuition: data.tuition || program.tuition,
          updated_at: new Date()
        }
      });
    } else {
      await prisma.programs.create({
        data: {
          university_id: universityId,
          external_id: data.program_id,
          name: data.name,
          degree: data.degree,
          department: data.department,
          description: data.description,
          requirements: data.requirements,
          duration: data.duration,
          tuition: data.tuition,
          is_active: true
        }
      });
    }

    result.records_processed++;
  } catch (error) {
    result.errors.push(`Program update error: ${error.message}`);
  }
}

async function processDeadlineUpdate(universityId: string, data: any, result: any) {
  try {
    await prisma.universities.update({
      where: { id: universityId },
      data: {
        deadlines: data.deadlines,
        updated_at: new Date()
      }
    });
    result.records_processed++;
  } catch (error) {
    result.errors.push(`Deadline update error: ${error.message}`);
  }
}

async function processRequirementUpdate(universityId: string, data: any, result: any) {
  try {
    await prisma.universities.update({
      where: { id: universityId },
      data: {
        admission_requirements: data.requirements,
        updated_at: new Date()
      }
    });
    result.records_processed++;
  } catch (error) {
    result.errors.push(`Requirement update error: ${error.message}`);
  }
}

async function processBulkUpdate(universityId: string, data: any, result: any) {
  try {
    if (data.programs && Array.isArray(data.programs)) {
      for (const programData of data.programs) {
        await processProgramUpdate(universityId, programData, result);
      }
    }

    if (data.deadlines) {
      await processDeadlineUpdate(universityId, data.deadlines, result);
    }

    if (data.requirements) {
      await processRequirementUpdate(universityId, data.requirements, result);
    }
  } catch (error) {
    result.errors.push(`Bulk update error: ${error.message}`);
  }
}

export default router;