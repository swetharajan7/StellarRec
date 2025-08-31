import Bull from 'bull';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { EmailService, EmailNotification } from './emailService';
import { SMSService, SMSNotification } from './smsService';
import { PushNotificationService, PushNotification } from './pushNotificationService';
import { NotificationPreferenceService } from './notificationPreferenceService';

const prisma = new PrismaClient();

export interface QueuedNotification {
  id: string;
  type: 'email' | 'sms' | 'push';
  notification: EmailNotification | SMSNotification | PushNotification;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt?: Date;
  userId?: string;
  retryCount?: number;
  maxRetries?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export class NotificationQueueService {
  private emailQueue: Bull.Queue;
  private smsQueue: Bull.Queue;
  private pushQueue: Bull.Queue;
  private redis: Redis;
  private emailService: EmailService;
  private smsService: SMSService;
  private pushNotificationService: PushNotificationService;
  private notificationPreferenceService: NotificationPreferenceService;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.pushNotificationService = new PushNotificationService();
    this.notificationPreferenceService = new NotificationPreferenceService();
    
    this.initializeQueues();
    this.setupProcessors();
  }

  async queueNotification(notification: QueuedNotification): Promise<string> {
    try {
      // Check user preferences before queueing
      if (notification.userId) {
        const allowed = await this.notificationPreferenceService.checkNotificationAllowed(
          notification.userId,
          notification.type,
          (notification.notification as any).category || 'general',
          notification.priority
        );

        if (!allowed) {
          logger.info('Notification blocked by user preferences', {
            userId: notification.userId,
            type: notification.type
          });
          return 'blocked';
        }
      }

      const queue = this.getQueue(notification.type);
      const jobOptions: Bull.JobOptions = {
        priority: this.mapPriorityToNumber(notification.priority),
        attempts: notification.maxRetries || 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 100,
        removeOnFail: 50
      };

      // Schedule notification if scheduledAt is provided
      if (notification.scheduledAt) {
        const delay = notification.scheduledAt.getTime() - Date.now();
        if (delay > 0) {
          jobOptions.delay = delay;
        }
      }

      const job = await queue.add('send', notification, jobOptions);

      logger.info('Notification queued', {
        id: notification.id,
        type: notification.type,
        jobId: job.id,
        priority: notification.priority,
        scheduledAt: notification.scheduledAt
      });

      return job.id?.toString() || notification.id;

    } catch (error) {
      logger.error('Error queueing notification:', error);
      throw new Error(`Failed to queue notification: ${error.message}`);
    }
  }

  async queueBulkNotifications(notifications: QueuedNotification[]): Promise<string[]> {
    const results: string[] = [];
    const batchSize = 100;

    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize);
      const batchPromises = batch.map(notification => this.queueNotification(notification));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            logger.error('Failed to queue notification in batch:', {
              notification: batch[index],
              error: result.reason
            });
            results.push('failed');
          }
        });
      } catch (error) {
        logger.error('Bulk notification queueing failed:', error);
      }
    }

    return results;
  }

  async cancelNotification(jobId: string, queueType: 'email' | 'sms' | 'push'): Promise<boolean> {
    try {
      const queue = this.getQueue(queueType);
      const job = await queue.getJob(jobId);

      if (job) {
        await job.remove();
        logger.info('Notification cancelled', { jobId, queueType });
        return true;
      }

      return false;

    } catch (error) {
      logger.error('Error cancelling notification:', error);
      throw new Error(`Failed to cancel notification: ${error.message}`);
    }
  }

  async getQueueStats(queueType?: 'email' | 'sms' | 'push'): Promise<Record<string, QueueStats>> {
    try {
      const stats: Record<string, QueueStats> = {};
      const queues = queueType ? [queueType] : ['email', 'sms', 'push'];

      for (const type of queues) {
        const queue = this.getQueue(type as 'email' | 'sms' | 'push');
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaiting(),
          queue.getActive(),
          queue.getCompleted(),
          queue.getFailed(),
          queue.getDelayed()
        ]);

        stats[type] = {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length,
          delayed: delayed.length,
          paused: await queue.isPaused()
        };
      }

      return stats;

    } catch (error) {
      logger.error('Error getting queue stats:', error);
      throw new Error(`Failed to get queue stats: ${error.message}`);
    }
  }

  async pauseQueue(queueType: 'email' | 'sms' | 'push'): Promise<void> {
    try {
      const queue = this.getQueue(queueType);
      await queue.pause();
      logger.info('Queue paused', { queueType });

    } catch (error) {
      logger.error('Error pausing queue:', error);
      throw new Error(`Failed to pause queue: ${error.message}`);
    }
  }

  async resumeQueue(queueType: 'email' | 'sms' | 'push'): Promise<void> {
    try {
      const queue = this.getQueue(queueType);
      await queue.resume();
      logger.info('Queue resumed', { queueType });

    } catch (error) {
      logger.error('Error resuming queue:', error);
      throw new Error(`Failed to resume queue: ${error.message}`);
    }
  }

  async retryFailedJobs(queueType: 'email' | 'sms' | 'push', limit: number = 100): Promise<number> {
    try {
      const queue = this.getQueue(queueType);
      const failedJobs = await queue.getFailed(0, limit - 1);
      
      let retriedCount = 0;
      for (const job of failedJobs) {
        try {
          await job.retry();
          retriedCount++;
        } catch (retryError) {
          logger.warn('Failed to retry job:', { jobId: job.id, error: retryError.message });
        }
      }

      logger.info('Failed jobs retried', { queueType, retriedCount, totalFailed: failedJobs.length });
      return retriedCount;

    } catch (error) {
      logger.error('Error retrying failed jobs:', error);
      throw new Error(`Failed to retry failed jobs: ${error.message}`);
    }
  }

  async cleanupCompletedJobs(queueType: 'email' | 'sms' | 'push', olderThan: number = 24): Promise<number> {
    try {
      const queue = this.getQueue(queueType);
      const cutoffTime = Date.now() - (olderThan * 60 * 60 * 1000); // hours to milliseconds
      
      const cleaned = await queue.clean(cutoffTime, 'completed');
      logger.info('Completed jobs cleaned up', { queueType, cleanedCount: cleaned.length });
      
      return cleaned.length;

    } catch (error) {
      logger.error('Error cleaning up completed jobs:', error);
      throw new Error(`Failed to cleanup completed jobs: ${error.message}`);
    }
  }

  async processScheduledNotifications(): Promise<void> {
    try {
      const now = new Date();
      const scheduledNotifications = await prisma.scheduledNotification.findMany({
        where: {
          scheduledAt: { lte: now },
          status: 'scheduled'
        },
        take: 100
      });

      for (const scheduled of scheduledNotifications) {
        try {
          const notification: QueuedNotification = {
            id: scheduled.id,
            type: scheduled.channel as 'email' | 'sms' | 'push',
            notification: scheduled.content as any,
            priority: scheduled.priority as any,
            userId: scheduled.userId
          };

          await this.queueNotification(notification);

          // Update status to sent
          await prisma.scheduledNotification.update({
            where: { id: scheduled.id },
            data: { status: 'sent' }
          });

        } catch (error) {
          logger.error('Error processing scheduled notification:', {
            id: scheduled.id,
            error: error.message
          });

          // Mark as failed
          await prisma.scheduledNotification.update({
            where: { id: scheduled.id },
            data: { status: 'failed' }
          });
        }
      }

      if (scheduledNotifications.length > 0) {
        logger.info('Scheduled notifications processed', { count: scheduledNotifications.length });
      }

    } catch (error) {
      logger.error('Error processing scheduled notifications:', error);
    }
  }

  private initializeQueues(): void {
    const redisConfig = {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    };

    this.emailQueue = new Bull('email notifications', redisConfig);
    this.smsQueue = new Bull('sms notifications', redisConfig);
    this.pushQueue = new Bull('push notifications', redisConfig);

    // Set up queue event listeners
    this.setupQueueEventListeners();

    logger.info('Notification queues initialized');
  }

  private setupProcessors(): void {
    // Email processor
    this.emailQueue.process('send', async (job) => {
      const notification = job.data as QueuedNotification;
      logger.info('Processing email notification', { id: notification.id });
      
      return await this.emailService.sendEmail(notification.notification as EmailNotification);
    });

    // SMS processor
    this.smsQueue.process('send', async (job) => {
      const notification = job.data as QueuedNotification;
      logger.info('Processing SMS notification', { id: notification.id });
      
      return await this.smsService.sendSMS(notification.notification as SMSNotification);
    });

    // Push processor
    this.pushQueue.process('send', async (job) => {
      const notification = job.data as QueuedNotification;
      logger.info('Processing push notification', { id: notification.id });
      
      return await this.pushNotificationService.sendPushNotification(notification.notification as PushNotification);
    });

    logger.info('Queue processors set up');
  }

  private setupQueueEventListeners(): void {
    const queues = [
      { name: 'email', queue: this.emailQueue },
      { name: 'sms', queue: this.smsQueue },
      { name: 'push', queue: this.pushQueue }
    ];

    queues.forEach(({ name, queue }) => {
      queue.on('completed', (job, result) => {
        logger.info(`${name} notification completed`, { 
          jobId: job.id, 
          notificationId: job.data.id 
        });
      });

      queue.on('failed', (job, err) => {
        logger.error(`${name} notification failed`, { 
          jobId: job.id, 
          notificationId: job.data.id,
          error: err.message,
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts.attempts
        });
      });

      queue.on('stalled', (job) => {
        logger.warn(`${name} notification stalled`, { 
          jobId: job.id, 
          notificationId: job.data.id 
        });
      });

      queue.on('progress', (job, progress) => {
        logger.debug(`${name} notification progress`, { 
          jobId: job.id, 
          progress 
        });
      });
    });
  }

  private getQueue(type: 'email' | 'sms' | 'push'): Bull.Queue {
    switch (type) {
      case 'email':
        return this.emailQueue;
      case 'sms':
        return this.smsQueue;
      case 'push':
        return this.pushQueue;
      default:
        throw new Error(`Unknown queue type: ${type}`);
    }
  }

  private mapPriorityToNumber(priority: string): number {
    switch (priority) {
      case 'urgent':
        return 1;
      case 'high':
        return 2;
      case 'normal':
        return 3;
      case 'low':
        return 4;
      default:
        return 3;
    }
  }
}