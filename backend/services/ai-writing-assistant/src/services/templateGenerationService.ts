import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export interface TemplateRequest {
  essayType: 'personal_statement' | 'supplemental_essay' | 'scholarship_essay' | 'cover_letter';
  userProfile: {
    major?: string;
    interests?: string[];
    experiences?: string[];
    achievements?: string[];
    goals?: string[];
    background?: string;
  };
  requirements: {
    wordLimit?: number;
    prompts?: string[];
    tone?: 'professional' | 'personal' | 'academic' | 'creative';
    audience?: string;
    university?: string;
  };
  userId: string;
}

export interface GeneratedTemplate {
  id: string;
  type: string;
  title: string;
  structure: {
    introduction: {
      hook: string;
      background: string;
      thesis: string;
    };
    body: {
      paragraph: number;
      topic: string;
      content: string;
      examples: string[];
    }[];
    conclusion: {
      summary: string;
      futureGoals: string;
      callToAction: string;
    };
  };
  content: string;
  placeholders: {
    key: string;
    description: string;
    suggestions: string[];
  }[];
  wordCount: number;
  estimatedTime: number; // minutes to complete
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tips: string[];
}

export interface TemplateCustomization {
  templateId: string;
  customizations: {
    tone?: 'professional' | 'personal' | 'academic' | 'creative';
    length?: 'short' | 'medium' | 'long';
    focus?: string[];
    style?: 'narrative' | 'analytical' | 'descriptive' | 'persuasive';
  };
  userPreferences: {
    writingStyle?: string;
    strengthsToHighlight?: string[];
    experiencesToInclude?: string[];
  };
}

export class TemplateGenerationService {
  async generateTemplate(request: TemplateRequest): Promise<GeneratedTemplate> {
    try {
      const templateId = this.generateId();
      
      // Analyze user profile to determine focus areas
      const focusAreas = this.analyzeFocusAreas(request.userProfile, request.essayType);
      
      // Generate structure based on essay type and requirements
      const structure = await this.generateStructure(request, focusAreas);
      
      // Generate content using AI
      const content = await this.generateContent(request, structure);
      
      // Create placeholders for personalization
      const placeholders = this.createPlaceholders(request, structure);
      
      // Calculate metrics
      const wordCount = this.estimateWordCount(structure);
      const estimatedTime = this.estimateCompletionTime(wordCount, request.essayType);
      const difficulty = this.assessDifficulty(request);
      
      // Generate tips
      const tips = this.generateTips(request.essayType, request.userProfile);
      
      const template: GeneratedTemplate = {
        id: templateId,
        type: request.essayType,
        title: this.generateTitle(request),
        structure,
        content,
        placeholders,
        wordCount,
        estimatedTime,
        difficulty,
        tips
      };
      
      // Store template
      await this.storeTemplate(request.userId, template);
      
      return template;
      
    } catch (error) {
      console.error('Error generating template:', error);
      throw new Error(`Failed to generate template: ${error.message}`);
    }
  }

  async customizeTemplate(templateId: string, customization: TemplateCustomization): Promise<GeneratedTemplate> {
    try {
      // Retrieve original template
      const originalTemplate = await this.getTemplate(templateId);
      if (!originalTemplate) {
        throw new Error('Template not found');
      }
      
      // Apply customizations
      const customizedStructure = await this.applyCustomizations(
        originalTemplate.structure,
        customization
      );
      
      // Regenerate content with customizations
      const customizedContent = await this.regenerateContent(
        customizedStructure,
        customization
      );
      
      // Update placeholders
      const updatedPlaceholders = this.updatePlaceholders(
        originalTemplate.placeholders,
        customization
      );
      
      // Create new template with customizations
      const customizedTemplate: GeneratedTemplate = {
        ...originalTemplate,
        id: this.generateId(),
        structure: customizedStructure,
        content: customizedContent,
        placeholders: updatedPlaceholders,
        wordCount: this.estimateWordCount(customizedStructure)
      };
      
      return customizedTemplate;
      
    } catch (error) {
      console.error('Error customizing template:', error);
      throw new Error(`Failed to customize template: ${error.message}`);
    }
  }

  async getTemplateCategories(): Promise<{
    category: string;
    templates: {
      id: string;
      title: string;
      description: string;
      difficulty: string;
      estimatedTime: number;
    }[];
  }[]> {
    try {
      const categories = [
        {
          category: 'Personal Statements',
          templates: await this.getTemplatesByType('personal_statement')
        },
        {
          category: 'Supplemental Essays',
          templates: await this.getTemplatesByType('supplemental_essay')
        },
        {
          category: 'Scholarship Essays',
          templates: await this.getTemplatesByType('scholarship_essay')
        },
        {
          category: 'Cover Letters',
          templates: await this.getTemplatesByType('cover_letter')
        }
      ];
      
      return categories;
      
    } catch (error) {
      console.error('Error getting template categories:', error);
      throw new Error(`Failed to get template categories: ${error.message}`);
    }
  }

  private analyzeFocusAreas(userProfile: TemplateRequest['userProfile'], essayType: string): string[] {
    const focusAreas: string[] = [];
    
    // Analyze based on essay type
    switch (essayType) {
      case 'personal_statement':
        focusAreas.push('personal_growth', 'academic_interests', 'future_goals');
        break;
      case 'supplemental_essay':
        focusAreas.push('university_fit', 'specific_programs', 'contribution');
        break;
      case 'scholarship_essay':
        focusAreas.push('financial_need', 'academic_merit', 'community_service');
        break;
      case 'cover_letter':
        focusAreas.push('relevant_experience', 'skills', 'enthusiasm');
        break;
    }
    
    // Add focus areas based on user profile
    if (userProfile.experiences?.length) {
      focusAreas.push('experience_highlights');
    }
    if (userProfile.achievements?.length) {
      focusAreas.push('achievements');
    }
    if (userProfile.interests?.length) {
      focusAreas.push('interests_alignment');
    }
    
    return focusAreas;
  }

  private async generateStructure(
    request: TemplateRequest,
    focusAreas: string[]
  ): Promise<GeneratedTemplate['structure']> {
    const { essayType, requirements, userProfile } = request;
    
    // Generate introduction structure
    const introduction = {
      hook: this.generateHookSuggestion(essayType, userProfile),
      background: this.generateBackgroundSuggestion(userProfile),
      thesis: this.generateThesisSuggestion(essayType, focusAreas)
    };
    
    // Generate body paragraphs based on focus areas
    const body = focusAreas.map((area, index) => ({
      paragraph: index + 1,
      topic: this.getTopicForFocusArea(area),
      content: this.generateParagraphContent(area, userProfile),
      examples: this.generateExampleSuggestions(area, userProfile)
    }));
    
    // Generate conclusion structure
    const conclusion = {
      summary: this.generateSummarySuggestion(focusAreas),
      futureGoals: this.generateFutureGoalsSuggestion(userProfile),
      callToAction: this.generateCallToActionSuggestion(essayType)
    };
    
    return {
      introduction,
      body,
      conclusion
    };
  }

  private async generateContent(
    request: TemplateRequest,
    structure: GeneratedTemplate['structure']
  ): Promise<string> {
    try {
      // Use OpenAI GPT to generate content based on structure
      const prompt = this.createContentPrompt(request, structure);
      
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert college admissions essay writer. Generate high-quality, personalized essay content based on the provided structure and user information.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.choices[0].message.content;
      
    } catch (error) {
      console.error('Error generating content with AI:', error);
      // Fallback to template-based content generation
      return this.generateFallbackContent(structure);
    }
  }

  private createPlaceholders(
    request: TemplateRequest,
    structure: GeneratedTemplate['structure']
  ): GeneratedTemplate['placeholders'] {
    const placeholders: GeneratedTemplate['placeholders'] = [];
    
    // Common placeholders
    placeholders.push({
      key: '[YOUR_NAME]',
      description: 'Your full name',
      suggestions: ['Use your preferred name or full legal name']
    });
    
    placeholders.push({
      key: '[YOUR_MAJOR]',
      description: 'Your intended major or field of study',
      suggestions: request.userProfile.major ? [request.userProfile.major] : ['Computer Science', 'Biology', 'English Literature']
    });
    
    placeholders.push({
      key: '[SPECIFIC_EXPERIENCE]',
      description: 'A specific experience that shaped you',
      suggestions: request.userProfile.experiences || ['Internship experience', 'Research project', 'Volunteer work']
    });
    
    placeholders.push({
      key: '[FUTURE_GOALS]',
      description: 'Your future career or academic goals',
      suggestions: request.userProfile.goals || ['Graduate school', 'Industry career', 'Research position']
    });
    
    // Essay-type specific placeholders
    if (request.essayType === 'supplemental_essay') {
      placeholders.push({
        key: '[UNIVERSITY_NAME]',
        description: 'The name of the university you\'re applying to',
        suggestions: request.requirements.university ? [request.requirements.university] : ['Harvard University', 'Stanford University']
      });
      
      placeholders.push({
        key: '[SPECIFIC_PROGRAM]',
        description: 'Specific program or opportunity at the university',
        suggestions: ['Research lab', 'Study abroad program', 'Student organization']
      });
    }
    
    if (request.essayType === 'scholarship_essay') {
      placeholders.push({
        key: '[FINANCIAL_SITUATION]',
        description: 'Brief description of your financial need',
        suggestions: ['Family financial circumstances', 'Educational expenses', 'Economic challenges']
      });
    }
    
    return placeholders;
  }

  private generateTitle(request: TemplateRequest): string {
    const titles = {
      'personal_statement': [
        'My Journey to [YOUR_MAJOR]',
        'Discovering My Passion',
        'The Path That Led Me Here',
        'My Story of Growth and Discovery'
      ],
      'supplemental_essay': [
        'Why [UNIVERSITY_NAME] is Perfect for Me',
        'My Contribution to [UNIVERSITY_NAME]',
        'Finding My Place at [UNIVERSITY_NAME]'
      ],
      'scholarship_essay': [
        'Investing in My Future',
        'Breaking Barriers Through Education',
        'My Commitment to Excellence'
      ],
      'cover_letter': [
        'Application for [POSITION_TITLE]',
        'My Interest in [COMPANY_NAME]',
        'Why I\'m the Right Fit'
      ]
    };
    
    const typeTitles = titles[request.essayType] || ['My Essay'];
    return typeTitles[Math.floor(Math.random() * typeTitles.length)];
  }

  private generateTips(essayType: string, userProfile: TemplateRequest['userProfile']): string[] {
    const commonTips = [
      'Be specific and use concrete examples',
      'Show, don\'t tell - use vivid details',
      'Connect your experiences to your goals',
      'Proofread carefully for grammar and spelling',
      'Stay within the word limit'
    ];
    
    const typeTips = {
      'personal_statement': [
        'Focus on personal growth and self-reflection',
        'Highlight what makes you unique',
        'Connect your past experiences to future goals'
      ],
      'supplemental_essay': [
        'Research the university thoroughly',
        'Be specific about programs and opportunities',
        'Show genuine interest and fit'
      ],
      'scholarship_essay': [
        'Emphasize your achievements and potential',
        'Explain how the scholarship will help you',
        'Demonstrate financial need if applicable'
      ],
      'cover_letter': [
        'Tailor to the specific position',
        'Highlight relevant experience and skills',
        'Show enthusiasm for the role'
      ]
    };
    
    return [...commonTips, ...(typeTips[essayType] || [])];
  }

  private estimateWordCount(structure: GeneratedTemplate['structure']): number {
    const introWords = 100;
    const bodyWords = structure.body.length * 150;
    const conclusionWords = 100;
    
    return introWords + bodyWords + conclusionWords;
  }

  private estimateCompletionTime(wordCount: number, essayType: string): number {
    // Base time: 2 minutes per 100 words for writing + research time
    const baseTime = Math.ceil(wordCount / 100) * 2;
    
    const complexityMultiplier = {
      'personal_statement': 1.5,
      'supplemental_essay': 1.2,
      'scholarship_essay': 1.3,
      'cover_letter': 1.0
    };
    
    return Math.ceil(baseTime * (complexityMultiplier[essayType] || 1.0));
  }

  private assessDifficulty(request: TemplateRequest): 'beginner' | 'intermediate' | 'advanced' {
    let difficultyScore = 0;
    
    // Essay type difficulty
    const typeDifficulty = {
      'cover_letter': 1,
      'supplemental_essay': 2,
      'scholarship_essay': 3,
      'personal_statement': 4
    };
    
    difficultyScore += typeDifficulty[request.essayType] || 2;
    
    // Word limit difficulty
    if (request.requirements.wordLimit) {
      if (request.requirements.wordLimit > 800) difficultyScore += 2;
      else if (request.requirements.wordLimit > 500) difficultyScore += 1;
    }
    
    // Multiple prompts increase difficulty
    if (request.requirements.prompts && request.requirements.prompts.length > 1) {
      difficultyScore += 1;
    }
    
    if (difficultyScore <= 3) return 'beginner';
    if (difficultyScore <= 6) return 'intermediate';
    return 'advanced';
  }

  // Helper methods for content generation
  private generateHookSuggestion(essayType: string, userProfile: TemplateRequest['userProfile']): string {
    const hooks = {
      'personal_statement': [
        'Start with a pivotal moment that changed your perspective',
        'Begin with a question that drives your academic interests',
        'Open with a vivid scene from a meaningful experience'
      ],
      'supplemental_essay': [
        'Start with what specifically draws you to this university',
        'Begin with a connection between your goals and the school\'s mission',
        'Open with a specific program or opportunity that excites you'
      ]
    };
    
    const typeHooks = hooks[essayType] || ['Start with an engaging opening that captures attention'];
    return typeHooks[Math.floor(Math.random() * typeHooks.length)];
  }

  private generateBackgroundSuggestion(userProfile: TemplateRequest['userProfile']): string {
    return 'Provide relevant background information that sets up your main story or argument';
  }

  private generateThesisSuggestion(essayType: string, focusAreas: string[]): string {
    return `Clearly state your main argument or the central theme that ties together your ${focusAreas.join(', ')}`;
  }

  private getTopicForFocusArea(area: string): string {
    const topics = {
      'personal_growth': 'Personal Development and Learning',
      'academic_interests': 'Academic Passion and Curiosity',
      'future_goals': 'Career Aspirations and Vision',
      'university_fit': 'Why This University',
      'experience_highlights': 'Key Experiences',
      'achievements': 'Notable Accomplishments',
      'community_service': 'Service and Leadership'
    };
    
    return topics[area] || 'Important Topic';
  }

  private generateParagraphContent(area: string, userProfile: TemplateRequest['userProfile']): string {
    return `Develop your ${area.replace('_', ' ')} with specific examples and reflection on their significance.`;
  }

  private generateExampleSuggestions(area: string, userProfile: TemplateRequest['userProfile']): string[] {
    const examples = userProfile.experiences || userProfile.achievements || [];
    return examples.slice(0, 3);
  }

  private generateSummarySuggestion(focusAreas: string[]): string {
    return `Synthesize your main points about ${focusAreas.join(', ')} without simply repeating them`;
  }

  private generateFutureGoalsSuggestion(userProfile: TemplateRequest['userProfile']): string {
    return userProfile.goals?.join(', ') || 'Articulate your future aspirations and how this opportunity fits into your plans';
  }

  private generateCallToActionSuggestion(essayType: string): string {
    const actions = {
      'personal_statement': 'End with confidence about your readiness for this next step',
      'supplemental_essay': 'Conclude with enthusiasm about contributing to the university community',
      'scholarship_essay': 'Close with gratitude and commitment to making the most of this opportunity',
      'cover_letter': 'End with a professional request for consideration and next steps'
    };
    
    return actions[essayType] || 'Conclude with a strong, memorable closing statement';
  }

  private createContentPrompt(request: TemplateRequest, structure: GeneratedTemplate['structure']): string {
    return `
Generate a ${request.essayType.replace('_', ' ')} with the following requirements:
- Type: ${request.essayType}
- Word limit: ${request.requirements.wordLimit || 'flexible'}
- Tone: ${request.requirements.tone || 'professional'}
- User background: ${JSON.stringify(request.userProfile)}

Structure to follow:
${JSON.stringify(structure, null, 2)}

Please generate engaging, personalized content that follows this structure while leaving placeholders for specific personal details.
`;
  }

  private generateFallbackContent(structure: GeneratedTemplate['structure']): string {
    let content = '';
    
    // Introduction
    content += `${structure.introduction.hook}\n\n`;
    content += `${structure.introduction.background}\n\n`;
    content += `${structure.introduction.thesis}\n\n`;
    
    // Body paragraphs
    structure.body.forEach(paragraph => {
      content += `${paragraph.content}\n\n`;
    });
    
    // Conclusion
    content += `${structure.conclusion.summary}\n\n`;
    content += `${structure.conclusion.futureGoals}\n\n`;
    content += `${structure.conclusion.callToAction}\n\n`;
    
    return content;
  }

  private async applyCustomizations(
    structure: GeneratedTemplate['structure'],
    customization: TemplateCustomization
  ): Promise<GeneratedTemplate['structure']> {
    // Apply tone, length, and style customizations
    // This is a simplified implementation
    return structure;
  }

  private async regenerateContent(
    structure: GeneratedTemplate['structure'],
    customization: TemplateCustomization
  ): Promise<string> {
    // Regenerate content with customizations
    return this.generateFallbackContent(structure);
  }

  private updatePlaceholders(
    placeholders: GeneratedTemplate['placeholders'],
    customization: TemplateCustomization
  ): GeneratedTemplate['placeholders'] {
    // Update placeholders based on customizations
    return placeholders;
  }

  private async getTemplate(templateId: string): Promise<GeneratedTemplate | null> {
    try {
      const template = await prisma.essayTemplate.findUnique({
        where: { id: templateId }
      });
      
      return template ? JSON.parse(template.content) : null;
    } catch (error) {
      console.error('Error getting template:', error);
      return null;
    }
  }

  private async getTemplatesByType(type: string): Promise<any[]> {
    try {
      const templates = await prisma.essayTemplate.findMany({
        where: { type },
        select: {
          id: true,
          title: true,
          description: true,
          difficulty: true,
          estimatedTime: true
        }
      });
      
      return templates;
    } catch (error) {
      console.error('Error getting templates by type:', error);
      return [];
    }
  }

  private async storeTemplate(userId: string, template: GeneratedTemplate): Promise<void> {
    try {
      await prisma.essayTemplate.create({
        data: {
          id: template.id,
          userId,
          type: template.type,
          title: template.title,
          content: JSON.stringify(template),
          difficulty: template.difficulty,
          estimatedTime: template.estimatedTime,
          wordCount: template.wordCount,
          createdAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error storing template:', error);
    }
  }

  private generateId(): string {
    return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}