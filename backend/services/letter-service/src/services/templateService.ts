import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: 'academic' | 'professional' | 'character' | 'general';
  content: string;
  variables: string[];
  is_public: boolean;
  created_by: string;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

export class TemplateService {
  constructor(private prisma: PrismaClient) {}

  async createTemplate(templateData: Omit<Template, 'id' | 'usage_count' | 'created_at' | 'updated_at'>) {
    try {
      const template = await this.prisma.letter_templates.create({
        data: {
          id: uuidv4(),
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          content: templateData.content,
          variables: templateData.variables,
          is_public: templateData.is_public,
          created_by: templateData.created_by,
          usage_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      });

      logger.info(`Template created: ${template.id}`);
      return template;
    } catch (error) {
      logger.error('Error creating template:', error);
      throw error;
    }
  }

  async getTemplates(userId?: string, category?: string) {
    try {
      const where: any = {
        OR: [
          { is_public: true },
          { created_by: userId }
        ]
      };

      if (category) {
        where.category = category;
      }

      const templates = await this.prisma.letter_templates.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              first_name: true,
              last_name: true
            }
          }
        },
        orderBy: [
          { usage_count: 'desc' },
          { created_at: 'desc' }
        ]
      });

      return templates;
    } catch (error) {
      logger.error('Error fetching templates:', error);
      throw error;
    }
  }

  async applyTemplate(templateId: string, variables: Record<string, string>) {
    try {
      const template = await this.prisma.letter_templates.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        throw new Error('Template not found');
      }

      let content = template.content;
      
      // Replace variables in template
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, value);
      }

      // Increment usage count
      await this.prisma.letter_templates.update({
        where: { id: templateId },
        data: { usage_count: { increment: 1 } }
      });

      return {
        template_id: templateId,
        processed_content: content,
        variables_used: Object.keys(variables)
      };
    } catch (error) {
      logger.error('Error applying template:', error);
      throw error;
    }
  }
}