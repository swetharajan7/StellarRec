import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { WebhookService } from '../services/webhookService';

const router = Router();

// Webhook endpoints don't require authentication (they come from external providers)
// But we use optional auth for internal webhook management

// Twilio webhook
router.post('/twilio',
  asyncHandler(async (req: Request, res: Response) => {
    const webhookService: WebhookService = req.app.locals.services.webhookService;
    
    const signature = req.headers['x-twilio-signature'] as string;
    const success = await webhookService.processWebhook(
      'twilio',
      req.body.MessageStatus || 'status_update',
      req.body,
      signature
    );

    res.status(success ? 200 : 400).json({
      success,
      message: success ? 'Webhook processed' : 'Webhook processing failed'
    });
  })
);

// SendGrid webhook
router.post('/sendgrid',
  asyncHandler(async (req: Request, res: Response) => {
    const webhookService: WebhookService = req.app.locals.services.webhookService;
    
    const signature = req.headers['x-twilio-email-event-webhook-signature'] as string;
    const events = Array.isArray(req.body) ? req.body : [req.body];
    
    let allSuccess = true;
    for (const event of events) {
      const success = await webhookService.processWebhook(
        'sendgrid',
        event.event,
        event,
        signature
      );
      if (!success) allSuccess = false;
    }

    res.status(allSuccess ? 200 : 400).json({
      success: allSuccess,
      message: allSuccess ? 'Webhooks processed' : 'Some webhooks failed'
    });
  })
);

// Mailgun webhook
router.post('/mailgun',
  asyncHandler(async (req: Request, res: Response) => {
    const webhookService: WebhookService = req.app.locals.services.webhookService;
    
    const signature = req.headers['x-mailgun-signature'] as string;
    const success = await webhookService.processWebhook(
      'mailgun',
      req.body.event,
      req.body,
      signature
    );

    res.status(success ? 200 : 400).json({
      success,
      message: success ? 'Webhook processed' : 'Webhook processing failed'
    });
  })
);

// Firebase webhook
router.post('/firebase',
  asyncHandler(async (req: Request, res: Response) => {
    const webhookService: WebhookService = req.app.locals.services.webhookService;
    
    const success = await webhookService.processWebhook(
      'firebase',
      req.body.eventType || 'notification_event',
      req.body
    );

    res.status(success ? 200 : 400).json({
      success,
      message: success ? 'Webhook processed' : 'Webhook processing failed'
    });
  })
);

// Get webhook events (admin only)
router.get('/events',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // This would typically require admin authentication
    const webhookService: WebhookService = req.app.locals.services.webhookService;
    const events = await webhookService.getWebhookEvents();

    res.status(200).json({
      success: true,
      data: events
    });
  })
);

export default router;