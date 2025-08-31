import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import axios from 'axios';

const prisma = new PrismaClient();

export interface ReminderDeliveryRequest {
  reminderId: string;
  userId: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface ReminderDeliveryResult {
  success: boolean;
  deliveryId?: string;
  error?: string;
  providerId?: string;
}

export class ReminderDeliveryService {
  private readonly NOTIFICATION_SERVICE_URL: string;

  constructor() {
    this.NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3009';
  }

  async sendReminder(request: ReminderDeliveryRequest): Promise<ReminderDeliveryResult> {
    try {
      logger.info('Sending reminder', { 
        reminderId: request.reminderId,
        channel: request.channel 
      });

      // Send via notification service
      const response = await axios.post(`${this.NOTIFICATION_SERVICE_URL}/api/v1/${request.channel}/send`, {
        to: request.userId,
        title: request.title,
        content: request.content,
        priority: request.priority,
        category: 'reminder',
        metadata: {
          reminderId: request.reminderId,
          ...request.metadata
        }
      });

      const deliveryId = this.generateId();
      
      // Track delivery
      await prisma.reminderDelivery.create({
        data: {
          id: deliveryId,
          reminderId: request.reminderId,
          userId: request.userId,
          channel: request.channel,
          status: 'sent',
          providerId: response.data.messageId,
          sentAt: new Date(),
          metadata: request.metadata || {}
        }
      });

      return {
        success: true,
        deliveryId,
        providerId: response.data.messageId
      };

    } catch (error) {
      logger.error('Error sending reminder:', error);
      
      // Track failed delivery
      const deliveryId = this.generateId();
      await prisma.reminderDelivery.create({
        data: {
          id: deliveryId,
          reminderId: request.reminderId,
          userId: request.userId,
          channel: request.channel,
          status: 'failed',
          error: error.message,
          failedAt: new Date(),
          metadata: request.metadata || {}
        }
      });

      return {
        success: false,
        deliveryId,
        error: error.message
      };
    }
  }

  private generateId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}