import { PrismaClient, PriorityLevel } from '@prisma/client';
import { logger } from '../utils/logger';

export interface NotificationData {
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  priority?: PriorityLevel;
  delivery_method?: string;
}

export class NotificationService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async sendNotification(notificationData: NotificationData) {
    try {
      // Create notification record
      const notification = await this.prisma.notifications.create({
        data: {
          user_id: notificationData.user_id,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data || {},
          delivery_method: notificationData.delivery_method || 'in_app',
          sent_at: new Date()
        }
      });

      // In a real implementation, this would:
      // 1. Send email notifications
      // 2. Send push notifications
      // 3. Send SMS notifications
      // 4. Integrate with external notification services

      logger.info(`Notification sent: ${notification.id} to user: ${notificationData.user_id}`);
      
      return notification;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  async getNotifications(userId: string, options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}) {
    const { unreadOnly = false, limit = 50, offset = 0 } = options;

    const where: any = { user_id: userId };
    if (unreadOnly) {
      where.read = false;
    }

    return this.prisma.notifications.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notifications.updateMany({
      where: {
        id: notificationId,
        user_id: userId
      },
      data: {
        read: true
      }
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notifications.updateMany({
      where: {
        user_id: userId,
        read: false
      },
      data: {
        read: true
      }
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notifications.count({
      where: {
        user_id: userId,
        read: false
      }
    });
  }
}