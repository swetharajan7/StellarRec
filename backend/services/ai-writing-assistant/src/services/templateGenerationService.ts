import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface TemplateRequest {
  document_type: 'letter' | 'essay' | 'personal_statement' | 'cover_letter';
  purpose: string;
  target_audience: string;
  key_points: string[];
  tone: 'formal' | 'professional' | 'personal' | 'academic';
  length: 'short' | 'medium' | 'long';
  user_profile?: any;
}

export interface GeneratedTemplate {
  id: string;
  title: string;
  content: string;
  structure: TemplateSection[];
  variables: TemplateVariable[];
  instructions: string[];
  estimated_length: number;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
}

export interface TemplateSection {
  name: string;
  description: string;
  content: string;
  order: number;
  required: boolean;
}

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'text' | 'number' | 'date' | 'list';
  required: boolean;
  placeholder: string;
}

export class TemplateGenerationService {
  private openai: OpenAI;

  constructor(private prisma: PrismaClient) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateTemplate(request: TemplateRequest, userId: string): Promise<GeneratedTemplate> {
    try {
      logger.info(`Generating template for user ${userId}: ${request.document_type}`);

      const prompt = this.buildTemplatePrompt(request);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000
      });

      const templateData = JSON.parse(response.choices[0].message.content || '{}');
      
      const template: GeneratedTemplate = {
        id: this.generateId(),
        title: templateData.title,
        content: templateData.content,
        structure: templateData.structure || [],
        variables: templateData.variables || [],
        instructions: templateData.instructions || [],
        estimated_length: templateData.estimated_length || 500,
        difficulty_level: templateData.difficulty_level || 'intermediate'
      };

      // Save template to database
      await this.saveTemplate(template, request, userId);

      return template;
    } catch (error) {
      logger.error('Error generating template:', error);
      throw error;
    }
  }

  async generatePersonalizedTemplate(
    request: TemplateRequest, 
    userProfile: any, 
    userId: string
  ): Promise<GeneratedTemplate> {
    try {
      const personalizedPrompt = this.buildPersonalizedPrompt(request, userProfile);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: personalizedPrompt }],
        temperature: 0.6,
        max_tokens: 2500
      });

      const templateData = JSON.parse(response.choices[0].message.content || '{}');
      
      const template: GeneratedTemplate = {
        id: this.generateId(),
        title: `Personalized ${templateData.title}`,
        content: templateData.content,
        structure: templateData.structure || [],
        variables: templateData.variables || [],
        instructions: templateData.instructions || [],
        estimated_length: templateData.estimated_length || 500,
        difficulty_level: templateData.difficulty_level || 'intermediate'
      };

      await this.saveTemplate(template, request, userId, userProfile);

      return template;
    } catch (error) {
      logger.error('Error generating personalized template:', error);
      throw error;
    }
  }

  async getTemplateLibrary(
    documentType?: string, 
    category?: string, 
    userId?: string
  ) {
    try {
      const where: any = { is_public: true };
      
      if (documentType) {
        where.document_type = documentType;
      }
      
      if (category) {
        where.category = category;
      }

      const templates = await this.prisma.writing_templates.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          document_type: true,
          category: true,
          difficulty_level: true,
          estimated_length: true,
          usage_count: true,
          rating: true,
          created_at: true
        },
        orderBy: [
          { usage_count: 'desc' },
          { rating: 'desc' },
          { created_at: 'desc' }
        ]
      });

      return templates;
    } catch (error) {
      logger.error('Error fetching template library:', error);
      throw error;
    }
  }

  async customizeTemplate(
    templateId: string, 
    customizations: any, 
    userId: string
  ): Promise<GeneratedTemplate> {
    try {
      const baseTemplate = await this.prisma.writing_templates.findUnique({
        where: { id: templateId }
      });

      if (!baseTemplate) {
        throw new Error('Template not found');
      }

      const customizationPrompt = `Customize this template based on the user's requirements:

Base Template:
Title: ${baseTemplate.title}
Content: ${baseTemplate.content}

Customizations:
${JSON.stringify(customizations, null, 2)}

Provide the customized template in JSON format:
{
  "title": "Customized template title",
  "content": "Full customized template content with placeholders",
  "structure": [
    {
      "name": "Section name",
      "description": "What this section covers",
      "content": "Section content with placeholders",
      "order": 1,
      "required": true
    }
  ],
  "variables": [
    {
      "name": "variable_name",
      "description": "What this variable represents",
      "type": "text",
      "required": true,
      "placeholder": "Example value"
    }
  ],
  "instructions": ["Step-by-step instructions"],
  "estimated_length": 600,
  "difficulty_level": "intermediate"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: customizationPrompt }],
        temperature: 0.5,
        max_tokens: 2000
      });

      const customizedData = JSON.parse(response.choices[0].message.content || '{}');
      
      const customizedTemplate: GeneratedTemplate = {
        id: this.generateId(),
        title: customizedData.title,
        content: customizedData.content,
        structure: customizedData.structure || [],
        variables: customizedData.variables || [],
        instructions: customizedData.instructions || [],
        estimated_length: customizedData.estimated_length || 500,
        difficulty_level: customizedData.difficulty_level || 'intermediate'
      };

      // Save as user's custom template
      await this.saveCustomTemplate(customizedTemplate, templateId, userId);

      return customizedTemplate;
    } catch (error) {
      logger.error('Error customizing template:', error);
      throw error;
    }
  }

  private buildTemplatePrompt(request: TemplateRequest): string {
    const lengthGuidance = {
      short: '200-400 words',
      medium: '400-800 words',
      long: '800-1200 words'
    };

    return `Generate a comprehensive ${request.document_type} template with the following specifications:

Purpose: ${request.purpose}
Target Audience: ${request.target_audience}
Key Points to Address: ${request.key_points.join(', ')}
Tone: ${request.tone}
Length: ${lengthGuidance[request.length]}

Provide the template in JSON format:
{
  "title": "Template title",
  "content": "Full template content with {{variable}} placeholders",
  "structure": [
    {
      "name": "Introduction",
      "description": "Opening paragraph purpose",
      "content": "Template content for this section",
      "order": 1,
      "required": true
    }
  ],
  "variables": [
    {
      "name": "recipient_name",
      "description": "Name of the person/organization",
      "type": "text",
      "required": true,
      "placeholder": "Dr. Smith"
    }
  ],
  "instructions": [
    "Step-by-step writing instructions"
  ],
  "estimated_length": 500,
  "difficulty_level": "intermediate"
}

Make the template professional, well-structured, and include helpful placeholders and instructions.`;
  }

  private buildPersonalizedPrompt(request: TemplateRequest, userProfile: any): string {
    return `Generate a personalized ${request.document_type} template based on this user profile:

User Profile:
- Background: ${userProfile.background || 'Not specified'}
- Experience: ${userProfile.experience || 'Not specified'}
- Goals: ${userProfile.goals || 'Not specified'}
- Strengths: ${userProfile.strengths?.join(', ') || 'Not specified'}
- Target Programs/Positions: ${userProfile.targets?.join(', ') || 'Not specified'}

Template Requirements:
Purpose: ${request.purpose}
Target Audience: ${request.target_audience}
Key Points: ${request.key_points.join(', ')}
Tone: ${request.tone}
Length: ${request.length}

Create a template that incorporates the user's specific background and goals. Include personalized examples and suggestions based on their profile.

Provide in JSON format with the same structure as before, but with personalized content and variables.`;
  }

  private async saveTemplate(
    template: GeneratedTemplate, 
    request: TemplateRequest, 
    userId: string,
    userProfile?: any
  ) {
    try {
      await this.prisma.writing_templates.create({
        data: {
          id: template.id,
          title: template.title,
          content: template.content,
          document_type: request.document_type,
          purpose: request.purpose,
          target_audience: request.target_audience,
          tone: request.tone,
          structure: template.structure,
          variables: template.variables,
          instructions: template.instructions,
          estimated_length: template.estimated_length,
          difficulty_level: template.difficulty_level,
          created_by: userId,
          is_public: false,
          is_personalized: !!userProfile,
          user_profile: userProfile,
          usage_count: 0,
          rating: 0,
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.error('Error saving template:', error);
      // Don't throw - template generation should still work
    }
  }

  private async saveCustomTemplate(
    template: GeneratedTemplate, 
    baseTemplateId: string, 
    userId: string
  ) {
    try {
      await this.prisma.custom_templates.create({
        data: {
          id: template.id,
          base_template_id: baseTemplateId,
          user_id: userId,
          title: template.title,
          content: template.content,
          structure: template.structure,
          variables: template.variables,
          instructions: template.instructions,
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.error('Error saving custom template:', error);
    }
  }

  async getUserTemplates(userId: string) {
    try {
      const [createdTemplates, customTemplates] = await Promise.all([
        this.prisma.writing_templates.findMany({
          where: { created_by: userId },
          orderBy: { created_at: 'desc' }
        }),
        this.prisma.custom_templates.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' }
        })
      ]);

      return {
        created: createdTemplates,
        customized: customTemplates
      };
    } catch (error) {
      logger.error('Error fetching user templates:', error);
      throw error;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}