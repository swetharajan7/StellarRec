import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface Suggestion {
  id: string;
  type: 'grammar' | 'style' | 'vocabulary' | 'structure' | 'content';
  category: 'correction' | 'improvement' | 'enhancement';
  message: string;
  original_text: string;
  suggested_text: string;
  position: { start: number; end: number };
  confidence: number;
  reasoning: string;
  applied: boolean;
}

export interface SuggestionContext {
  document_type: 'letter' | 'essay' | 'application';
  target_audience: 'academic' | 'professional' | 'general';
  writing_goal: 'persuasive' | 'informative' | 'narrative' | 'descriptive';
  user_level: 'beginner' | 'intermediate' | 'advanced';
}

export class SuggestionService {
  private openai: OpenAI;

  constructor(private prisma: PrismaClient, private io: Server) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async generateSuggestions(
    text: string, 
    position: number, 
    context: SuggestionContext,
    userId: string
  ): Promise<Suggestion[]> {
    try {
      logger.info(`Generating suggestions for user ${userId}`);

      const [
        grammarSuggestions,
        styleSuggestions,
        vocabularySuggestions,
        structureSuggestions,
        contentSuggestions
      ] = await Promise.all([
        this.generateGrammarSuggestions(text, position, context),
        this.generateStyleSuggestions(text, position, context),
        this.generateVocabularySuggestions(text, position, context),
        this.generateStructureSuggestions(text, position, context),
        this.generateContentSuggestions(text, position, context)
      ]);

      const allSuggestions = [
        ...grammarSuggestions,
        ...styleSuggestions,
        ...vocabularySuggestions,
        ...structureSuggestions,
        ...contentSuggestions
      ];

      // Sort by confidence and relevance
      const sortedSuggestions = allSuggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10); // Limit to top 10 suggestions

      // Save suggestions to database
      await this.saveSuggestions(sortedSuggestions, userId, text);

      return sortedSuggestions;
    } catch (error) {
      logger.error('Error generating suggestions:', error);
      throw error;
    }
  }

  private async generateGrammarSuggestions(
    text: string, 
    position: number, 
    context: SuggestionContext
  ): Promise<Suggestion[]> {
    try {
      const prompt = `Analyze the following text for grammar errors and provide specific corrections. Focus on the area around position ${position}:

Text: "${text}"

Provide up to 3 grammar corrections in JSON format:
[
  {
    "original_text": "text with error",
    "suggested_text": "corrected text",
    "message": "Brief explanation of the error",
    "reasoning": "Why this correction improves the text",
    "position_start": 10,
    "position_end": 25,
    "confidence": 0.9
  }
]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 500
      });

      const suggestions = JSON.parse(response.choices[0].message.content || '[]');
      
      return suggestions.map((s: any) => ({
        id: this.generateId(),
        type: 'grammar',
        category: 'correction',
        message: s.message,
        original_text: s.original_text,
        suggested_text: s.suggested_text,
        position: { start: s.position_start, end: s.position_end },
        confidence: s.confidence,
        reasoning: s.reasoning,
        applied: false
      }));
    } catch (error) {
      logger.error('Error generating grammar suggestions:', error);
      return [];
    }
  }

  private async generateStyleSuggestions(
    text: string, 
    position: number, 
    context: SuggestionContext
  ): Promise<Suggestion[]> {
    try {
      const stylePrompt = this.buildStylePrompt(text, context);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: stylePrompt }],
        temperature: 0.4,
        max_tokens: 600
      });

      const suggestions = JSON.parse(response.choices[0].message.content || '[]');
      
      return suggestions.map((s: any) => ({
        id: this.generateId(),
        type: 'style',
        category: 'improvement',
        message: s.message,
        original_text: s.original_text,
        suggested_text: s.suggested_text,
        position: { start: s.position_start, end: s.position_end },
        confidence: s.confidence,
        reasoning: s.reasoning,
        applied: false
      }));
    } catch (error) {
      logger.error('Error generating style suggestions:', error);
      return [];
    }
  }

  private async generateVocabularySuggestions(
    text: string, 
    position: number, 
    context: SuggestionContext
  ): Promise<Suggestion[]> {
    try {
      const prompt = `Suggest vocabulary improvements for this ${context.document_type} targeting ${context.target_audience} audience:

Text: "${text}"

Provide up to 3 vocabulary enhancements in JSON format:
[
  {
    "original_text": "basic word or phrase",
    "suggested_text": "enhanced alternative",
    "message": "Why this word choice is better",
    "reasoning": "How it improves the writing",
    "position_start": 15,
    "position_end": 30,
    "confidence": 0.8
  }
]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        max_tokens: 500
      });

      const suggestions = JSON.parse(response.choices[0].message.content || '[]');
      
      return suggestions.map((s: any) => ({
        id: this.generateId(),
        type: 'vocabulary',
        category: 'enhancement',
        message: s.message,
        original_text: s.original_text,
        suggested_text: s.suggested_text,
        position: { start: s.position_start, end: s.position_end },
        confidence: s.confidence,
        reasoning: s.reasoning,
        applied: false
      }));
    } catch (error) {
      logger.error('Error generating vocabulary suggestions:', error);
      return [];
    }
  }

  private async generateStructureSuggestions(
    text: string, 
    position: number, 
    context: SuggestionContext
  ): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];

    // Analyze paragraph structure
    const paragraphs = text.split(/\n\s*\n/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Check for paragraph length
    paragraphs.forEach((paragraph, index) => {
      const words = paragraph.split(/\s+/).length;
      if (words > 150) {
        suggestions.push({
          id: this.generateId(),
          type: 'structure',
          category: 'improvement',
          message: 'This paragraph might be too long',
          original_text: paragraph.substring(0, 50) + '...',
          suggested_text: 'Consider breaking into 2-3 shorter paragraphs',
          position: { start: 0, end: paragraph.length },
          confidence: 0.7,
          reasoning: 'Shorter paragraphs improve readability and flow',
          applied: false
        });
      }
    });

    // Check sentence variety
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    if (avgSentenceLength > 25) {
      suggestions.push({
        id: this.generateId(),
        type: 'structure',
        category: 'improvement',
        message: 'Consider varying sentence lengths',
        original_text: 'Long sentences throughout',
        suggested_text: 'Mix short and long sentences for better rhythm',
        position: { start: 0, end: text.length },
        confidence: 0.6,
        reasoning: 'Sentence variety improves readability and engagement',
        applied: false
      });
    }

    return suggestions.slice(0, 2); // Limit structure suggestions
  }

  private async generateContentSuggestions(
    text: string, 
    position: number, 
    context: SuggestionContext
  ): Promise<Suggestion[]> {
    try {
      const contentPrompt = `Analyze this ${context.document_type} for content improvements. The goal is ${context.writing_goal} writing for ${context.target_audience} audience:

Text: "${text}"

Suggest content enhancements in JSON format:
[
  {
    "message": "Content improvement suggestion",
    "original_text": "section that could be improved",
    "suggested_text": "enhanced version or addition",
    "reasoning": "Why this improves the content",
    "position_start": 0,
    "position_end": 50,
    "confidence": 0.7
  }
]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: contentPrompt }],
        temperature: 0.6,
        max_tokens: 400
      });

      const suggestions = JSON.parse(response.choices[0].message.content || '[]');
      
      return suggestions.slice(0, 2).map((s: any) => ({
        id: this.generateId(),
        type: 'content',
        category: 'enhancement',
        message: s.message,
        original_text: s.original_text,
        suggested_text: s.suggested_text,
        position: { start: s.position_start, end: s.position_end },
        confidence: s.confidence,
        reasoning: s.reasoning,
        applied: false
      }));
    } catch (error) {
      logger.error('Error generating content suggestions:', error);
      return [];
    }
  }

  private buildStylePrompt(text: string, context: SuggestionContext): string {
    const audienceGuidance = {
      academic: 'formal, scholarly tone with precise language',
      professional: 'professional, clear, and confident tone',
      general: 'clear, engaging, and accessible language'
    };

    const goalGuidance = {
      persuasive: 'compelling arguments and strong calls to action',
      informative: 'clear explanations and logical organization',
      narrative: 'engaging storytelling and vivid descriptions',
      descriptive: 'rich details and sensory language'
    };

    return `Improve the writing style of this ${context.document_type} for ${audienceGuidance[context.target_audience]} with ${goalGuidance[context.writing_goal]}:

Text: "${text}"

Provide up to 3 style improvements in JSON format:
[
  {
    "original_text": "text to improve",
    "suggested_text": "improved version",
    "message": "Style improvement explanation",
    "reasoning": "How this enhances the writing",
    "position_start": 10,
    "position_end": 25,
    "confidence": 0.8
  }
]`;
  }

  async applySuggestion(suggestionId: string, userId: string): Promise<boolean> {
    try {
      await this.prisma.applied_suggestions.create({
        data: {
          suggestion_id: suggestionId,
          user_id: userId,
          applied_at: new Date()
        }
      });

      // Emit real-time update
      this.io.to(`user-${userId}`).emit('suggestion-applied', { suggestionId });

      return true;
    } catch (error) {
      logger.error('Error applying suggestion:', error);
      return false;
    }
  }

  async getSuggestionHistory(userId: string, limit: number = 50) {
    try {
      return await this.prisma.writing_suggestions.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: limit,
        include: {
          applied_suggestions: true
        }
      });
    } catch (error) {
      logger.error('Error fetching suggestion history:', error);
      throw error;
    }
  }

  private async saveSuggestions(suggestions: Suggestion[], userId: string, originalText: string) {
    try {
      for (const suggestion of suggestions) {
        await this.prisma.writing_suggestions.create({
          data: {
            id: suggestion.id,
            user_id: userId,
            type: suggestion.type,
            category: suggestion.category,
            message: suggestion.message,
            original_text: suggestion.original_text,
            suggested_text: suggestion.suggested_text,
            position_start: suggestion.position.start,
            position_end: suggestion.position.end,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning,
            source_text: originalText,
            created_at: new Date()
          }
        });
      }
    } catch (error) {
      logger.error('Error saving suggestions:', error);
      // Don't throw - suggestions should still work even if saving fails
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}