import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { addDays, addHours, addMinutes, differenceInDays, differenceInHours, isBefore } from 'date-fns';
import { ReminderDeliveryService } from './reminderDeliveryService';
import { PersonalizationService } from './personalizationService';
import * as cron from 'node-cron';

const prisma = new PrismaClient();

export interface EscalationWorkflow {
  id: string;
  name: string;
  description?: string;
  triggerConditions: EscalationTrigger[];
  escalationLevels: EscalationLevel[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationTrigger {
  type: 'deadline_proximity' | 'no_response' | 'missed_deadline' | 'priority_change' | 'custom';
  condition: string; // JSON condition
  threshold: number;
  timeUnit: 'minutes' | 'hours' | 'days';
}

export interface EscalationLevel {
  level: number;
  name: string;
  delayAfterTrigger: number; // minutes
  channels: ('email' | 'sms' | 'push' | 'in_app')[];
  recipients: EscalationRecipient[];
  messageTemplate: string;
  requiresAcknowledgment: boolean;
  autoResolve: boolean;
  nextLevelDelay?: number; // minutes to next level if no response
}

export interface EscalationRecipient {
  type: 'user' | 'supervisor' | 'admin' | 'custom';
  identifier: string; // userId, email, or role
  notificationPreference?: string;
}

export interface EscalationInstance {
  id: string;
  workflowId: string;
  userId: string;
  reminderId: string;
  currentLevel: number;
  status: 'active' | 'resolved' | 'cancelled' | 'completed';
  triggeredAt: Date;
  lastEscalatedAt?: Date;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface EscalationAction {
  id: string;
  escalationId: string;
  level: number;
  action: 'notify' | 'escalate' | 'resolve' | 'cancel';
  recipient: string;
  channel: string;
  executedAt: Date;
  success: boolean;
  response?: string;
}

export class EscalationWorkflowService {
  private reminderDeliveryService: ReminderDeliveryService;
  private personalizationService: PersonalizationService;
  private escalationActive = false;

  constructor() {
    this.reminderDeliveryService = new ReminderDeliveryService();
    this.personalizationService = new PersonalizationService();
    this.startEscalationProcessor();
  }

  async createEscalationWorkflow(workflow: Omit<EscalationWorkflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      logger.info('Creating escalation workflow', { name: workflow.name });

      const escalationWorkflow = await prisma.escalationWorkflow.create({
        data: {
          id: this.generateId(),
          name: workflow.name,
          description: workflow.description,
          triggerConditions: workflow.triggerConditions,
          escalationLevels: workflow.escalationLevels,
          active: workflow.active,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info('Escalation workflow created', { 
        workflowId: escalationWorkflow.id,
        levels: workflow.escalationLevels.length 
      });

      return escalationWorkflow.id;

    } catch (error) {
      logger.error('Error creating escalation workflow:', error);
      throw new Error(`Failed to create escalation workflow: ${error.message}`);
    }
  }

  async triggerEscalation(
    reminderId: string,
    userId: string,
    triggerType: string,
    metadata: Record<string, any> = {}
  ): Promise<string | null> {
    try {
      logger.info('Triggering escalation', { reminderId, userId, triggerType });

      // Find applicable workflows
      const workflows = await this.findApplicableWorkflows(triggerType, metadata);
      
      if (workflows.length === 0) {
        logger.info('No applicable escalation workflows found', { triggerType });
        return null;
      }

      // Use the first applicable workflow (could be enhanced with priority logic)
      const workflow = workflows[0];

      // Check if escalation already exists for this reminder
      const existingEscalation = await prisma.escalationInstance.findFirst({
        where: {
          reminderId,
          status: 'active'
        }
      });

      if (existingEscalation) {
        logger.info('Escalation already active for reminder', { reminderId });
        return existingEscalation.id;
      }

      // Create escalation instance
      const escalationInstance = await prisma.escalationInstance.create({
        data: {
          id: this.generateId(),
          workflowId: workflow.id,
          userId,
          reminderId,
          currentLevel: 0,
          status: 'active',
          triggeredAt: new Date(),
          metadata
        }
      });

      // Start escalation process
      await this.processEscalationLevel(escalationInstance.id, 0);

      logger.info('Escalation triggered', { 
        escalationId: escalationInstance.id,
        workflowId: workflow.id 
      });

      return escalationInstance.id;

    } catch (error) {
      logger.error('Error triggering escalation:', error);
      throw new Error(`Failed to trigger escalation: ${error.message}`);
    }
  }

  async acknowledgeEscalation(escalationId: string, userId: string, response?: string): Promise<void> {
    try {
      const escalation = await prisma.escalationInstance.findUnique({
        where: { id: escalationId },
        include: { workflow: true }
      });

      if (!escalation) {
        throw new Error('Escalation not found');
      }

      const currentLevel = escalation.workflow.escalationLevels[escalation.currentLevel];
      
      if (currentLevel?.requiresAcknowledgment) {
        // Record acknowledgment
        await prisma.escalationAction.create({
          data: {
            id: this.generateId(),
            escalationId,
            level: escalation.currentLevel,
            action: 'resolve',
            recipient: userId,
            channel: 'manual',
            executedAt: new Date(),
            success: true,
            response
          }
        });

        // Resolve escalation if configured to auto-resolve
        if (currentLevel.autoResolve) {
          await this.resolveEscalation(escalationId, 'acknowledged');
        }

        logger.info('Escalation acknowledged', { escalationId, userId });
      }

    } catch (error) {
      logger.error('Error acknowledging escalation:', error);
      throw new Error(`Failed to acknowledge escalation: ${error.message}`);
    }
  }

  async resolveEscalation(escalationId: string, reason: string): Promise<void> {
    try {
      await prisma.escalationInstance.update({
        where: { id: escalationId },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          metadata: {
            resolvedReason: reason
          }
        }
      });

      logger.info('Escalation resolved', { escalationId, reason });

    } catch (error) {
      logger.error('Error resolving escalation:', error);
      throw new Error(`Failed to resolve escalation: ${error.message}`);
    }
  }

  async cancelEscalation(escalationId: string, reason: string): Promise<void> {
    try {
      await prisma.escalationInstance.update({
        where: { id: escalationId },
        data: {
          status: 'cancelled',
          metadata: {
            cancelledReason: reason
          }
        }
      });

      logger.info('Escalation cancelled', { escalationId, reason });

    } catch (error) {
      logger.error('Error cancelling escalation:', error);
      throw new Error(`Failed to cancel escalation: ${error.message}`);
    }
  }

  async getActiveEscalations(userId?: string): Promise<EscalationInstance[]> {
    try {
      const whereClause: any = { status: 'active' };
      if (userId) {
        whereClause.userId = userId;
      }

      const escalations = await prisma.escalationInstance.findMany({
        where: whereClause,
        include: {
          workflow: true,
          actions: true
        },
        orderBy: { triggeredAt: 'desc' }
      });

      return escalations.map(this.mapToEscalationInstance);

    } catch (error) {
      logger.error('Error getting active escalations:', error);
      throw new Error(`Failed to get active escalations: ${error.message}`);
    }
  }

  async getEscalationHistory(
    userId?: string,
    days: number = 30
  ): Promise<{
    escalations: EscalationInstance[];
    statistics: {
      totalEscalations: number;
      resolvedEscalations: number;
      averageResolutionTime: number;
      escalationsByLevel: Record<number, number>;
    };
  }> {
    try {
      const startDate = addDays(new Date(), -days);
      const whereClause: any = {
        triggeredAt: { gte: startDate }
      };
      
      if (userId) {
        whereClause.userId = userId;
      }

      const escalations = await prisma.escalationInstance.findMany({
        where: whereClause,
        include: {
          workflow: true,
          actions: true
        },
        orderBy: { triggeredAt: 'desc' }
      });

      const statistics = this.calculateEscalationStatistics(escalations);

      return {
        escalations: escalations.map(this.mapToEscalationInstance),
        statistics
      };

    } catch (error) {
      logger.error('Error getting escalation history:', error);
      throw new Error(`Failed to get escalation history: ${error.message}`);
    }
  }

  async processEscalations(): Promise<void> {
    try {
      // Get active escalations that need processing
      const activeEscalations = await prisma.escalationInstance.findMany({
        where: { status: 'active' },
        include: { workflow: true }
      });

      for (const escalation of activeEscalations) {
        try {
          await this.checkEscalationProgress(escalation);
        } catch (error) {
          logger.error('Error processing individual escalation:', {
            escalationId: escalation.id,
            error: error.message
          });
        }
      }

      if (activeEscalations.length > 0) {
        logger.info('Escalations processed', { count: activeEscalations.length });
      }

    } catch (error) {
      logger.error('Error processing escalations:', error);
    }
  }

  private async findApplicableWorkflows(
    triggerType: string,
    metadata: Record<string, any>
  ): Promise<any[]> {
    const workflows = await prisma.escalationWorkflow.findMany({
      where: { active: true }
    });

    return workflows.filter(workflow => {
      return workflow.triggerConditions.some((trigger: any) => {
        if (trigger.type !== triggerType) return false;
        
        // Evaluate trigger condition
        return this.evaluateTriggerCondition(trigger, metadata);
      });
    });
  }

  private evaluateTriggerCondition(trigger: any, metadata: Record<string, any>): boolean {
    try {
      switch (trigger.type) {
        case 'deadline_proximity':
          const daysUntilDeadline = metadata.daysUntilDeadline || 0;
          return daysUntilDeadline <= trigger.threshold;
        
        case 'no_response':
          const hoursSinceLastReminder = metadata.hoursSinceLastReminder || 0;
          return hoursSinceLastReminder >= trigger.threshold;
        
        case 'missed_deadline':
          return metadata.deadlineMissed === true;
        
        case 'priority_change':
          return metadata.priority === 'critical';
        
        default:
          return false;
      }
    } catch (error) {
      logger.error('Error evaluating trigger condition:', error);
      return false;
    }
  }

  private async processEscalationLevel(escalationId: string, level: number): Promise<void> {
    try {
      const escalation = await prisma.escalationInstance.findUnique({
        where: { id: escalationId },
        include: { workflow: true }
      });

      if (!escalation || escalation.status !== 'active') {
        return;
      }

      const escalationLevel = escalation.workflow.escalationLevels[level];
      if (!escalationLevel) {
        // No more levels, mark as completed
        await prisma.escalationInstance.update({
          where: { id: escalationId },
          data: { status: 'completed' }
        });
        return;
      }

      // Wait for delay if specified
      if (escalationLevel.delayAfterTrigger > 0) {
        setTimeout(async () => {
          await this.executeEscalationLevel(escalationId, level);
        }, escalationLevel.delayAfterTrigger * 60 * 1000);
      } else {
        await this.executeEscalationLevel(escalationId, level);
      }

    } catch (error) {
      logger.error('Error processing escalation level:', error);
    }
  }

  private async executeEscalationLevel(escalationId: string, level: number): Promise<void> {
    try {
      const escalation = await prisma.escalationInstance.findUnique({
        where: { id: escalationId },
        include: { workflow: true }
      });

      if (!escalation || escalation.status !== 'active') {
        return;
      }

      const escalationLevel = escalation.workflow.escalationLevels[level];
      
      // Generate personalized message
      const personalizedMessage = await this.personalizationService.generateEscalationMessage(
        escalation.userId,
        escalationLevel.messageTemplate,
        escalation.metadata
      );

      // Send notifications to all recipients
      for (const recipient of escalationLevel.recipients) {
        for (const channel of escalationLevel.channels) {
          try {
            const recipientId = await this.resolveRecipient(recipient, escalation.userId);
            
            const deliveryResult = await this.reminderDeliveryService.sendReminder({
              reminderId: `escalation_${escalationId}_${level}`,
              userId: recipientId,
              channel,
              title: `Escalation: ${escalationLevel.name}`,
              content: personalizedMessage,
              priority: 'high',
              metadata: {
                escalationId,
                level,
                requiresAcknowledgment: escalationLevel.requiresAcknowledgment
              }
            });

            // Record action
            await prisma.escalationAction.create({
              data: {
                id: this.generateId(),
                escalationId,
                level,
                action: 'notify',
                recipient: recipientId,
                channel,
                executedAt: new Date(),
                success: deliveryResult.success
              }
            });

          } catch (error) {
            logger.error('Error sending escalation notification:', error);
          }
        }
      }

      // Update escalation instance
      await prisma.escalationInstance.update({
        where: { id: escalationId },
        data: {
          currentLevel: level,
          lastEscalatedAt: new Date()
        }
      });

      // Schedule next level if configured
      if (escalationLevel.nextLevelDelay && level < escalation.workflow.escalationLevels.length - 1) {
        setTimeout(async () => {
          // Check if escalation is still active before proceeding
          const currentEscalation = await prisma.escalationInstance.findUnique({
            where: { id: escalationId }
          });
          
          if (currentEscalation?.status === 'active') {
            await this.processEscalationLevel(escalationId, level + 1);
          }
        }, escalationLevel.nextLevelDelay * 60 * 1000);
      }

      logger.info('Escalation level executed', { escalationId, level });

    } catch (error) {
      logger.error('Error executing escalation level:', error);
    }
  }

  private async checkEscalationProgress(escalation: any): Promise<void> {
    const currentLevel = escalation.workflow.escalationLevels[escalation.currentLevel];
    
    if (!currentLevel) return;

    // Check if escalation should auto-resolve
    if (currentLevel.autoResolve) {
      const hoursSinceEscalation = differenceInHours(new Date(), escalation.lastEscalatedAt || escalation.triggeredAt);
      
      if (hoursSinceEscalation > 24) { // Auto-resolve after 24 hours
        await this.resolveEscalation(escalation.id, 'auto_resolved_timeout');
      }
    }

    // Check for acknowledgment timeout
    if (currentLevel.requiresAcknowledgment && currentLevel.nextLevelDelay) {
      const minutesSinceEscalation = differenceInHours(new Date(), escalation.lastEscalatedAt || escalation.triggeredAt) * 60;
      
      if (minutesSinceEscalation > currentLevel.nextLevelDelay) {
        // Check if there's a next level
        if (escalation.currentLevel < escalation.workflow.escalationLevels.length - 1) {
          await this.processEscalationLevel(escalation.id, escalation.currentLevel + 1);
        }
      }
    }
  }

  private async resolveRecipient(recipient: EscalationRecipient, userId: string): Promise<string> {
    switch (recipient.type) {
      case 'user':
        return userId;
      
      case 'supervisor':
        // In a real implementation, this would look up the user's supervisor
        return recipient.identifier || userId;
      
      case 'admin':
        // Return admin user ID
        return recipient.identifier || 'admin';
      
      case 'custom':
        return recipient.identifier;
      
      default:
        return userId;
    }
  }

  private calculateEscalationStatistics(escalations: any[]): any {
    const totalEscalations = escalations.length;
    const resolvedEscalations = escalations.filter(e => e.status === 'resolved').length;
    
    const resolutionTimes = escalations
      .filter(e => e.resolvedAt)
      .map(e => differenceInHours(e.resolvedAt, e.triggeredAt));
    
    const averageResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length 
      : 0;

    const escalationsByLevel: Record<number, number> = {};
    escalations.forEach(e => {
      escalationsByLevel[e.currentLevel] = (escalationsByLevel[e.currentLevel] || 0) + 1;
    });

    return {
      totalEscalations,
      resolvedEscalations,
      averageResolutionTime,
      escalationsByLevel
    };
  }

  private startEscalationProcessor(): void {
    if (this.escalationActive) return;

    // Process escalations every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.processEscalations();
      } catch (error) {
        logger.error('Error in escalation processor:', error);
      }
    });

    this.escalationActive = true;
    logger.info('Escalation processor started');
  }

  private mapToEscalationInstance(dbEscalation: any): EscalationInstance {
    return {
      id: dbEscalation.id,
      workflowId: dbEscalation.workflowId,
      userId: dbEscalation.userId,
      reminderId: dbEscalation.reminderId,
      currentLevel: dbEscalation.currentLevel,
      status: dbEscalation.status,
      triggeredAt: dbEscalation.triggeredAt,
      lastEscalatedAt: dbEscalation.lastEscalatedAt,
      resolvedAt: dbEscalation.resolvedAt,
      metadata: dbEscalation.metadata
    };
  }

  private generateId(): string {
    return `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}