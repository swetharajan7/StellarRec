import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import natural from 'natural';
import compromise from 'compromise';
import sentiment from 'sentiment';
import { logger } from '../utils/logger';

export interface WritingAnalysis {
  readability: {
    score: number;
    level: string;
    suggestions: string[];
  };
  sentiment: {
    score: number;
    comparative: number;
    positive: string[];
    negative: string[];
  };
  structure: {
    paragraphs: number;
    sentences: number;
    words: number;
    characters: number;
    avg_sentence_length: number;
    avg_paragraph_length: number;
  };
  vocabulary: {
    unique_words: number;
    complexity_score: number;
    repeated_words: string[];
    advanced_words: string[];
  };
  grammar: {
    issues: GrammarIssue[];
    score: number;
  };
  style: {
    tone: string;
    formality: number;
    clarity_score: number;
    engagement_score: number;
  };
  suggestions: WritingSuggestion[];
}

export interface GrammarIssue {
  type: 'spelling' | 'grammar' | 'punctuation' | 'style';
  message: string;
  position: { start: number; end: number };
  suggestions: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface WritingSuggestion {
  type: 'improvement' | 'enhancement' | 'correction';
  category: 'clarity' | 'conciseness' | 'engagement' | 'structure' | 'vocabulary';
  message: string;
  original_text?: string;
  suggested_text?: string;
  position?: { start: number; end: number };
  confidence: number;
}

export class WritingAnalysisService {
  private openai: OpenAI;
  private sentimentAnalyzer: any;

  constructor(private prisma: PrismaClient) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.sentimentAnalyzer = new sentiment();
  }

  async analyzeText(text: string, context?: any): Promise<WritingAnalysis> {
    try {
      logger.info('Starting comprehensive text analysis');

      const [
        readabilityAnalysis,
        sentimentAnalysis,
        structureAnalysis,
        vocabularyAnalysis,
        grammarAnalysis,
        styleAnalysis
      ] = await Promise.all([
        this.analyzeReadability(text),
        this.analyzeSentiment(text),
        this.analyzeStructure(text),
        this.analyzeVocabulary(text),
        this.analyzeGrammar(text),
        this.analyzeStyle(text, context)
      ]);

      const suggestions = await this.generateWritingSuggestions(text, {
        readability: readabilityAnalysis,
        sentiment: sentimentAnalysis,
        structure: structureAnalysis,
        vocabulary: vocabularyAnalysis,
        grammar: grammarAnalysis,
        style: styleAnalysis
      });

      const analysis: WritingAnalysis = {
        readability: readabilityAnalysis,
        sentiment: sentimentAnalysis,
        structure: structureAnalysis,
        vocabulary: vocabularyAnalysis,
        grammar: grammarAnalysis,
        style: styleAnalysis,
        suggestions
      };

      // Save analysis to database
      await this.saveAnalysis(text, analysis, context);

      return analysis;
    } catch (error) {
      logger.error('Error in text analysis:', error);
      throw error;
    }
  }

  private async analyzeReadability(text: string) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const syllables = this.countSyllables(text);

    // Flesch Reading Ease Score
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    const fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    const clampedScore = Math.max(0, Math.min(100, fleschScore));

    let level = 'Graduate';
    let suggestions = [];

    if (clampedScore >= 90) {
      level = 'Very Easy';
    } else if (clampedScore >= 80) {
      level = 'Easy';
    } else if (clampedScore >= 70) {
      level = 'Fairly Easy';
    } else if (clampedScore >= 60) {
      level = 'Standard';
    } else if (clampedScore >= 50) {
      level = 'Fairly Difficult';
    } else if (clampedScore >= 30) {
      level = 'Difficult';
    }

    if (avgSentenceLength > 20) {
      suggestions.push('Consider breaking up long sentences for better readability');
    }
    if (avgSyllablesPerWord > 1.7) {
      suggestions.push('Consider using simpler words where appropriate');
    }

    return {
      score: Math.round(clampedScore),
      level,
      suggestions
    };
  }

  private async analyzeSentiment(text: string) {
    const result = this.sentimentAnalyzer.analyze(text);
    
    return {
      score: result.score,
      comparative: result.comparative,
      positive: result.positive,
      negative: result.negative
    };
  }

  private async analyzeStructure(text: string) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const characters = text.length;

    return {
      paragraphs: paragraphs.length,
      sentences: sentences.length,
      words: words.length,
      characters,
      avg_sentence_length: Math.round(words.length / sentences.length),
      avg_paragraph_length: Math.round(sentences.length / paragraphs.length)
    };
  }

  private async analyzeVocabulary(text: string) {
    const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    const uniqueWords = new Set(words);
    const wordFreq = new Map<string, number>();

    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    const repeatedWords = Array.from(wordFreq.entries())
      .filter(([word, count]) => count > 3 && word.length > 3)
      .map(([word]) => word)
      .slice(0, 10);

    // Simple complexity score based on average word length and unique word ratio
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const uniqueRatio = uniqueWords.size / words.length;
    const complexityScore = Math.round((avgWordLength * 10) + (uniqueRatio * 50));

    const advancedWords = words.filter(word => word.length > 8).slice(0, 10);

    return {
      unique_words: uniqueWords.size,
      complexity_score: Math.min(100, complexityScore),
      repeated_words: repeatedWords,
      advanced_words: [...new Set(advancedWords)]
    };
  }

  private async analyzeGrammar(text: string): Promise<{ issues: GrammarIssue[]; score: number }> {
    const issues: GrammarIssue[] = [];
    
    // Basic grammar checks using natural language processing
    const doc = compromise(text);
    
    // Check for common issues
    const sentences = text.split(/[.!?]+/);
    
    sentences.forEach((sentence, index) => {
      const trimmed = sentence.trim();
      if (trimmed.length === 0) return;

      // Check for sentence fragments
      if (trimmed.length < 10 && !trimmed.match(/^(yes|no|okay|ok)$/i)) {
        issues.push({
          type: 'grammar',
          message: 'This might be a sentence fragment',
          position: { start: 0, end: trimmed.length },
          suggestions: ['Consider expanding this sentence'],
          severity: 'medium'
        });
      }

      // Check for run-on sentences
      if (trimmed.length > 150) {
        issues.push({
          type: 'style',
          message: 'This sentence might be too long',
          position: { start: 0, end: trimmed.length },
          suggestions: ['Consider breaking this into shorter sentences'],
          severity: 'low'
        });
      }
    });

    // Check for passive voice overuse
    const passiveCount = doc.match('#Passive').length;
    const totalSentences = sentences.length;
    
    if (passiveCount / totalSentences > 0.3) {
      issues.push({
        type: 'style',
        message: 'Consider reducing passive voice usage',
        position: { start: 0, end: text.length },
        suggestions: ['Use more active voice constructions'],
        severity: 'medium'
      });
    }

    const score = Math.max(0, 100 - (issues.length * 10));

    return { issues, score };
  }

  private async analyzeStyle(text: string, context?: any) {
    try {
      // Use OpenAI for advanced style analysis
      const prompt = `Analyze the writing style of the following text and provide scores (0-100) for tone, formality, clarity, and engagement. Also identify the overall tone:

Text: "${text}"

Respond in JSON format:
{
  "tone": "professional|casual|academic|persuasive|narrative",
  "formality": 85,
  "clarity_score": 78,
  "engagement_score": 82
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        tone: result.tone || 'neutral',
        formality: result.formality || 50,
        clarity_score: result.clarity_score || 50,
        engagement_score: result.engagement_score || 50
      };
    } catch (error) {
      logger.error('Error in style analysis:', error);
      // Fallback to basic analysis
      return {
        tone: 'neutral',
        formality: 50,
        clarity_score: 50,
        engagement_score: 50
      };
    }
  }

  private async generateWritingSuggestions(text: string, analysis: any): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];

    // Readability suggestions
    if (analysis.readability.score < 60) {
      suggestions.push({
        type: 'improvement',
        category: 'clarity',
        message: 'Consider simplifying complex sentences for better readability',
        confidence: 0.8
      });
    }

    // Structure suggestions
    if (analysis.structure.avg_sentence_length > 25) {
      suggestions.push({
        type: 'improvement',
        category: 'structure',
        message: 'Break up long sentences to improve flow',
        confidence: 0.9
      });
    }

    if (analysis.structure.paragraphs < 3 && analysis.structure.words > 200) {
      suggestions.push({
        type: 'improvement',
        category: 'structure',
        message: 'Consider breaking the text into more paragraphs',
        confidence: 0.7
      });
    }

    // Vocabulary suggestions
    if (analysis.vocabulary.repeated_words.length > 0) {
      suggestions.push({
        type: 'enhancement',
        category: 'vocabulary',
        message: `Consider varying these repeated words: ${analysis.vocabulary.repeated_words.slice(0, 3).join(', ')}`,
        confidence: 0.6
      });
    }

    // Style suggestions
    if (analysis.style.engagement_score < 60) {
      suggestions.push({
        type: 'enhancement',
        category: 'engagement',
        message: 'Consider adding more engaging language or examples',
        confidence: 0.7
      });
    }

    return suggestions;
  }

  private countSyllables(text: string): number {
    const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    return words.reduce((total, word) => {
      const syllableCount = word.match(/[aeiouy]+/g)?.length || 1;
      return total + Math.max(1, syllableCount);
    }, 0);
  }

  private async saveAnalysis(text: string, analysis: WritingAnalysis, context?: any) {
    try {
      await this.prisma.writing_analyses.create({
        data: {
          text_content: text,
          analysis_results: analysis,
          context: context,
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.error('Error saving analysis:', error);
      // Don't throw - analysis should still work even if saving fails
    }
  }
}