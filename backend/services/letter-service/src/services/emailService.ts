import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import { logger } from '../utils/logger';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail(emailData: {
    to: string;
    subject: string;
    template: string;
    data: any;
  }) {
    try {
      const template = this.getEmailTemplate(emailData.template);
      const html = handlebars.compile(template)(emailData.data);

      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@stellarrec.com',
        to: emailData.to,
        subject: emailData.subject,
        html: html
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${emailData.to}: ${result.messageId}`);
      return result;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  private getEmailTemplate(templateName: string): string {
    const templates: Record<string, string> = {
      invitation: `
        <h2>Recommendation Letter Request</h2>
        <p>Hello {{recommender_name}},</p>
        <p>{{student_name}} has requested a recommendation letter from you for their application to {{university_name}}.</p>
        {{#if message}}
        <p><strong>Personal message:</strong></p>
        <p>{{message}}</p>
        {{/if}}
        <p><a href="{{invite_url}}" style="background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Accept Invitation</a></p>
        <p>This invitation expires on {{expires_at}}.</p>
      `,
      invitation_accepted_student: `
        <h2>Great News!</h2>
        <p>Hello {{student_name}},</p>
        <p>{{recommender_name}} has accepted your recommendation letter request for {{university_name}}.</p>
        <p>You can now collaborate on the letter through your dashboard.</p>
      `,
      invitation_declined: `
        <h2>Recommendation Request Update</h2>
        <p>Hello {{student_name}},</p>
        <p>Unfortunately, {{recommender_email}} was unable to accept your recommendation request for {{university_name}}.</p>
        {{#if decline_reason}}
        <p><strong>Reason:</strong> {{decline_reason}}</p>
        {{/if}}
        <p>Consider reaching out to another recommender.</p>
      `
    };

    return templates[templateName] || '<p>{{message}}</p>';
  }
}