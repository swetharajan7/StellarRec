import { PrismaClient } from '@prisma/client';
import moment from 'moment-timezone';
import { logger } from '../utils/logger';

export interface Deadline {
  id: string;
  title: string;
  description?: string;
  due_date: Date;
  type: 'application' | 'essay' | 'test' | 'document' | 'interview' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'upcoming' | 'due_soon' | 'overdue' | 'completed';
  university_id?: string;
  application_id?: string;
  user_id: string;
  reminder_settings?: {
    enabled: boolean;
    intervals: number[]; // Days before deadline
    channels: ('email' | 'sms' | 'push')[];
  };
}

export class DeadlineService {
  constructor(private prisma: PrismaClient) {}

  async createDeadline(deadlineData: Omit<Deadline, 'id' | 'status'>) {
    try {
      const deadline = await this.prisma.deadlines.create({
        data: {
          ...deadlineData,
          status: this.calculateDeadlineStatus(deadlineData.due_date),
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      logger.info(`Deadline created: ${deadline.id} for user: ${deadlineData.user_id}`);
      return deadline;
    } catch (error) {
      logger.error('Error creating deadline:', error);
      throw error;
    }
  }

  async getUserDeadlines(userId: string, filters?: {
    status?: string;
    type?: string;
    university_id?: string;
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

      if (filters?.university_id) {
        where.university_id = filters.university_id;
      }

      if (filters?.upcoming_days) {
        where.due_date = {
          gte: new Date(),
          lte: moment().add(filters.upcoming_days, 'days').toDate()
        };
      }

      const deadlines = await this.prisma.deadlines.findMany({
        where,
        include: {
          university: {
            select: {
              id: true,
              name: true,
              short_name: true
            }
          },
          application: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { due_date: 'asc' }
        ]
      });

      return deadlines;
    } catch (error) {
      logger.error('Error fetching user deadlines:', error);
      throw error;
    }
  }

  async updateDeadline(deadlineId: string, updates: Partial<Deadline>) {
    try {
      const deadline = await this.prisma.deadlines.update({
        where: { id: deadlineId },
        data: {
          ...updates,
          status: updates.due_date ? this.calculateDeadlineStatus(updates.due_date) : undefined,
          updated_at: new Date()
        }
      });

      return deadline;
    } catch (error) {
      logger.error('Error updating deadline:', error);
      throw error;
    }
  }

  async deleteDeadline(deadlineId: string) {
    try {
      await this.prisma.deadlines.delete({
        where: { id: deadlineId }
      });

      logger.info(`Deadline deleted: ${deadlineId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting deadline:', error);
      throw error;
    }
  }

  async monitorUpcomingDeadlines() {
    try {
      logger.info('Monitoring upcoming deadlines');

      // Update deadline statuses
      await this.updateDeadlineStatuses();

      // Find critical deadlines (due within 3 days)
      const criticalDeadlines = await this.prisma.deadlines.findMany({
        where: {
          due_date: {
            gte: new Date(),
            lte: moment().add(3, 'days').toDate()
          },
          status: {
            in: ['upcoming', 'due_soon']
          }
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
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

      // Process critical deadlines
      for (const deadline of criticalDeadlines) {
        await this.processCriticalDeadline(deadline);
      }

      // Find overdue deadlines
      const overdueDeadlines = await this.prisma.deadlines.findMany({
        where: {
          due_date: {
            lt: new Date()
          },
          status: {
            not: 'completed'
          }
        }
      });

      // Update overdue deadlines
      for (const deadline of overdueDeadlines) {
        await this.updateDeadline(deadline.id, { status: 'overdue' });
      }

      logger.info(`Processed ${criticalDeadlines.length} critical deadlines and ${overdueDeadlines.length} overdue deadlines`);

      return {
        critical_deadlines: criticalDeadlines.length,
        overdue_deadlines: overdueDeadlines.length
      };
    } catch (error) {
      logger.error('Error monitoring deadlines:', error);
      throw error;
    }
  }

  private async updateDeadlineStatuses() {
    const now = moment();
    const threeDaysFromNow = now.clone().add(3, 'days');
    const sevenDaysFromNow = now.clone().add(7, 'days');

    // Update to 'due_soon' (within 7 days)
    await this.prisma.deadlines.updateMany({
      where: {
        due_date: {
          gte: now.toDate(),
          lte: sevenDaysFromNow.toDate()
        },
        status: 'upcoming'
      },
      data: {
        status: 'due_soon',
        updated_at: new Date()
      }
    });

    // Update to 'overdue'
    await this.prisma.deadlines.updateMany({
      where: {
        due_date: {
          lt: now.toDate()
        },
        status: {
          not: 'completed'
        }
      },
      data: {
        status: 'overdue',
        updated_at: new Date()
      }
    });
  }

  private async processCriticalDeadline(deadline: any) {
    try {
      const daysUntilDue = moment(deadline.due_date).diff(moment(), 'days');
      
      // Create urgent reminder if within 1 day
      if (daysUntilDue <= 1) {
        await this.createUrgentReminder(deadline);
      }

      // Update priority to critical if not already
      if (deadline.priority !== 'critical') {
        await this.updateDeadline(deadline.id, { priority: 'critical' });
      }

      logger.info(`Processed critical deadline: ${deadline.title} (${daysUntilDue} days remaining)`);
    } catch (error) {
      logger.error(`Error processing critical deadline ${deadline.id}:`, error);
    }
  }

  private async createUrgentReminder(deadline: any) {
    try {
      // This would integrate with the notification service
      // For now, we'll log the urgent reminder
      logger.warn(`URGENT REMINDER: ${deadline.title} is due ${moment(deadline.due_date).fromNow()} for user ${deadline.user.email}`);

      // Create reminder record
      await this.prisma.reminders.create({
        data: {
          user_id: deadline.user_id,
          deadline_id: deadline.id,
          type: 'urgent',
          title: `URGENT: ${deadline.title}`,
          message: `Your deadline "${deadline.title}" is due ${moment(deadline.due_date).format('MMMM Do, YYYY [at] h:mm A')}`,
          scheduled_for: new Date(),
          status: 'pending',
          channels: ['email', 'push'],
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.error('Error creating urgent reminder:', error);
    }
  }

  private calculateDeadlineStatus(dueDate: Date): 'upcoming' | 'due_soon' | 'overdue' | 'completed' {
    const now = moment();
    const due = moment(dueDate);
    const daysUntilDue = due.diff(now, 'days');

    if (due.isBefore(now)) {
      return 'overdue';
    } else if (daysUntilDue <= 7) {
      return 'due_soon';
    } else {
      return 'upcoming';
    }
  }

  async getDeadlineAnalytics(userId: string, timeframe: 'week' | 'month' | 'quarter' = 'month') {
    try {
      const startDate = moment().subtract(1, timeframe).toDate();
      const endDate = new Date();

      const [totalDeadlines, completedDeadlines, overdueDeadlines, upcomingDeadlines] = await Promise.all([
        this.prisma.deadlines.count({
          where: {
            user_id: userId,
            created_at: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        this.prisma.deadlines.count({
          where: {
            user_id: userId,
            status: 'completed',
            updated_at: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        this.prisma.deadlines.count({
          where: {
            user_id: userId,
            status: 'overdue'
          }
        }),
        this.prisma.deadlines.count({
          where: {
            user_id: userId,
            status: {
              in: ['upcoming', 'due_soon']
            }
          }
        })
      ]);

      const completionRate = totalDeadlines > 0 ? Math.round((completedDeadlines / totalDeadlines) * 100) : 0;

      // Get deadline distribution by type
      const typeDistribution = await this.prisma.deadlines.groupBy({
        by: ['type'],
        where: {
          user_id: userId,
          created_at: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: {
          type: true
        }
      });

      // Get priority distribution
      const priorityDistribution = await this.prisma.deadlines.groupBy({
        by: ['priority'],
        where: {
          user_id: userId,
          status: {
            in: ['upcoming', 'due_soon']
          }
        },
        _count: {
          priority: true
        }
      });

      return {
        timeframe,
        total_deadlines: totalDeadlines,
        completed_deadlines: completedDeadlines,
        overdue_deadlines: overdueDeadlines,
        upcoming_deadlines: upcomingDeadlines,
        completion_rate: completionRate,
        type_distribution: typeDistribution.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {} as Record<string, number>),
        priority_distribution: priorityDistribution.reduce((acc, item) => {
          acc[item.priority] = item._count.priority;
          return acc;
        }, {} as Record<string, number>)
      };
    } catch (error) {
      logger.error('Error generating deadline analytics:', error);
      throw error;
    }
  }

  async detectDeadlineConflicts(userId: string) {
    try {
      const upcomingDeadlines = await this.getUserDeadlines(userId, {
        status: 'upcoming',
        upcoming_days: 30
      });

      const conflicts = [];
      const now = moment();

      for (let i = 0; i < upcomingDeadlines.length; i++) {
        const deadline1 = upcomingDeadlines[i];
        const due1 = moment(deadline1.due_date);

        for (let j = i + 1; j < upcomingDeadlines.length; j++) {
          const deadline2 = upcomingDeadlines[j];
          const due2 = moment(deadline2.due_date);

          const daysDiff = Math.abs(due1.diff(due2, 'days'));

          // Check for conflicts (high priority items due within 2 days of each other)
          if (daysDiff <= 2 && 
              (deadline1.priority === 'high' || deadline1.priority === 'critical') &&
              (deadline2.priority === 'high' || deadline2.priority === 'critical')) {
            
            conflicts.push({
              type: 'scheduling_conflict',
              deadlines: [
                {
                  id: deadline1.id,
                  title: deadline1.title,
                  due_date: deadline1.due_date,
                  priority: deadline1.priority
                },
                {
                  id: deadline2.id,
                  title: deadline2.title,
                  due_date: deadline2.due_date,
                  priority: deadline2.priority
                }
              ],
              days_apart: daysDiff,
              severity: daysDiff === 0 ? 'critical' : daysDiff === 1 ? 'high' : 'medium',
              suggestion: `Consider adjusting the timeline for one of these deadlines to avoid overlap`
            });
          }
        }

        // Check for unrealistic timelines (multiple high-priority items in same week)
        const sameWeekDeadlines = upcomingDeadlines.filter(d => {
          const dueDate = moment(d.due_date);
          return dueDate.isSame(due1, 'week') && 
                 d.id !== deadline1.id && 
                 (d.priority === 'high' || d.priority === 'critical');
        });

        if (sameWeekDeadlines.length >= 2) {
          conflicts.push({
            type: 'workload_conflict',
            week: due1.format('YYYY-[W]WW'),
            deadlines: [deadline1, ...sameWeekDeadlines].map(d => ({
              id: d.id,
              title: d.title,
              due_date: d.due_date,
              priority: d.priority
            })),
            severity: 'medium',
            suggestion: `Consider spreading out these ${sameWeekDeadlines.length + 1} high-priority deadlines across multiple weeks`
          });
        }
      }

      return {
        conflicts_found: conflicts.length,
        conflicts,
        recommendations: this.generateConflictRecommendations(conflicts)
      };
    } catch (error) {
      logger.error('Error detecting deadline conflicts:', error);
      throw error;
    }
  }

  private generateConflictRecommendations(conflicts: any[]) {
    const recommendations = [];

    for (const conflict of conflicts) {
      switch (conflict.type) {
        case 'scheduling_conflict':
          if (conflict.severity === 'critical') {
            recommendations.push({
              type: 'urgent_reschedule',
              message: `Immediate attention needed: Two critical deadlines are due on the same day`,
              action: 'Consider moving one deadline earlier or requesting an extension'
            });
          } else {
            recommendations.push({
              type: 'reschedule',
              message: `Two high-priority deadlines are very close together`,
              action: 'Plan to start work on one of these items earlier'
            });
          }
          break;

        case 'workload_conflict':
          recommendations.push({
            type: 'workload_management',
            message: `Heavy workload detected for week ${conflict.week}`,
            action: 'Consider starting work early on some items or seeking help with time management'
          });
          break;
      }
    }

    return recommendations;
  }

  async createDeadlineFromApplication(applicationId: string) {
    try {
      const application = await this.prisma.applications.findUnique({
        where: { id: applicationId },
        include: {
          university: true,
          user: true
        }
      });

      if (!application) {
        throw new Error('Application not found');
      }

      const deadlines = [];

      // Main application deadline
      if (application.deadline) {
        const mainDeadline = await this.createDeadline({
          title: `${application.university.name} Application Due`,
          description: `Complete and submit application to ${application.university.name}`,
          due_date: application.deadline,
          type: 'application',
          priority: 'high',
          university_id: application.university_id,
          application_id: application.id,
          user_id: application.user_id,
          reminder_settings: {
            enabled: true,
            intervals: [14, 7, 3, 1], // 2 weeks, 1 week, 3 days, 1 day before
            channels: ['email', 'push']
          }
        });

        deadlines.push(mainDeadline);
      }

      // Essay deadlines (typically 1-2 weeks before application deadline)
      const essayRequirements = application.university.admission_requirements?.essays || [];
      for (let i = 0; i < essayRequirements.length; i++) {
        const essay = essayRequirements[i];
        const essayDeadline = moment(application.deadline).subtract(1 + i, 'weeks').toDate();

        const deadline = await this.createDeadline({
          title: `Essay: ${essay.prompt?.substring(0, 50)}...`,
          description: essay.prompt,
          due_date: essayDeadline,
          type: 'essay',
          priority: 'high',
          university_id: application.university_id,
          application_id: application.id,
          user_id: application.user_id,
          reminder_settings: {
            enabled: true,
            intervals: [7, 3, 1],
            channels: ['email', 'push']
          }
        });

        deadlines.push(deadline);
      }

      logger.info(`Created ${deadlines.length} deadlines for application ${applicationId}`);
      return deadlines;
    } catch (error) {
      logger.error('Error creating deadlines from application:', error);
      throw error;
    }
  }
}