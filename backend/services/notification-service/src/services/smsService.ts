import { Twilio } from 'twilio';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { TemplateService } from './templateService';
import { DeliveryTrackingService } from './deliveryTrackingService';
import handlebars from 'handlebars';
import axios from 'axios';

const prisma = new PrismaClient();

export interface SMSNotification {
  id?: string;
  to: string | string[];
  message?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
  userId?: string;
  category?: string;
  tags?: string[];
  mediaUrls?: string[];
}

export interface SMSDeliveryResult {
  messageId: string;
  status: string;
  to: string;
  errorCode?: string;
  errorMessage?: string;
}

export class SMSService {
  private twilioClient: Twilio;
  private templateService: TemplateService;
  private deliveryTrackingService: DeliveryTrackingService;
  private smsProvider: string;

  constructor() {
    this.templateService = new TemplateService();
    this.deliveryTrackingService = new DeliveryTrackingService();
    this.smsProvider = process.env.SMS_PROVIDER || 'twilio';
    this.initializeProvider();
  }

  async sendSMS(notification: SMSNotification): Promise<SMSDeliveryResult> {
    try {
      logger.info('Sending SMS notification', { 
        to: notification.to,
        templateId: notification.templateId 
      });

      // Generate content from template if templateId is provided
      let message = notification.message;
      if (notification.templateId) {
        const template = await this.templateService.getTemplate(notification.templateId);
        if (template) {
          message = this.compileTemplate(template.content, notification.templateData || {});
        }
      }

      if (!message) {
        throw new Error('SMS message content is required');
      }

      // Validate phone number
      const phoneNumber = Array.isArray(notification.to) ? notification.to[0] : notification.to;
      if (!this.validatePhoneNumber(phoneNumber)) {
        throw new Error('Invalid phone number format');
      }

      let result: SMSDeliveryResult;

      switch (this.smsProvider) {
        case 'twilio':
          result = await this.sendViaTwilio(phoneNumber, message, notification);
          break;
        case 'aws-sns':
          result = await this.sendViaAWSSNS(phoneNumber, message, notification);
          break;
        case 'nexmo':
          result = await this.sendViaNexmo(phoneNumber, message, notification);
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${this.smsProvider}`);
      }

      // Track delivery
      await this.deliveryTrackingService.trackDelivery({
        notificationId: notification.id || this.generateId(),
        channel: 'sms',
        recipient: phoneNumber,
        status: 'sent',
        providerId: result.messageId,
        sentAt: new Date(),
        metadata: {
          provider: this.smsProvider,
          status: result.status
        }
      });

      logger.info('SMS sent successfully', { 
        messageId: result.messageId,
        to: phoneNumber,
        status: result.status
      });

      return result;

    } catch (error) {
      logger.error('Error sending SMS:', error);
      
      // Track failed delivery
      if (notification.id) {
        const phoneNumber = Array.isArray(notification.to) ? notification.to[0] : notification.to;
        await this.deliveryTrackingService.trackDelivery({
          notificationId: notification.id,
          channel: 'sms',
          recipient: phoneNumber,
          status: 'failed',
          error: error.message,
          failedAt: new Date()
        });
      }

      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  async sendBulkSMS(notifications: SMSNotification[]): Promise<SMSDeliveryResult[]> {
    const results: SMSDeliveryResult[] = [];
    const batchSize = parseInt(process.env.SMS_BATCH_SIZE || '5');

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchPromises = batch.map(notification => this.sendSMS(notification));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            logger.error('Bulk SMS failed:', { 
              notification: batch[index],
              error: result.reason 
            });
          }
        });

        // Rate limiting between batches
        if (i + batchSize < notifications.length) {
          await this.delay(parseInt(process.env.SMS_BATCH_DELAY || '2000'));
        }
      } catch (error) {
        logger.error('Bulk SMS batch failed:', error);
      }
    }

    return results;
  }

  async scheduleSMS(notification: SMSNotification, scheduledAt: Date): Promise<string> {
    try {
      const scheduledNotification = await prisma.scheduledNotification.create({
        data: {
          id: this.generateId(),
          channel: 'sms',
          recipient: Array.isArray(notification.to) ? notification.to[0] : notification.to,
          subject: 'SMS Notification',
          content: {
            message: notification.message,
            templateId: notification.templateId,
            templateData: notification.templateData,
            mediaUrls: notification.mediaUrls
          },
          scheduledAt,
          status: 'scheduled',
          priority: notification.priority,
          userId: notification.userId,
          category: notification.category,
          tags: notification.tags || []
        }
      });

      logger.info('SMS scheduled successfully', { 
        id: scheduledNotification.id,
        scheduledAt 
      });

      return scheduledNotification.id;

    } catch (error) {
      logger.error('Error scheduling SMS:', error);
      throw new Error(`Failed to schedule SMS: ${error.message}`);
    }
  }

  async getSMSStatus(messageId: string): Promise<any> {
    try {
      const delivery = await this.deliveryTrackingService.getDeliveryStatus(messageId);
      return delivery;

    } catch (error) {
      logger.error('Error getting SMS status:', error);
      throw new Error(`Failed to get SMS status: ${error.message}`);
    }
  }

  async validatePhoneNumber(phoneNumber: string): Promise<boolean> {
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber);
  }

  async getSMSTemplates(): Promise<any[]> {
    return await this.templateService.getTemplatesByChannel('sms');
  }

  async createSMSTemplate(template: {
    name: string;
    content: string;
    category?: string;
    variables?: string[];
  }): Promise<string> {
    return await this.templateService.createTemplate({
      ...template,
      channel: 'sms'
    });
  }

  private async sendViaTwilio(
    phoneNumber: string, 
    message: string, 
    notification: SMSNotification
  ): Promise<SMSDeliveryResult> {
    try {
      const messageOptions: any = {
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      };

      // Add media URLs if provided
      if (notification.mediaUrls && notification.mediaUrls.length > 0) {
        messageOptions.mediaUrl = notification.mediaUrls;
      }

      const twilioMessage = await this.twilioClient.messages.create(messageOptions);

      return {
        messageId: twilioMessage.sid,
        status: twilioMessage.status,
        to: phoneNumber,
        errorCode: twilioMessage.errorCode || undefined,
        errorMessage: twilioMessage.errorMessage || undefined
      };

    } catch (error) {
      logger.error('Twilio SMS error:', error);
      throw error;
    }
  }

  private async sendViaAWSSNS(
    phoneNumber: string, 
    message: string, 
    notification: SMSNotification
  ): Promise<SMSDeliveryResult> {
    try {
      // AWS SNS implementation would go here
      // For now, return a mock result
      const messageId = `aws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        messageId,
        status: 'sent',
        to: phoneNumber
      };

    } catch (error) {
      logger.error('AWS SNS SMS error:', error);
      throw error;
    }
  }

  private async sendViaNexmo(
    phoneNumber: string, 
    message: string, 
    notification: SMSNotification
  ): Promise<SMSDeliveryResult> {
    try {
      const response = await axios.post('https://rest.nexmo.com/sms/json', {
        from: process.env.NEXMO_FROM_NUMBER,
        to: phoneNumber.replace('+', ''),
        text: message,
        api_key: process.env.NEXMO_API_KEY,
        api_secret: process.env.NEXMO_API_SECRET
      });

      const result = response.data.messages[0];
      
      return {
        messageId: result['message-id'],
        status: result.status === '0' ? 'sent' : 'failed',
        to: phoneNumber,
        errorCode: result.status !== '0' ? result.status : undefined,
        errorMessage: result.status !== '0' ? result['error-text'] : undefined
      };

    } catch (error) {
      logger.error('Nexmo SMS error:', error);
      throw error;
    }
  }

  private initializeProvider(): void {
    switch (this.smsProvider) {
      case 'twilio':
        this.twilioClient = new Twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        break;
      case 'aws-sns':
        // AWS SNS initialization would go here
        break;
      case 'nexmo':
        // Nexmo initialization would go here
        break;
      default:
        logger.warn(`Unknown SMS provider: ${this.smsProvider}, defaulting to Twilio`);
        this.twilioClient = new Twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
    }

    logger.info(`SMS service initialized with provider: ${this.smsProvider}`);
  }

  private compileTemplate(template: string, data: Record<string, any>): string {
    try {
      const compiledTemplate = handlebars.compile(template);
      return compiledTemplate(data);
    } catch (error) {
      logger.error('Error compiling SMS template:', error);
      return template;
    }
  }

  private generateId(): string {
    return `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}