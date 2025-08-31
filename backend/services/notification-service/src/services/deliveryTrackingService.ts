import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { addDays, subDays, startOfDay, endOfDay } from 'date-fns';

const prisma = new PrismaClient();

export interface DeliveryRecord {
  id?: string;
  notificationId: string;
  channel: 'email' | 'sms' | 'push';
  recipient: string;
  status: 'sent' | 'delivered' | 'failed' | 'bounced' | 'opened' | 'clicked' | 'unsubscribed';
  providerId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  failedAt?: Date;
  error?: string;
  retryCount?: number;
  metadata?: Record<string, any>;
}

export interface DeliveryStats {
  totalSent: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
  bounced: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface RetryConfiguration {
  maxRetries: number;
  retryDelays: number[]; // in minutes
  retryableErrors: string[];
}

export class DeliveryTrackingService {
  private defaultRetryConfig: RetryConfiguration = {
    maxRetries: 3,
    retryDelays: [5, 30, 120], // 5 min, 30 min, 2 hours
    retryableErrors: [
      'timeout',
      'network_error',
      'rate_limit',
      'temporary_failure',
      'service_unavailable'
    ]
  };

  async trackDelivery(record: DeliveryRecord): Promise<string> {
    try {
      const deliveryRecord = await prisma.deliveryTracking.create({
        data: {
          id: record.id || this.generateId(),
          notificationId: record.notificationId,
          channel: record.channel,
          recipient: record.recipient,
          status: record.status,
          providerId: record.providerId,
          sentAt: record.sentAt,
          deliveredAt: record.deliveredAt,
          openedAt: record.openedAt,
          clickedAt: record.clickedAt,
          failedAt: record.failedAt,
          error: record.error,
          retryCount: record.retryCount || 0,
          metadata: record.metadata || {},
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('Delivery tracked', { 
        id: deliveryRecord.id,
        status: record.status,
        channel: record.channel 
      });

      // Schedule retry if needed
      if (record.status === 'failed' && this.shouldRetry(record)) {
        await this.scheduleRetry(deliveryRecord.id, record);
      }

      return deliveryRecord.id;

    } catch (error) {
      logger.error('Error tracking delivery:', error);
      throw new Error(`Failed to track delivery: ${error.message}`);
    }
  }

  async updateDeliveryStatus(
    deliveryId: string, 
    status: DeliveryRecord['status'],
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      // Set timestamp based on status
      switch (status) {
        case 'delivered':
          updateData.deliveredAt = new Date();
          break;
        case 'opened':
          updateData.openedAt = new Date();
          break;
        case 'clicked':
          updateData.clickedAt = new Date();
          break;
        case 'failed':
          updateData.failedAt = new Date();
          break;
      }

      if (metadata) {
        updateData.metadata = metadata;
      }

      await prisma.deliveryTracking.update({
        where: { id: deliveryId },
        data: updateData
      });

      logger.info('Delivery status updated', { id: deliveryId, status });

    } catch (error) {
      logger.error('Error updating delivery status:', error);
      throw new Error(`Failed to update delivery status: ${error.message}`);
    }
  }

  async getDeliveryStatus(notificationId: string): Promise<DeliveryRecord[]> {
    try {
      const records = await prisma.deliveryTracking.findMany({
        where: { notificationId },
        orderBy: { createdAt: 'desc' }
      });

      return records.map(this.mapToDeliveryRecord);

    } catch (error) {
      logger.error('Error getting delivery status:', error);
      throw new Error(`Failed to get delivery status: ${error.message}`);
    }
  }

  async getDeliveryStats(
    channel?: 'email' | 'sms' | 'push',
    startDate?: Date,
    endDate?: Date,
    userId?: string
  ): Promise<DeliveryStats> {
    try {
      const whereClause: any = {};

      if (channel) {
        whereClause.channel = channel;
      }

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = startOfDay(startDate);
        if (endDate) whereClause.createdAt.lte = endOfDay(endDate);
      }

      if (userId) {
        // This would require joining with notification table to get userId
        // For now, we'll skip this filter
      }

      const stats = await prisma.deliveryTracking.groupBy({
        by: ['status'],
        where: whereClause,
        _count: {
          status: true
        }
      });

      const statusCounts = stats.reduce((acc, stat) => {
        acc[stat.status] = stat._count.status;
        return acc;
      }, {} as Record<string, number>);

      const totalSent = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
      const delivered = statusCounts.delivered || 0;
      const failed = statusCounts.failed || 0;
      const opened = statusCounts.opened || 0;
      const clicked = statusCounts.clicked || 0;
      const bounced = statusCounts.bounced || 0;

      return {
        totalSent,
        delivered,
        failed,
        opened,
        clicked,
        bounced,
        deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
        openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
        clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
        bounceRate: totalSent > 0 ? (bounced / totalSent) * 100 : 0
      };

    } catch (error) {
      logger.error('Error getting delivery stats:', error);
      throw new Error(`Failed to get delivery stats: ${error.message}`);
    }
  }

  async getFailedDeliveries(
    channel?: 'email' | 'sms' | 'push',
    limit: number = 100
  ): Promise<DeliveryRecord[]> {
    try {
      const whereClause: any = {
        status: 'failed'
      };

      if (channel) {
        whereClause.channel = channel;
      }

      const records = await prisma.deliveryTracking.findMany({
        where: whereClause,
        orderBy: { failedAt: 'desc' },
        take: limit
      });

      return records.map(this.mapToDeliveryRecord);

    } catch (error) {
      logger.error('Error getting failed deliveries:', error);
      throw new Error(`Failed to get failed deliveries: ${error.message}`);
    }
  }

  async retryFailedDelivery(deliveryId: string): Promise<boolean> {
    try {
      const record = await prisma.deliveryTracking.findUnique({
        where: { id: deliveryId }
      });

      if (!record || record.status !== 'failed') {
        return false;
      }

      const retryCount = (record.retryCount || 0) + 1;
      
      if (retryCount > this.defaultRetryConfig.maxRetries) {
        logger.warn('Max retries exceeded', { deliveryId, retryCount });
        return false;
      }

      // Update retry count
      await prisma.deliveryTracking.update({
        where: { id: deliveryId },
        data: {
          retryCount,
          status: 'sent', // Reset to sent for retry
          updatedAt: new Date()
        }
      });

      // Schedule the actual retry (this would typically be handled by a queue)
      await this.scheduleRetry(deliveryId, this.mapToDeliveryRecord(record));

      logger.info('Delivery retry scheduled', { deliveryId, retryCount });
      return true;

    } catch (error) {
      logger.error('Error retrying failed delivery:', error);
      throw new Error(`Failed to retry delivery: ${error.message}`);
    }
  }

  async getDeliveryTrends(
    channel?: 'email' | 'sms' | 'push',
    days: number = 30
  ): Promise<Array<{
    date: string;
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
  }>> {
    try {
      const startDate = subDays(new Date(), days);
      const whereClause: any = {
        createdAt: { gte: startDate }
      };

      if (channel) {
        whereClause.channel = channel;
      }

      // This would typically use a more sophisticated query
      // For now, return mock trend data
      const trends = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        trends.push({
          date: date.toISOString().split('T')[0],
          sent: Math.floor(Math.random() * 1000),
          delivered: Math.floor(Math.random() * 900),
          failed: Math.floor(Math.random() * 100),
          deliveryRate: 85 + Math.random() * 10
        });
      }

      return trends;

    } catch (error) {
      logger.error('Error getting delivery trends:', error);
      throw new Error(`Failed to get delivery trends: ${error.message}`);
    }
  }

  async cleanupOldRecords(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = subDays(new Date(), daysToKeep);
      
      const result = await prisma.deliveryTracking.deleteMany({
        where: {
          createdAt: { lt: cutoffDate }
        }
      });

      logger.info('Old delivery records cleaned up', { 
        deletedCount: result.count,
        cutoffDate 
      });

      return result.count;

    } catch (error) {
      logger.error('Error cleaning up old records:', error);
      throw new Error(`Failed to cleanup old records: ${error.message}`);
    }
  }

  async trackWebhookEvent(
    providerId: string,
    event: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      // Find delivery record by provider ID
      const deliveryRecord = await prisma.deliveryTracking.findFirst({
        where: { providerId }
      });

      if (!deliveryRecord) {
        logger.warn('Delivery record not found for webhook', { providerId, event });
        return;
      }

      // Map webhook event to delivery status
      let status: DeliveryRecord['status'] | null = null;
      switch (event.toLowerCase()) {
        case 'delivered':
        case 'delivery':
          status = 'delivered';
          break;
        case 'opened':
        case 'open':
          status = 'opened';
          break;
        case 'clicked':
        case 'click':
          status = 'clicked';
          break;
        case 'bounced':
        case 'bounce':
          status = 'bounced';
          break;
        case 'failed':
        case 'failure':
          status = 'failed';
          break;
        case 'unsubscribed':
        case 'unsubscribe':
          status = 'unsubscribed';
          break;
      }

      if (status) {
        await this.updateDeliveryStatus(deliveryRecord.id, status, data);
      }

      logger.info('Webhook event processed', { 
        providerId, 
        event, 
        status,
        deliveryId: deliveryRecord.id 
      });

    } catch (error) {
      logger.error('Error tracking webhook event:', error);
    }
  }

  private shouldRetry(record: DeliveryRecord): boolean {
    const retryCount = record.retryCount || 0;
    
    if (retryCount >= this.defaultRetryConfig.maxRetries) {
      return false;
    }

    if (record.error && this.defaultRetryConfig.retryableErrors.some(
      error => record.error!.toLowerCase().includes(error)
    )) {
      return true;
    }

    return false;
  }

  private async scheduleRetry(deliveryId: string, record: DeliveryRecord): Promise<void> {
    try {
      const retryCount = (record.retryCount || 0) + 1;
      const delayMinutes = this.defaultRetryConfig.retryDelays[retryCount - 1] || 
                          this.defaultRetryConfig.retryDelays[this.defaultRetryConfig.retryDelays.length - 1];
      
      const retryAt = new Date(Date.now() + delayMinutes * 60 * 1000);

      await prisma.retryQueue.create({
        data: {
          deliveryId,
          retryAt,
          retryCount,
          createdAt: new Date()
        }
      });

      logger.info('Retry scheduled', { 
        deliveryId, 
        retryAt, 
        retryCount,
        delayMinutes 
      });

    } catch (error) {
      logger.error('Error scheduling retry:', error);
    }
  }

  private mapToDeliveryRecord(dbRecord: any): DeliveryRecord {
    return {
      id: dbRecord.id,
      notificationId: dbRecord.notificationId,
      channel: dbRecord.channel,
      recipient: dbRecord.recipient,
      status: dbRecord.status,
      providerId: dbRecord.providerId,
      sentAt: dbRecord.sentAt,
      deliveredAt: dbRecord.deliveredAt,
      openedAt: dbRecord.openedAt,
      clickedAt: dbRecord.clickedAt,
      failedAt: dbRecord.failedAt,
      error: dbRecord.error,
      retryCount: dbRecord.retryCount,
      metadata: dbRecord.metadata
    };
  }

  private generateId(): string {
    return `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}