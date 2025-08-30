import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';
import { logger } from '../utils/logger';

export interface Reminder {
  id: string;
  user_id: string;
  deadline_id?: string;
  timeline_item_id?: string;
  type: 'deadline' | 'timeline' | 'custom' | 'urgent';
  title: string;
  message: string;
  scheduled_for: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  channels: ('email' | 'sms' | 'push')[];
  sent_at?: Date;
  error_message?: string;
}

export class ReminderService {
  constructor(private prisma: PrismaClient) {}

  async createReminder(reminderData: Omit<Reminder, 'id' | 'status' | 'sent_at'>) {
    try {
      const reminder = await this.prisma.reminders.create({
        data: {
          ...reminderData,
          status: 'pending',
          created_at: new Date()
        }
      });

      logger.info(`Reminder created: ${reminder.id} for user: ${reminderData.user_id}`);
      return reminder;
    } catch (error) {
      logger.error('Error creating reminder:', error);
      throw error;
    }
  }

  async scheduleDeadlineReminders(deadlineId: string) {
    try {
      const deadline = await this.prisma.deadlines.findUnique({
        where: { id: deadlineId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              timezone: true,
              notification_preferences: true
            }
          },
          university: {
            select: {
              name: true,
              short_name: true
            }
          }
        }
      });

      if (!deadline) {
        throw new Error('Deadline not found');
      }

      const reminderSettings = deadline.reminder_settings as any || {
        enabled: true,
        intervals: [7, 3, 1], // Default: 1 week, 3 days, 1 day before
        channels: ['email']
      };

      if (!reminderSettings.enabled) {
        logger.info(`Reminders disabled for deadline: ${deadlineId}`);
        return [];
      }

      const reminders = [];
      const userTimezone = deadline.user.timezone || 'UTC';
      const dueDate = moment.tz(deadline.due_date, userTimezone);

      for (const interval of reminderSettings.intervals) {
        const reminderTime = dueDate.clone().subtract(interval, 'days').hour(9).minute(0).second(0);

        // Don't schedule reminders in the past
        if (reminderTime.isAfter(moment())) {
          const reminder = await this.createReminder({
            user_id: deadline.user_id,
            deadline_id: deadline.id,
            type: 'deadline',
            title: `Reminder: ${deadline.title}`,
            message: this.generateReminderMessage(deadline, interval),
            scheduled_for: reminderTime.toDate(),
            channels: reminderSettings.channels
          });

          reminders.push(reminder);
        }
      }

      logger.info(`Scheduled ${reminders.length} reminders for deadline: ${deadlineId}`);
      return reminders;
    } catch (error) {
      logger.error('Error scheduling deadline reminders:', error);
      throw error;
    }
  }

  async processDueReminders() {
    try {
      const now = new Date();
      const dueReminders = await this.prisma.reminders.findMany({
        where: {
          status: 'pending',
          scheduled_for: {
            lte: now
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
              phone: true,
              notification_preferences: true
            }
          },
          deadline: {
            select: {
              id: true,
              title: true,
              due_date: true,
              type: true,
              priority: true,
              university: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      logger.info(`Processing ${dueReminders.length} due reminders`);

      for (const reminder of dueReminders) {
        try {
          await this.sendReminder(reminder);
        } catch (error) {
          logger.error(`Failed to send reminder ${reminder.id}:`, error);
          await this.markReminderFailed(reminder.id, error.message);
        }
      }

      return dueReminders.length;
    } catch (error) {
      logger.error('Error processing due reminders:', error);
      throw error;
    }
  }

  private async sendReminder(reminder: any) {
    try {
      const user = reminder.user;
      const userPreferences = user.notification_preferences as any || {};

      // Check if user has disabled this type of notification
      if (userPreferences.reminders === false) {
        await this.markReminderCancelled(reminder.id, 'User has disabled reminder notifications');
        return;
      }

      // Send via each enabled channel
      const results = [];
      for (const channel of reminder.channels) {
        try {
          switch (channel) {
            case 'email':
              if (userPreferences.email !== false) {
                await this.sendEmailReminder(reminder);
                results.push({ channel, status: 'sent' });
              } else {
                results.push({ channel, status: 'skipped', reason: 'Email notifications disabled' });
              }
              break;

            case 'sms':
              if (user.phone && userPreferences.sms !== false) {
                await this.sendSMSReminder(reminder);
                results.push({ channel, status: 'sent' });
              } else {
                results.push({ channel, status: 'skipped', reason: 'SMS not available or disabled' });
              }
              break;

            case 'push':
              if (userPreferences.push !== false) {
                await this.sendPushReminder(reminder);
                results.push({ channel, status: 'sent' });
              } else {
                results.push({ channel, status: 'skipped', reason: 'Push notifications disabled' });
              }
              break;
          }
        } catch (channelError) {
          results.push({ channel, status: 'failed', error: channelError.message });
        }
      }

      // Mark as sent if at least one channel succeeded
      const sentChannels = results.filter(r => r.status === 'sent');
      if (sentChannels.length > 0) {
        await this.markReminderSent(reminder.id, results);
      } else {
        await this.markReminderFailed(reminder.id, 'All channels failed or were disabled');
      }

      logger.info(`Reminder ${reminder.id} processed:`, results);
    } catch (error) {
      logger.error(`Error sending reminder ${reminder.id}:`, error);
      throw error;
    }
  }

  private async sendEmailReminder(reminder: any) {
    // This would integrate with the notification service
    // For now, we'll simulate sending an email
    logger.info(`EMAIL REMINDER: Sending to ${reminder.user.email}`);
    logger.info(`Subject: ${reminder.title}`);
    logger.info(`Message: ${reminder.message}`);

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendSMSReminder(reminder: any) {
    // This would integrate with SMS service (Twilio, etc.)
    logger.info(`SMS REMINDER: Sending to ${reminder.user.phone}`);
    logger.info(`Message: ${reminder.message}`);

    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async sendPushReminder(reminder: any) {
    // This would integrate with push notification service
    logger.info(`PUSH REMINDER: Sending to user ${reminder.user.id}`);
    logger.info(`Title: ${reminder.title}`);
    logger.info(`Message: ${reminder.message}`);

    // Simulate push sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  private async markReminderSent(reminderId: string, results: any[]) {
    await this.prisma.reminders.update({
      where: { id: reminderId },
      data: {
        status: 'sent',
        sent_at: new Date(),
        delivery_results: results
      }
    });
  }

  private async markReminderFailed(reminderId: string, errorMessage: string) {
    await this.prisma.reminders.update({
      where: { id: reminderId },
      data: {
        status: 'failed',
        error_message: errorMessage
      }
    });
  }

  private async markReminderCancelled(reminderId: string, reason: string) {
    await this.prisma.reminders.update({
      where: { id: reminderId },
      data: {
        status: 'cancelled',
        error_message: reason
      }
    });
  }

  private generateReminderMessage(deadline: any, daysUntil: number): string {
    const universityName = deadline.university?.name || 'your university';
    const dueDate = moment(deadline.due_date).format('MMMM Do, YYYY [at] h:mm A');
    
    let timePhrase;
    if (daysUntil === 1) {
      timePhrase = 'tomorrow';
    } else if (daysUntil === 0) {
      timePhrase = 'today';
    } else {
      timePhrase = `in ${daysUntil} days`;
    }

    const urgencyLevel = daysUntil <= 1 ? '🚨 URGENT' : daysUntil <= 3 ? '⚠️ Important' : '📅 Reminder';

    return `${urgencyLevel}: Your ${deadline.type} "${deadline.title}" for ${universityName} is due ${timePhrase} (${dueDate}). Make sure you have everything ready for submission!`;
  }

  async getUserReminders(userId: string, filters?: {
    status?: string;
    type?: string;
    upcoming_days?: number;
  }) {
    try {
      const where: any = { user_id: userId };

      if (filters?.status) {
        where.status = filters.status;
      }

      if (filters?.type) {
        where.type = filters.type;
      }

      if (filters?.upcoming_days) {
        where.scheduled_for = {
          gte: new Date(),
          lte: moment().add(filters.upcoming_days, 'days').toDate()
        };
      }

      const reminders = await this.prisma.reminders.findMany({
        where,
        include: {
          deadline: {
            select: {
              id: true,
              title: true,
              due_date: true,
              type: true,
              priority: true,
              university: {
                select: {
                  name: true,
                  short_name: true
                }
              }
            }
          }
        },
        orderBy: {
          scheduled_for: 'asc'
        }
      });

      return reminders;
    } catch (error) {
      logger.error('Error fetching user reminders:', error);
      throw error;
    }
  }

  async updateReminderSettings(userId: string, deadlineId: string, settings: {
    enabled: boolean;
    intervals?: number[];
    channels?: ('email' | 'sms' | 'push')[];
  }) {
    try {
      // Update deadline reminder settings
      await this.prisma.deadlines.update({
        where: { id: deadlineId },
        data: {
          reminder_settings: settings
        }
      });

      // Cancel existing pending reminders if disabled
      if (!settings.enabled) {
        await this.prisma.reminders.updateMany({
          where: {
            deadline_id: deadlineId,
            status: 'pending'
          },
          data: {
            status: 'cancelled',
            error_message: 'Reminders disabled by user'
          }
        });
      } else {
        // Reschedule reminders with new settings
        await this.scheduleDeadlineReminders(deadlineId);
      }

      logger.info(`Updated reminder settings for deadline ${deadlineId}`);
      return true;
    } catch (error) {
      logger.error('Error updating reminder settings:', error);
      throw error;
    }
  }

  async getReminderAnalytics(userId: string) {
    try {
      const [totalReminders, sentReminders, failedReminders, pendingReminders] = await Promise.all([
        this.prisma.reminders.count({
          where: { user_id: userId }
        }),
        this.prisma.reminders.count({
          where: {
            user_id: userId,
            status: 'sent'
          }
        }),
        this.prisma.reminders.count({
          where: {
            user_id: userId,
            status: 'failed'
          }
        }),
        this.prisma.reminders.count({
          where: {
            user_id: userId,
            status: 'pending'
          }
        })
      ]);

      const deliveryRate = totalReminders > 0 ? Math.round((sentReminders / totalReminders) * 100) : 0;

      // Get channel effectiveness
      const channelStats = await this.prisma.reminders.findMany({
        where: {
          user_id: userId,
          status: 'sent'
        },
        select: {
          channels: true,
          delivery_results: true
        }
      });

      const channelEffectiveness = this.calculateChannelEffectiveness(channelStats);

      return {
        total_reminders: totalReminders,
        sent_reminders: sentReminders,
        failed_reminders: failedReminders,
        pending_reminders: pendingReminders,
        delivery_rate: deliveryRate,
        channel_effectiveness: channelEffectiveness
      };
    } catch (error) {
      logger.error('Error generating reminder analytics:', error);
      throw error;
    }
  }

  private calculateChannelEffectiveness(channelStats: any[]) {
    const effectiveness = {
      email: { sent: 0, total: 0, rate: 0 },
      sms: { sent: 0, total: 0, rate: 0 },
      push: { sent: 0, total: 0, rate: 0 }
    };

    for (const stat of channelStats) {
      const results = stat.delivery_results as any[] || [];
      
      for (const result of results) {
        if (effectiveness[result.channel]) {
          effectiveness[result.channel].total++;
          if (result.status === 'sent') {
            effectiveness[result.channel].sent++;
          }
        }
      }
    }

    // Calculate rates
    for (const channel of Object.keys(effectiveness)) {
      const stats = effectiveness[channel];
      stats.rate = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
    }

    return effectiveness;
  }

  async createCustomReminder(userId: string, reminderData: {
    title: string;
    message: string;
    scheduled_for: Date;
    channels: ('email' | 'sms' | 'push')[];
  }) {
    try {
      const reminder = await this.createReminder({
        user_id: userId,
        type: 'custom',
        ...reminderData
      });

      logger.info(`Custom reminder created: ${reminder.id} for user: ${userId}`);
      return reminder;
    } catch (error) {
      logger.error('Error creating custom reminder:', error);
      throw error;
    }
  }

  async snoozeReminder(reminderId: string, snoozeMinutes: number) {
    try {
      const newScheduledTime = moment().add(snoozeMinutes, 'minutes').toDate();

      const reminder = await this.prisma.reminders.update({
        where: { id: reminderId },
        data: {
          scheduled_for: newScheduledTime,
          status: 'pending'
        }
      });

      logger.info(`Reminder ${reminderId} snoozed for ${snoozeMinutes} minutes`);
      return reminder;
    } catch (error) {
      logger.error('Error snoozing reminder:', error);
      throw error;
    }
  }
}