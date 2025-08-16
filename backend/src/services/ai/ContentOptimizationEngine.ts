import { Logger } from '../logger';
import { StudentProfile, University, ContentOptimization, OptimizedContent, ContentImprovement, CulturalAdaptation } from './AIIntelligenceService';

export interface ContentAnalysis {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  readabilityScore: number;
  keywordDensity: Record<string, number>;
  tone: 'formal' | 'informal' | 'academic' | 'personal';
  sentiment: 'positive' | 'neutral' | 'negative';
  strengths: string[];
  weaknesses: string[];
}

export interface UniversityContentPreferences {
  preferredLength: { min: number; max: number };
  preferredTone: string;
  keyKeywords: string[];
  culturalConsiderations: string[];
  structurePreferences: string[];
  commonMistakes: string[];
}

export class ContentOptimizationEngine {
  private logger = new Logger('ContentOptimizationEngine');

  /**
   * Analyze content quality and characteristics
   */
  async analyzeContent(content: string): Promise<ContentAnalysis> {
    try {
      const analysis: ContentAnalysis = {
        wordCount: this.countWords(content),
        sentenceCount: this.countSentences(content),
        paragraphCount: this.countParagraphs(content),
        readabilityScore: this.calculateReadabilityScore(content),
        keywordDensity: this.analyzeKeywordDensity(content),
        tone: this.analyzeTone(content),
        sentiment: this.analyzeSentiment(content),
        strengths: this.identifyStrengths(content),
        weaknesses: this.identifyWeaknesses(content)
      };

      this.logger.info(`Content analysis completed: ${analysis.wordCount} words, readability: ${analysis.readabilityScore}`);
      return analysis;

    } catch (error) {
      this.logger.error('Failed to analyze content:', error);
      throw error;
    }
  }

  /**
   * Optimize content for a specific university
   */
  async optimizeForUniversity(
    content: string,
    university: University,
    studentProfile: StudentProfile,
    contentAnalysis: ContentAnalysis
  ): Promise<OptimizedContent> {
    try {
      this.logger.info(`Optimizing content for ${university.name}`);

      // Get university-specific preferences
      const preferences = await this.getUniversityPreferences(university);

      // Apply optimizations
      let optimizedContent = content;
      const keywordOptimization: string[] = [];
      const culturalAdaptations: string[] = [];
      const toneAdjustments: string[] = [];
      const structureImprovements: string[] = [];

      // 1. Keyword optimization
      const keywordResults = this.optimizeKeywords(optimizedContent, preferences, studentProfile);
      optimizedContent = keywordResults.content;
      keywordOptimization.push(...keywordResults.changes);

      // 2. Length optimization
      const lengthResults = this.optimizeLength(optimizedContent, preferences);
      optimizedContent = lengthResults.content;
      const lengthOptimization = lengthResults.changed;

      // 3. Tone adjustment
      const toneResults = this.adjustTone(optimizedContent, preferences, university);
      optimizedContent = toneResults.content;
      toneAdjustments.push(...toneResults.changes);

      // 4. Cultural adaptation
      const culturalResults = this.applyCulturalAdaptations(optimizedContent, university);
      optimizedContent = culturalResults.content;
      culturalAdaptations.push(...culturalResults.changes);

      // 5. Structure improvements
      const structureResults = this.improveStructure(optimizedContent, preferences);
      optimizedContent = structureResults.content;
      structureImprovements.push(...structureResults.changes);

      // Generate reasoning
      const reasoning = this.generateOptimizationReasoning(
        content,
        optimizedContent,
        university,
        preferences
      );

      return {
        content: optimizedContent,
        reasoning,
        keywordOptimization,
        culturalAdaptations,
        lengthOptimization,
        toneAdjustments,
        structureImprovements
      };

    } catch (error) {
      this.logger.error(`Failed to optimize content for ${university.name}:`, error);
      throw error;
    }
  }

  /**
   * Generate improvement suggestions
   */
  async generateImprovements(
    content: string,
    targets: University[],
    studentProfile: StudentProfile
  ): Promise<ContentImprovement[]> {
    try {
      const improvements: ContentImprovement[] = [];

      // Analyze content for common improvements
      const analysis = await this.analyzeContent(content);

      // Length improvements
      if (analysis.wordCount < 200) {
        improvements.push({
          type: 'length',
          description: 'Content is too short. Consider adding more specific examples and details.',
          impact: 'high',
          implementation: 'Add 2-3 specific examples of student achievements and expand on their significance.'
        });
      } else if (analysis.wordCount > 1000) {
        improvements.push({
          type: 'length',
          description: 'Content may be too long for some universities. Consider creating a more concise version.',
          impact: 'medium',
          implementation: 'Focus on the most impactful achievements and remove redundant information.'
        });
      }

      // Keyword improvements
      const missingKeywords = this.identifyMissingKeywords(content, studentProfile);
      if (missingKeywords.length > 0) {
        improvements.push({
          type: 'keyword',
          description: `Consider including these relevant keywords: ${missingKeywords.join(', ')}`,
          impact: 'medium',
          implementation: 'Naturally incorporate these terms when describing student achievements and qualities.'
        });
      }

      // Structure improvements
      if (analysis.paragraphCount < 3) {
        improvements.push({
          type: 'structure',
          description: 'Consider organizing content into clear paragraphs for better readability.',
          impact: 'medium',
          implementation: 'Structure as: Introduction, Academic achievements, Personal qualities, Conclusion.'
        });
      }

      // Tone improvements
      if (analysis.tone === 'informal') {
        improvements.push({
          type: 'tone',
          description: 'Consider using a more formal, academic tone for university applications.',
          impact: 'high',
          implementation: 'Use professional language and avoid contractions or casual expressions.'
        });
      }

      // Cultural improvements for international universities
      const internationalTargets = targets.filter(u => u.country !== 'US');
      if (internationalTargets.length > 0) {
        improvements.push({
          type: 'cultural',
          description: 'Consider cultural adaptations for international universities.',
          impact: 'high',
          implementation: 'Emphasize global perspective, cultural awareness, and international experiences.'
        });
      }

      return improvements;

    } catch (error) {
      this.logger.error('Failed to generate improvements:', error);
      throw error;
    }
  }

  /**
   * Generate cultural adaptations for different countries
   */
  async generateCulturalAdaptations(
    content: string,
    targets: University[]
  ): Promise<CulturalAdaptation[]> {
    try {
      const adaptations: CulturalAdaptation[] = [];

      for (const university of targets) {
        const countryAdaptations = this.getCulturalAdaptationsForCountry(content, university.country);
        adaptations.push(...countryAdaptations);
      }

      // Remove duplicates
      const uniqueAdaptations = adaptations.filter((adaptation, index, self) =>
        index === self.findIndex(a => 
          a.targetCountry === adaptation.targetCountry && 
          a.adaptationType === adaptation.adaptationType
        )
      );

      return uniqueAdaptations;

    } catch (error) {
      this.logger.error('Failed to generate cultural adaptations:', error);
      throw error;
    }
  }

  /**
   * Calculate overall content quality score
   */
  async calculateQualityScore(
    originalContent: string,
    optimizedVersions: Record<string, OptimizedContent>
  ): Promise<number> {
    try {
      const originalAnalysis = await this.analyzeContent(originalContent);
      
      // Base score from original content
      let baseScore = 0;
      baseScore += Math.min(originalAnalysis.readabilityScore, 100) * 0.3;
      baseScore += (originalAnalysis.wordCount >= 200 && originalAnalysis.wordCount <= 800) ? 25 : 10;
      baseScore += originalAnalysis.tone === 'academic' ? 20 : 10;
      baseScore += originalAnalysis.sentiment === 'positive' ? 15 : 5;

      // Bonus for optimizations
      const optimizationCount = Object.keys(optimizedVersions).length;
      const optimizationBonus = Math.min(optimizationCount * 2, 20);

      const totalScore = Math.min(baseScore + optimizationBonus, 100);
      return Math.round(totalScore);

    } catch (error) {
      this.logger.error('Failed to calculate quality score:', error);
      return 50; // Default score
    }
  }

  // Private helper methods

  private countWords(content: string): number {
    return content.trim().split(/\s+/).length;
  }

  private countSentences(content: string): number {
    return content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  }

  private countParagraphs(content: string): number {
    return content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  }

  private calculateReadabilityScore(content: string): number {
    // Simplified Flesch Reading Ease calculation
    const words = this.countWords(content);
    const sentences = this.countSentences(content);
    const syllables = this.countSyllables(content);

    if (sentences === 0 || words === 0) return 0;

    const avgSentenceLength = words / sentences;
    const avgSyllablesPerWord = syllables / words;

    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    return Math.max(0, Math.min(100, score));
  }

  private countSyllables(content: string): number {
    // Simplified syllable counting
    const words = content.toLowerCase().match(/\b\w+\b/g) || [];
    let syllableCount = 0;

    for (const word of words) {
      const vowels = word.match(/[aeiouy]+/g);
      syllableCount += vowels ? vowels.length : 1;
    }

    return syllableCount;
  }

  private analyzeKeywordDensity(content: string): Record<string, number> {
    const words = content.toLowerCase().match(/\b\w+\b/g) || [];
    const totalWords = words.length;
    const wordCount: Record<string, number> = {};

    // Count word frequencies
    for (const word of words) {
      if (word.length > 3) { // Only count meaningful words
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    }

    // Convert to density (percentage)
    const density: Record<string, number> = {};
    for (const [word, count] of Object.entries(wordCount)) {
      density[word] = (count / totalWords) * 100;
    }

    // Return top keywords
    return Object.fromEntries(
      Object.entries(density)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 20)
    );
  }

  private analyzeTone(content: string): 'formal' | 'informal' | 'academic' | 'personal' {
    const formalIndicators = ['furthermore', 'moreover', 'consequently', 'therefore', 'thus'];
    const informalIndicators = ['really', 'pretty', 'quite', 'kind of', 'sort of'];
    const academicIndicators = ['research', 'analysis', 'methodology', 'hypothesis', 'theoretical'];
    const personalIndicators = ['I feel', 'I believe', 'personally', 'in my opinion'];

    const formalCount = this.countIndicators(content, formalIndicators);
    const informalCount = this.countIndicators(content, informalIndicators);
    const academicCount = this.countIndicators(content, academicIndicators);
    const personalCount = this.countIndicators(content, personalIndicators);

    const max = Math.max(formalCount, informalCount, academicCount, personalCount);
    
    if (max === academicCount) return 'academic';
    if (max === formalCount) return 'formal';
    if (max === personalCount) return 'personal';
    return 'informal';
  }

  private analyzeSentiment(content: string): 'positive' | 'neutral' | 'negative' {
    const positiveWords = ['excellent', 'outstanding', 'exceptional', 'remarkable', 'impressive', 'strong', 'talented'];
    const negativeWords = ['weak', 'poor', 'lacking', 'insufficient', 'disappointing', 'concerning'];

    const positiveCount = this.countIndicators(content, positiveWords);
    const negativeCount = this.countIndicators(content, negativeWords);

    if (positiveCount > negativeCount * 2) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private countIndicators(content: string, indicators: string[]): number {
    const lowerContent = content.toLowerCase();
    return indicators.reduce((count, indicator) => {
      const regex = new RegExp(`\\b${indicator}\\b`, 'g');
      const matches = lowerContent.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private identifyStrengths(content: string): string[] {
    const strengths: string[] = [];

    if (this.countWords(content) >= 300 && this.countWords(content) <= 800) {
      strengths.push('Appropriate length for most universities');
    }

    if (this.calculateReadabilityScore(content) >= 60) {
      strengths.push('Good readability and clarity');
    }

    if (this.analyzeSentiment(content) === 'positive') {
      strengths.push('Positive and supportive tone');
    }

    if (this.countParagraphs(content) >= 3) {
      strengths.push('Well-structured with clear organization');
    }

    const academicKeywords = ['research', 'academic', 'scholarly', 'analytical', 'critical thinking'];
    if (this.countIndicators(content, academicKeywords) >= 2) {
      strengths.push('Strong academic focus and terminology');
    }

    return strengths;
  }

  private identifyWeaknesses(content: string): string[] {
    const weaknesses: string[] = [];

    if (this.countWords(content) < 200) {
      weaknesses.push('Content may be too short - consider adding more detail');
    }

    if (this.countWords(content) > 1000) {
      weaknesses.push('Content may be too long - consider condensing key points');
    }

    if (this.calculateReadabilityScore(content) < 40) {
      weaknesses.push('Content may be difficult to read - consider simplifying sentence structure');
    }

    if (this.countParagraphs(content) < 2) {
      weaknesses.push('Consider organizing content into multiple paragraphs');
    }

    if (this.analyzeTone(content) === 'informal') {
      weaknesses.push('Consider using a more formal, academic tone');
    }

    const clicheWords = ['hardworking', 'dedicated', 'passionate', 'motivated'];
    if (this.countIndicators(content, clicheWords) >= 3) {
      weaknesses.push('Consider replacing common clichés with specific examples');
    }

    return weaknesses;
  }

  private async getUniversityPreferences(university: University): Promise<UniversityContentPreferences> {
    // In a real implementation, this would query a database of university preferences
    // For now, return preferences based on university characteristics

    const basePreferences: UniversityContentPreferences = {
      preferredLength: { min: 300, max: 800 },
      preferredTone: 'academic',
      keyKeywords: ['academic', 'research', 'leadership', 'achievement'],
      culturalConsiderations: [],
      structurePreferences: ['introduction', 'academic_achievements', 'personal_qualities', 'conclusion'],
      commonMistakes: ['too_generic', 'lack_of_specifics', 'informal_tone']
    };

    // Customize based on university type and country
    if (university.country === 'GB') {
      basePreferences.keyKeywords.push('intellectual_curiosity', 'independent_learning', 'critical_thinking');
      basePreferences.culturalConsiderations.push('british_academic_culture', 'tutorial_system');
    } else if (university.country === 'FR') {
      basePreferences.keyKeywords.push('analytical_thinking', 'cultural_awareness', 'international_perspective');
      basePreferences.culturalConsiderations.push('french_academic_rigor', 'grandes_ecoles_culture');
    } else if (university.country === 'AU') {
      basePreferences.keyKeywords.push('practical_experience', 'global_perspective', 'innovation');
      basePreferences.culturalConsiderations.push('australian_work_culture', 'multicultural_environment');
    }

    // Adjust for institution type
    if (university.name.includes('Research University')) {
      basePreferences.keyKeywords.push('research_experience', 'scholarly_work', 'innovation');
    } else if (university.name.includes('Liberal Arts')) {
      basePreferences.keyKeywords.push('well_rounded', 'diverse_interests', 'critical_thinking');
    } else if (university.name.includes('Technology') || university.name.includes('Engineering')) {
      basePreferences.keyKeywords.push('technical_skills', 'problem_solving', 'innovation', 'STEM');
    }

    return basePreferences;
  }

  private optimizeKeywords(
    content: string,
    preferences: UniversityContentPreferences,
    studentProfile: StudentProfile
  ): { content: string; changes: string[] } {
    let optimizedContent = content;
    const changes: string[] = [];

    // Add missing relevant keywords naturally
    for (const keyword of preferences.keyKeywords) {
      if (!content.toLowerCase().includes(keyword.replace('_', ' '))) {
        // Find appropriate place to insert keyword
        const keywordPhrase = this.generateKeywordPhrase(keyword, studentProfile);
        if (keywordPhrase) {
          optimizedContent = this.insertKeywordNaturally(optimizedContent, keywordPhrase);
          changes.push(`Added "${keyword.replace('_', ' ')}" emphasis`);
        }
      }
    }

    return { content: optimizedContent, changes };
  }

  private optimizeLength(
    content: string,
    preferences: UniversityContentPreferences
  ): { content: string; changed: boolean } {
    const wordCount = this.countWords(content);
    let optimizedContent = content;
    let changed = false;

    if (wordCount > preferences.preferredLength.max) {
      // Trim content while preserving key information
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const targetSentences = Math.floor(sentences.length * (preferences.preferredLength.max / wordCount));
      
      optimizedContent = sentences.slice(0, targetSentences).join('. ') + '.';
      changed = true;
    } else if (wordCount < preferences.preferredLength.min) {
      // Add expansion suggestions (in real implementation, this would be more sophisticated)
      optimizedContent += '\n\n[Consider expanding with specific examples and additional details about the student\'s achievements and potential.]';
      changed = true;
    }

    return { content: optimizedContent, changed };
  }

  private adjustTone(
    content: string,
    preferences: UniversityContentPreferences,
    university: University
  ): { content: string; changes: string[] } {
    let optimizedContent = content;
    const changes: string[] = [];

    // Replace informal contractions
    const contractions = {
      "don't": "do not",
      "won't": "will not",
      "can't": "cannot",
      "isn't": "is not",
      "aren't": "are not",
      "wasn't": "was not",
      "weren't": "were not",
      "hasn't": "has not",
      "haven't": "have not",
      "hadn't": "had not"
    };

    for (const [contraction, expansion] of Object.entries(contractions)) {
      if (optimizedContent.includes(contraction)) {
        optimizedContent = optimizedContent.replace(new RegExp(contraction, 'gi'), expansion);
        changes.push(`Replaced "${contraction}" with "${expansion}"`);
      }
    }

    // Replace casual language with formal alternatives
    const formalReplacements = {
      'really good': 'excellent',
      'pretty amazing': 'remarkable',
      'super smart': 'intellectually gifted',
      'awesome': 'outstanding',
      'cool': 'interesting',
      'stuff': 'work',
      'things': 'aspects'
    };

    for (const [casual, formal] of Object.entries(formalReplacements)) {
      if (optimizedContent.toLowerCase().includes(casual)) {
        optimizedContent = optimizedContent.replace(new RegExp(casual, 'gi'), formal);
        changes.push(`Replaced "${casual}" with "${formal}"`);
      }
    }

    return { content: optimizedContent, changes };
  }

  private applyCulturalAdaptations(
    content: string,
    university: University
  ): { content: string; changes: string[] } {
    let optimizedContent = content;
    const changes: string[] = [];

    // Apply country-specific adaptations
    switch (university.country) {
      case 'GB':
        // UK universities value intellectual curiosity and independent learning
        if (!content.toLowerCase().includes('intellectual') && !content.toLowerCase().includes('curiosity')) {
          optimizedContent += ' The student demonstrates strong intellectual curiosity and independent learning capabilities.';
          changes.push('Added emphasis on intellectual curiosity (UK preference)');
        }
        break;

      case 'FR':
        // French universities value analytical thinking and cultural awareness
        if (!content.toLowerCase().includes('analytical') && !content.toLowerCase().includes('critical')) {
          optimizedContent += ' The student shows excellent analytical and critical thinking skills.';
          changes.push('Added emphasis on analytical thinking (French preference)');
        }
        break;

      case 'AU':
        // Australian universities value practical experience and global perspective
        if (!content.toLowerCase().includes('practical') && !content.toLowerCase().includes('global')) {
          optimizedContent += ' The student brings practical experience and a global perspective to their studies.';
          changes.push('Added emphasis on practical experience (Australian preference)');
        }
        break;

      case 'DE':
        // German universities value thoroughness and technical competence
        if (!content.toLowerCase().includes('thorough') && !content.toLowerCase().includes('systematic')) {
          optimizedContent += ' The student demonstrates thorough and systematic approach to learning.';
          changes.push('Added emphasis on thoroughness (German preference)');
        }
        break;
    }

    return { content: optimizedContent, changes };
  }

  private improveStructure(
    content: string,
    preferences: UniversityContentPreferences
  ): { content: string; changes: string[] } {
    let optimizedContent = content;
    const changes: string[] = [];

    // Ensure proper paragraph structure
    const paragraphs = content.split(/\n\s*\n/);
    
    if (paragraphs.length === 1 && this.countWords(content) > 200) {
      // Split long single paragraph into multiple paragraphs
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      const sentencesPerParagraph = Math.ceil(sentences.length / 3);
      
      const newParagraphs = [];
      for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
        const paragraphSentences = sentences.slice(i, i + sentencesPerParagraph);
        newParagraphs.push(paragraphSentences.join('. ') + '.');
      }
      
      optimizedContent = newParagraphs.join('\n\n');
      changes.push('Improved paragraph structure for better readability');
    }

    return { content: optimizedContent, changes };
  }

  private generateOptimizationReasoning(
    originalContent: string,
    optimizedContent: string,
    university: University,
    preferences: UniversityContentPreferences
  ): string {
    const reasons: string[] = [];

    if (originalContent !== optimizedContent) {
      reasons.push(`Content optimized specifically for ${university.name}`);
    }

    if (university.country !== 'US') {
      reasons.push(`Cultural adaptations applied for ${university.country} academic culture`);
    }

    if (preferences.keyKeywords.length > 0) {
      reasons.push(`Enhanced with relevant keywords: ${preferences.keyKeywords.slice(0, 3).join(', ')}`);
    }

    reasons.push(`Tone adjusted to match ${preferences.preferredTone} style preferred by this institution`);

    return reasons.join('. ') + '.';
  }

  private identifyMissingKeywords(content: string, studentProfile: StudentProfile): string[] {
    const relevantKeywords = this.generateRelevantKeywords(studentProfile);
    const missingKeywords: string[] = [];

    for (const keyword of relevantKeywords) {
      if (!content.toLowerCase().includes(keyword.toLowerCase())) {
        missingKeywords.push(keyword);
      }
    }

    return missingKeywords.slice(0, 5); // Top 5 missing keywords
  }

  private generateRelevantKeywords(studentProfile: StudentProfile): string[] {
    const keywords: string[] = [];

    // Add major-specific keywords
    const majorKeywords = this.getMajorKeywords(studentProfile.academic.major);
    keywords.push(...majorKeywords);

    // Add achievement-based keywords
    if (studentProfile.background.achievements.some(a => a.type === 'academic')) {
      keywords.push('academic excellence', 'scholarly achievement');
    }

    if (studentProfile.background.achievements.some(a => a.type === 'leadership')) {
      keywords.push('leadership', 'team management');
    }

    if (studentProfile.background.extracurriculars.some(e => e.type === 'community_service')) {
      keywords.push('community service', 'social responsibility');
    }

    // Add research keywords if applicable
    if (studentProfile.goals.researchInterests.length > 0) {
      keywords.push('research experience', 'scholarly inquiry');
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  private getMajorKeywords(major: string): string[] {
    const majorKeywordMap: Record<string, string[]> = {
      'Computer Science': ['programming', 'algorithms', 'software development', 'technical skills'],
      'Engineering': ['problem solving', 'technical analysis', 'innovation', 'design thinking'],
      'Business': ['leadership', 'strategic thinking', 'entrepreneurship', 'team collaboration'],
      'Biology': ['scientific research', 'analytical skills', 'laboratory experience', 'scientific method'],
      'Psychology': ['research methodology', 'analytical thinking', 'human behavior', 'statistical analysis'],
      'Mathematics': ['analytical reasoning', 'problem solving', 'logical thinking', 'quantitative skills']
    };

    return majorKeywordMap[major] || ['academic excellence', 'critical thinking'];
  }

  private generateKeywordPhrase(keyword: string, studentProfile: StudentProfile): string | null {
    // Generate natural phrases that incorporate keywords
    const keywordPhrases: Record<string, string[]> = {
      'research': [
        'has demonstrated strong research capabilities',
        'shows excellent research potential',
        'has engaged in meaningful research activities'
      ],
      'leadership': [
        'has shown exceptional leadership qualities',
        'demonstrates natural leadership abilities',
        'has taken on significant leadership roles'
      ],
      'analytical': [
        'possesses strong analytical skills',
        'demonstrates excellent analytical thinking',
        'shows remarkable analytical capabilities'
      ]
    };

    const phrases = keywordPhrases[keyword];
    if (phrases) {
      return phrases[Math.floor(Math.random() * phrases.length)];
    }

    return null;
  }

  private insertKeywordNaturally(content: string, phrase: string): string {
    // Insert phrase naturally into content
    const sentences = content.split(/[.!?]+/);
    if (sentences.length > 2) {
      // Insert in the middle of the content
      const insertIndex = Math.floor(sentences.length / 2);
      sentences.splice(insertIndex, 0, ` ${phrase}`);
      return sentences.join('.').replace(/\.\s*\./g, '.');
    }
    
    return content + ` ${phrase}.`;
  }

  private getCulturalAdaptationsForCountry(content: string, country: string): CulturalAdaptation[] {
    const adaptations: CulturalAdaptation[] = [];

    switch (country) {
      case 'GB':
        adaptations.push({
          targetCountry: 'GB',
          adaptationType: 'tone',
          originalElement: 'American academic style',
          adaptedElement: 'British academic style with emphasis on intellectual curiosity',
          reasoning: 'UK universities value independent thinking and intellectual exploration'
        });
        break;

      case 'FR':
        adaptations.push({
          targetCountry: 'FR',
          adaptationType: 'structure',
          originalElement: 'American recommendation format',
          adaptedElement: 'French academic reference with analytical focus',
          reasoning: 'French system values analytical rigor and cultural sophistication'
        });
        break;

      case 'AU':
        adaptations.push({
          targetCountry: 'AU',
          adaptationType: 'content',
          originalElement: 'US-focused achievements',
          adaptedElement: 'Global perspective with practical applications',
          reasoning: 'Australian universities value practical experience and international outlook'
        });
        break;
    }

    return adaptations;
  }
}