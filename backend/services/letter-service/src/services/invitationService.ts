import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { EmailService } from './emailService';

export interface Invitation {
  id: string;
  student_id: string;
  recommender_email: string;
  recommender_name?: string;
  application_id?: string;
  university_id?: string;
  message?: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: Date;
  accepted_at?: Date;
  created_at: Date;
}

export class InvitationService {
  private emailService: EmailService;

  constructor(private prisma: PrismaClient) {
    this.emailService = new EmailService();
  }

  async createInvitation(invitationData: Omit<Invitation, 'id' | 'token' | 'status' | 'created_at'>) {
    try {
      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Set expiration (default 7 days)
      const expiresAt = invitationData.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invitation = await this.prisma.invitations.create({
        data: {
          id: uuidv4(),
          student_id: invitationData.student_id,
          recommender_email: invitationData.recommender_email.toLowerCase(),
          recommender_name: invitationData.recommender_name,
          application_id: invitationData.application_id,
          university_id: invitationData.university_id,
          message: invitationData.message,
          token: token,
          status: 'pending',
          expires_at: expiresAt,
          created_at: new Date()
        }
      });

      // Send invitation email
      await this.sendInvitationEmail(invitation);

      logger.info(`Invitation created: ${invitation.id} for ${invitationData.recommender_email}`);
      return invitation;
    } catch (error) {
      logger.error('Error creating invitation:', error);
      throw error;
    }
  }

  async getInvitation(invitationId: string) {
    try {
      const invitation = await this.prisma.invitations.findUnique({
        where: { id: invitationId },
        include: {
          student: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          university: {
            select: {
              id: true,
              name: true,
              short_name: true
            }
          }
        }
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      return invitation;
    } catch (error) {
      logger.error('Error fetching invitation:', error);
      throw error;
    }
  }

  async getInvitationByToken(token: string) {
    try {
      const invitation = await this.prisma.invitations.findFirst({
        where: { token },
        include: {
          student: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          university: {
            select: {
              id: true,
              name: true,
              short_name: true
            }
          }
        }
      });

      if (!invitation) {
        throw new Error('Invalid invitation token');
      }

      // Check if expired
      if (invitation.expires_at < new Date()) {
        await this.updateInvitationStatus(invitation.id, 'expired');
        throw new Error('Invitation has expired');
      }

      return invitation;
    } catch (error) {
      logger.error('Error fetching invitation by token:', error);
      throw error;
    }
  }

  async acceptInvitation(token: string, recommenderData: any) {
    try {
      const invitation = await this.getInvitationByToken(token);

      if (invitation.status !== 'pending') {
        throw new Error('Invitation is no longer valid');
      }

      // Check if recommender already exists
      let recommender = await this.prisma.users.findUnique({
        where: { email: invitation.recommender_email }
      });

      if (!recommender) {
        // Create new recommender account
        recommender = await this.prisma.users.create({
          data: {
            id: uuidv4(),
            email: invitation.recommender_email,
            first_name: recommenderData.first_name,
            last_name: recommenderData.last_name,
            role: 'recommender',
            is_verified: true, // Auto-verify through invitation
            created_at: new Date()
          }
        });

        // Create recommender profile
        await this.prisma.recommender_profiles.create({
          data: {
            user_id: recommender.id,
            title: recommenderData.title,
            organization: recommenderData.organization,
            department: recommenderData.department,
            phone: recommenderData.phone,
            bio: recommenderData.bio,
            created_at: new Date()
          }
        });
      }

      // Update invitation status
      await this.prisma.invitations.update({
        where: { id: invitation.id },
        data: {
          status: 'accepted',
          accepted_at: new Date()
        }
      });

      // Create initial letter draft
      const letterService = new (await import('./letterService')).LetterService(this.prisma);
      const letter = await letterService.createLetter({
        student_id: invitation.student_id,
        recommender_id: recommender.id,
        application_id: invitation.application_id,
        university_id: invitation.university_id,
        title: `Recommendation Letter for ${invitation.student.first_name} ${invitation.student.last_name}`,
        content: '',
        status: 'draft'
      });

      // Send confirmation emails
      await this.sendAcceptanceConfirmation(invitation, recommender);

      logger.info(`Invitation accepted: ${invitation.id} by ${recommender.email}`);
      return {
        invitation,
        recommender,
        letter
      };
    } catch (error) {
      logger.error('Error accepting invitation:', error);
      throw error;
    }
  }

  async declineInvitation(token: string, reason?: string) {
    try {
      const invitation = await this.getInvitationByToken(token);

      if (invitation.status !== 'pending') {
        throw new Error('Invitation is no longer valid');
      }

      await this.prisma.invitations.update({
        where: { id: invitation.id },
        data: {
          status: 'declined',
          decline_reason: reason
        }
      });

      // Notify student of decline
      await this.sendDeclineNotification(invitation, reason);

      logger.info(`Invitation declined: ${invitation.id}`);
      return invitation;
    } catch (error) {
      logger.error('Error declining invitation:', error);
      throw error;
    }
  }

  async getStudentInvitations(studentId: string) {
    try {
      const invitations = await this.prisma.invitations.findMany({
        where: { student_id: studentId },
        include: {
          university: {
            select: {
              id: true,
              name: true,
              short_name: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      return invitations;
    } catch (error) {
      logger.error('Error fetching student invitations:', error);
      throw error;
    }
  }

  async getRecommenderInvitations(recommenderEmail: string) {
    try {
      const invitations = await this.prisma.invitations.findMany({
        where: { recommender_email: recommenderEmail.toLowerCase() },
        include: {
          student: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true
            }
          },
          university: {
            select: {
              id: true,
              name: true,
              short_name: true
            }
          }
        },
        orderBy: { created_at: 'desc' }
      });

      return invitations;
    } catch (error) {
      logger.error('Error fetching recommender invitations:', error);
      throw error;
    }
  }

  async resendInvitation(invitationId: string, studentId: string) {
    try {
      const invitation = await this.prisma.invitations.findFirst({
        where: {
          id: invitationId,
          student_id: studentId
        }
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Can only resend pending invitations');
      }

      // Extend expiration by 7 days
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      await this.prisma.invitations.update({
        where: { id: invitationId },
        data: {
          expires_at: newExpiresAt,
          resent_count: { increment: 1 }
        }
      });

      // Resend email
      await this.sendInvitationEmail(invitation, true);

      logger.info(`Invitation resent: ${invitationId}`);
      return invitation;
    } catch (error) {
      logger.error('Error resending invitation:', error);
      throw error;
    }
  }

  async cancelInvitation(invitationId: string, studentId: string) {
    try {
      const invitation = await this.prisma.invitations.findFirst({
        where: {
          id: invitationId,
          student_id: studentId
        }
      });

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Can only cancel pending invitations');
      }

      await this.prisma.invitations.update({
        where: { id: invitationId },
        data: {
          status: 'cancelled' as any
        }
      });

      logger.info(`Invitation cancelled: ${invitationId}`);
      return invitation;
    } catch (error) {
      logger.error('Error cancelling invitation:', error);
      throw error;
    }
  }

  private async updateInvitationStatus(invitationId: string, status: Invitation['status']) {
    return this.prisma.invitations.update({
      where: { id: invitationId },
      data: { status }
    });
  }

  private async sendInvitationEmail(invitation: any, isResend: boolean = false) {
    try {
      const inviteUrl = `${process.env.FRONTEND_URL}/invitations/${invitation.token}`;
      
      const emailData = {
        to: invitation.recommender_email,
        subject: isResend 
          ? `Reminder: Recommendation Letter Request from ${invitation.student?.first_name} ${invitation.student?.last_name}`
          : `Recommendation Letter Request from ${invitation.student?.first_name} ${invitation.student?.last_name}`,
        template: 'invitation',
        data: {
          recommender_name: invitation.recommender_name || 'Dear Recommender',
          student_name: `${invitation.student?.first_name} ${invitation.student?.last_name}`,
          university_name: invitation.university?.name,
          message: invitation.message,
          invite_url: inviteUrl,
          expires_at: invitation.expires_at,
          is_resend: isResend
        }
      };

      await this.emailService.sendEmail(emailData);
    } catch (error) {
      logger.error('Error sending invitation email:', error);
      // Don't throw - invitation should still be created even if email fails
    }
  }

  private async sendAcceptanceConfirmation(invitation: any, recommender: any) {
    try {
      // Email to student
      await this.emailService.sendEmail({
        to: invitation.student.email,
        subject: `${recommender.first_name} ${recommender.last_name} accepted your recommendation request`,
        template: 'invitation_accepted_student',
        data: {
          student_name: `${invitation.student.first_name} ${invitation.student.last_name}`,
          recommender_name: `${recommender.first_name} ${recommender.last_name}`,
          university_name: invitation.university?.name
        }
      });

      // Email to recommender
      await this.emailService.sendEmail({
        to: recommender.email,
        subject: 'Welcome to StellarRec - Next Steps',
        template: 'invitation_accepted_recommender',
        data: {
          recommender_name: `${recommender.first_name} ${recommender.last_name}`,
          student_name: `${invitation.student.first_name} ${invitation.student.last_name}`,
          dashboard_url: `${process.env.FRONTEND_URL}/dashboard`
        }
      });
    } catch (error) {
      logger.error('Error sending acceptance confirmation:', error);
    }
  }

  private async sendDeclineNotification(invitation: any, reason?: string) {
    try {
      await this.emailService.sendEmail({
        to: invitation.student.email,
        subject: 'Recommendation Request Update',
        template: 'invitation_declined',
        data: {
          student_name: `${invitation.student.first_name} ${invitation.student.last_name}`,
          recommender_email: invitation.recommender_email,
          university_name: invitation.university?.name,
          decline_reason: reason
        }
      });
    } catch (error) {
      logger.error('Error sending decline notification:', error);
    }
  }

  async getInvitationStats(studentId?: string) {
    try {
      const where: any = {};
      if (studentId) {
        where.student_id = studentId;
      }

      const [total, pending, accepted, declined, expired] = await Promise.all([
        this.prisma.invitations.count({ where }),
        this.prisma.invitations.count({ where: { ...where, status: 'pending' } }),
        this.prisma.invitations.count({ where: { ...where, status: 'accepted' } }),
        this.prisma.invitations.count({ where: { ...where, status: 'declined' } }),
        this.prisma.invitations.count({ where: { ...where, status: 'expired' } })
      ]);

      const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

      return {
        total_invitations: total,
        pending_invitations: pending,
        accepted_invitations: accepted,
        declined_invitations: declined,
        expired_invitations: expired,
        acceptance_rate: acceptanceRate
      };
    } catch (error) {
      logger.error('Error fetching invitation stats:', error);
      throw error;
    }
  }
}