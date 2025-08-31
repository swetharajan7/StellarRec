import webpush from 'web-push';
import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { TemplateService } from './templateService';
import { DeliveryTrackingService } from './deliveryTrackingService';
import handlebars from 'handlebars';

const prisma = new PrismaClient();

export interface PushNotification {
  id?: string;
  to: string | string[]; // Device tokens or subscription endpoints
  title: string;
  body?: string;
  templateId?: string;
  templateData?: Record<string, any>;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, any>;
  actions?: PushAction[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
  userId?: string;
  category?: string;
  tags?: string[];
  ttl?: number; // Time to live in seconds
  silent?: boolean;
}

export interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushDeliveryResult {
  messageId: string;
  success: boolean;
  recipient: string;
  error?: string;
  response?: any;
}

export interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class PushNotificationService {
  private templateService: TemplateService;
  private deliveryTrackingService: DeliveryTrackingService;
  private firebaseApp: admin.app.App | null = null;

  constructor() {
    this.templateService = new TemplateService();
    this.deliveryTrackingService = new DeliveryTrackingService();
    this.initializeServices();
  }

  async sendPushNotification(notification: PushNotification): Promise<PushDeliveryResult[]> {
    try {
      logger.info('Sending push notification', { 
        to: notification.to,
        title: notification.title,
        templateId: notification.templateId 
      });

      // Generate content from template if templateId is provided
      let title = notification.title;
      let body = notification.body;

      if (notification.templateId) {
        const template = await this.templateService.getTemplate(notification.templateId);
        if (template) {
          title = this.compileTemplate(template.title || title, notification.templateData || {});
          body = this.compileTemplate(template.content, notification.templateData || {});
        }
      }

      const recipients = Array.isArray(notification.to) ? notification.to : [notification.to];
      const results: PushDeliveryResult[] = [];

      for (const recipient of recipients) {
        try {
          let result: PushDeliveryResult;

          // Determine if it's a web push subscription or FCM token
          if (this.isWebPushSubscription(recipient)) {
            result = await this.sendWebPush(recipient, { ...notification, title, body });
          } else {
            result = await this.sendFCMPush(recipient, { ...notification, title, body });
          }

          results.push(result);

          // Track delivery
          await this.deliveryTrackingService.trackDelivery({
            notificationId: notification.id || this.generateId(),
            channel: 'push',
            recipient,
            status: result.success ? 'sent' : 'failed',
            providerId: result.messageId,
            sentAt: new Date(),
            error: result.error,
            metadata: {
              platform: this.isWebPushSubscription(recipient) ? 'web' : 'mobile',
              response: result.response
            }
          });

        } catch (error) {
          logger.error('Error sending push to recipient:', { recipient, error: error.message });
          results.push({
            messageId: this.generateId(),
            success: false,
            recipient,
            error: error.message
          });
        }
      }

      logger.info('Push notifications sent', { 
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return results;

    } catch (error) {
      logger.error('Error sending push notification:', error);
      throw new Error(`Failed to send push notification: ${error.message}`);
    }
  }

  async sendBulkPushNotifications(notifications: PushNotification[]): Promise<PushDeliveryResult[]> {
    const results: PushDeliveryResult[] = [];
    const batchSize = parseInt(process.env.PUSH_BATCH_SIZE || '100');

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchPromises = batch.map(notification => this.sendPushNotification(notification));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(...result.value);
          } else {
            logger.error('Bulk push notification failed:', { 
              notification: batch[index],
              error: result.reason 
            });
          }
        });

        // Rate limiting between batches
        if (i + batchSize < notifications.length) {
          await this.delay(parseInt(process.env.PUSH_BATCH_DELAY || '500'));
        }
      } catch (error) {
        logger.error('Bulk push notification batch failed:', error);
      }
    }

    return results;
  }

  async schedulePushNotification(notification: PushNotification, scheduledAt: Date): Promise<string> {
    try {
      const scheduledNotification = await prisma.scheduledNotification.create({
        data: {
          id: this.generateId(),
          channel: 'push',
          recipient: Array.isArray(notification.to) ? notification.to[0] : notification.to,
          subject: notification.title,
          content: {
            title: notification.title,
            body: notification.body,
            templateId: notification.templateId,
            templateData: notification.templateData,
            icon: notification.icon,
            badge: notification.badge,
            image: notification.image,
            data: notification.data,
            actions: notification.actions,
            ttl: notification.ttl,
            silent: notification.silent
          },
          scheduledAt,
          status: 'scheduled',
          priority: notification.priority,
          userId: notification.userId,
          category: notification.category,
          tags: notification.tags || []
        }
      });

      logger.info('Push notification scheduled successfully', { 
        id: scheduledNotification.id,
        scheduledAt 
      });

      return scheduledNotification.id;

    } catch (error) {
      logger.error('Error scheduling push notification:', error);
      throw new Error(`Failed to schedule push notification: ${error.message}`);
    }
  }

  async registerDevice(userId: string, deviceToken: string, platform: 'ios' | 'android' | 'web', subscription?: WebPushSubscription): Promise<void> {
    try {
      await prisma.deviceRegistration.upsert({
        where: {
          userId_deviceToken: {
            userId,
            deviceToken
          }
        },
        update: {
          platform,
          subscription: subscription || undefined,
          lastSeen: new Date(),
          active: true
        },
        create: {
          userId,
          deviceToken,
          platform,
          subscription: subscription || undefined,
          lastSeen: new Date(),
          active: true
        }
      });

      logger.info('Device registered successfully', { userId, platform });

    } catch (error) {
      logger.error('Error registering device:', error);
      throw new Error(`Failed to register device: ${error.message}`);
    }
  }

  async unregisterDevice(userId: string, deviceToken: string): Promise<void> {
    try {
      await prisma.deviceRegistration.update({
        where: {
          userId_deviceToken: {
            userId,
            deviceToken
          }
        },
        data: {
          active: false
        }
      });

      logger.info('Device unregistered successfully', { userId, deviceToken });

    } catch (error) {
      logger.error('Error unregistering device:', error);
      throw new Error(`Failed to unregister device: ${error.message}`);
    }
  }

  async getUserDevices(userId: string): Promise<any[]> {
    try {
      const devices = await prisma.deviceRegistration.findMany({
        where: {
          userId,
          active: true
        },
        orderBy: {
          lastSeen: 'desc'
        }
      });

      return devices;

    } catch (error) {
      logger.error('Error getting user devices:', error);
      throw new Error(`Failed to get user devices: ${error.message}`);
    }
  }

  async getPushTemplates(): Promise<any[]> {
    return await this.templateService.getTemplatesByChannel('push');
  }

  async createPushTemplate(template: {
    name: string;
    title: string;
    content: string;
    category?: string;
    variables?: string[];
  }): Promise<string> {
    return await this.templateService.createTemplate({
      ...template,
      channel: 'push'
    });
  }

  private async sendWebPush(subscriptionEndpoint: string, notification: PushNotification): Promise<PushDeliveryResult> {
    try {
      // Get subscription from database
      const device = await prisma.deviceRegistration.findFirst({
        where: {
          deviceToken: subscriptionEndpoint,
          platform: 'web',
          active: true
        }
      });

      if (!device || !device.subscription) {
        throw new Error('Web push subscription not found');
      }

      const subscription = device.subscription as any;
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: notification.icon || '/icons/icon-192x192.png',
        badge: notification.badge || '/icons/badge-72x72.png',
        image: notification.image,
        data: notification.data || {},
        actions: notification.actions || [],
        tag: notification.category,
        requireInteraction: notification.priority === 'high' || notification.priority === 'urgent',
        silent: notification.silent || false
      });

      const options = {
        TTL: notification.ttl || 86400, // 24 hours default
        urgency: this.mapPriorityToUrgency(notification.priority),
        vapidDetails: {
          subject: process.env.VAPID_SUBJECT || 'mailto:admin@stellarrec.com',
          publicKey: process.env.VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!
        }
      };

      const result = await webpush.sendNotification(subscription, payload, options);

      return {
        messageId: this.generateId(),
        success: true,
        recipient: subscriptionEndpoint,
        response: result
      };

    } catch (error) {
      logger.error('Web push error:', error);
      return {
        messageId: this.generateId(),
        success: false,
        recipient: subscriptionEndpoint,
        error: error.message
      };
    }
  }

  private async sendFCMPush(deviceToken: string, notification: PushNotification): Promise<PushDeliveryResult> {
    try {
      if (!this.firebaseApp) {
        throw new Error('Firebase not initialized');
      }

      const message: admin.messaging.Message = {
        token: deviceToken,
        notification: {
          title: notification.title,
          body: notification.body,
          imageUrl: notification.image
        },
        data: notification.data ? this.stringifyData(notification.data) : undefined,
        android: {
          priority: this.mapPriorityToAndroid(notification.priority),
          notification: {
            icon: notification.icon,
            color: '#1976d2',
            tag: notification.category,
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          },
          ttl: notification.ttl ? notification.ttl * 1000 : undefined
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body
              },
              badge: notification.badge ? parseInt(notification.badge) : undefined,
              sound: notification.silent ? undefined : 'default',
              'thread-id': notification.category
            }
          },
          headers: {
            'apns-priority': this.mapPriorityToAPNS(notification.priority),
            'apns-expiration': notification.ttl ? 
              Math.floor(Date.now() / 1000) + notification.ttl : undefined
          }
        }
      };

      const response = await admin.messaging().send(message);

      return {
        messageId: response,
        success: true,
        recipient: deviceToken,
        response
      };

    } catch (error) {
      logger.error('FCM push error:', error);
      return {
        messageId: this.generateId(),
        success: false,
        recipient: deviceToken,
        error: error.message
      };
    }
  }

  private initializeServices(): void {
    // Initialize Web Push
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || 'mailto:admin@stellarrec.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      logger.info('Web Push VAPID configured');
    }

    // Initialize Firebase
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        logger.info('Firebase Admin SDK initialized');
      } catch (error) {
        logger.error('Failed to initialize Firebase:', error);
      }
    }
  }

  private isWebPushSubscription(recipient: string): boolean {
    return recipient.startsWith('https://') || recipient.includes('push');
  }

  private compileTemplate(template: string, data: Record<string, any>): string {
    try {
      const compiledTemplate = handlebars.compile(template);
      return compiledTemplate(data);
    } catch (error) {
      logger.error('Error compiling push template:', error);
      return template;
    }
  }

  private mapPriorityToUrgency(priority: string): 'very-low' | 'low' | 'normal' | 'high' {
    switch (priority) {
      case 'urgent':
        return 'high';
      case 'high':
        return 'high';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }

  private mapPriorityToAndroid(priority: string): 'normal' | 'high' {
    return (priority === 'high' || priority === 'urgent') ? 'high' : 'normal';
  }

  private mapPriorityToAPNS(priority: string): '5' | '10' {
    return (priority === 'high' || priority === 'urgent') ? '10' : '5';
  }

  private stringifyData(data: Record<string, any>): Record<string, string> {
    const stringified: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      stringified[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return stringified;
  }

  private generateId(): string {
    return `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}