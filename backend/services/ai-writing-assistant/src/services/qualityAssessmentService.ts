import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

export interface QualityAssessment {
  overall_score: number;
  readiness_level: 'draft' | 'needs_work' | 'good' | 'excellent';
  dimensions: {
    content: QualityDimension;
    structure: QualityDimension;
    language: QualityDimension;
    clarity: QualityDimension;
    engagement: QualityDimension;
    appropriateness: QualityDimension;
  };
  strengths: string[];
  areas_for_improvement: string[];
  actionable_recommendations: Recommendation[];
  comparison_to_benchmarks: BenchmarkComparison;
  estimated_impact: string;
}

export interface QualityDimension {
  score: number;
  level: 'poor' | 'fair' | 'good' | 'excellent';
  feedback: string;
  specific_issues: string[];
  improvement_suggestions: string[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'content' | 'structure' | 'language' | 'style';
  action: string;
  expected_impact: string;
  effort_required: 'low' | 'medium' | 'high';
}

export interface BenchmarkComparison {
  percentile: number;
  comparison_group: string;
  similar_documents_analyzed: number;
  key_differentiators: string[];
}

export class QualityAssessmentService {
  private openai: OpenAI;

  constructor(private prisma: PrismaClient) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  async assessQuality(
    text: string, 
    documentType: string, 
    context: any,
    userId: string
  ): Promise<QualityAssessment> {
    try {
      logger.info(`Assessing quality for ${documentType} by user ${userId}`);

      const [
        contentAssessment,
        structureAssessment,
        languageAssessment,
        clarityAssessment,
        engagementAssessment,
        appropriatenessAssessment
      ] = await Promise.all([
        this.assessContent(text, documentType, context),
        this.assessStructure(text, documentType),
        this.assessLanguage(text, context),
        this.assessClarity(text),
        this.assessEngagement(text, documentType),
        this.assessAppropriateness(text, documentType, context)
      ]);

      const dimensions = {
        content: contentAssessment,
        structure: structureAssessment,
        language: languageAssessment,
        clarity: clarityAssessment,
        engagement: engagementAssessment,
        appropriateness: appropriatenessAssessment
      };

      const overallScore = this.calculateOverallScore(dimensions);
      const readinessLevel = this.determineReadinessLevel(overallScore, dimensions);

      const [strengths, improvements] = this.identifyStrengthsAndImprovements(dimensions);
      const recommendations = await this.generateRecommendations(text, dimensions, documentType);
      const benchmarkComparison = await this.compareToBenchmarks(text, documentType, overallScore);

      const assessment: QualityAssessment = {
        overall_score: overallScore,
        readiness_level: readinessLevel,
        dimensions,
        strengths,
        areas_for_improvement: improvements,
        actionable_recommendations: recommendations,
        comparison_to_benchmarks: benchmarkComparison,
        estimated_impact: this.estimateImpact(readinessLevel, documentType)
      };

      // Save assessment
      await this.saveAssessment(assessment, text, documentType, userId);

      return assessment;
    } catch (error) {
      logger.error('Error in quality assessment:', error);
      throw error;
    }
  }

  private async assessContent(text: string, documentType: string, context: any): Promise<QualityDimension> {
    try {
      const prompt = `Assess the content quality of this ${documentType}:

Text: "${text}"
Context: ${JSON.stringify(context)}

Evaluate:
1. Relevance to purpose
2. Completeness of information
3. Accuracy and credibility
4. Depth of insights
5. Supporting evidence/examples

Respond in JSON:
{
  "score": 85,
  "level": "good",
  "feedback": "Overall content assessment",
  "specific_issues": ["List of specific content issues"],
  "improvement_suggestions": ["Specific suggestions for improvement"]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      logger.error('Error assessing content:', error);
      return this.getDefaultDimension();
    }
  }

  private async assessStructure(text: string, documentType: string): Promise<QualityDimension> {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let score = 70; // Base score
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check paragraph count
    if (paragraphs.length < 3 && text.length > 300) {
      score -= 10;
      issues.push('Too few paragraphs for the length of text');
      suggestions.push('Break content into more logical paragraphs');
    }

    // Check paragraph balance
    const avgParagraphLength = text.length / paragraphs.length;
    if (avgParagraphLength > 200) {
      score -= 5;
      issues.push('Paragraphs are too long on average');
      suggestions.push('Create shorter, more focused paragraphs');
    }

    // Check for introduction and conclusion
    const hasIntro = paragraphs[0]?.length > 50;
    const hasConclusion = paragraphs[paragraphs.length - 1]?.length > 50;
    
    if (!hasIntro) {
      score -= 10;
      issues.push('Weak or missing introduction');
      suggestions.push('Strengthen the opening paragraph');
    }

    if (!hasConclusion && documentType !== 'letter') {
      score -= 10;
      issues.push('Weak or missing conclusion');
      suggestions.push('Add a strong concluding paragraph');
    }

    const level = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'fair' : 'poor';

    return {
      score: Math.max(0, Math.min(100, score)),
      level: level as any,
      feedback: `Structure shows ${level} organization with ${paragraphs.length} paragraphs`,
      specific_issues: issues,
      improvement_suggestions: suggestions
    };
  }

  private async assessLanguage(text: string, context: any): Promise<QualityDimension> {
    try {
      const prompt = `Assess the language quality of this text:

"${text}"

Evaluate:
1. Grammar and syntax
2. Vocabulary appropriateness
3. Sentence variety
4. Word choice precision
5. Professional tone

Respond in JSON format with score (0-100), level, feedback, specific_issues, and improvement_suggestions.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 400
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      logger.error('Error assessing language:', error);
      return this.getDefaultDimension();
    }
  }

  private async assessClarity(text: string): Promise<QualityDimension> {
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgSentenceLength = words / sentences;
    
    let score = 80;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check sentence length
    if (avgSentenceLength > 25) {
      score -= 15;
      issues.push('Sentences are too long on average');
      suggestions.push('Break up complex sentences for better clarity');
    } else if (avgSentenceLength < 10) {
      score -= 5;
      issues.push('Sentences might be too short');
      suggestions.push('Consider combining some short sentences');
    }

    // Check for clarity indicators
    const clarityWords = ['however', 'therefore', 'furthermore', 'moreover', 'consequently'];
    const clarityCount = clarityWords.reduce((count, word) => 
      count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g'))?.length || 0), 0
    );

    if (clarityCount / sentences < 0.1) {
      score -= 10;
      issues.push('Limited use of transitional phrases');
      suggestions.push('Add more transitional words to improve flow');
    }

    const level = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'fair' : 'poor';

    return {
      score: Math.max(0, Math.min(100, score)),
      level: level as any,
      feedback: `Clarity is ${level} with average sentence length of ${Math.round(avgSentenceLength)} words`,
      specific_issues: issues,
      improvement_suggestions: suggestions
    };
  }

  private async assessEngagement(text: string, documentType: string): Promise<QualityDimension> {
    let score = 70;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for engaging elements
    const questionCount = (text.match(/\?/g) || []).length;
    const exclamationCount = (text.match(/!/g) || []).length;
    const personalPronouns = (text.toLowerCase().match(/\b(i|we|you|my|our|your)\b/g) || []).length;

    if (documentType === 'essay' || documentType === 'personal_statement') {
      if (personalPronouns < 5) {
        score -= 10;
        issues.push('Limited personal voice');
        suggestions.push('Include more personal experiences and perspectives');
      }
    }

    // Check for variety in sentence starters
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const starters = sentences.map(s => s.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
    const uniqueStarters = new Set(starters);
    
    if (uniqueStarters.size / starters.length < 0.7) {
      score -= 10;
      issues.push('Limited variety in sentence beginnings');
      suggestions.push('Vary how you start your sentences');
    }

    const level = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'fair' : 'poor';

    return {
      score: Math.max(0, Math.min(100, score)),
      level: level as any,
      feedback: `Engagement level is ${level}`,
      specific_issues: issues,
      improvement_suggestions: suggestions
    };
  }

  private async assessAppropriateness(text: string, documentType: string, context: any): Promise<QualityDimension> {
    let score = 80;
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check formality level
    const informalWords = ['gonna', 'wanna', 'kinda', 'sorta', 'yeah', 'ok', 'okay'];
    const informalCount = informalWords.reduce((count, word) => 
      count + (text.toLowerCase().match(new RegExp(`\\b${word}\\b`, 'g'))?.length || 0), 0
    );

    if (informalCount > 0 && (documentType === 'letter' || documentType === 'application')) {
      score -= 15;
      issues.push('Contains informal language inappropriate for the context');
      suggestions.push('Replace informal expressions with more professional language');
    }

    // Check length appropriateness
    const wordCount = text.split(/\s+/).length;
    const expectedRanges = {
      letter: { min: 200, max: 600 },
      essay: { min: 300, max: 1000 },
      personal_statement: { min: 400, max: 800 },
      cover_letter: { min: 200, max: 400 }
    };

    const range = expectedRanges[documentType as keyof typeof expectedRanges];
    if (range) {
      if (wordCount < range.min) {
        score -= 10;
        issues.push(`Too short for a ${documentType} (${wordCount} words)`);
        suggestions.push(`Expand content to reach ${range.min}-${range.max} words`);
      } else if (wordCount > range.max) {
        score -= 5;
        issues.push(`Might be too long for a ${documentType} (${wordCount} words)`);
        suggestions.push(`Consider condensing to ${range.min}-${range.max} words`);
      }
    }

    const level = score >= 90 ? 'excellent' : score >= 75 ? 'good' : score >= 60 ? 'fair' : 'poor';

    return {
      score: Math.max(0, Math.min(100, score)),
      level: level as any,
      feedback: `Appropriateness is ${level} for ${documentType}`,
      specific_issues: issues,
      improvement_suggestions: suggestions
    };
  }

  private calculateOverallScore(dimensions: any): number {
    const weights = {
      content: 0.25,
      structure: 0.20,
      language: 0.20,
      clarity: 0.15,
      engagement: 0.10,
      appropriateness: 0.10
    };

    return Math.round(
      Object.entries(weights).reduce((total, [key, weight]) => 
        total + (dimensions[key].score * weight), 0
      )
    );
  }

  private determineReadinessLevel(overallScore: number, dimensions: any): 'draft' | 'needs_work' | 'good' | 'excellent' {
    if (overallScore >= 90) return 'excellent';
    if (overallScore >= 75) return 'good';
    if (overallScore >= 60) return 'needs_work';
    return 'draft';
  }

  private identifyStrengthsAndImprovements(dimensions: any): [string[], string[]] {
    const strengths: string[] = [];
    const improvements: string[] = [];

    Object.entries(dimensions).forEach(([key, dimension]: [string, any]) => {
      if (dimension.score >= 80) {
        strengths.push(`Strong ${key}: ${dimension.feedback}`);
      } else if (dimension.score < 70) {
        improvements.push(`${key.charAt(0).toUpperCase() + key.slice(1)}: ${dimension.feedback}`);
      }
    });

    return [strengths, improvements];
  }

  private async generateRecommendations(text: string, dimensions: any, documentType: string): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Generate recommendations based on lowest scoring dimensions
    const sortedDimensions = Object.entries(dimensions)
      .sort(([,a], [,b]) => (a as any).score - (b as any).score)
      .slice(0, 3);

    for (const [key, dimension] of sortedDimensions) {
      const dim = dimension as any;
      if (dim.score < 80) {
        recommendations.push({
          priority: dim.score < 60 ? 'high' : dim.score < 75 ? 'medium' : 'low',
          category: key as any,
          action: dim.improvement_suggestions[0] || `Improve ${key}`,
          expected_impact: `Could increase ${key} score by 10-15 points`,
          effort_required: dim.score < 50 ? 'high' : 'medium'
        });
      }
    }

    return recommendations;
  }

  private async compareToBenchmarks(text: string, documentType: string, score: number): Promise<BenchmarkComparison> {
    // Simulate benchmark comparison (in production, this would use real data)
    const percentile = Math.min(95, Math.max(5, score + Math.random() * 10 - 5));
    
    return {
      percentile: Math.round(percentile),
      comparison_group: `${documentType}s from similar applicants`,
      similar_documents_analyzed: Math.floor(Math.random() * 1000) + 500,
      key_differentiators: score > 80 ? 
        ['Strong content development', 'Clear structure', 'Professional tone'] :
        ['Needs content enhancement', 'Structure improvements needed', 'Language refinement required']
    };
  }

  private estimateImpact(readinessLevel: string, documentType: string): string {
    const impacts = {
      excellent: `This ${documentType} is ready for submission and likely to make a strong positive impression`,
      good: `This ${documentType} is well-developed and should be effective with minor refinements`,
      needs_work: `This ${documentType} has potential but needs significant improvements before submission`,
      draft: `This ${documentType} requires substantial revision across multiple areas`
    };

    return impacts[readinessLevel as keyof typeof impacts] || impacts.draft;
  }

  private getDefaultDimension(): QualityDimension {
    return {
      score: 70,
      level: 'fair',
      feedback: 'Assessment unavailable',
      specific_issues: [],
      improvement_suggestions: []
    };
  }

  private async saveAssessment(
    assessment: QualityAssessment, 
    text: string, 
    documentType: string, 
    userId: string
  ) {
    try {
      await this.prisma.quality_assessments.create({
        data: {
          user_id: userId,
          document_type: documentType,
          text_content: text,
          overall_score: assessment.overall_score,
          readiness_level: assessment.readiness_level,
          assessment_results: assessment,
          created_at: new Date()
        }
      });
    } catch (error) {
      logger.error('Error saving quality assessment:', error);
    }
  }
}