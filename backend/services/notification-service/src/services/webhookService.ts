import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { DeliveryTrackingService } from './deliveryTrackingService';
import crypto from 'crypto';
import axios from 'axios';

const prisma = new PrismaClient();

export interface WebhookEvent {
  id: string;
  provider: string;
  event: string;
  data: Record<string, any>;
  signature?: string;
  timestamp: Date;
  processed: boolean;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number; // in seconds
  };
  headers?: Record<string, string>;
}

export class WebhookService {
  private deliveryTrackingService: DeliveryTrackingService;

  constructor() {
    this.deliveryTrackingService = new DeliveryTrackingService();
  }

  async processWebhook(
    provider: string,
    event: string,
    data: Record<string, any>,
    signature?: string
  ): Promise<boolean> {
    try {
      logger.info('Processing webhook', { provider, event });

      // Verify webhook signature if provided
      if (signature && !this.verifySignature(provider, data, signature)) {
        logger.warn('Webhook signature verification failed', { provider, event });
        return false;
      }

      // Store webhook event
      const webhookEvent = await this.storeWebhookEvent(provider, event, data, signature);

      // Process based on provider and event type
      await this.handleWebhookEvent(webhookEvent);

      // Mark as processed
      await this.markWebhookProcessed(webhookEvent.id);

      logger.info('Webhook processed successfully', { 
        id: webhookEvent.id,
        provider, 
        event 
      });

      return true;

    } catch (error) {
      logger.error('Error processing webhook:', error);
      return false;
    }
  }

  async registerWebhookEndpoint(endpoint: Omit<WebhookEndpoint, 'id'>): Promise<string> {
    try {
      const webhookEndpoint = await prisma.webhookEndpoint.create({
        data: {
          id: this.generateId(),
          url: endpoint.url,
          events: endpoint.events,
          secret: endpoint.secret,
          active: endpoint.active,
          retryPolicy: endpoint.retryPolicy,
          headers: endpoint.headers || {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('Webhook endpoint registered', { 
        id: webhookEndpoint.id,
        url: endpoint.url 
      });

      return webhookEndpoint.id;

    } catch (error) {
      logger.error('Error registering webhook endpoint:', error);
      throw new Error(`Failed to register webhook endpoint: ${error.message}`);
    }
  }

  async sendWebhook(
    endpointId: string,
    event: string,
    data: Record<string, any>
  ): Promise<boolean> {
    try {
      const endpoint = await prisma.webhookEndpoint.findUnique({
        where: { id: endpointId }
      });

      if (!endpoint || !endpoint.active) {
        logger.warn('Webhook endpoint not found or inactive', { endpointId });
        return false;
      }

      if (!endpoint.events.includes(event)) {
        logger.debug('Event not subscribed by endpoint', { endpointId, event });
        return false;
      }

      const payload = {
        event,
        data,
        timestamp: new Date().toISOString(),
        id: this.generateId()
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'StellarRec-Webhooks/1.0',
        ...endpoint.headers
      };

      // Add signature if secret is configured
      if (endpoint.secret) {
        const signature = this.generateSignature(payload, endpoint.secret);
        headers['X-StellarRec-Signature'] = signature;
      }

      const response = await axios.post(endpoint.url, payload, {
        headers,
        timeout: 30000, // 30 seconds
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Log successful delivery
      await this.logWebhookDelivery(endpointId, event, payload, true, response.status);

      logger.info('Webhook sent successfully', { 
        endpointId,
        event,
        status: response.status 
      });

      return true;

    } catch (error) {
      logger.error('Error sending webhook:', error);

      // Log failed delivery
      await this.logWebhookDelivery(endpointId, event, data, false, 0, error.message);

      // Schedule retry if configured
      await this.scheduleWebhookRetry(endpointId, event, data);

      return false;
    }
  }

  async getWebhookEvents(
    provider?: string,
    processed?: boolean,
    limit: number = 100
  ): Promise<WebhookEvent[]> {
    try {
      const whereClause: any = {};
      
      if (provider) {
        whereClause.provider = provider;
      }
      
      if (processed !== undefined) {
        whereClause.processed = processed;
      }

      const events = await prisma.webhookEvent.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: limit
      });

      return events.map(this.mapToWebhookEvent);

    } catch (error) {
      logger.error('Error getting webhook events:', error);
      throw new Error(`Failed to get webhook events: ${error.message}`);
    }
  }

  async reprocessWebhookEvent(eventId: string): Promise<boolean> {
    try {
      const event = await prisma.webhookEvent.findUnique({
        where: { id: eventId }
      });

      if (!event) {
        return false;
      }

      const webhookEvent = this.mapToWebhookEvent(event);
      await this.handleWebhookEvent(webhookEvent);

      await this.markWebhookProcessed(eventId);

      logger.info('Webhook event reprocessed', { eventId });
      return true;

    } catch (error) {
      logger.error('Error reprocessing webhook event:', error);
      return false;
    }
  }

  private async storeWebhookEvent(
    provider: string,
    event: string,
    data: Record<string, any>,
    signature?: string
  ): Promise<WebhookEvent> {
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        id: this.generateId(),
        provider,
        event,
        data,
        signature,
        timestamp: new Date(),
        processed: false
      }
    });

    return this.mapToWebhookEvent(webhookEvent);
  }

  private async handleWebhookEvent(webhookEvent: WebhookEvent): Promise<void> {
    switch (webhookEvent.provider.toLowerCase()) {
      case 'twilio':
        await this.handleTwilioWebhook(webhookEvent);
        break;
      case 'sendgrid':
        await this.handleSendGridWebhook(webhookEvent);
        break;
      case 'mailgun':
        await this.handleMailgunWebhook(webhookEvent);
        break;
      case 'firebase':
        await this.handleFirebaseWebhook(webhookEvent);
        break;
      default:
        logger.warn('Unknown webhook provider', { provider: webhookEvent.provider });
    }
  }

  private async handleTwilioWebhook(webhookEvent: WebhookEvent): Promise<void> {
    const { data } = webhookEvent;
    
    if (data.MessageSid) {
      await this.deliveryTrackingService.trackWebhookEvent(
        data.MessageSid,
        data.MessageStatus || webhookEvent.event,
        data
      );
    }
  }

  private async handleSendGridWebhook(webhookEvent: WebhookEvent): Promise<void> {
    const events = Array.isArray(webhookEvent.data) ? webhookEvent.data : [webhookEvent.data];
    
    for (const event of events) {
      if (event.sg_message_id) {
        await this.deliveryTrackingService.trackWebhookEvent(
          event.sg_message_id,
          event.event,
          event
        );
      }
    }
  }

  private async handleMailgunWebhook(webhookEvent: WebhookEvent): Promise<void> {
    const { data } = webhookEvent;
    
    if (data['message-id']) {
      await this.deliveryTrackingService.trackWebhookEvent(
        data['message-id'],
        webhookEvent.event,
        data
      );
    }
  }

  private async handleFirebaseWebhook(webhookEvent: WebhookEvent): Promise<void> {
    const { data } = webhookEvent;
    
    if (data.messageId) {
      await this.deliveryTrackingService.trackWebhookEvent(
        data.messageId,
        webhookEvent.event,
        data
      );
    }
  }

  private async markWebhookProcessed(eventId: string): Promise<void> {
    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { processed: true }
    });
  }

  private async logWebhookDelivery(
    endpointId: string,
    event: string,
    payload: any,
    success: boolean,
    statusCode: number,
    error?: string
  ): Promise<void> {
    try {
      await prisma.webhookDelivery.create({
        data: {
          id: this.generateId(),
          endpointId,
          event,
          payload,
          success,
          statusCode,
          error,
          timestamp: new Date()
        }
      });
    } catch (logError) {
      logger.error('Error logging webhook delivery:', logError);
    }
  }

  private async scheduleWebhookRetry(
    endpointId: string,
    event: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      const endpoint = await prisma.webhookEndpoint.findUnique({
        where: { id: endpointId }
      });

      if (!endpoint) return;

      const retryPolicy = endpoint.retryPolicy as any;
      const retryAt = new Date(Date.now() + (retryPolicy.retryDelay * 1000));

      await prisma.webhookRetry.create({
        data: {
          id: this.generateId(),
          endpointId,
          event,
          payload: data,
          retryAt,
          attempts: 0,
          maxAttempts: retryPolicy.maxRetries,
          createdAt: new Date()
        }
      });

      logger.info('Webhook retry scheduled', { endpointId, event, retryAt });

    } catch (error) {
      logger.error('Error scheduling webhook retry:', error);
    }
  }

  private verifySignature(
    provider: string,
    data: Record<string, any>,
    signature: string
  ): boolean {
    try {
      switch (provider.toLowerCase()) {
        case 'twilio':
          return this.verifyTwilioSignature(data, signature);
        case 'sendgrid':
          return this.verifySendGridSignature(data, signature);
        case 'mailgun':
          return this.verifyMailgunSignature(data, signature);
        default:
          logger.warn('Signature verification not implemented for provider', { provider });
          return true; // Allow through if verification not implemented
      }
    } catch (error) {
      logger.error('Error verifying signature:', error);
      return false;
    }
  }

  private verifyTwilioSignature(data: Record<string, any>, signature: string): boolean {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) return true;

    // Twilio signature verification logic would go here
    return true;
  }

  private verifySendGridSignature(data: Record<string, any>, signature: string): boolean {
    const webhookSecret = process.env.SENDGRID_WEBHOOK_SECRET;
    if (!webhookSecret) return true;

    // SendGrid signature verification logic would go here
    return true;
  }

  private verifyMailgunSignature(data: Record<string, any>, signature: string): boolean {
    const webhookSecret = process.env.MAILGUN_WEBHOOK_SECRET;
    if (!webhookSecret) return true;

    // Mailgun signature verification logic would go here
    return true;
  }

  private generateSignature(payload: any, secret: string): string {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  private mapToWebhookEvent(dbEvent: any): WebhookEvent {
    return {
      id: dbEvent.id,
      provider: dbEvent.provider,
      event: dbEvent.event,
      data: dbEvent.data,
      signature: dbEvent.signature,
      timestamp: dbEvent.timestamp,
      processed: dbEvent.processed
    };
  }

  private generateId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}