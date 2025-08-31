import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { addDays, addHours, addMinutes, subDays, isBefore, isAfter, differenceInDays, differenceInHours } from 'date-fns';
import { SmartTimingService } from './smartTimingService';
import { PersonalizationService } from './personalizationService';
import { ReminderDeliveryService } from './reminderDeliveryService';
import * as cron from 'node-cron';

const prisma = new PrismaClient();

export interface ReminderSchedule {
  id: string;
  userId: string;
  type: 'deadline' | 'milestone' | 'task' | 'follow_up' | 'custom';
  title: string;
  description?: string;
  targetDate: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  metadata: Record<string, any>;
  reminderTimes: ReminderTime[];
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface ReminderTime {
  id: string;
  scheduleId: string;
  scheduledAt: Date;
  type: 'initial' | 'follow_up' | 'escalation' | 'final';
  channel: 'email' | 'sms' | 'push' | 'in_app';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';
  content?: string;
  templateId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
}

export interface DeadlineReminder {
  deadlineId: string;
  deadlineDate: Date;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  userId: string;
  reminderStrategy: 'standard' | 'aggressive' | 'gentle' | 'custom';
}

export class ReminderSchedulingService {
  private smartTimingService: SmartTimingService;
  private personalizationService: PersonalizationService;
  private reminderDeliveryService: ReminderDeliveryService;
  private schedulingActive = false;

  constructor() {
    this.smartTimingService = new SmartTimingService();
    this.personalizationService = new PersonalizationService();
    this.reminderDeliveryService = new ReminderDeliveryService();
    this.startScheduler();
  }

  async createReminderSchedule(schedule: Omit<ReminderSchedule, 'id' | 'createdAt' | 'updatedAt' | 'reminderTimes'>): Promise<string> {
    try {
      logger.info('Creating reminder schedule', { 
        userId: schedule.userId, 
        type: schedule.type,
        targetDate: schedule.targetDate 
      });

      // Generate optimal reminder times using smart timing
      const optimalTimes = await this.smartTimingService.calculateOptimalReminderTimes(
        schedule.userId,
        schedule.targetDate,
        schedule.priority,
        schedule.type
      );

      // Create reminder schedule
      const reminderSchedule = await prisma.reminderSchedule.create({
        data: {
          id: this.generateId(),
          userId: schedule.userId,
          type: schedule.type,
          title: schedule.title,
          description: schedule.description,
          targetDate: schedule.targetDate,
          priority: schedule.priority,
          category: schedule.category,
          metadata: schedule.metadata,
          status: schedule.status,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Create reminder times
      for (const time of optimalTimes) {
        await prisma.reminderTime.create({
          data: {
            id: this.generateId(),
            scheduleId: reminderSchedule.id,
            scheduledAt: time.scheduledAt,
            type: time.type,
            channel: time.channel,
            status: 'pending',
            templateId: time.templateId
          }
        });
      }

      logger.info('Reminder schedule created', { 
        scheduleId: reminderSchedule.id,
        reminderCount: optimalTimes.length 
      });

      return reminderSchedule.id;

    } catch (error) {
      logger.error('Error creating reminder schedule:', error);
      throw new Error(`Failed to create reminder schedule: ${error.message}`);
    }
  }

  async createDeadlineReminders(deadline: DeadlineReminder): Promise<string[]> {
    try {
      logger.info('Creating deadline reminders', { 
        deadlineId: deadline.deadlineId,
        deadlineDate: deadline.deadlineDate 
      });

      const reminderSchedules: string[] = [];
      const strategy = await this.determineReminderStrategy(deadline);

      // Create multiple reminder schedules based on strategy
      const scheduleConfigs = this.generateDeadlineScheduleConfigs(deadline, strategy);

      for (const config of scheduleConfigs) {
        const scheduleId = await this.createReminderSchedule({
          userId: deadline.userId,
          type: 'deadline',
          title: config.title,
          description: config.description,
          targetDate: deadline.deadlineDate,
          priority: deadline.priority,
          category: deadline.category,
          metadata: {
            deadlineId: deadline.deadlineId,
            reminderType: config.reminderType,
            ...config.metadata
          },
          status: 'active'
        });

        reminderSchedules.push(scheduleId);
      }

      logger.info('Deadline reminders created', { 
        deadlineId: deadline.deadlineId,
        scheduleCount: reminderSchedules.length 
      });

      return reminderSchedules;

    } catch (error) {
      logger.error('Error creating deadline reminders:', error);
      throw new Error(`Failed to create deadline reminders: ${error.message}`);
    }
  }

  async updateReminderSchedule(scheduleId: string, updates: Partial<ReminderSchedule>): Promise<void> {
    try {
      await prisma.reminderSchedule.update({
        where: { id: scheduleId },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      // If target date changed, recalculate reminder times
      if (updates.targetDate) {
        await this.recalculateReminderTimes(scheduleId, updates.targetDate);
      }

      logger.info('Reminder schedule updated', { scheduleId });

    } catch (error) {
      logger.error('Error updating reminder schedule:', error);
      throw new Error(`Failed to update reminder schedule: ${error.message}`);
    }
  }

  async pauseReminderSchedule(scheduleId: string): Promise<void> {
    try {
      await prisma.reminderSchedule.update({
        where: { id: scheduleId },
        data: { status: 'paused', updatedAt: new Date() }
      });

      // Cancel pending reminders
      await prisma.reminderTime.updateMany({
        where: { 
          scheduleId,
          status: 'pending'
        },
        data: { status: 'cancelled' }
      });

      logger.info('Reminder schedule paused', { scheduleId });

    } catch (error) {
      logger.error('Error pausing reminder schedule:', error);
      throw new Error(`Failed to pause reminder schedule: ${error.message}`);
    }
  }

  async resumeReminderSchedule(scheduleId: string): Promise<void> {
    try {
      const schedule = await prisma.reminderSchedule.findUnique({
        where: { id: scheduleId }
      });

      if (!schedule) {
        throw new Error('Reminder schedule not found');
      }

      await prisma.reminderSchedule.update({
        where: { id: scheduleId },
        data: { status: 'active', updatedAt: new Date() }
      });

      // Recalculate reminder times for future reminders
      await this.recalculateReminderTimes(scheduleId, schedule.targetDate);

      logger.info('Reminder schedule resumed', { scheduleId });

    } catch (error) {
      logger.error('Error resuming reminder schedule:', error);
      throw new Error(`Failed to resume reminder schedule: ${error.message}`);
    }
  }

  async getUserReminderSchedules(userId: string, status?: string): Promise<ReminderSchedule[]> {
    try {
      const whereClause: any = { userId };
      if (status) {
        whereClause.status = status;
      }

      const schedules = await prisma.reminderSchedule.findMany({
        where: whereClause,
        include: {
          reminderTimes: true
        },
        orderBy: { targetDate: 'asc' }
      });

      return schedules.map(this.mapToReminderSchedule);

    } catch (error) {
      logger.error('Error getting user reminder schedules:', error);
      throw new Error(`Failed to get user reminder schedules: ${error.message}`);
    }
  }

  async getUpcomingReminders(userId?: string, hours: number = 24): Promise<ReminderTime[]> {
    try {
      const now = new Date();
      const cutoff = addHours(now, hours);

      const whereClause: any = {
        scheduledAt: {
          gte: now,
          lte: cutoff
        },
        status: 'pending'
      };

      if (userId) {
        whereClause.schedule = { userId };
      }

      const reminders = await prisma.reminderTime.findMany({
        where: whereClause,
        include: {
          schedule: true
        },
        orderBy: { scheduledAt: 'asc' }
      });

      return reminders.map(this.mapToReminderTime);

    } catch (error) {
      logger.error('Error getting upcoming reminders:', error);
      throw new Error(`Failed to get upcoming reminders: ${error.message}`);
    }
  }

  async processScheduledReminders(): Promise<void> {
    try {
      const now = new Date();
      const dueReminders = await prisma.reminderTime.findMany({
        where: {
          scheduledAt: { lte: now },
          status: 'pending'
        },
        include: {
          schedule: true
        },
        take: 100
      });

      for (const reminder of dueReminders) {
        try {
          await this.processReminder(reminder);
        } catch (error) {
          logger.error('Error processing individual reminder:', {
            reminderId: reminder.id,
            error: error.message
          });
        }
      }

      if (dueReminders.length > 0) {
        logger.info('Scheduled reminders processed', { count: dueReminders.length });
      }

    } catch (error) {
      logger.error('Error processing scheduled reminders:', error);
    }
  }

  private async processReminder(reminder: any): Promise<void> {
    try {
      // Generate personalized content
      const personalizedContent = await this.personalizationService.generateReminderContent(
        reminder.schedule.userId,
        reminder.schedule,
        reminder.type
      );

      // Send reminder
      const deliveryResult = await this.reminderDeliveryService.sendReminder({
        reminderId: reminder.id,
        userId: reminder.schedule.userId,
        channel: reminder.channel,
        title: personalizedContent.title,
        content: personalizedContent.content,
        priority: reminder.schedule.priority,
        metadata: {
          scheduleId: reminder.scheduleId,
          reminderType: reminder.type,
          category: reminder.schedule.category
        }
      });

      // Update reminder status
      await prisma.reminderTime.update({
        where: { id: reminder.id },
        data: {
          status: deliveryResult.success ? 'sent' : 'failed',
          sentAt: new Date(),
          content: personalizedContent.content
        }
      });

      logger.info('Reminder processed', { 
        reminderId: reminder.id,
        success: deliveryResult.success 
      });

    } catch (error) {
      logger.error('Error processing reminder:', error);
      
      // Mark as failed
      await prisma.reminderTime.update({
        where: { id: reminder.id },
        data: { status: 'failed' }
      });
    }
  }

  private async determineReminderStrategy(deadline: DeadlineReminder): Promise<string> {
    // Analyze user behavior to determine optimal strategy
    const userBehavior = await this.smartTimingService.getUserBehaviorProfile(deadline.userId);
    
    if (userBehavior.procrastinationTendency > 0.7) {
      return 'aggressive';
    } else if (userBehavior.responsiveness > 0.8) {
      return 'gentle';
    } else if (deadline.reminderStrategy !== 'standard') {
      return deadline.reminderStrategy;
    }
    
    return 'standard';
  }

  private generateDeadlineScheduleConfigs(deadline: DeadlineReminder, strategy: string): any[] {
    const configs = [];
    const daysUntilDeadline = differenceInDays(deadline.deadlineDate, new Date());

    switch (strategy) {
      case 'aggressive':
        // More frequent reminders for procrastinators
        if (daysUntilDeadline > 14) {
          configs.push({
            title: `Early Reminder: ${deadline.title}`,
            description: 'Get started early to avoid last-minute stress',
            reminderType: 'early_start',
            metadata: { timing: 'early' }
          });
        }
        if (daysUntilDeadline > 7) {
          configs.push({
            title: `One Week Reminder: ${deadline.title}`,
            description: 'One week remaining - time to focus!',
            reminderType: 'one_week',
            metadata: { timing: 'weekly' }
          });
        }
        configs.push({
          title: `Final Reminder: ${deadline.title}`,
          description: 'Deadline approaching - complete now!',
          reminderType: 'final',
          metadata: { timing: 'final' }
        });
        break;

      case 'gentle':
        // Fewer, more polite reminders
        if (daysUntilDeadline > 7) {
          configs.push({
            title: `Friendly Reminder: ${deadline.title}`,
            description: 'Just a gentle reminder about your upcoming deadline',
            reminderType: 'gentle',
            metadata: { timing: 'gentle' }
          });
        }
        break;

      default: // standard
        if (daysUntilDeadline > 7) {
          configs.push({
            title: `Upcoming Deadline: ${deadline.title}`,
            description: 'You have an upcoming deadline',
            reminderType: 'standard',
            metadata: { timing: 'standard' }
          });
        }
        configs.push({
          title: `Deadline Tomorrow: ${deadline.title}`,
          description: 'Your deadline is tomorrow',
          reminderType: 'final',
          metadata: { timing: 'final' }
        });
        break;
    }

    return configs;
  }

  private async recalculateReminderTimes(scheduleId: string, newTargetDate: Date): Promise<void> {
    try {
      const schedule = await prisma.reminderSchedule.findUnique({
        where: { id: scheduleId }
      });

      if (!schedule) return;

      // Cancel existing pending reminders
      await prisma.reminderTime.updateMany({
        where: { 
          scheduleId,
          status: 'pending'
        },
        data: { status: 'cancelled' }
      });

      // Generate new optimal times
      const optimalTimes = await this.smartTimingService.calculateOptimalReminderTimes(
        schedule.userId,
        newTargetDate,
        schedule.priority as any,
        schedule.type as any
      );

      // Create new reminder times
      for (const time of optimalTimes) {
        await prisma.reminderTime.create({
          data: {
            id: this.generateId(),
            scheduleId,
            scheduledAt: time.scheduledAt,
            type: time.type,
            channel: time.channel,
            status: 'pending',
            templateId: time.templateId
          }
        });
      }

      logger.info('Reminder times recalculated', { 
        scheduleId,
        newReminderCount: optimalTimes.length 
      });

    } catch (error) {
      logger.error('Error recalculating reminder times:', error);
    }
  }

  private startScheduler(): void {
    if (this.schedulingActive) return;

    // Process reminders every minute
    cron.schedule('* * * * *', async () => {
      try {
        await this.processScheduledReminders();
      } catch (error) {
        logger.error('Error in reminder scheduler:', error);
      }
    });

    this.schedulingActive = true;
    logger.info('Reminder scheduler started');
  }

  private mapToReminderSchedule(dbSchedule: any): ReminderSchedule {
    return {
      id: dbSchedule.id,
      userId: dbSchedule.userId,
      type: dbSchedule.type,
      title: dbSchedule.title,
      description: dbSchedule.description,
      targetDate: dbSchedule.targetDate,
      priority: dbSchedule.priority,
      category: dbSchedule.category,
      metadata: dbSchedule.metadata,
      reminderTimes: dbSchedule.reminderTimes?.map(this.mapToReminderTime) || [],
      status: dbSchedule.status,
      createdAt: dbSchedule.createdAt,
      updatedAt: dbSchedule.updatedAt
    };
  }

  private mapToReminderTime(dbReminder: any): ReminderTime {
    return {
      id: dbReminder.id,
      scheduleId: dbReminder.scheduleId,
      scheduledAt: dbReminder.scheduledAt,
      type: dbReminder.type,
      channel: dbReminder.channel,
      status: dbReminder.status,
      content: dbReminder.content,
      templateId: dbReminder.templateId,
      sentAt: dbReminder.sentAt,
      deliveredAt: dbReminder.deliveredAt
    };
  }

  private generateId(): string {
    return `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}