import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export interface SuggestionRequest {
  content: string;
  type: 'vocabulary' | 'structure' | 'tone' | 'clarity' | 'grammar';
  context?: {
    essayType?: string;
    audience?: string;
    tone?: string;
    position?: {
      start: number;
      end: number;
    };
  };
  userId: string;
}

export interface Suggestion {
  id: string;
  type: 'vocabulary' | 'structure' | 'tone' | 'clarity' | 'grammar';
  severity: 'low' | 'medium' | 'high';
  original: string;
  suggestion: string;
  explanation: string;
  position?: {
    start: number;
    end: number;
  };
  confidence: number;
  alternatives?: string[];
  category?: string;
}

export interface VocabularySuggestion extends Suggestion {
  type: 'vocabulary';
  wordType: 'adjective' | 'verb' | 'noun' | 'adverb';
  synonyms: string[];
  contextualFit: number;
  formalityLevel: 'informal' | 'neutral' | 'formal' | 'academic';
}

export interface StructureSuggestion extends Suggestion {
  type: 'structure';
  structureType: 'paragraph' | 'sentence' | 'transition' | 'organization';
  improvement: string;
  example: string;
}

export interface ToneSuggestion extends Suggestion {
  type: 'tone';
  currentTone: string;
  suggestedTone: string;
  toneShift: 'more_formal' | 'less_formal' | 'more_personal' | 'more_professional';
}

export class SuggestionService {
  async getSuggestions(request: SuggestionRequest): Promise<Suggestion[]> {
    try {
      let suggestions: Suggestion[] = [];
      
      switch (request.type) {
        case 'vocabulary':
          suggestions = await this.getVocabularySuggestions(request);
          break;
        case 'structure':
          suggestions = await this.getStructureSuggestions(request);
          break;
        case 'tone':
          suggestions = await this.getToneSuggestions(request);
          break;
        case 'clarity':
          suggestions = await this.getClaritySuggestions(request);
          break;
        case 'grammar':
          suggestions = await this.getGrammarSuggestions(request);
          break;
        default:
          suggestions = await this.getAllSuggestions(request);
      }
      
      // Store suggestions for analytics
      await this.storeSuggestions(request.userId, suggestions);
      
      return suggestions.sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
      
    } catch (error) {
      console.error('Error getting suggestions:', error);
      throw new Error(`Failed to get suggestions: ${error.message}`);
    }
  }

  async getVocabularySuggestions(request: SuggestionRequest): Promise<VocabularySuggestion[]> {
    try {
      const suggestions: VocabularySuggestion[] = [];
      const words = this.extractWords(request.content);
      
      for (const word of words) {
        const wordSuggestions = await this.analyzeWord(word, request.context);
        suggestions.push(...wordSuggestions);
      }
      
      return suggestions;
      
    } catch (error) {
      console.error('Error getting vocabulary suggestions:', error);
      return [];
    }
  }

  async getStructureSuggestions(request: SuggestionRequest): Promise<StructureSuggestion[]> {
    try {
      const suggestions: StructureSuggestion[] = [];
      
      // Analyze paragraph structure
      const paragraphSuggestions = await this.analyzeParagraphStructure(request.content);
      suggestions.push(...paragraphSuggestions);
      
      // Analyze sentence structure
      const sentenceSuggestions = await this.analyzeSentenceStructure(request.content);
      suggestions.push(...sentenceSuggestions);
      
      // Analyze transitions
      const transitionSuggestions = await this.analyzeTransitions(request.content);
      suggestions.push(...transitionSuggestions);
      
      // Analyze overall organization
      const organizationSuggestions = await this.analyzeOrganization(request.content, request.context);
      suggestions.push(...organizationSuggestions);
      
      return suggestions;
      
    } catch (error) {
      console.error('Error getting structure suggestions:', error);
      return [];
    }
  }

  async getToneSuggestions(request: SuggestionRequest): Promise<ToneSuggestion[]> {
    try {
      const suggestions: ToneSuggestion[] = [];
      
      // Analyze current tone
      const currentTone = await this.analyzeTone(request.content);
      const targetTone = request.context?.tone || 'professional';
      
      if (currentTone !== targetTone) {
        const toneShift = this.determineToneShift(currentTone, targetTone);
        const toneSuggestions = await this.generateToneAdjustments(
          request.content,
          currentTone,
          targetTone,
          toneShift
        );
        suggestions.push(...toneSuggestions);
      }
      
      return suggestions;
      
    } catch (error) {
      console.error('Error getting tone suggestions:', error);
      return [];
    }
  }

  async getClaritySuggestions(request: SuggestionRequest): Promise<Suggestion[]> {
    try {
      const suggestions: Suggestion[] = [];
      
      // Analyze sentence clarity
      const sentences = this.splitIntoSentences(request.content);
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const claritySuggestions = await this.analyzeSentenceClarity(sentence, i);
        suggestions.push(...claritySuggestions);
      }
      
      // Analyze word choice clarity
      const wordChoiceSuggestions = await this.analyzeWordChoiceClarity(request.content);
      suggestions.push(...wordChoiceSuggestions);
      
      // Analyze logical flow
      const flowSuggestions = await this.analyzeLogicalFlow(request.content);
      suggestions.push(...flowSuggestions);
      
      return suggestions;
      
    } catch (error) {
      console.error('Error getting clarity suggestions:', error);
      return [];
    }
  }

  async getGrammarSuggestions(request: SuggestionRequest): Promise<Suggestion[]> {
    try {
      // Use external grammar checking services
      const [languageToolSuggestions, grammarSuggestions] = await Promise.allSettled([
        this.getLanguageToolSuggestions(request.content),
        this.getInternalGrammarSuggestions(request.content)
      ]);
      
      const suggestions: Suggestion[] = [];
      
      if (languageToolSuggestions.status === 'fulfilled') {
        suggestions.push(...languageToolSuggestions.value);
      }
      
      if (grammarSuggestions.status === 'fulfilled') {
        suggestions.push(...grammarSuggestions.value);
      }
      
      // Remove duplicates
      return this.deduplicateSuggestions(suggestions);
      
    } catch (error) {
      console.error('Error getting grammar suggestions:', error);
      return [];
    }
  }

  async getAllSuggestions(request: SuggestionRequest): Promise<Suggestion[]> {
    try {
      const [
        vocabularySuggestions,
        structureSuggestions,
        toneSuggestions,
        claritySuggestions,
        grammarSuggestions
      ] = await Promise.allSettled([
        this.getVocabularySuggestions(request),
        this.getStructureSuggestions(request),
        this.getToneSuggestions(request),
        this.getClaritySuggestions(request),
        this.getGrammarSuggestions(request)
      ]);
      
      const allSuggestions: Suggestion[] = [];
      
      if (vocabularySuggestions.status === 'fulfilled') {
        allSuggestions.push(...vocabularySuggestions.value);
      }
      if (structureSuggestions.status === 'fulfilled') {
        allSuggestions.push(...structureSuggestions.value);
      }
      if (toneSuggestions.status === 'fulfilled') {
        allSuggestions.push(...toneSuggestions.value);
      }
      if (claritySuggestions.status === 'fulfilled') {
        allSuggestions.push(...claritySuggestions.value);
      }
      if (grammarSuggestions.status === 'fulfilled') {
        allSuggestions.push(...grammarSuggestions.value);
      }
      
      return this.deduplicateSuggestions(allSuggestions);
      
    } catch (error) {
      console.error('Error getting all suggestions:', error);
      return [];
    }
  }

  private async analyzeWord(word: { text: string; position: { start: number; end: number } }, context?: SuggestionRequest['context']): Promise<VocabularySuggestion[]> {
    const suggestions: VocabularySuggestion[] = [];
    
    // Check if word is overused
    if (this.isOverusedWord(word.text)) {
      const synonyms = await this.getSynonyms(word.text);
      const bestSynonym = this.selectBestSynonym(synonyms, context);
      
      if (bestSynonym) {
        suggestions.push({
          id: this.generateId(),
          type: 'vocabulary',
          severity: 'medium',
          original: word.text,
          suggestion: bestSynonym,
          explanation: `Consider using "${bestSynonym}" instead of the overused word "${word.text}"`,
          position: word.position,
          confidence: 0.8,
          alternatives: synonyms.slice(0, 3),
          wordType: await this.getWordType(word.text),
          synonyms,
          contextualFit: 0.8,
          formalityLevel: await this.getFormalityLevel(bestSynonym)
        });
      }
    }
    
    // Check for weak words
    if (this.isWeakWord(word.text)) {
      const strongerAlternatives = await this.getStrongerAlternatives(word.text);
      
      if (strongerAlternatives.length > 0) {
        suggestions.push({
          id: this.generateId(),
          type: 'vocabulary',
          severity: 'low',
          original: word.text,
          suggestion: strongerAlternatives[0],
          explanation: `Consider using a stronger word like "${strongerAlternatives[0]}" instead of "${word.text}"`,
          position: word.position,
          confidence: 0.7,
          alternatives: strongerAlternatives,
          wordType: await this.getWordType(word.text),
          synonyms: strongerAlternatives,
          contextualFit: 0.7,
          formalityLevel: await this.getFormalityLevel(strongerAlternatives[0])
        });
      }
    }
    
    return suggestions;
  }

  private async analyzeParagraphStructure(content: string): Promise<StructureSuggestion[]> {
    const suggestions: StructureSuggestion[] = [];
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    paragraphs.forEach((paragraph, index) => {
      const sentences = this.splitIntoSentences(paragraph);
      
      // Check paragraph length
      if (sentences.length < 3) {
        suggestions.push({
          id: this.generateId(),
          type: 'structure',
          severity: 'medium',
          original: paragraph.substring(0, 50) + '...',
          suggestion: 'Expand this paragraph with more supporting details',
          explanation: 'Paragraphs should typically contain 3-5 sentences to fully develop ideas',
          confidence: 0.8,
          structureType: 'paragraph',
          improvement: 'Add more supporting sentences or examples',
          example: 'Consider adding specific examples, evidence, or further explanation to strengthen your point.'
        });
      }
      
      if (sentences.length > 7) {
        suggestions.push({
          id: this.generateId(),
          type: 'structure',
          severity: 'medium',
          original: paragraph.substring(0, 50) + '...',
          suggestion: 'Consider breaking this paragraph into smaller ones',
          explanation: 'Long paragraphs can be difficult to follow and may contain multiple ideas',
          confidence: 0.8,
          structureType: 'paragraph',
          improvement: 'Split into 2-3 focused paragraphs',
          example: 'Each paragraph should focus on one main idea with supporting details.'
        });
      }
    });
    
    return suggestions;
  }

  private async analyzeSentenceStructure(content: string): Promise<StructureSuggestion[]> {
    const suggestions: StructureSuggestion[] = [];
    const sentences = this.splitIntoSentences(content);
    
    sentences.forEach((sentence, index) => {
      const words = sentence.split(/\s+/);
      
      // Check sentence length
      if (words.length > 30) {
        suggestions.push({
          id: this.generateId(),
          type: 'structure',
          severity: 'medium',
          original: sentence,
          suggestion: 'Consider breaking this long sentence into shorter ones',
          explanation: 'Long sentences can be difficult to follow and may confuse readers',
          confidence: 0.8,
          structureType: 'sentence',
          improvement: 'Split into 2-3 shorter sentences',
          example: 'Use periods, semicolons, or coordinating conjunctions to create clearer sentence boundaries.'
        });
      }
      
      // Check for run-on sentences
      if (this.isRunOnSentence(sentence)) {
        suggestions.push({
          id: this.generateId(),
          type: 'structure',
          severity: 'high',
          original: sentence,
          suggestion: 'This appears to be a run-on sentence',
          explanation: 'Run-on sentences contain multiple independent clauses that should be separated',
          confidence: 0.9,
          structureType: 'sentence',
          improvement: 'Separate independent clauses with proper punctuation',
          example: 'Use periods, semicolons, or conjunctions to properly connect ideas.'
        });
      }
    });
    
    return suggestions;
  }

  private async analyzeTransitions(content: string): Promise<StructureSuggestion[]> {
    const suggestions: StructureSuggestion[] = [];
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    for (let i = 1; i < paragraphs.length; i++) {
      const currentParagraph = paragraphs[i];
      const previousParagraph = paragraphs[i - 1];
      
      if (!this.hasTransition(currentParagraph, previousParagraph)) {
        suggestions.push({
          id: this.generateId(),
          type: 'structure',
          severity: 'low',
          original: currentParagraph.substring(0, 50) + '...',
          suggestion: 'Consider adding a transition to connect this paragraph to the previous one',
          explanation: 'Transitions help readers follow your logical flow between ideas',
          confidence: 0.7,
          structureType: 'transition',
          improvement: 'Add transitional words or phrases',
          example: 'Use words like "Furthermore," "However," "In addition," or "On the other hand" to connect ideas.'
        });
      }
    }
    
    return suggestions;
  }

  private async analyzeOrganization(content: string, context?: SuggestionRequest['context']): Promise<StructureSuggestion[]> {
    const suggestions: StructureSuggestion[] = [];
    
    // Check for introduction and conclusion
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    if (paragraphs.length > 2) {
      const firstParagraph = paragraphs[0];
      const lastParagraph = paragraphs[paragraphs.length - 1];
      
      if (!this.hasIntroductionElements(firstParagraph)) {
        suggestions.push({
          id: this.generateId(),
          type: 'structure',
          severity: 'medium',
          original: firstParagraph.substring(0, 50) + '...',
          suggestion: 'Consider strengthening your introduction',
          explanation: 'A strong introduction should hook the reader and preview your main points',
          confidence: 0.8,
          structureType: 'organization',
          improvement: 'Add a hook, background, and thesis statement',
          example: 'Start with an engaging opening, provide context, and clearly state your main argument.'
        });
      }
      
      if (!this.hasConclusionElements(lastParagraph)) {
        suggestions.push({
          id: this.generateId(),
          type: 'structure',
          severity: 'medium',
          original: lastParagraph.substring(0, 50) + '...',
          suggestion: 'Consider strengthening your conclusion',
          explanation: 'A strong conclusion should summarize key points and provide closure',
          confidence: 0.8,
          structureType: 'organization',
          improvement: 'Summarize main points and end with impact',
          example: 'Restate your thesis, summarize key arguments, and end with a memorable closing thought.'
        });
      }
    }
    
    return suggestions;
  }

  private async analyzeTone(content: string): Promise<string> {
    // Simplified tone analysis
    const formalWords = ['furthermore', 'consequently', 'therefore', 'moreover'];
    const informalWords = ['gonna', 'wanna', 'kinda', 'really', 'pretty'];
    const personalWords = ['I', 'my', 'me', 'personally'];
    
    const words = content.toLowerCase().split(/\s+/);
    const formalCount = words.filter(word => formalWords.includes(word)).length;
    const informalCount = words.filter(word => informalWords.includes(word)).length;
    const personalCount = words.filter(word => personalWords.includes(word)).length;
    
    if (formalCount > informalCount && formalCount > personalCount) return 'formal';
    if (informalCount > formalCount) return 'informal';
    if (personalCount > 5) return 'personal';
    return 'neutral';
  }

  private determineToneShift(currentTone: string, targetTone: string): ToneSuggestion['toneShift'] {
    if (currentTone === 'informal' && targetTone === 'formal') return 'more_formal';
    if (currentTone === 'formal' && targetTone === 'personal') return 'more_personal';
    if (currentTone === 'personal' && targetTone === 'formal') return 'more_professional';
    return 'more_formal';
  }

  private async generateToneAdjustments(
    content: string,
    currentTone: string,
    targetTone: string,
    toneShift: ToneSuggestion['toneShift']
  ): Promise<ToneSuggestion[]> {
    const suggestions: ToneSuggestion[] = [];
    
    // This is a simplified implementation
    suggestions.push({
      id: this.generateId(),
      type: 'tone',
      severity: 'medium',
      original: content.substring(0, 100) + '...',
      suggestion: `Adjust the tone to be more ${targetTone}`,
      explanation: `The current tone appears ${currentTone}, but ${targetTone} would be more appropriate`,
      confidence: 0.7,
      currentTone,
      suggestedTone: targetTone,
      toneShift
    });
    
    return suggestions;
  }

  private async analyzeSentenceClarity(sentence: string, index: number): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // Check for unclear pronoun references
    if (this.hasUnclearPronouns(sentence)) {
      suggestions.push({
        id: this.generateId(),
        type: 'clarity',
        severity: 'medium',
        original: sentence,
        suggestion: 'Clarify pronoun references',
        explanation: 'Make sure pronouns clearly refer to specific nouns',
        confidence: 0.8
      });
    }
    
    // Check for jargon or complex terms
    const jargonWords = this.identifyJargon(sentence);
    if (jargonWords.length > 0) {
      suggestions.push({
        id: this.generateId(),
        type: 'clarity',
        severity: 'low',
        original: jargonWords.join(', '),
        suggestion: 'Consider explaining or simplifying technical terms',
        explanation: 'Technical jargon may not be clear to all readers',
        confidence: 0.7
      });
    }
    
    return suggestions;
  }

  private async analyzeWordChoiceClarity(content: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // Check for vague words
    const vagueWords = ['thing', 'stuff', 'very', 'really', 'quite', 'somewhat'];
    const words = this.extractWords(content);
    
    words.forEach(word => {
      if (vagueWords.includes(word.text.toLowerCase())) {
        suggestions.push({
          id: this.generateId(),
          type: 'clarity',
          severity: 'low',
          original: word.text,
          suggestion: 'Use more specific language',
          explanation: `"${word.text}" is vague - consider using more precise words`,
          position: word.position,
          confidence: 0.8
        });
      }
    });
    
    return suggestions;
  }

  private async analyzeLogicalFlow(content: string): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    
    // This is a simplified implementation
    // In a real system, you would use more sophisticated NLP techniques
    
    return suggestions;
  }

  // Helper methods
  private extractWords(content: string): { text: string; position: { start: number; end: number } }[] {
    const words: { text: string; position: { start: number; end: number } }[] = [];
    const regex = /\b\w+\b/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      words.push({
        text: match[0],
        position: {
          start: match.index,
          end: match.index + match[0].length
        }
      });
    }
    
    return words;
  }

  private splitIntoSentences(content: string): string[] {
    return content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  private isOverusedWord(word: string): boolean {
    const overusedWords = ['very', 'really', 'quite', 'pretty', 'thing', 'stuff', 'good', 'bad', 'nice'];
    return overusedWords.includes(word.toLowerCase());
  }

  private isWeakWord(word: string): boolean {
    const weakWords = ['okay', 'fine', 'alright', 'maybe', 'perhaps', 'might'];
    return weakWords.includes(word.toLowerCase());
  }

  private async getSynonyms(word: string): Promise<string[]> {
    // In a real implementation, you would use a thesaurus API
    const synonymMap: Record<string, string[]> = {
      'good': ['excellent', 'outstanding', 'remarkable', 'exceptional'],
      'bad': ['poor', 'inadequate', 'substandard', 'disappointing'],
      'very': ['extremely', 'exceptionally', 'remarkably', 'significantly'],
      'thing': ['element', 'aspect', 'component', 'factor']
    };
    
    return synonymMap[word.toLowerCase()] || [];
  }

  private selectBestSynonym(synonyms: string[], context?: SuggestionRequest['context']): string | null {
    if (synonyms.length === 0) return null;
    
    // Simple selection - in a real system, you would use context analysis
    return synonyms[0];
  }

  private async getWordType(word: string): Promise<VocabularySuggestion['wordType']> {
    // Simplified word type detection
    if (word.endsWith('ly')) return 'adverb';
    if (word.endsWith('ed') || word.endsWith('ing')) return 'verb';
    return 'noun';
  }

  private async getFormalityLevel(word: string): Promise<VocabularySuggestion['formalityLevel']> {
    const formalWords = ['consequently', 'furthermore', 'nevertheless', 'exceptional'];
    const informalWords = ['okay', 'stuff', 'thing', 'really'];
    
    if (formalWords.includes(word.toLowerCase())) return 'formal';
    if (informalWords.includes(word.toLowerCase())) return 'informal';
    return 'neutral';
  }

  private async getStrongerAlternatives(word: string): Promise<string[]> {
    const alternatives: Record<string, string[]> = {
      'okay': ['acceptable', 'satisfactory', 'adequate'],
      'fine': ['excellent', 'satisfactory', 'appropriate'],
      'maybe': ['perhaps', 'possibly', 'potentially']
    };
    
    return alternatives[word.toLowerCase()] || [];
  }

  private isRunOnSentence(sentence: string): boolean {
    // Simplified run-on detection
    const conjunctions = sentence.match(/\b(and|but|or|so|yet)\b/g);
    const commas = sentence.match(/,/g);
    
    return (conjunctions?.length || 0) > 2 && (commas?.length || 0) > 3;
  }

  private hasTransition(currentParagraph: string, previousParagraph: string): boolean {
    const transitionWords = [
      'furthermore', 'moreover', 'additionally', 'however', 'nevertheless',
      'consequently', 'therefore', 'thus', 'meanwhile', 'similarly'
    ];
    
    const firstSentence = currentParagraph.split('.')[0].toLowerCase();
    return transitionWords.some(word => firstSentence.includes(word));
  }

  private hasIntroductionElements(paragraph: string): boolean {
    // Simplified check for introduction elements
    const sentences = this.splitIntoSentences(paragraph);
    return sentences.length >= 2; // Basic check
  }

  private hasConclusionElements(paragraph: string): boolean {
    // Simplified check for conclusion elements
    const conclusionWords = ['conclusion', 'summary', 'finally', 'ultimately', 'therefore'];
    return conclusionWords.some(word => paragraph.toLowerCase().includes(word));
  }

  private hasUnclearPronouns(sentence: string): boolean {
    const pronouns = ['it', 'this', 'that', 'they', 'them'];
    const words = sentence.toLowerCase().split(/\s+/);
    
    // Simple check - if sentence starts with a pronoun, it might be unclear
    return pronouns.includes(words[0]);
  }

  private identifyJargon(sentence: string): string[] {
    // Simplified jargon detection
    const jargonWords = ['utilize', 'facilitate', 'implement', 'optimize', 'leverage'];
    const words = sentence.toLowerCase().split(/\s+/);
    
    return words.filter(word => jargonWords.includes(word));
  }

  private async getLanguageToolSuggestions(content: string): Promise<Suggestion[]> {
    // Placeholder for LanguageTool integration
    return [];
  }

  private async getInternalGrammarSuggestions(content: string): Promise<Suggestion[]> {
    // Simplified internal grammar checking
    const suggestions: Suggestion[] = [];
    
    // Check for common grammar issues
    if (content.includes("it's") && content.includes("its")) {
      // This is a very basic check - real implementation would be more sophisticated
    }
    
    return suggestions;
  }

  private deduplicateSuggestions(suggestions: Suggestion[]): Suggestion[] {
    const seen = new Set();
    return suggestions.filter(suggestion => {
      const key = `${suggestion.original}-${suggestion.suggestion}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async storeSuggestions(userId: string, suggestions: Suggestion[]): Promise<void> {
    try {
      for (const suggestion of suggestions) {
        await prisma.writingSuggestion.create({
          data: {
            id: suggestion.id,
            userId,
            type: suggestion.type,
            severity: suggestion.severity,
            original: suggestion.original,
            suggestion: suggestion.suggestion,
            explanation: suggestion.explanation,
            confidence: suggestion.confidence,
            position: suggestion.position || {},
            alternatives: suggestion.alternatives || [],
            createdAt: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error storing suggestions:', error);
    }
  }

  private generateId(): string {
    return `suggestion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}