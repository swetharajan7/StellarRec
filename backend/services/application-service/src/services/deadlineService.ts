import { PrismaClient, EventStatus, PriorityLevel } from '@prisma/client';
import { logger } from '../utils/logger';
import { NotificationService } from './notificationService';

export class DeadlineService {
  private notificationService: NotificationService;

  constructor(private prisma: PrismaClient) {
    this.notificationService = new NotificationService();
  }

  async checkUpcomingDeadlines() {
    logger.info('Checking upcoming deadlines');

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get applications with upcoming deadlines
    const upcomingApplications = await this.prisma.applications.findMany({
      where: {
        deadline: {
          gte: now,
          lte: thirtyDaysFromNow
        },
        status: {
          in: ['draft', 'in_progress']
        },
        deleted_at: null
      },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            student_profiles: {
              select: {
                first_name: true,
                last_name: true
              }
            }
          }
        },
        university: {
          select: {
            name: true,
            short_name: true
          }
        },
        program: {
          select: {
            name: true,
            degree: true
          }
        }
      }
    });

    // Process deadline notifications
    for (const application of upcomingApplications) {
      const daysUntilDeadline = Math.ceil(
        (application.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      let shouldNotify = false;
      let priority: PriorityLevel = 'medium';
      let notificationType = 'deadline_reminder';

      // Determine notification timing and priority
      if (daysUntilDeadline <= 1) {
        shouldNotify = true;
        priority = 'critical';
        notificationType = 'deadline_urgent';
      } else if (daysUntilDeadline <= 7) {
        shouldNotify = true;
        priority = 'high';
        notificationType = 'deadline_week';
      } else if (daysUntilDeadline <= 30 && daysUntilDeadline % 7 === 0) {
        shouldNotify = true;
        priority = 'medium';
        notificationType = 'deadline_month';
      }

      if (shouldNotify) {
        // Check if we've already sent this type of notification recently
        const recentNotification = await this.prisma.notifications.findFirst({
          where: {
            user_id: application.student_id,
            type: notificationType,
            data: {
              path: ['application_id'],
              equals: application.id
            },
            created_at: {
              gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
          }
        });

        if (!recentNotification) {
          await this.sendDeadlineNotification(application, daysUntilDeadline, priority);
        }
      }
    }

    // Check for overdue tasks
    await this.checkOverdueTasks();

    logger.info(`Processed ${upcomingApplications.length} applications for deadline notifications`);
  }

  async checkOverdueTasks() {
    const now = new Date();

    const overdueTasks = await this.prisma.timeline_events.findMany({
      where: {
        due_date: {
          lt: now
        },
        status: 'pending',
        event_type: 'task'
      },
      include: {
        application: {
          include: {
            student: {
              select: {
                id: true,
                email: true,
                student_profiles: {
                  select: {
                    first_name: true,
                    last_name: true
                  }
                }
              }
            },
            university: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    for (const task of overdueTasks) {
      // Update task status to overdue
      await this.prisma.timeline_events.update({
        where: { id: task.id },
        data: { status: 'overdue' }
      });

      // Send overdue notification
      await this.sendOverdueTaskNotification(task);
    }

    logger.info(`Processed ${overdueTasks.length} overdue tasks`);
  }

  async updateApplicationProgress() {
    logger.info('Updating application progress');

    const applications = await this.prisma.applications.findMany({
      where: {
        status: {
          in: ['draft', 'in_progress']
        },
        deleted_at: null
      },
      include: {
        application_components: true
      }
    });

    for (const application of applications) {
      const totalComponents = application.application_components.length;
      const completedComponents = application.application_components.filter(
        c => c.status === 'completed' || c.status === 'approved'
      ).length;

      const progressPercentage = totalComponents > 0 ? 
        Math.round((completedComponents / totalComponents) * 100) : 0;

      // Update progress if it has changed
      if (application.progress_percentage !== progressPercentage) {
        await this.prisma.applications.update({
          where: { id: application.id },
          data: { progress_percentage: progressPercentage }
        });

        // Update status based on progress
        let newStatus = application.status;
        if (progressPercentage === 0) {
          newStatus = 'draft';
        } else if (progressPercentage > 0 && progressPercentage < 100) {
          newStatus = 'in_progress';
        }

        if (newStatus !== application.status) {
          await this.prisma.applications.update({
            where: { id: application.id },
            data: { status: newStatus }
          });
        }
      }
    }

    logger.info(`Updated progress for ${applications.length} applications`);
  }

  async createDeadlineReminders(applicationId: string, deadline: Date) {
    const reminderDates = [
      { days: 30, priority: 'medium' as PriorityLevel },
      { days: 14, priority: 'medium' as PriorityLevel },
      { days: 7, priority: 'high' as PriorityLevel },
      { days: 3, priority: 'high' as PriorityLevel },
      { days: 1, priority: 'critical' as PriorityLevel }
    ];

    const reminders = reminderDates.map(reminder => ({
      application_id: applicationId,
      event_type: 'reminder',
      title: `Deadline Reminder - ${reminder.days} day${reminder.days > 1 ? 's' : ''} remaining`,
      description: `Application deadline is approaching in ${reminder.days} day${reminder.days > 1 ? 's' : ''}`,
      due_date: new Date(deadline.getTime() - reminder.days * 24 * 60 * 60 * 1000),
      priority: reminder.priority,
      status: 'pending' as EventStatus
    }));

    await this.prisma.timeline_events.createMany({
      data: reminders
    });
  }

  async getUpcomingDeadlines(studentId: string, days: number = 30) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const deadlines = await this.prisma.applications.findMany({
      where: {
        student_id: studentId,
        deadline: {
          gte: now,
          lte: futureDate
        },
        status: {
          in: ['draft', 'in_progress']
        },
        deleted_at: null
      },
      include: {
        university: {
          select: {
            name: true,
            short_name: true
          }
        },
        program: {
          select: {
            name: true,
            degree: true
          }
        }
      },
      orderBy: {
        deadline: 'asc'
      }
    });

    return deadlines.map(app => ({
      application_id: app.id,
      university_name: app.university.name,
      program_name: app.program.name,
      deadline: app.deadline,
      days_remaining: Math.ceil((app.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      progress_percentage: app.progress_percentage,
      status: app.status,
      priority: this.calculateDeadlinePriority(app.deadline, app.progress_percentage)
    }));
  }

  async getOverdueTasks(studentId: string) {
    const now = new Date();

    const overdueTasks = await this.prisma.timeline_events.findMany({
      where: {
        application: {
          student_id: studentId
        },
        due_date: {
          lt: now
        },
        status: {
          in: ['pending', 'overdue']
        }
      },
      include: {
        application: {
          include: {
            university: {
              select: {
                name: true
              }
            },
            program: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        due_date: 'desc'
      }
    });

    return overdueTasks.map(task => ({
      task_id: task.id,
      application_id: task.application_id,
      university_name: task.application.university.name,
      program_name: task.application.program.name,
      title: task.title,
      description: task.description,
      due_date: task.due_date,
      days_overdue: Math.ceil((now.getTime() - task.due_date!.getTime()) / (1000 * 60 * 60 * 24)),
      priority: task.priority
    }));
  }

  private async sendDeadlineNotification(application: any, daysUntilDeadline: number, priority: PriorityLevel) {
    const studentProfile = application.student.student_profiles[0];
    const studentName = studentProfile ? 
      `${studentProfile.first_name} ${studentProfile.last_name}` : 
      'Student';

    let title: string;
    let message: string;

    if (daysUntilDeadline <= 1) {
      title = '🚨 URGENT: Application Due Tomorrow!';
      message = `Your application to ${application.university.name} for ${application.program.name} is due tomorrow. Please submit immediately!`;
    } else if (daysUntilDeadline <= 7) {
      title = '⚠️ Application Deadline Approaching';
      message = `Your application to ${application.university.name} is due in ${daysUntilDeadline} days. Current progress: ${application.progress_percentage}%`;
    } else {
      title = '📅 Application Deadline Reminder';
      message = `Don't forget: Your application to ${application.university.name} is due in ${daysUntilDeadline} days.`;
    }

    await this.notificationService.sendNotification({
      user_id: application.student_id,
      type: 'deadline_reminder',
      title,
      message,
      data: {
        application_id: application.id,
        university_name: application.university.name,
        program_name: application.program.name,
        deadline: application.deadline,
        days_remaining: daysUntilDeadline,
        progress_percentage: application.progress_percentage
      },
      priority
    });
  }

  private async sendOverdueTaskNotification(task: any) {
    const application = task.application;
    const studentProfile = application.student.student_profiles[0];
    const studentName = studentProfile ? 
      `${studentProfile.first_name} ${studentProfile.last_name}` : 
      'Student';

    const daysOverdue = Math.ceil(
      (new Date().getTime() - task.due_date.getTime()) / (1000 * 60 * 60 * 24)
    );

    await this.notificationService.sendNotification({
      user_id: application.student_id,
      type: 'task_overdue',
      title: '⏰ Overdue Task',
      message: `Task "${task.title}" for ${application.university.name} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue.`,
      data: {
        task_id: task.id,
        application_id: application.id,
        university_name: application.university.name,
        task_title: task.title,
        due_date: task.due_date,
        days_overdue: daysOverdue
      },
      priority: 'high'
    });
  }

  private calculateDeadlinePriority(deadline: Date, progressPercentage: number): PriorityLevel {
    const now = new Date();
    const daysUntilDeadline = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDeadline <= 1) {
      return 'critical';
    } else if (daysUntilDeadline <= 7 || (daysUntilDeadline <= 14 && progressPercentage < 50)) {
      return 'high';
    } else if (daysUntilDeadline <= 30) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}