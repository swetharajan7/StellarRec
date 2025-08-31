import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import handlebars from 'handlebars';
import mjml2html from 'mjml';

const prisma = new PrismaClient();

export interface NotificationTemplate {
  id: string;
  name: string;
  channel: 'email' | 'sms' | 'push';
  subject?: string; // For email
  title?: string;   // For push notifications
  content: string;
  htmlContent?: string; // For email
  textContent?: string; // For email
  category?: string;
  variables: string[];
  active: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'url';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

export class TemplateService {
  private compiledTemplates: Map<string, handlebars.TemplateDelegate> = new Map();

  constructor() {
    this.registerHelpers();
  }

  async createTemplate(template: {
    name: string;
    channel: 'email' | 'sms' | 'push';
    subject?: string;
    title?: string;
    content: string;
    htmlContent?: string;
    textContent?: string;
    category?: string;
    variables?: string[];
    createdBy?: string;
  }): Promise<string> {
    try {
      // Extract variables from template content
      const extractedVariables = this.extractVariables(template.content);
      const allVariables = [...new Set([...(template.variables || []), ...extractedVariables])];

      // Validate template syntax
      this.validateTemplate(template.content);
      if (template.htmlContent) {
        this.validateTemplate(template.htmlContent);
      }

      const newTemplate = await prisma.notificationTemplate.create({
        data: {
          id: this.generateId(),
          name: template.name,
          channel: template.channel,
          subject: template.subject,
          title: template.title,
          content: template.content,
          htmlContent: template.htmlContent,
          textContent: template.textContent,
          category: template.category || 'general',
          variables: allVariables,
          active: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: template.createdBy
        }
      });

      logger.info('Template created successfully', { 
        id: newTemplate.id, 
        name: template.name,
        channel: template.channel 
      });

      return newTemplate.id;

    } catch (error) {
      logger.error('Error creating template:', error);
      throw new Error(`Failed to create template: ${error.message}`);
    }
  }

  async updateTemplate(
    templateId: string, 
    updates: Partial<NotificationTemplate>
  ): Promise<NotificationTemplate> {
    try {
      const existingTemplate = await this.getTemplate(templateId);
      if (!existingTemplate) {
        throw new Error('Template not found');
      }

      // Extract variables if content is being updated
      let variables = existingTemplate.variables;
      if (updates.content) {
        const extractedVariables = this.extractVariables(updates.content);
        variables = [...new Set([...variables, ...extractedVariables])];
        this.validateTemplate(updates.content);
      }

      if (updates.htmlContent) {
        this.validateTemplate(updates.htmlContent);
      }

      const updatedTemplate = await prisma.notificationTemplate.update({
        where: { id: templateId },
        data: {
          ...updates,
          variables,
          version: existingTemplate.version + 1,
          updatedAt: new Date()
        }
      });

      // Clear compiled template cache
      this.compiledTemplates.delete(templateId);

      logger.info('Template updated successfully', { id: templateId });

      return this.mapToTemplate(updatedTemplate);

    } catch (error) {
      logger.error('Error updating template:', error);
      throw new Error(`Failed to update template: ${error.message}`);
    }
  }

  async getTemplate(templateId: string): Promise<NotificationTemplate | null> {
    try {
      const template = await prisma.notificationTemplate.findUnique({
        where: { id: templateId }
      });

      return template ? this.mapToTemplate(template) : null;

    } catch (error) {
      logger.error('Error getting template:', error);
      throw new Error(`Failed to get template: ${error.message}`);
    }
  }

  async getTemplatesByChannel(channel: 'email' | 'sms' | 'push'): Promise<NotificationTemplate[]> {
    try {
      const templates = await prisma.notificationTemplate.findMany({
        where: { 
          channel,
          active: true 
        },
        orderBy: { name: 'asc' }
      });

      return templates.map(this.mapToTemplate);

    } catch (error) {
      logger.error('Error getting templates by channel:', error);
      throw new Error(`Failed to get templates by channel: ${error.message}`);
    }
  }

  async getTemplatesByCategory(category: string): Promise<NotificationTemplate[]> {
    try {
      const templates = await prisma.notificationTemplate.findMany({
        where: { 
          category,
          active: true 
        },
        orderBy: { name: 'asc' }
      });

      return templates.map(this.mapToTemplate);

    } catch (error) {
      logger.error('Error getting templates by category:', error);
      throw new Error(`Failed to get templates by category: ${error.message}`);
    }
  }

  async renderTemplate(templateId: string, data: Record<string, any>): Promise<{
    subject?: string;
    title?: string;
    content: string;
    htmlContent?: string;
    textContent?: string;
  }> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error('Template not found');
      }

      // Get or compile template
      let compiledTemplate = this.compiledTemplates.get(templateId);
      if (!compiledTemplate) {
        compiledTemplate = handlebars.compile(template.content);
        this.compiledTemplates.set(templateId, compiledTemplate);
      }

      const result: any = {
        content: compiledTemplate(data)
      };

      // Render subject for email templates
      if (template.subject) {
        const subjectTemplate = handlebars.compile(template.subject);
        result.subject = subjectTemplate(data);
      }

      // Render title for push templates
      if (template.title) {
        const titleTemplate = handlebars.compile(template.title);
        result.title = titleTemplate(data);
      }

      // Render HTML content for email templates
      if (template.htmlContent) {
        const htmlTemplate = handlebars.compile(template.htmlContent);
        let htmlContent = htmlTemplate(data);

        // Convert MJML to HTML if needed
        if (htmlContent.includes('<mjml>')) {
          const mjmlResult = mjml2html(htmlContent);
          if (!mjmlResult.errors.length) {
            htmlContent = mjmlResult.html;
          }
        }

        result.htmlContent = htmlContent;
      }

      // Render text content for email templates
      if (template.textContent) {
        const textTemplate = handlebars.compile(template.textContent);
        result.textContent = textTemplate(data);
      }

      return result;

    } catch (error) {
      logger.error('Error rendering template:', error);
      throw new Error(`Failed to render template: ${error.message}`);
    }
  }

  async validateTemplateData(templateId: string, data: Record<string, any>): Promise<{
    valid: boolean;
    missingVariables: string[];
    errors: string[];
  }> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        return { valid: false, missingVariables: [], errors: ['Template not found'] };
      }

      const missingVariables: string[] = [];
      const errors: string[] = [];

      // Check for required variables
      template.variables.forEach(variable => {
        if (!(variable in data)) {
          missingVariables.push(variable);
        }
      });

      // Try to render template to catch any other errors
      try {
        await this.renderTemplate(templateId, data);
      } catch (renderError) {
        errors.push(`Template rendering error: ${renderError.message}`);
      }

      return {
        valid: missingVariables.length === 0 && errors.length === 0,
        missingVariables,
        errors
      };

    } catch (error) {
      logger.error('Error validating template data:', error);
      return { valid: false, missingVariables: [], errors: [error.message] };
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    try {
      await prisma.notificationTemplate.update({
        where: { id: templateId },
        data: { active: false }
      });

      // Clear from cache
      this.compiledTemplates.delete(templateId);

      logger.info('Template deleted successfully', { id: templateId });

    } catch (error) {
      logger.error('Error deleting template:', error);
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  async duplicateTemplate(templateId: string, newName: string): Promise<string> {
    try {
      const originalTemplate = await this.getTemplate(templateId);
      if (!originalTemplate) {
        throw new Error('Template not found');
      }

      const duplicatedTemplate = await this.createTemplate({
        name: newName,
        channel: originalTemplate.channel,
        subject: originalTemplate.subject,
        title: originalTemplate.title,
        content: originalTemplate.content,
        htmlContent: originalTemplate.htmlContent,
        textContent: originalTemplate.textContent,
        category: originalTemplate.category,
        variables: originalTemplate.variables
      });

      logger.info('Template duplicated successfully', { 
        originalId: templateId,
        newId: duplicatedTemplate 
      });

      return duplicatedTemplate;

    } catch (error) {
      logger.error('Error duplicating template:', error);
      throw new Error(`Failed to duplicate template: ${error.message}`);
    }
  }

  async getTemplateUsageStats(templateId: string): Promise<{
    totalSent: number;
    successRate: number;
    lastUsed?: Date;
    popularVariables: string[];
  }> {
    try {
      // This would typically query delivery tracking data
      // For now, return mock data
      return {
        totalSent: 0,
        successRate: 0,
        lastUsed: undefined,
        popularVariables: []
      };

    } catch (error) {
      logger.error('Error getting template usage stats:', error);
      throw new Error(`Failed to get template usage stats: ${error.message}`);
    }
  }

  private extractVariables(content: string): string[] {
    const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      const variable = match[1].trim().split(' ')[0]; // Handle helpers
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }

    return variables;
  }

  private validateTemplate(content: string): void {
    try {
      handlebars.compile(content);
    } catch (error) {
      throw new Error(`Invalid template syntax: ${error.message}`);
    }
  }

  private registerHelpers(): void {
    // Date formatting helper
    handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      if (!date) return '';
      
      const d = new Date(date);
      switch (format) {
        case 'short':
          return d.toLocaleDateString();
        case 'long':
          return d.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        case 'time':
          return d.toLocaleTimeString();
        default:
          return d.toISOString();
      }
    });

    // Uppercase helper
    handlebars.registerHelper('uppercase', (str: string) => {
      return str ? str.toUpperCase() : '';
    });

    // Lowercase helper
    handlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    // Capitalize helper
    handlebars.registerHelper('capitalize', (str: string) => {
      return str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';
    });

    // Truncate helper
    handlebars.registerHelper('truncate', (str: string, length: number) => {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });

    // Conditional helper
    handlebars.registerHelper('ifEquals', function(arg1: any, arg2: any, options: any) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    // URL helper
    handlebars.registerHelper('url', (path: string) => {
      const baseUrl = process.env.FRONTEND_URL || 'https://stellarrec.com';
      return `${baseUrl}${path}`;
    });
  }

  private mapToTemplate(dbTemplate: any): NotificationTemplate {
    return {
      id: dbTemplate.id,
      name: dbTemplate.name,
      channel: dbTemplate.channel,
      subject: dbTemplate.subject,
      title: dbTemplate.title,
      content: dbTemplate.content,
      htmlContent: dbTemplate.htmlContent,
      textContent: dbTemplate.textContent,
      category: dbTemplate.category,
      variables: dbTemplate.variables,
      active: dbTemplate.active,
      version: dbTemplate.version,
      createdAt: dbTemplate.createdAt,
      updatedAt: dbTemplate.updatedAt,
      createdBy: dbTemplate.createdBy
    };
  }

  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}