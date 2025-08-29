import { PrismaClient, ApplicationStatus, ComponentStatus, ComponentType } from '@prisma/client';
import { logger } from '../utils/logger';

export interface ApplicationData {
  student_id: string;
  university_id: string;
  program_id: string;
  deadline: Date;
  notes?: string;
}

export interface ApplicationFilters {
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
}

export interface ComponentData {
  application_id: string;
  component_type: ComponentType;
  status?: ComponentStatus;
  data?: any;
}

export interface SubmissionResult {
  success: boolean;
  application?: any;
  errors?: string[];
}

export class ApplicationService {
  constructor(private prisma: PrismaClient) {}

  async getApplications(studentId: string, filters: ApplicationFilters = {}) {
    const { status, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      student_id: studentId,
      deleted_at: null
    };

    if (status) {
      where.status = status;
    }

    const [applications, total] = await Promise.all([
      this.prisma.applications.findMany({
        where,
        include: {
          university: {
            select: {
              id: true,
              name: true,
              short_name: true,
              location: true,
              metadata: true
            }
          },
          program: {
            select: {
              id: true,
              name: true,
              degree: true,
              department: true
            }
          },
          application_components: {
            select: {
              id: true,
              component_type: true,
              status: true,
              completed_at: true
            }
          },
          timeline_events: {
            where: {
              status: 'pending'
            },
            orderBy: {
              due_date: 'asc'
            },
            take: 3
          }
        },
        orderBy: {
          deadline: 'asc'
        },
        skip,
        take: limit
      }),
      this.prisma.applications.count({ where })
    ]);

    return {
      applications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getApplicationById(applicationId: string) {
    return this.prisma.applications.findFirst({
      where: {
        id: applicationId,
        deleted_at: null
      },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            short_name: true,
            location: true,
            admission_requirements: true,
            deadlines: true,
            metadata: true
          }
        },
        program: {
          select: {
            id: true,
            name: true,
            degree: true,
            department: true,
            description: true,
            requirements: true
          }
        },
        application_components: {
          orderBy: {
            component_type: 'asc'
          }
        },
        timeline_events: {
          orderBy: {
            due_date: 'asc'
          }
        }
      }
    });
  }

  async createApplication(data: ApplicationData) {
    const application = await this.prisma.applications.create({
      data: {
        ...data,
        status: 'draft',
        progress_percentage: 0
      },
      include: {
        university: {
          select: {
            id: true,
            name: true,
            short_name: true
          }
        },
        program: {
          select: {
            id: true,
            name: true,
            degree: true
          }
        }
      }
    });

    // Create default application components
    await this.createDefaultComponents(application.id);

    // Create initial timeline events
    await this.createInitialTimeline(application.id, data.deadline);

    return application;
  }

  async updateApplication(applicationId: string, updateData: any) {
    try {
      return await this.prisma.applications.update({
        where: {
          id: applicationId,
          deleted_at: null
        },
        data: {
          ...updateData,
          updated_at: new Date()
        },
        include: {
          university: {
            select: {
              id: true,
              name: true,
              short_name: true
            }
          },
          program: {
            select: {
              id: true,
              name: true,
              degree: true
            }
          }
        }
      });
    } catch (error) {
      logger.error('Error updating application:', error);
      return null;
    }
  }

  async deleteApplication(applicationId: string): Promise<boolean> {
    try {
      await this.prisma.applications.update({
        where: {
          id: applicationId
        },
        data: {
          deleted_at: new Date()
        }
      });
      return true;
    } catch (error) {
      logger.error('Error deleting application:', error);
      return false;
    }
  }

  async submitApplication(applicationId: string): Promise<SubmissionResult> {
    const application = await this.getApplicationById(applicationId);
    
    if (!application) {
      return { success: false, errors: ['Application not found'] };
    }

    if (application.status === 'submitted') {
      return { success: false, errors: ['Application already submitted'] };
    }

    // Check if application is complete
    const validationResult = await this.validateApplicationForSubmission(applicationId);
    
    if (!validationResult.isValid) {
      return { success: false, errors: validationResult.errors };
    }

    // Update application status
    const updatedApplication = await this.prisma.applications.update({
      where: { id: applicationId },
      data: {
        status: 'submitted',
        submitted_at: new Date(),
        progress_percentage: 100
      },
      include: {
        university: true,
        program: true,
        application_components: true
      }
    });

    // Create submission timeline event
    await this.prisma.timeline_events.create({
      data: {
        application_id: applicationId,
        event_type: 'submission',
        title: 'Application Submitted',
        description: 'Application successfully submitted to university',
        completed_at: new Date(),
        status: 'completed',
        priority: 'high'
      }
    });

    logger.info(`Application ${applicationId} submitted successfully`);
    
    return { success: true, application: updatedApplication };
  }

  async getApplicationProgress(applicationId: string) {
    const application = await this.prisma.applications.findFirst({
      where: {
        id: applicationId,
        deleted_at: null
      },
      include: {
        application_components: true,
        timeline_events: {
          orderBy: {
            due_date: 'asc'
          }
        }
      }
    });

    if (!application) {
      return null;
    }

    const totalComponents = application.application_components.length;
    const completedComponents = application.application_components.filter(
      c => c.status === 'completed' || c.status === 'approved'
    ).length;

    const progressPercentage = totalComponents > 0 ? 
      Math.round((completedComponents / totalComponents) * 100) : 0;

    const nextSteps = application.timeline_events
      .filter(event => event.status === 'pending')
      .slice(0, 3)
      .map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        due_date: event.due_date,
        priority: event.priority
      }));

    const componentProgress = application.application_components.map(component => ({
      type: component.component_type,
      status: component.status,
      completed_at: component.completed_at,
      completion_percentage: this.calculateComponentProgress(component)
    }));

    return {
      application_id: applicationId,
      overall_progress: progressPercentage,
      status: application.status,
      deadline: application.deadline,
      days_remaining: this.calculateDaysRemaining(application.deadline),
      component_progress: componentProgress,
      next_steps: nextSteps,
      last_updated: application.updated_at
    };
  }

  async addApplicationComponent(data: ComponentData) {
    const component = await this.prisma.application_components.create({
      data
    });

    // Update application progress
    await this.updateApplicationProgressPercentage(data.application_id);

    return component;
  }

  async updateApplicationComponent(componentId: string, updateData: any) {
    try {
      const component = await this.prisma.application_components.update({
        where: { id: componentId },
        data: {
          ...updateData,
          completed_at: updateData.status === 'completed' ? new Date() : undefined,
          updated_at: new Date()
        }
      });

      // Update application progress
      await this.updateApplicationProgressPercentage(component.application_id);

      return component;
    } catch (error) {
      logger.error('Error updating application component:', error);
      return null;
    }
  }

  async getApplicationStats(studentId: string) {
    const applications = await this.prisma.applications.findMany({
      where: {
        student_id: studentId,
        deleted_at: null
      },
      include: {
        application_components: true,
        timeline_events: true
      }
    });

    const stats = {
      total_applications: applications.length,
      by_status: {
        draft: 0,
        in_progress: 0,
        submitted: 0,
        under_review: 0,
        accepted: 0,
        rejected: 0,
        waitlisted: 0
      },
      average_progress: 0,
      upcoming_deadlines: 0,
      overdue_tasks: 0,
      completed_applications: 0
    };

    let totalProgress = 0;
    const now = new Date();

    applications.forEach(app => {
      stats.by_status[app.status]++;
      totalProgress += app.progress_percentage;

      if (app.status === 'submitted' || app.status === 'accepted') {
        stats.completed_applications++;
      }

      if (app.deadline > now && app.status !== 'submitted') {
        const daysUntilDeadline = Math.ceil(
          (app.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntilDeadline <= 30) {
          stats.upcoming_deadlines++;
        }
      }

      // Count overdue tasks
      app.timeline_events.forEach(event => {
        if (event.status === 'pending' && event.due_date && event.due_date < now) {
          stats.overdue_tasks++;
        }
      });
    });

    stats.average_progress = applications.length > 0 ? 
      Math.round(totalProgress / applications.length) : 0;

    return stats;
  }

  private async createDefaultComponents(applicationId: string) {
    const defaultComponents: ComponentType[] = [
      'personal_info',
      'academic_history',
      'test_scores',
      'essays',
      'recommendations'
    ];

    const componentData = defaultComponents.map(type => ({
      application_id: applicationId,
      component_type: type,
      status: 'pending' as ComponentStatus,
      data: {}
    }));

    await this.prisma.application_components.createMany({
      data: componentData
    });
  }

  private async createInitialTimeline(applicationId: string, deadline: Date) {
    const timelineEvents = [
      {
        application_id: applicationId,
        event_type: 'deadline',
        title: 'Application Deadline',
        description: 'Final deadline for application submission',
        due_date: deadline,
        priority: 'critical' as const,
        status: 'pending' as const
      },
      {
        application_id: applicationId,
        event_type: 'task',
        title: 'Complete Personal Information',
        description: 'Fill out personal details and contact information',
        due_date: new Date(deadline.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days before
        priority: 'high' as const,
        status: 'pending' as const
      },
      {
        application_id: applicationId,
        event_type: 'task',
        title: 'Submit Test Scores',
        description: 'Upload official test scores and transcripts',
        due_date: new Date(deadline.getTime() - 21 * 24 * 60 * 60 * 1000), // 21 days before
        priority: 'high' as const,
        status: 'pending' as const
      },
      {
        application_id: applicationId,
        event_type: 'task',
        title: 'Complete Essays',
        description: 'Write and submit all required essays',
        due_date: new Date(deadline.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days before
        priority: 'high' as const,
        status: 'pending' as const
      },
      {
        application_id: applicationId,
        event_type: 'task',
        title: 'Request Recommendations',
        description: 'Ensure all recommendation letters are submitted',
        due_date: new Date(deadline.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before
        priority: 'medium' as const,
        status: 'pending' as const
      }
    ];

    await this.prisma.timeline_events.createMany({
      data: timelineEvents
    });
  }

  private async validateApplicationForSubmission(applicationId: string) {
    const application = await this.prisma.applications.findFirst({
      where: { id: applicationId },
      include: {
        application_components: true
      }
    });

    if (!application) {
      return { isValid: false, errors: ['Application not found'] };
    }

    const errors: string[] = [];

    // Check if all required components are completed
    const requiredComponents: ComponentType[] = [
      'personal_info',
      'academic_history',
      'test_scores',
      'essays'
    ];

    for (const requiredType of requiredComponents) {
      const component = application.application_components.find(
        c => c.component_type === requiredType
      );

      if (!component || (component.status !== 'completed' && component.status !== 'approved')) {
        errors.push(`${requiredType.replace('_', ' ')} is not completed`);
      }
    }

    // Check deadline
    if (application.deadline < new Date()) {
      errors.push('Application deadline has passed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private calculateComponentProgress(component: any): number {
    switch (component.status) {
      case 'completed':
      case 'approved':
        return 100;
      case 'in_progress':
        return 50;
      case 'rejected':
        return 25;
      default:
        return 0;
    }
  }

  private calculateDaysRemaining(deadline: Date): number {
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private async updateApplicationProgressPercentage(applicationId: string) {
    const components = await this.prisma.application_components.findMany({
      where: { application_id: applicationId }
    });

    const totalComponents = components.length;
    const completedComponents = components.filter(
      c => c.status === 'completed' || c.status === 'approved'
    ).length;

    const progressPercentage = totalComponents > 0 ? 
      Math.round((completedComponents / totalComponents) * 100) : 0;

    await this.prisma.applications.update({
      where: { id: applicationId },
      data: { progress_percentage: progressPercentage }
    });
  }
}