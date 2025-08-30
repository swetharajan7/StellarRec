import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';
import { logger } from '../utils/logger';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  due_date: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'application' | 'essay' | 'recommendation' | 'test' | 'document' | 'other';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  estimated_duration_hours?: number;
  dependencies?: string[];
  university_id?: string;
  application_id?: string;
}

export interface Timeline {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  items: TimelineItem[];
  created_at: Date;
  updated_at: Date;
}

export class TimelineService {
  constructor(private prisma: PrismaClient) {}

  async createTimeline(userId: string, timelineData: Partial<Timeline>) {
    try {
      const timeline = await this.prisma.timelines.create({
        data: {
          user_id: userId,
          name: timelineData.name || 'My Application Timeline',
          description: timelineData.description,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      logger.info(`Timeline created: ${timeline.id} for user: ${userId}`);
      return timeline;
    } catch (error) {
      logger.error('Error creating timeline:', error);
      throw error;
    }
  }

  async generateSmartTimeline(userId: string, applications: any[]) {
    try {
      logger.info(`Generating smart timeline for user: ${userId}`);
      
      const timelineItems: TimelineItem[] = [];
      const now = moment();

      for (const application of applications) {
        const university = await this.prisma.universities.findUnique({
          where: { id: application.university_id },
          include: { programs: true }
        });

        if (!university) continue;

        const deadlines = university.deadlines as any || {};
        const applicationDeadline = moment(deadlines.application || application.deadline);

        // Generate timeline items based on deadline and requirements
        const items = this.generateTimelineItems(application, university, applicationDeadline);
        timelineItems.push(...items);
      }

      // Sort items by priority and due date
      const sortedItems = this.prioritizeTimelineItems(timelineItems);

      // Create timeline
      const timeline = await this.createTimeline(userId, {
        name: 'Smart Application Timeline',
        description: 'AI-generated timeline based on your applications and deadlines'
      });

      // Add items to timeline
      for (const item of sortedItems) {
        await this.addTimelineItem(timeline.id, item);
      }

      return this.getTimeline(timeline.id);
    } catch (error) {
      logger.error('Error generating smart timeline:', error);
      throw error;
    }
  }

  private generateTimelineItems(application: any, university: any, deadline: moment.Moment): TimelineItem[] {
    const items: TimelineItem[] = [];
    const now = moment();
    const weeksUntilDeadline = deadline.diff(now, 'weeks');

    // Application form completion
    items.push({
      id: `app-form-${application.id}`,
      title: `Complete ${university.name} Application`,
      description: 'Fill out and submit the main application form',
      due_date: deadline.clone().subtract(1, 'week').toDate(),
      priority: 'high',
      category: 'application',
      status: 'pending',
      estimated_duration_hours: 4,
      university_id: university.id,
      application_id: application.id
    });

    // Essay writing
    const essayRequirements = university.admission_requirements?.essays || [];
    essayRequirements.forEach((essay: any, index: number) => {
      const essayDueDate = deadline.clone().subtract(2 + index, 'weeks');
      items.push({
        id: `essay-${application.id}-${index}`,
        title: `Write Essay: ${essay.prompt?.substring(0, 50)}...`,
        description: essay.prompt,
        due_date: essayDueDate.toDate(),
        priority: 'high',
        category: 'essay',
        status: 'pending',
        estimated_duration_hours: 8,
        university_id: university.id,
        application_id: application.id
      });
    });

    // Recommendation letters
    const recommendationCount = university.admission_requirements?.recommendations || 2;
    for (let i = 0; i < recommendationCount; i++) {
      items.push({
        id: `rec-${application.id}-${i}`,
        title: `Request Recommendation Letter ${i + 1}`,
        description: `Request and follow up on recommendation letter from recommender`,
        due_date: deadline.clone().subtract(4, 'weeks').toDate(),
        priority: 'medium',
        category: 'recommendation',
        status: 'pending',
        estimated_duration_hours: 2,
        university_id: university.id,
        application_id: application.id
      });
    }

    // Test scores
    if (university.admission_requirements?.test_scores) {
      items.push({
        id: `test-${application.id}`,
        title: `Submit Test Scores to ${university.name}`,
        description: 'Send official test scores (SAT/ACT/GRE/GMAT)',
        due_date: deadline.clone().subtract(2, 'weeks').toDate(),
        priority: 'medium',
        category: 'test',
        status: 'pending',
        estimated_duration_hours: 1,
        university_id: university.id,
        application_id: application.id
      });
    }

    // Transcripts
    items.push({
      id: `transcript-${application.id}`,
      title: `Submit Official Transcripts`,
      description: 'Request and send official academic transcripts',
      due_date: deadline.clone().subtract(3, 'weeks').toDate(),
      priority: 'medium',
      category: 'document',
      status: 'pending',
      estimated_duration_hours: 2,
      university_id: university.id,
      application_id: application.id
    });

    // Financial aid (if applicable)
    if (university.admission_requirements?.financial_aid) {
      items.push({
        id: `finaid-${application.id}`,
        title: `Complete Financial Aid Application`,
        description: 'Submit FAFSA and any additional financial aid forms',
        due_date: deadline.clone().subtract(1, 'week').toDate(),
        priority: 'medium',
        category: 'document',
        status: 'pending',
        estimated_duration_hours: 3,
        university_id: university.id,
        application_id: application.id
      });
    }

    return items;
  }

  private prioritizeTimelineItems(items: TimelineItem[]): TimelineItem[] {
    const priorityWeights = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1
    };

    return items.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityWeights[b.priority] - priorityWeights[a.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then sort by due date
      return moment(a.due_date).diff(moment(b.due_date));
    });
  }

  async addTimelineItem(timelineId: string, item: Omit<TimelineItem, 'id'>) {
    try {
      const timelineItem = await this.prisma.timeline_items.create({
        data: {
          timeline_id: timelineId,
          title: item.title,
          description: item.description,
          due_date: item.due_date,
          priority: item.priority,
          category: item.category,
          status: item.status,
          estimated_duration_hours: item.estimated_duration_hours,
          dependencies: item.dependencies,
          university_id: item.university_id,
          application_id: item.application_id,
          created_at: new Date()
        }
      });

      return timelineItem;
    } catch (error) {
      logger.error('Error adding timeline item:', error);
      throw error;
    }
  }

  async getTimeline(timelineId: string) {
    try {
      const timeline = await this.prisma.timelines.findUnique({
        where: { id: timelineId },
        include: {
          timeline_items: {
            orderBy: [
              { priority: 'desc' },
              { due_date: 'asc' }
            ]
          }
        }
      });

      if (!timeline) {
        throw new Error('Timeline not found');
      }

      return timeline;
    } catch (error) {
      logger.error('Error fetching timeline:', error);
      throw error;
    }
  }

  async getUserTimelines(userId: string) {
    try {
      const timelines = await this.prisma.timelines.findMany({
        where: { user_id: userId },
        include: {
          timeline_items: {
            orderBy: [
              { priority: 'desc' },
              { due_date: 'asc' }
            ]
          }
        },
        orderBy: { updated_at: 'desc' }
      });

      return timelines;
    } catch (error) {
      logger.error('Error fetching user timelines:', error);
      throw error;
    }
  }

  async updateTimelineItem(itemId: string, updates: Partial<TimelineItem>) {
    try {
      const item = await this.prisma.timeline_items.update({
        where: { id: itemId },
        data: {
          ...updates,
          updated_at: new Date()
        }
      });

      // Update timeline's updated_at timestamp
      await this.prisma.timelines.update({
        where: { id: item.timeline_id },
        data: { updated_at: new Date() }
      });

      return item;
    } catch (error) {
      logger.error('Error updating timeline item:', error);
      throw error;
    }
  }

  async deleteTimelineItem(itemId: string) {
    try {
      const item = await this.prisma.timeline_items.findUnique({
        where: { id: itemId }
      });

      if (!item) {
        throw new Error('Timeline item not found');
      }

      await this.prisma.timeline_items.delete({
        where: { id: itemId }
      });

      // Update timeline's updated_at timestamp
      await this.prisma.timelines.update({
        where: { id: item.timeline_id },
        data: { updated_at: new Date() }
      });

      return true;
    } catch (error) {
      logger.error('Error deleting timeline item:', error);
      throw error;
    }
  }

  async optimizeTimeline(timelineId: string) {
    try {
      const timeline = await this.getTimeline(timelineId);
      const items = timeline.timeline_items;

      // Detect conflicts and suggest optimizations
      const conflicts = this.detectTimelineConflicts(items);
      const suggestions = this.generateOptimizationSuggestions(items, conflicts);

      // Auto-resolve simple conflicts
      for (const suggestion of suggestions) {
        if (suggestion.auto_apply) {
          await this.updateTimelineItem(suggestion.item_id, suggestion.changes);
        }
      }

      return {
        conflicts,
        suggestions,
        optimized_items: suggestions.filter(s => s.auto_apply).length
      };
    } catch (error) {
      logger.error('Error optimizing timeline:', error);
      throw error;
    }
  }

  private detectTimelineConflicts(items: any[]) {
    const conflicts = [];
    const now = moment();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const dueDate = moment(item.due_date);

      // Check for overdue items
      if (dueDate.isBefore(now) && item.status !== 'completed') {
        conflicts.push({
          type: 'overdue',
          item_id: item.id,
          message: `Item "${item.title}" is overdue`,
          severity: 'high'
        });
      }

      // Check for items due too close together
      for (let j = i + 1; j < items.length; j++) {
        const otherItem = items[j];
        const otherDueDate = moment(otherItem.due_date);
        const daysDiff = Math.abs(dueDate.diff(otherDueDate, 'days'));

        if (daysDiff <= 2 && item.priority === 'high' && otherItem.priority === 'high') {
          conflicts.push({
            type: 'scheduling_conflict',
            item_ids: [item.id, otherItem.id],
            message: `High priority items "${item.title}" and "${otherItem.title}" are due within 2 days of each other`,
            severity: 'medium'
          });
        }
      }

      // Check for unrealistic time estimates
      const hoursUntilDue = dueDate.diff(now, 'hours');
      if (item.estimated_duration_hours && hoursUntilDue < item.estimated_duration_hours) {
        conflicts.push({
          type: 'insufficient_time',
          item_id: item.id,
          message: `Not enough time to complete "${item.title}" (needs ${item.estimated_duration_hours}h, has ${hoursUntilDue}h)`,
          severity: 'high'
        });
      }
    }

    return conflicts;
  }

  private generateOptimizationSuggestions(items: any[], conflicts: any[]) {
    const suggestions = [];

    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'overdue':
          suggestions.push({
            item_id: conflict.item_id,
            type: 'status_update',
            message: 'Mark as overdue and adjust priority',
            changes: { status: 'overdue', priority: 'critical' },
            auto_apply: true
          });
          break;

        case 'scheduling_conflict':
          // Suggest moving one item earlier
          const [item1, item2] = conflict.item_ids.map(id => items.find(i => i.id === id));
          const earlierDue = moment.min(moment(item1.due_date), moment(item2.due_date));
          
          suggestions.push({
            item_id: item2.id,
            type: 'reschedule',
            message: `Move "${item2.title}" to ${earlierDue.subtract(3, 'days').format('YYYY-MM-DD')}`,
            changes: { due_date: earlierDue.subtract(3, 'days').toDate() },
            auto_apply: false
          });
          break;

        case 'insufficient_time':
          suggestions.push({
            item_id: conflict.item_id,
            type: 'priority_increase',
            message: 'Increase priority due to time constraints',
            changes: { priority: 'critical' },
            auto_apply: true
          });
          break;
      }
    }

    return suggestions;
  }

  async optimizeAllTimelines() {
    try {
      const timelines = await this.prisma.timelines.findMany({
        where: {
          updated_at: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Active in last 7 days
          }
        }
      });

      let optimizedCount = 0;
      for (const timeline of timelines) {
        try {
          const result = await this.optimizeTimeline(timeline.id);
          if (result.optimized_items > 0) {
            optimizedCount++;
          }
        } catch (error) {
          logger.error(`Error optimizing timeline ${timeline.id}:`, error);
        }
      }

      logger.info(`Optimized ${optimizedCount} timelines`);
      return optimizedCount;
    } catch (error) {
      logger.error('Error in bulk timeline optimization:', error);
      throw error;
    }
  }

  async getTimelineAnalytics(timelineId: string) {
    try {
      const timeline = await this.getTimeline(timelineId);
      const items = timeline.timeline_items;
      const now = moment();

      const analytics = {
        total_items: items.length,
        completed_items: items.filter(i => i.status === 'completed').length,
        overdue_items: items.filter(i => moment(i.due_date).isBefore(now) && i.status !== 'completed').length,
        upcoming_items: items.filter(i => moment(i.due_date).isAfter(now) && moment(i.due_date).isBefore(now.clone().add(7, 'days'))).length,
        total_estimated_hours: items.reduce((sum, i) => sum + (i.estimated_duration_hours || 0), 0),
        completion_rate: items.length > 0 ? Math.round((items.filter(i => i.status === 'completed').length / items.length) * 100) : 0,
        priority_distribution: {
          critical: items.filter(i => i.priority === 'critical').length,
          high: items.filter(i => i.priority === 'high').length,
          medium: items.filter(i => i.priority === 'medium').length,
          low: items.filter(i => i.priority === 'low').length
        },
        category_distribution: items.reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      return analytics;
    } catch (error) {
      logger.error('Error generating timeline analytics:', error);
      throw error;
    }
  }
}