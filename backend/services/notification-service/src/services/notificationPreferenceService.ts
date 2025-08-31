import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface NotificationPreferences {
  userId: string;
  channels: {
    email: ChannelPreference;
    sms: ChannelPreference;
    push: ChannelPreference;
  };
  categories: {
    [category: string]: CategoryPreference;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
    timezone: string;
  };
  frequency: {
    digest: 'immediate' | 'hourly' | 'daily' | 'weekly' | 'never';
    reminders: 'all' | 'important' | 'critical' | 'none';
  };
  globalOptOut: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChannelPreference {
  enabled: boolean;
  verified: boolean;
  verifiedAt?: Date;
  address?: string; // email address, phone number, etc.
}

export interface CategoryPreference {
  enabled: boolean;
  channels: ('email' | 'sms' | 'push')[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  defaultChannels: ('email' | 'sms' | 'push')[];
  defaultPriority: 'low' | 'normal' | 'high' | 'urgent';
  required: boolean; // Cannot be disabled
}

export class NotificationPreferenceService {
  private defaultCategories: NotificationCategory[] = [
    {
      id: 'application_deadlines',
      name: 'Application Deadlines',
      description: 'Notifications about upcoming application deadlines',
      defaultChannels: ['email', 'push'],
      defaultPriority: 'high',
      required: true
    },
    {
      id: 'admission_updates',
      name: 'Admission Updates',
      description: 'Updates on admission decisions and status changes',
      defaultChannels: ['email', 'sms', 'push'],
      defaultPriority: 'urgent',
      required: true
    },
    {
      id: 'recommendation_requests',
      name: 'Recommendation Requests',
      description: 'Requests for recommendation letters',
      defaultChannels: ['email'],
      defaultPriority: 'high',
      required: false
    },
    {
      id: 'essay_feedback',
      name: 'Essay Feedback',
      description: 'Feedback and suggestions on essays',
      defaultChannels: ['email', 'push'],
      defaultPriority: 'normal',
      required: false
    },
    {
      id: 'platform_updates',
      name: 'Platform Updates',
      description: 'Updates about new features and improvements',
      defaultChannels: ['email'],
      defaultPriority: 'low',
      required: false
    },
    {
      id: 'security_alerts',
      name: 'Security Alerts',
      description: 'Important security notifications',
      defaultChannels: ['email', 'sms'],
      defaultPriority: 'urgent',
      required: true
    },
    {
      id: 'marketing',
      name: 'Marketing & Promotions',
      description: 'Marketing messages and promotional content',
      defaultChannels: ['email'],
      defaultPriority: 'low',
      required: false
    }
  ];

  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences = await prisma.notificationPreference.findUnique({
        where: { userId }
      });

      if (!preferences) {
        // Create default preferences
        return await this.createDefaultPreferences(userId);
      }

      return this.mapToPreferences(preferences);

    } catch (error) {
      logger.error('Error getting user preferences:', error);
      throw new Error(`Failed to get user preferences: ${error.message}`);
    }
  }

  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      const existingPreferences = await this.getUserPreferences(userId);
      const updatedPreferences = { ...existingPreferences, ...preferences };

      await prisma.notificationPreference.upsert({
        where: { userId },
        update: {
          channels: updatedPreferences.channels,
          categories: updatedPreferences.categories,
          quietHours: updatedPreferences.quietHours,
          frequency: updatedPreferences.frequency,
          globalOptOut: updatedPreferences.globalOptOut,
          updatedAt: new Date()
        },
        create: {
          userId,
          channels: updatedPreferences.channels,
          categories: updatedPreferences.categories,
          quietHours: updatedPreferences.quietHours,
          frequency: updatedPreferences.frequency,
          globalOptOut: updatedPreferences.globalOptOut,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('User preferences updated', { userId });
      return updatedPreferences;

    } catch (error) {
      logger.error('Error updating user preferences:', error);
      throw new Error(`Failed to update user preferences: ${error.message}`);
    }
  }

  async updateChannelPreference(
    userId: string, 
    channel: 'email' | 'sms' | 'push', 
    preference: Partial<ChannelPreference>
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      preferences.channels[channel] = { ...preferences.channels[channel], ...preference };

      await this.updateUserPreferences(userId, { channels: preferences.channels });

      logger.info('Channel preference updated', { userId, channel });

    } catch (error) {
      logger.error('Error updating channel preference:', error);
      throw new Error(`Failed to update channel preference: ${error.message}`);
    }
  }

  async updateCategoryPreference(
    userId: string, 
    category: string, 
    preference: Partial<CategoryPreference>
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);
      preferences.categories[category] = { ...preferences.categories[category], ...preference };

      await this.updateUserPreferences(userId, { categories: preferences.categories });

      logger.info('Category preference updated', { userId, category });

    } catch (error) {
      logger.error('Error updating category preference:', error);
      throw new Error(`Failed to update category preference: ${error.message}`);
    }
  }

  async verifyChannel(userId: string, channel: 'email' | 'sms', verificationCode: string): Promise<boolean> {
    try {
      // Get verification record
      const verification = await prisma.channelVerification.findFirst({
        where: {
          userId,
          channel,
          code: verificationCode,
          expiresAt: { gt: new Date() },
          verified: false
        }
      });

      if (!verification) {
        return false;
      }

      // Mark as verified
      await prisma.channelVerification.update({
        where: { id: verification.id },
        data: { verified: true, verifiedAt: new Date() }
      });

      // Update channel preference
      await this.updateChannelPreference(userId, channel, {
        verified: true,
        verifiedAt: new Date()
      });

      logger.info('Channel verified successfully', { userId, channel });
      return true;

    } catch (error) {
      logger.error('Error verifying channel:', error);
      throw new Error(`Failed to verify channel: ${error.message}`);
    }
  }

  async sendVerificationCode(userId: string, channel: 'email' | 'sms', address: string): Promise<void> {
    try {
      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Save verification record
      await prisma.channelVerification.create({
        data: {
          userId,
          channel,
          address,
          code,
          expiresAt,
          verified: false
        }
      });

      // Send verification code (implementation would depend on the channel)
      // This would typically call the email or SMS service
      logger.info('Verification code sent', { userId, channel, address });

    } catch (error) {
      logger.error('Error sending verification code:', error);
      throw new Error(`Failed to send verification code: ${error.message}`);
    }
  }

  async checkNotificationAllowed(
    userId: string, 
    channel: 'email' | 'sms' | 'push', 
    category: string,
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserPreferences(userId);

      // Check global opt-out
      if (preferences.globalOptOut) {
        return false;
      }

      // Check channel enabled and verified
      const channelPref = preferences.channels[channel];
      if (!channelPref.enabled || (channel !== 'push' && !channelPref.verified)) {
        return false;
      }

      // Check category preferences
      const categoryPref = preferences.categories[category];
      if (!categoryPref || !categoryPref.enabled) {
        return false;
      }

      // Check if channel is allowed for this category
      if (!categoryPref.channels.includes(channel)) {
        return false;
      }

      // Check quiet hours
      if (preferences.quietHours.enabled && this.isInQuietHours(preferences.quietHours)) {
        // Allow urgent notifications during quiet hours
        return priority === 'urgent';
      }

      return true;

    } catch (error) {
      logger.error('Error checking notification permission:', error);
      return false;
    }
  }

  async getNotificationCategories(): Promise<NotificationCategory[]> {
    return this.defaultCategories;
  }

  async getUserOptOutToken(userId: string): Promise<string> {
    try {
      let token = await prisma.optOutToken.findUnique({
        where: { userId }
      });

      if (!token) {
        token = await prisma.optOutToken.create({
          data: {
            userId,
            token: this.generateOptOutToken(),
            createdAt: new Date()
          }
        });
      }

      return token.token;

    } catch (error) {
      logger.error('Error getting opt-out token:', error);
      throw new Error(`Failed to get opt-out token: ${error.message}`);
    }
  }

  async processOptOut(token: string): Promise<boolean> {
    try {
      const optOutRecord = await prisma.optOutToken.findUnique({
        where: { token }
      });

      if (!optOutRecord) {
        return false;
      }

      // Update user preferences to opt out globally
      await this.updateUserPreferences(optOutRecord.userId, { globalOptOut: true });

      logger.info('User opted out globally', { userId: optOutRecord.userId });
      return true;

    } catch (error) {
      logger.error('Error processing opt-out:', error);
      return false;
    }
  }

  async getPreferenceStatistics(): Promise<any> {
    try {
      const stats = await prisma.notificationPreference.aggregate({
        _count: {
          userId: true
        },
        where: {
          globalOptOut: false
        }
      });

      const channelStats = await prisma.notificationPreference.findMany({
        select: {
          channels: true
        }
      });

      const emailEnabled = channelStats.filter(p => (p.channels as any).email?.enabled).length;
      const smsEnabled = channelStats.filter(p => (p.channels as any).sms?.enabled).length;
      const pushEnabled = channelStats.filter(p => (p.channels as any).push?.enabled).length;

      return {
        totalUsers: stats._count.userId,
        channelAdoption: {
          email: emailEnabled,
          sms: smsEnabled,
          push: pushEnabled
        }
      };

    } catch (error) {
      logger.error('Error getting preference statistics:', error);
      throw new Error(`Failed to get preference statistics: ${error.message}`);
    }
  }

  private async createDefaultPreferences(userId: string): Promise<NotificationPreferences> {
    const defaultPreferences: NotificationPreferences = {
      userId,
      channels: {
        email: { enabled: true, verified: false },
        sms: { enabled: false, verified: false },
        push: { enabled: true, verified: true }
      },
      categories: {},
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC'
      },
      frequency: {
        digest: 'daily',
        reminders: 'all'
      },
      globalOptOut: false
    };

    // Set default category preferences
    this.defaultCategories.forEach(category => {
      defaultPreferences.categories[category.id] = {
        enabled: true,
        channels: category.defaultChannels,
        priority: category.defaultPriority
      };
    });

    await prisma.notificationPreference.create({
      data: {
        userId,
        channels: defaultPreferences.channels,
        categories: defaultPreferences.categories,
        quietHours: defaultPreferences.quietHours,
        frequency: defaultPreferences.frequency,
        globalOptOut: defaultPreferences.globalOptOut,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return defaultPreferences;
  }

  private mapToPreferences(dbPreferences: any): NotificationPreferences {
    return {
      userId: dbPreferences.userId,
      channels: dbPreferences.channels,
      categories: dbPreferences.categories,
      quietHours: dbPreferences.quietHours,
      frequency: dbPreferences.frequency,
      globalOptOut: dbPreferences.globalOptOut,
      createdAt: dbPreferences.createdAt,
      updatedAt: dbPreferences.updatedAt
    };
  }

  private isInQuietHours(quietHours: NotificationPreferences['quietHours']): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: quietHours.timezone 
    }).substring(0, 5);

    const start = quietHours.start;
    const end = quietHours.end;

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    } else {
      return currentTime >= start && currentTime <= end;
    }
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateOptOutToken(): string {
    return `opt_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }
}