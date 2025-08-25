import { StudentProfile, University, OptimizedContent, ContentImprovement, CulturalAdaptation } from './AIIntelligenceService';
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
    preferredLength: {
        min: number;
        max: number;
    };
    preferredTone: string;
    keyKeywords: string[];
    culturalConsiderations: string[];
    structurePreferences: string[];
    commonMistakes: string[];
}
export declare class ContentOptimizationEngine {
    private logger;
    analyzeContent(content: string): Promise<ContentAnalysis>;
    optimizeForUniversity(content: string, university: University, studentProfile: StudentProfile, contentAnalysis: ContentAnalysis): Promise<OptimizedContent>;
    generateImprovements(content: string, targets: University[], studentProfile: StudentProfile): Promise<ContentImprovement[]>;
    generateCulturalAdaptations(content: string, targets: University[]): Promise<CulturalAdaptation[]>;
    calculateQualityScore(originalContent: string, optimizedVersions: Record<string, OptimizedContent>): Promise<number>;
    private countWords;
    private countSentences;
    private countParagraphs;
    private calculateReadabilityScore;
    private countSyllables;
    private analyzeKeywordDensity;
    private analyzeTone;
    private analyzeSentiment;
    private countIndicators;
    private identifyStrengths;
    private identifyWeaknesses;
    private getUniversityPreferences;
    private optimizeKeywords;
    private optimizeLength;
    private adjustTone;
    private applyCulturalAdaptations;
    private improveStructure;
    private generateOptimizationReasoning;
    private identifyMissingKeywords;
    private generateRelevantKeywords;
    private getMajorKeywords;
    private generateKeywordPhrase;
    private insertKeywordNaturally;
    private getCulturalAdaptationsForCountry;
}
//# sourceMappingURL=ContentOptimizationEngine.d.ts.map