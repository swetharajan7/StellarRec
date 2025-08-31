import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export interface AnalysisRequest {
  content: string;
  type: 'personal_statement' | 'supplemental_essay' | 'scholarship_essay' | 'cover_letter';
  requirements?: {
    wordLimit?: number;
    tone?: string;
    audience?: string;
    prompts?: string[];
  };
  userId: string;
}

export interface AnalysisResult {
  id: string;
  scores: {
    grammar: number;
    style: number;
    clarity: number;
    impact: number;
    originality: number;
    overall: number;
  };
  suggestions: {
    type: 'grammar' | 'style' | 'structure' | 'vocabulary' | 'tone';
    severity: 'low' | 'medium' | 'high';
    message: string;
    suggestion: string;
    position?: {
      start: number;
      end: number;
    };
  }[];
  metrics: {
    wordCount: number;
    sentenceCount: number;
    paragraphCount: number;
    readabilityScore: number;
    averageSentenceLength: number;
    vocabularyComplexity: number;
  };
  readinessLevel: 'draft' | 'needs_work' | 'good' | 'excellent';
}

export interface GrammarCheck {
  errors: {
    type: 'grammar' | 'spelling' | 'punctuation' | 'style';
    message: string;
    suggestion: string;
    position: {
      start: number;
      end: number;
    };
    severity: 'low' | 'medium' | 'high';
  }[];
  score: number;
}

export interface StyleAnalysis {
  tone: {
    detected: string;
    confidence: number;
    suggestions: string[];
  };
  formality: {
    level: 'very_informal' | 'informal' | 'neutral' | 'formal' | 'very_formal';
    score: number;
    appropriate: boolean;
  };
  voice: {
    active: number;
    passive: number;
    recommendation: string;
  };
  sentenceVariety: {
    score: number;
    suggestions: string[];
  };
}

export interface ReadabilityAssessment {
  fleschKincaid: {
    gradeLevel: number;
    readingEase: number;
  };
  gunningFog: number;
  smog: number;
  automatedReadability: number;
  colemanLiau: number;
  recommendation: string;
  targetAudience: string;
}

export class WritingAnalysisService {
  async analyzeContent(request: AnalysisRequest): Promise<AnalysisResult> {
    try {
      const analysisId = this.generateId();
      
      // Perform parallel analysis
      const [
        grammarCheck,
        styleAnalysis,
        readabilityAssessment,
        structureAnalysis,
        originalityCheck
      ] = await Promise.all([
        this.checkGrammar(request.content),
        this.analyzeStyle(request.content, request.type),
        this.assessReadability(request.content),
        this.analyzeStructure(request.content, request.type),
        this.checkOriginality(request.content)
      ]);

      // Calculate metrics
      const metrics = this.calculateMetrics(request.content);
      
      // Generate suggestions
      const suggestions = this.generateSuggestions(
        grammarCheck,
        styleAnalysis,
        structureAnalysis,
        request.requirements
      );

      // Calculate scores
      const scores = this.calculateScores(
        grammarCheck,
        styleAnalysis,
        readabilityAssessment,
        structureAnalysis,
        originalityCheck
      );

      // Determine readiness level
      const readinessLevel = this.determineReadinessLevel(scores);

      const result: AnalysisResult = {
        id: analysisId,
        scores,
        suggestions,
        metrics,
        readinessLevel
      };

      // Store analysis result
      await this.storeAnalysisResult(request.userId, result);

      return result;

    } catch (error) {
      console.error('Error analyzing content:', error);
      throw new Error(`Failed to analyze content: ${error.message}`);
    }
  }

  async checkGrammar(content: string): Promise<GrammarCheck> {
    try {
      // Use multiple grammar checking services
      const [grammarlyResult, languageToolResult] = await Promise.allSettled([
        this.checkWithGrammarly(content),
        this.checkWithLanguageTool(content)
      ]);

      const errors: GrammarCheck['errors'] = [];
      let totalScore = 100;

      // Process Grammarly results
      if (grammarlyResult.status === 'fulfilled') {
        errors.push(...grammarlyResult.value.errors);
        totalScore = Math.min(totalScore, grammarlyResult.value.score);
      }

      // Process LanguageTool results
      if (languageToolResult.status === 'fulfilled') {
        errors.push(...languageToolResult.value.errors);
        totalScore = Math.min(totalScore, languageToolResult.value.score);
      }

      // Remove duplicates and sort by severity
      const uniqueErrors = this.deduplicateErrors(errors);
      const sortedErrors = uniqueErrors.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

      return {
        errors: sortedErrors,
        score: Math.max(0, totalScore - (sortedErrors.length * 2))
      };

    } catch (error) {
      console.error('Error checking grammar:', error);
      return {
        errors: [],
        score: 85 // Default score if grammar check fails
      };
    }
  }

  async analyzeStyle(content: string, essayType: string): Promise<StyleAnalysis> {
    try {
      // Analyze tone using sentiment analysis
      const toneAnalysis = await this.analyzeTone(content);
      
      // Assess formality level
      const formalityAnalysis = await this.assessFormality(content, essayType);
      
      // Analyze voice (active vs passive)
      const voiceAnalysis = this.analyzeVoice(content);
      
      // Assess sentence variety
      const sentenceVariety = this.assessSentenceVariety(content);

      return {
        tone: toneAnalysis,
        formality: formalityAnalysis,
        voice: voiceAnalysis,
        sentenceVariety
      };

    } catch (error) {
      console.error('Error analyzing style:', error);
      throw new Error(`Failed to analyze style: ${error.message}`);
    }
  }

  async assessReadability(content: string): Promise<ReadabilityAssessment> {
    try {
      const sentences = this.splitIntoSentences(content);
      const words = this.splitIntoWords(content);
      const syllables = this.countSyllables(content);

      // Calculate Flesch-Kincaid metrics
      const avgSentenceLength = words.length / sentences.length;
      const avgSyllablesPerWord = syllables / words.length;
      
      const fleschReadingEase = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
      const fleschKincaidGrade = (0.39 * avgSentenceLength) + (11.8 * avgSyllablesPerWord) - 15.59;

      // Calculate other readability metrics
      const gunningFog = this.calculateGunningFog(content);
      const smog = this.calculateSMOG(content);
      const automatedReadability = this.calculateARI(content);
      const colemanLiau = this.calculateColemanLiau(content);

      // Generate recommendation
      const recommendation = this.generateReadabilityRecommendation(fleschKincaidGrade);
      const targetAudience = this.determineTargetAudience(fleschKincaidGrade);

      return {
        fleschKincaid: {
          gradeLevel: Math.round(fleschKincaidGrade * 10) / 10,
          readingEase: Math.round(fleschReadingEase * 10) / 10
        },
        gunningFog: Math.round(gunningFog * 10) / 10,
        smog: Math.round(smog * 10) / 10,
        automatedReadability: Math.round(automatedReadability * 10) / 10,
        colemanLiau: Math.round(colemanLiau * 10) / 10,
        recommendation,
        targetAudience
      };

    } catch (error) {
      console.error('Error assessing readability:', error);
      throw new Error(`Failed to assess readability: ${error.message}`);
    }
  }

  private async checkWithGrammarly(content: string): Promise<GrammarCheck> {
    // Placeholder for Grammarly API integration
    // In a real implementation, you would integrate with Grammarly's API
    return {
      errors: [],
      score: 95
    };
  }

  private async checkWithLanguageTool(content: string): Promise<GrammarCheck> {
    try {
      // Use LanguageTool API for grammar checking
      const response = await axios.post('https://api.languagetool.org/v2/check', {
        text: content,
        language: 'en-US'
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const errors = response.data.matches.map((match: any) => ({
        type: this.mapLanguageToolCategory(match.rule.category.id),
        message: match.message,
        suggestion: match.replacements[0]?.value || '',
        position: {
          start: match.offset,
          end: match.offset + match.length
        },
        severity: this.mapLanguageToolSeverity(match.rule.category.id)
      }));

      const score = Math.max(0, 100 - (errors.length * 3));

      return { errors, score };

    } catch (error) {
      console.error('LanguageTool API error:', error);
      return { errors: [], score: 90 };
    }
  }

  private async analyzeTone(content: string): Promise<StyleAnalysis['tone']> {
    try {
      // Use sentiment analysis to detect tone
      // This is a simplified implementation
      const words = content.toLowerCase().split(/\s+/);
      
      const positiveWords = ['excellent', 'outstanding', 'passionate', 'dedicated', 'innovative'];
      const negativeWords = ['difficult', 'challenging', 'struggle', 'problem', 'issue'];
      const formalWords = ['furthermore', 'consequently', 'therefore', 'moreover', 'nevertheless'];
      
      const positiveCount = words.filter(word => positiveWords.includes(word)).length;
      const negativeCount = words.filter(word => negativeWords.includes(word)).length;
      const formalCount = words.filter(word => formalWords.includes(word)).length;
      
      let detectedTone = 'neutral';
      let confidence = 0.5;
      
      if (positiveCount > negativeCount && positiveCount > 2) {
        detectedTone = 'positive';
        confidence = Math.min(0.9, 0.5 + (positiveCount * 0.1));
      } else if (negativeCount > positiveCount && negativeCount > 2) {
        detectedTone = 'negative';
        confidence = Math.min(0.9, 0.5 + (negativeCount * 0.1));
      }
      
      if (formalCount > 3) {
        detectedTone = 'formal';
        confidence = Math.min(0.9, 0.6 + (formalCount * 0.05));
      }

      const suggestions = this.generateToneSuggestions(detectedTone, confidence);

      return {
        detected: detectedTone,
        confidence,
        suggestions
      };

    } catch (error) {
      console.error('Error analyzing tone:', error);
      return {
        detected: 'neutral',
        confidence: 0.5,
        suggestions: []
      };
    }
  }

  private async assessFormality(content: string, essayType: string): Promise<StyleAnalysis['formality']> {
    const formalIndicators = [
      'furthermore', 'consequently', 'therefore', 'moreover', 'nevertheless',
      'subsequently', 'accordingly', 'thus', 'hence', 'whereas'
    ];
    
    const informalIndicators = [
      'gonna', 'wanna', 'kinda', 'sorta', 'yeah', 'ok', 'cool', 'awesome'
    ];
    
    const contractions = ["don't", "won't", "can't", "shouldn't", "wouldn't"];
    
    const words = content.toLowerCase().split(/\s+/);
    const formalCount = words.filter(word => formalIndicators.includes(word)).length;
    const informalCount = words.filter(word => informalIndicators.includes(word)).length;
    const contractionCount = words.filter(word => contractions.some(c => word.includes(c))).length;
    
    const formalityScore = Math.max(0, Math.min(100, 
      50 + (formalCount * 10) - (informalCount * 15) - (contractionCount * 5)
    ));
    
    let level: StyleAnalysis['formality']['level'];
    if (formalityScore >= 80) level = 'very_formal';
    else if (formalityScore >= 60) level = 'formal';
    else if (formalityScore >= 40) level = 'neutral';
    else if (formalityScore >= 20) level = 'informal';
    else level = 'very_informal';
    
    const appropriate = this.isFormalityAppropriate(level, essayType);
    
    return {
      level,
      score: formalityScore,
      appropriate
    };
  }

  private analyzeVoice(content: string): StyleAnalysis['voice'] {
    const sentences = this.splitIntoSentences(content);
    let activeCount = 0;
    let passiveCount = 0;
    
    sentences.forEach(sentence => {
      if (this.isPassiveVoice(sentence)) {
        passiveCount++;
      } else {
        activeCount++;
      }
    });
    
    const total = activeCount + passiveCount;
    const activePercentage = total > 0 ? (activeCount / total) * 100 : 0;
    const passivePercentage = total > 0 ? (passiveCount / total) * 100 : 0;
    
    let recommendation = '';
    if (passivePercentage > 30) {
      recommendation = 'Consider using more active voice to make your writing more engaging and direct.';
    } else if (passivePercentage < 5) {
      recommendation = 'Good use of active voice! Your writing is direct and engaging.';
    } else {
      recommendation = 'Good balance of active and passive voice.';
    }
    
    return {
      active: Math.round(activePercentage),
      passive: Math.round(passivePercentage),
      recommendation
    };
  }

  private assessSentenceVariety(content: string): StyleAnalysis['sentenceVariety'] {
    const sentences = this.splitIntoSentences(content);
    const lengths = sentences.map(s => s.split(/\s+/).length);
    
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Score based on variety (higher standard deviation = more variety)
    const varietyScore = Math.min(100, (standardDeviation / avgLength) * 100);
    
    const suggestions = [];
    if (varietyScore < 30) {
      suggestions.push('Try varying your sentence lengths for better flow and readability.');
    }
    if (avgLength > 25) {
      suggestions.push('Consider breaking up some longer sentences for clarity.');
    }
    if (avgLength < 10) {
      suggestions.push('Consider combining some shorter sentences for better flow.');
    }
    
    return {
      score: Math.round(varietyScore),
      suggestions
    };
  }

  private calculateMetrics(content: string) {
    const words = this.splitIntoWords(content);
    const sentences = this.splitIntoSentences(content);
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    const syllables = this.countSyllables(content);
    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;
    
    // Calculate vocabulary complexity (unique words / total words)
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    const vocabularyComplexity = (uniqueWords.size / words.length) * 100;
    
    // Calculate readability score (Flesch Reading Ease)
    const readabilityScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      readabilityScore: Math.round(readabilityScore * 10) / 10,
      averageSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      vocabularyComplexity: Math.round(vocabularyComplexity * 10) / 10
    };
  }

  private generateSuggestions(
    grammarCheck: GrammarCheck,
    styleAnalysis: StyleAnalysis,
    structureAnalysis: any,
    requirements?: AnalysisRequest['requirements']
  ) {
    const suggestions: AnalysisResult['suggestions'] = [];
    
    // Add grammar suggestions
    grammarCheck.errors.forEach(error => {
      suggestions.push({
        type: 'grammar',
        severity: error.severity,
        message: error.message,
        suggestion: error.suggestion,
        position: error.position
      });
    });
    
    // Add style suggestions
    if (!styleAnalysis.formality.appropriate) {
      suggestions.push({
        type: 'style',
        severity: 'medium',
        message: `The formality level (${styleAnalysis.formality.level}) may not be appropriate for this type of essay.`,
        suggestion: 'Consider adjusting the formality to match your audience and purpose.'
      });
    }
    
    if (styleAnalysis.voice.passive > 30) {
      suggestions.push({
        type: 'style',
        severity: 'low',
        message: 'High use of passive voice detected.',
        suggestion: 'Consider using more active voice to make your writing more engaging.'
      });
    }
    
    // Add word limit suggestions
    if (requirements?.wordLimit) {
      const wordCount = this.splitIntoWords('').length; // This would be calculated from content
      if (wordCount > requirements.wordLimit * 1.1) {
        suggestions.push({
          type: 'structure',
          severity: 'high',
          message: `Essay exceeds word limit by ${wordCount - requirements.wordLimit} words.`,
          suggestion: 'Consider condensing your content to meet the word limit requirement.'
        });
      }
    }
    
    return suggestions;
  }

  private calculateScores(
    grammarCheck: GrammarCheck,
    styleAnalysis: StyleAnalysis,
    readabilityAssessment: ReadabilityAssessment,
    structureAnalysis: any,
    originalityCheck: any
  ) {
    const grammar = grammarCheck.score;
    const style = this.calculateStyleScore(styleAnalysis);
    const clarity = this.calculateClarityScore(readabilityAssessment);
    const impact = this.calculateImpactScore(styleAnalysis, structureAnalysis);
    const originality = originalityCheck.score || 85;
    
    // Weighted overall score
    const overall = Math.round(
      (grammar * 0.25) + 
      (style * 0.20) + 
      (clarity * 0.20) + 
      (impact * 0.20) + 
      (originality * 0.15)
    );
    
    return {
      grammar: Math.round(grammar),
      style: Math.round(style),
      clarity: Math.round(clarity),
      impact: Math.round(impact),
      originality: Math.round(originality),
      overall
    };
  }

  private determineReadinessLevel(scores: AnalysisResult['scores']): AnalysisResult['readinessLevel'] {
    const { overall } = scores;
    
    if (overall >= 90) return 'excellent';
    if (overall >= 75) return 'good';
    if (overall >= 60) return 'needs_work';
    return 'draft';
  }

  // Helper methods
  private splitIntoWords(content: string): string[] {
    return content.toLowerCase().match(/\b\w+\b/g) || [];
  }

  private splitIntoSentences(content: string): string[] {
    return content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private countSyllables(content: string): number {
    const words = this.splitIntoWords(content);
    return words.reduce((total, word) => total + this.countWordSyllables(word), 0);
  }

  private countWordSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    
    const vowels = 'aeiouy';
    let syllableCount = 0;
    let previousWasVowel = false;
    
    for (let i = 0; i < word.length; i++) {
      const isVowel = vowels.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        syllableCount++;
      }
      previousWasVowel = isVowel;
    }
    
    // Handle silent 'e'
    if (word.endsWith('e')) {
      syllableCount--;
    }
    
    return Math.max(1, syllableCount);
  }

  private isPassiveVoice(sentence: string): boolean {
    const passiveIndicators = [
      /\b(am|is|are|was|were|being|been)\s+\w+ed\b/,
      /\b(am|is|are|was|were|being|been)\s+\w+en\b/,
      /\bby\s+\w+/
    ];
    
    return passiveIndicators.some(pattern => pattern.test(sentence.toLowerCase()));
  }

  private async analyzeStructure(content: string, essayType: string): Promise<any> {
    // Placeholder for structure analysis
    return {
      hasIntroduction: true,
      hasConclusion: true,
      paragraphCount: content.split(/\n\s*\n/).length,
      score: 85
    };
  }

  private async checkOriginality(content: string): Promise<any> {
    // Placeholder for originality checking
    return {
      score: 90,
      similarityPercentage: 5,
      sources: []
    };
  }

  private calculateStyleScore(styleAnalysis: StyleAnalysis): number {
    let score = 100;
    
    if (!styleAnalysis.formality.appropriate) score -= 15;
    if (styleAnalysis.voice.passive > 40) score -= 10;
    if (styleAnalysis.sentenceVariety.score < 30) score -= 10;
    
    return Math.max(0, score);
  }

  private calculateClarityScore(readabilityAssessment: ReadabilityAssessment): number {
    const gradeLevel = readabilityAssessment.fleschKincaid.gradeLevel;
    
    // Optimal grade level for college essays is 11-14
    if (gradeLevel >= 11 && gradeLevel <= 14) return 95;
    if (gradeLevel >= 9 && gradeLevel <= 16) return 85;
    if (gradeLevel >= 7 && gradeLevel <= 18) return 75;
    return 65;
  }

  private calculateImpactScore(styleAnalysis: StyleAnalysis, structureAnalysis: any): number {
    let score = 80;
    
    if (styleAnalysis.tone.detected === 'positive') score += 10;
    if (styleAnalysis.voice.active > 70) score += 10;
    if (structureAnalysis.hasIntroduction && structureAnalysis.hasConclusion) score += 10;
    
    return Math.min(100, score);
  }

  private generateToneSuggestions(tone: string, confidence: number): string[] {
    const suggestions = [];
    
    if (confidence < 0.7) {
      suggestions.push('Consider making your tone more consistent throughout the essay.');
    }
    
    if (tone === 'negative') {
      suggestions.push('Try to frame challenges as learning opportunities or growth experiences.');
    }
    
    return suggestions;
  }

  private isFormalityAppropriate(level: StyleAnalysis['formality']['level'], essayType: string): boolean {
    const appropriateLevels = {
      'personal_statement': ['formal', 'very_formal'],
      'supplemental_essay': ['neutral', 'formal'],
      'scholarship_essay': ['formal', 'very_formal'],
      'cover_letter': ['formal', 'very_formal']
    };
    
    return appropriateLevels[essayType]?.includes(level) || false;
  }

  private mapLanguageToolCategory(categoryId: string): 'grammar' | 'spelling' | 'punctuation' | 'style' {
    if (categoryId.includes('GRAMMAR')) return 'grammar';
    if (categoryId.includes('TYPOS')) return 'spelling';
    if (categoryId.includes('PUNCTUATION')) return 'punctuation';
    return 'style';
  }

  private mapLanguageToolSeverity(categoryId: string): 'low' | 'medium' | 'high' {
    if (categoryId.includes('ERROR')) return 'high';
    if (categoryId.includes('WARNING')) return 'medium';
    return 'low';
  }

  private deduplicateErrors(errors: GrammarCheck['errors']): GrammarCheck['errors'] {
    const seen = new Set();
    return errors.filter(error => {
      const key = `${error.position.start}-${error.position.end}-${error.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateGunningFog(content: string): number {
    const sentences = this.splitIntoSentences(content);
    const words = this.splitIntoWords(content);
    const complexWords = words.filter(word => this.countWordSyllables(word) >= 3);
    
    const avgSentenceLength = words.length / sentences.length;
    const complexWordPercentage = (complexWords.length / words.length) * 100;
    
    return 0.4 * (avgSentenceLength + complexWordPercentage);
  }

  private calculateSMOG(content: string): number {
    const sentences = this.splitIntoSentences(content);
    const words = this.splitIntoWords(content);
    const complexWords = words.filter(word => this.countWordSyllables(word) >= 3);
    
    return 1.0430 * Math.sqrt(complexWords.length * (30 / sentences.length)) + 3.1291;
  }

  private calculateARI(content: string): number {
    const sentences = this.splitIntoSentences(content);
    const words = this.splitIntoWords(content);
    const characters = content.replace(/\s/g, '').length;
    
    return 4.71 * (characters / words.length) + 0.5 * (words.length / sentences.length) - 21.43;
  }

  private calculateColemanLiau(content: string): number {
    const sentences = this.splitIntoSentences(content);
    const words = this.splitIntoWords(content);
    const characters = content.replace(/\s/g, '').length;
    
    const L = (characters / words.length) * 100;
    const S = (sentences.length / words.length) * 100;
    
    return 0.0588 * L - 0.296 * S - 15.8;
  }

  private generateReadabilityRecommendation(gradeLevel: number): string {
    if (gradeLevel < 9) return 'Your writing may be too simple for a college-level audience.';
    if (gradeLevel > 16) return 'Your writing may be too complex. Consider simplifying some sentences.';
    return 'Your writing complexity is appropriate for your audience.';
  }

  private determineTargetAudience(gradeLevel: number): string {
    if (gradeLevel < 6) return 'Elementary school';
    if (gradeLevel < 9) return 'Middle school';
    if (gradeLevel < 13) return 'High school';
    if (gradeLevel < 16) return 'College';
    return 'Graduate level';
  }

  private async storeAnalysisResult(userId: string, result: AnalysisResult): Promise<void> {
    try {
      await prisma.writingAnalysis.create({
        data: {
          id: result.id,
          userId,
          scores: result.scores,
          suggestions: result.suggestions,
          metrics: result.metrics,
          readinessLevel: result.readinessLevel,
          createdAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error storing analysis result:', error);
    }
  }

  private generateId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}