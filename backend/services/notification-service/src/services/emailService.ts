import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { TemplateService } from './templateService';
import { DeliveryTrackingService } from './deliveryTrackingService';
import handlebars from 'handlebars';
import mjml2html from 'mjml';

const prisma = new PrismaClient();

export interface EmailNotification {
  id?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  templateId?: string;
  templateData?: Record<string, any>;
  htmlContent?: string;
  textContent?: string;
  attachments?: EmailAttachment[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
  userId?: string;
  category?: string;
  tags?: string[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
  cid?: string; // Content-ID for inline attachments
}

export interface EmailDeliveryResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private templateService: TemplateService;
  private deliveryTrackingService: DeliveryTrackingService;

  constructor() {
    this.templateService = new TemplateService();
    this.deliveryTrackingService = new DeliveryTrackingService();
    this.initializeTransporter();
  }

  async sendEmail(notification: EmailNotification): Promise<EmailDeliveryResult> {
    try {
      logger.info('Sending email notification', { 
        to: notification.to, 
        subject: notification.subject,
        templateId: notification.templateId 
      });

      // Generate content from template if templateId is provided
      let htmlContent = notification.htmlContent;
      let textContent = notification.textContent;

      if (notification.templateId) {
        const template = await this.templateService.getTemplate(notification.templateId);
        if (template) {
          htmlContent = this.compileTemplate(template.htmlContent, notification.templateData || {});
          textContent = this.compileTemplate(template.textContent || '', notification.templateData || {});
        }
      }

      // Convert MJML to HTML if needed
      if (htmlContent && htmlContent.includes('<mjml>')) {
        const mjmlResult = mjml2html(htmlContent);
        if (!mjmlResult.errors.length) {
          htmlContent = mjmlResult.html;
        }
      }

      // Prepare email options
      const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@stellarrec.com',
        to: Array.isArray(notification.to) ? notification.to.join(', ') : notification.to,
        cc: notification.cc ? (Array.isArray(notification.cc) ? notification.cc.join(', ') : notification.cc) : undefined,
        bcc: notification.bcc ? (Array.isArray(notification.bcc) ? notification.bcc.join(', ') : notification.bcc) : undefined,
        subject: notification.subject,
        html: htmlContent,
        text: textContent,
        attachments: notification.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          cid: att.cid
        })),
        priority: this.mapPriority(notification.priority),
        headers: {
          'X-Category': notification.category || 'general',
          'X-Tags': notification.tags?.join(',') || '',
          'X-User-ID': notification.userId || ''
        }
      };

      // Send email
      const result = await this.transporter.sendMail(mailOptions);

      // Track delivery
      await this.deliveryTrackingService.trackDelivery({
        notificationId: notification.id || this.generateId(),
        channel: 'email',
        recipient: Array.isArray(notification.to) ? notification.to[0] : notification.to,
        status: 'sent',
        providerId: result.messageId,
        sentAt: new Date(),
        metadata: {
          accepted: result.accepted,
          rejected: result.rejected,
          response: result.response
        }
      });

      logger.info('Email sent successfully', { 
        messageId: result.messageId,
        accepted: result.accepted.length,
        rejected: result.rejected.length
      });

      return {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        pending: result.pending || [],
        response: result.response
      };

    } catch (error) {
      logger.error('Error sending email:', error);
      
      // Track failed delivery
      if (notification.id) {
        await this.deliveryTrackingService.trackDelivery({
          notificationId: notification.id,
          channel: 'email',
          recipient: Array.isArray(notification.to) ? notification.to[0] : notification.to,
          status: 'failed',
          error: error.message,
          failedAt: new Date()
        });
      }

      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendBulkEmails(notifications: EmailNotification[]): Promise<EmailDeliveryResult[]> {
    const results: EmailDeliveryResult[] = [];
    const batchSize = parseInt(process.env.EMAIL_BATCH_SIZE || '10');

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchPromises = batch.map(notification => this.sendEmail(notification));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            logger.error('Bulk email failed:', { 
              notification: batch[index],
              error: result.reason 
            });
          }
        });

        // Rate limiting between batches
        if (i + batchSize < notifications.length) {
          await this.delay(parseInt(process.env.EMAIL_BATCH_DELAY || '1000'));
        }
      } catch (error) {
        logger.error('Bulk email batch failed:', error);
      }
    }

    return results;
  }

  async scheduleEmail(notification: EmailNotification, scheduledAt: Date): Promise<string> {
    try {
      const scheduledNotification = await prisma.scheduledNotification.create({
        data: {
          id: this.generateId(),
          channel: 'email',
          recipient: Array.isArray(notification.to) ? notification.to[0] : notification.to,
          subject: notification.subject,
          content: {
            templateId: notification.templateId,
            templateData: notification.templateData,
            htmlContent: notification.htmlContent,
            textContent: notification.textContent,
            attachments: notification.attachments
          },
          scheduledAt,
          status: 'scheduled',
          priority: notification.priority,
          userId: notification.userId,
          category: notification.category,
          tags: notification.tags || []
        }
      });

      logger.info('Email scheduled successfully', { 
        id: scheduledNotification.id,
        scheduledAt 
      });

      return scheduledNotification.id;

    } catch (error) {
      logger.error('Error scheduling email:', error);
      throw new Error(`Failed to schedule email: ${error.message}`);
    }
  }

  async cancelScheduledEmail(notificationId: string): Promise<void> {
    try {
      await prisma.scheduledNotification.update({
        where: { id: notificationId },
        data: { status: 'cancelled' }
      });

      logger.info('Scheduled email cancelled', { notificationId });

    } catch (error) {
      logger.error('Error cancelling scheduled email:', error);
      throw new Error(`Failed to cancel scheduled email: ${error.message}`);
    }
  }

  async getEmailStatus(messageId: string): Promise<any> {
    try {
      const delivery = await this.deliveryTrackingService.getDeliveryStatus(messageId);
      return delivery;

    } catch (error) {
      logger.error('Error getting email status:', error);
      throw new Error(`Failed to get email status: ${error.message}`);
    }
  }

  async validateEmailAddress(email: string): Promise<boolean> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async getEmailTemplates(): Promise<any[]> {
    return await this.templateService.getTemplatesByChannel('email');
  }

  async createEmailTemplate(template: {
    name: string;
    subject: string;
    htmlContent: string;
    textContent?: string;
    category?: string;
    variables?: string[];
  }): Promise<string> {
    return await this.templateService.createTemplate({
      ...template,
      channel: 'email'
    });
  }

  private initializeTransporter(): void {
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';

    switch (emailProvider) {
      case 'sendgrid':
        this.transporter = nodemailer.createTransporter({
          service: 'SendGrid',
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
          }
        });
        break;

      case 'ses':
        this.transporter = nodemailer.createTransporter({
          SES: {
            aws: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              region: process.env.AWS_REGION || 'us-east-1'
            }
          }
        });
        break;

      case 'mailgun':
        this.transporter = nodemailer.createTransporter({
          service: 'Mailgun',
          auth: {
            user: process.env.MAILGUN_USERNAME,
            pass: process.env.MAILGUN_PASSWORD
          }
        });
        break;

      default: // SMTP
        this.transporter = nodemailer.createTransporter({
          host: process.env.SMTP_HOST || 'localhost',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          },
          tls: {
            rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
          }
        });
    }

    // Verify transporter configuration
    this.transporter.verify((error, success) => {
      if (error) {
        logger.error('Email transporter verification failed:', error);
      } else {
        logger.info('Email transporter verified successfully');
      }
    });
  }

  private compileTemplate(template: string, data: Record<string, any>): string {
    try {
      const compiledTemplate = handlebars.compile(template);
      return compiledTemplate(data);
    } catch (error) {
      logger.error('Error compiling template:', error);
      return template;
    }
  }

  private mapPriority(priority: string): 'high' | 'normal' | 'low' {
    switch (priority) {
      case 'urgent':
      case 'high':
        return 'high';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }

  private generateId(): string {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}