import { PrismaClient } from '@prisma/client';
import { WritingAnalysisService, AnalysisResult } from './writingAnalysisService';

const prisma = new PrismaClient();

export interface QualityAssessmentRequest {
  content: string;
  essayType: 'personal_statement' | 'supplemental_essay' | 'scholarship_essay' | 'cover_letter';
  requirements?: {
    wordLimit?: number;
    prompts?: string[];
    criteria?: string[];
  };
  userId: string;
}

export interface QualityScore {
  category: string;
  score: number;
  maxScore: number;
  weight: number;
  feedback: string;
  improvements: string[];
}

export interface QualityAssessment {
  id: string;
  overallScore: number;
  maxScore: number;
  percentage: number;
  readinessLevel: 'not_ready' | 'needs_improvement' | 'good' | 'excellent';
  scores: QualityScore[];
  strengths: string[];
  weaknesses: string[];
  priorityImprovements: string[];
  estimatedTimeToImprove: number; // in hours
  submissionRecommendation: {
    ready: boolean;
    confidence: number;
    reasoning: string;
  };
  comparison: {
    averageScore: number;
    percentile: number;
    similarEssays: number;
  };
}

export interface ReadinessCheck {
  ready: boolean;
  confidence: number;
  checklist: {
    item: string;
    completed: boolean;
    importance: 'low' | 'medium' | 'high';
    feedback?: string;
  }[];
  missingElements: string[];
  criticalIssues: string[];
}

export interface ComparisonData {
  essayType: string;
  averageScores: Record<string, number>;
  percentileRanges: Record<string, { min: number; max: number }>;
  commonStrengths: string[];
  commonWeaknesses: string[];
}

export class QualityAssessmentService {
  private analysisService: WritingAnalysisService;

  constructor() {
    this.analysisService = new WritingAnalysisService();
  }

  async assessQuality(request: QualityAssessmentRequest): Promise<QualityAssessment> {
    try {
      const assessmentId = this.generateId();
      
      // Get detailed analysis
      const analysis = await this.analysisService.analyzeContent({
        content: request.content,
        type: request.essayType,
        requirements: request.requirements,
        userId: request.userId
      });
      
      // Calculate quality scores for each category
      const scores = await this.calculateQualityScores(analysis, request);
      
      // Calculate overall score
      const overallScore = this.calculateOverallScore(scores);
      const maxScore = scores.reduce((sum, score) => sum + score.maxScore, 0);
      const percentage = Math.round((overallScore / maxScore) * 100);
      
      // Determine readiness level
      const readinessLevel = this.determineReadinessLevel(percentage);
      
      // Identify strengths and weaknesses
      const strengths = this.identifyStrengths(scores, analysis);
      const weaknesses = this.identifyWeaknesses(scores, analysis);
      
      // Generate priority improvements
      const priorityImprovements = this.generatePriorityImprovements(scores, analysis);
      
      // Estimate time to improve
      const estimatedTimeToImprove = this.estimateImprovementTime(weaknesses, priorityImprovements);
      
      // Generate submission recommendation
      const submissionRecommendation = this.generateSubmissionRecommendation(
        percentage,
        readinessLevel,
        analysis
      );
      
      // Get comparison data
      const comparison = await this.getComparisonData(request.essayType, overallScore);
      
      const assessment: QualityAssessment = {
        id: assessmentId,
        overallScore,
        maxScore,
        percentage,
        readinessLevel,
        scores,
        strengths,
        weaknesses,
        priorityImprovements,
        estimatedTimeToImprove,
        submissionRecommendation,
        comparison
      };
      
      // Store assessment
      await this.storeAssessment(request.userId, assessment);
      
      return assessment;
      
    } catch (error) {
      console.error('Error assessing quality:', error);
      throw new Error(`Failed to assess quality: ${error.message}`);
    }
  }

  async checkReadiness(request: QualityAssessmentRequest): Promise<ReadinessCheck> {
    try {
      // Get quality assessment
      const assessment = await this.assessQuality(request);
      
      // Create readiness checklist
      const checklist = this.createReadinessChecklist(request, assessment);
      
      // Identify missing elements
      const missingElements = this.identifyMissingElements(request, assessment);
      
      // Identify critical issues
      const criticalIssues = this.identifyCriticalIssues(assessment);
      
      // Determine overall readiness
      const completedItems = checklist.filter(item => item.completed).length;
      const totalItems = checklist.length;
      const completionRate = completedItems / totalItems;
      
      const ready = completionRate >= 0.8 && criticalIssues.length === 0;
      const confidence = Math.min(0.95, completionRate * (criticalIssues.length === 0 ? 1 : 0.5));
      
      return {
        ready,
        confidence,
        checklist,
        missingElements,
        criticalIssues
      };
      
    } catch (error) {
      console.error('Error checking readiness:', error);
      throw new Error(`Failed to check readiness: ${error.message}`);
    }
  }

  async compareEssays(
    essay1: string,
    essay2: string,
    essayType: string,
    userId: string
  ): Promise<{
    essay1Score: number;
    essay2Score: number;
    comparison: {
      category: string;
      essay1: number;
      essay2: number;
      difference: number;
      winner: 'essay1' | 'essay2' | 'tie';
    }[];
    recommendation: string;
  }> {
    try {
      // Assess both essays
      const [assessment1, assessment2] = await Promise.all([
        this.assessQuality({
          content: essay1,
          essayType: essayType as any,
          userId
        }),
        this.assessQuality({
          content: essay2,
          essayType: essayType as any,
          userId
        })
      ]);
      
      // Compare scores by category
      const comparison = assessment1.scores.map(score1 => {
        const score2 = assessment2.scores.find(s => s.category === score1.category);
        const difference = score1.score - (score2?.score || 0);
        
        let winner: 'essay1' | 'essay2' | 'tie' = 'tie';
        if (Math.abs(difference) > 2) {
          winner = difference > 0 ? 'essay1' : 'essay2';
        }
        
        return {
          category: score1.category,
          essay1: score1.score,
          essay2: score2?.score || 0,
          difference,
          winner
        };
      });
      
      // Generate recommendation
      const recommendation = this.generateComparisonRecommendation(
        assessment1,
        assessment2,
        comparison
      );
      
      return {
        essay1Score: assessment1.percentage,
        essay2Score: assessment2.percentage,
        comparison,
        recommendation
      };
      
    } catch (error) {
      console.error('Error comparing essays:', error);
      throw new Error(`Failed to compare essays: ${error.message}`);
    }
  }

  private async calculateQualityScores(
    analysis: AnalysisResult,
    request: QualityAssessmentRequest
  ): Promise<QualityScore[]> {
    const scores: QualityScore[] = [];
    
    // Content Quality (25%)
    scores.push({
      category: 'Content Quality',
      score: this.assessContentQuality(analysis, request),
      maxScore: 25,
      weight: 0.25,
      feedback: this.generateContentFeedback(analysis),
      improvements: this.generateContentImprovements(analysis)
    });
    
    // Writing Mechanics (20%)
    scores.push({
      category: 'Writing Mechanics',
      score: Math.round(analysis.scores.grammar * 0.2),
      maxScore: 20,
      weight: 0.20,
      feedback: this.generateMechanicsFeedback(analysis),
      improvements: this.generateMechanicsImprovements(analysis)
    });
    
    // Structure & Organization (20%)
    scores.push({
      category: 'Structure & Organization',
      score: this.assessStructure(analysis, request),
      maxScore: 20,
      weight: 0.20,
      feedback: this.generateStructureFeedback(analysis),
      improvements: this.generateStructureImprovements(analysis)
    });
    
    // Clarity & Style (15%)
    scores.push({
      category: 'Clarity & Style',
      score: Math.round((analysis.scores.clarity + analysis.scores.style) * 0.075),
      maxScore: 15,
      weight: 0.15,
      feedback: this.generateClarityFeedback(analysis),
      improvements: this.generateClarityImprovements(analysis)
    });
    
    // Impact & Engagement (10%)
    scores.push({
      category: 'Impact & Engagement',
      score: Math.round(analysis.scores.impact * 0.1),
      maxScore: 10,
      weight: 0.10,
      feedback: this.generateImpactFeedback(analysis),
      improvements: this.generateImpactImprovements(analysis)
    });
    
    // Requirements Compliance (10%)
    scores.push({
      category: 'Requirements Compliance',
      score: this.assessCompliance(analysis, request),
      maxScore: 10,
      weight: 0.10,
      feedback: this.generateComplianceFeedback(analysis, request),
      improvements: this.generateComplianceImprovements(analysis, request)
    });
    
    return scores;
  }

  private calculateOverallScore(scores: QualityScore[]): number {
    return scores.reduce((total, score) => total + score.score, 0);
  }

  private determineReadinessLevel(percentage: number): QualityAssessment['readinessLevel'] {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 75) return 'good';
    if (percentage >= 60) return 'needs_improvement';
    return 'not_ready';
  }

  private identifyStrengths(scores: QualityScore[], analysis: AnalysisResult): string[] {
    const strengths: string[] = [];
    
    // Identify high-scoring categories
    scores.forEach(score => {
      const percentage = (score.score / score.maxScore) * 100;
      if (percentage >= 80) {
        strengths.push(`Strong ${score.category.toLowerCase()}`);
      }
    });
    
    // Add specific strengths from analysis
    if (analysis.scores.grammar >= 90) {
      strengths.push('Excellent grammar and mechanics');
    }
    
    if (analysis.scores.originality >= 85) {
      strengths.push('Highly original content');
    }
    
    if (analysis.metrics.vocabularyComplexity >= 70) {
      strengths.push('Rich vocabulary usage');
    }
    
    return strengths;
  }

  private identifyWeaknesses(scores: QualityScore[], analysis: AnalysisResult): string[] {
    const weaknesses: string[] = [];
    
    // Identify low-scoring categories
    scores.forEach(score => {
      const percentage = (score.score / score.maxScore) * 100;
      if (percentage < 60) {
        weaknesses.push(`Weak ${score.category.toLowerCase()}`);
      }
    });
    
    // Add specific weaknesses from analysis
    if (analysis.scores.grammar < 70) {
      weaknesses.push('Grammar and mechanics need improvement');
    }
    
    if (analysis.scores.clarity < 70) {
      weaknesses.push('Content clarity could be improved');
    }
    
    if (analysis.suggestions.filter(s => s.severity === 'high').length > 3) {
      weaknesses.push('Multiple high-priority issues to address');
    }
    
    return weaknesses;
  }

  private generatePriorityImprovements(scores: QualityScore[], analysis: AnalysisResult): string[] {
    const improvements: string[] = [];
    
    // Get improvements from lowest-scoring categories
    const sortedScores = scores.sort((a, b) => (a.score / a.maxScore) - (b.score / b.maxScore));
    
    sortedScores.slice(0, 3).forEach(score => {
      improvements.push(...score.improvements.slice(0, 2));
    });
    
    // Add high-severity suggestions
    const highSeveritySuggestions = analysis.suggestions
      .filter(s => s.severity === 'high')
      .slice(0, 3);
    
    highSeveritySuggestions.forEach(suggestion => {
      improvements.push(suggestion.suggestion);
    });
    
    return improvements.slice(0, 5); // Limit to top 5
  }

  private estimateImprovementTime(weaknesses: string[], improvements: string[]): number {
    // Base time estimation in hours
    let hours = 0;
    
    // Add time based on number of weaknesses
    hours += weaknesses.length * 0.5;
    
    // Add time based on number of improvements
    hours += improvements.length * 0.3;
    
    // Minimum 1 hour, maximum 8 hours
    return Math.max(1, Math.min(8, Math.round(hours * 10) / 10));
  }

  private generateSubmissionRecommendation(
    percentage: number,
    readinessLevel: QualityAssessment['readinessLevel'],
    analysis: AnalysisResult
  ): QualityAssessment['submissionRecommendation'] {
    let ready = false;
    let confidence = 0;
    let reasoning = '';
    
    if (readinessLevel === 'excellent') {
      ready = true;
      confidence = 0.95;
      reasoning = 'Your essay demonstrates excellent quality across all categories and is ready for submission.';
    } else if (readinessLevel === 'good') {
      ready = true;
      confidence = 0.8;
      reasoning = 'Your essay shows good quality with minor areas for improvement. Consider addressing the suggested improvements, but it\'s ready for submission.';
    } else if (readinessLevel === 'needs_improvement') {
      ready = false;
      confidence = 0.6;
      reasoning = 'Your essay needs improvement in several areas before submission. Focus on the priority improvements identified.';
    } else {
      ready = false;
      confidence = 0.3;
      reasoning = 'Your essay requires significant revision before submission. Consider working through the suggested improvements systematically.';
    }
    
    return { ready, confidence, reasoning };
  }

  private async getComparisonData(
    essayType: string,
    score: number
  ): Promise<QualityAssessment['comparison']> {
    try {
      // Get comparison data from database
      const stats = await prisma.qualityAssessment.aggregate({
        where: { essayType },
        _avg: { overallScore: true },
        _count: { id: true }
      });
      
      const averageScore = stats._avg.overallScore || 75;
      const similarEssays = stats._count.id || 100;
      
      // Calculate percentile (simplified)
      const percentile = score > averageScore ? 75 : 25;
      
      return {
        averageScore: Math.round(averageScore),
        percentile,
        similarEssays
      };
      
    } catch (error) {
      console.error('Error getting comparison data:', error);
      return {
        averageScore: 75,
        percentile: 50,
        similarEssays: 100
      };
    }
  }

  private createReadinessChecklist(
    request: QualityAssessmentRequest,
    assessment: QualityAssessment
  ): ReadinessCheck['checklist'] {
    const checklist: ReadinessCheck['checklist'] = [];
    
    // Word count check
    if (request.requirements?.wordLimit) {
      const wordCount = request.content.split(/\s+/).length;
      const withinLimit = wordCount <= request.requirements.wordLimit * 1.1;
      
      checklist.push({
        item: `Word count within limit (${wordCount}/${request.requirements.wordLimit})`,
        completed: withinLimit,
        importance: 'high',
        feedback: withinLimit ? 'Word count is appropriate' : 'Reduce word count to meet requirements'
      });
    }
    
    // Grammar check
    checklist.push({
      item: 'Grammar and mechanics',
      completed: assessment.scores.find(s => s.category === 'Writing Mechanics')!.score >= 16,
      importance: 'high',
      feedback: 'Ensure proper grammar, spelling, and punctuation'
    });
    
    // Structure check
    checklist.push({
      item: 'Clear structure and organization',
      completed: assessment.scores.find(s => s.category === 'Structure & Organization')!.score >= 16,
      importance: 'high',
      feedback: 'Essay should have clear introduction, body, and conclusion'
    });
    
    // Content quality check
    checklist.push({
      item: 'Strong content and examples',
      completed: assessment.scores.find(s => s.category === 'Content Quality')!.score >= 20,
      importance: 'medium',
      feedback: 'Include specific examples and compelling content'
    });
    
    // Proofreading check
    checklist.push({
      item: 'Thoroughly proofread',
      completed: assessment.percentage >= 80,
      importance: 'medium',
      feedback: 'Review for any remaining errors or improvements'
    });
    
    return checklist;
  }

  private identifyMissingElements(
    request: QualityAssessmentRequest,
    assessment: QualityAssessment
  ): string[] {
    const missing: string[] = [];
    
    // Check for common missing elements based on essay type
    if (request.essayType === 'personal_statement') {
      if (!request.content.toLowerCase().includes('goal')) {
        missing.push('Clear statement of future goals');
      }
      if (!request.content.toLowerCase().includes('experience')) {
        missing.push('Specific examples or experiences');
      }
    }
    
    if (request.essayType === 'supplemental_essay') {
      if (!request.content.toLowerCase().includes('university') && !request.content.toLowerCase().includes('college')) {
        missing.push('Specific mention of the university');
      }
    }
    
    return missing;
  }

  private identifyCriticalIssues(assessment: QualityAssessment): string[] {
    const critical: string[] = [];
    
    // Check for critical quality issues
    if (assessment.scores.find(s => s.category === 'Writing Mechanics')!.score < 12) {
      critical.push('Serious grammar and mechanics issues');
    }
    
    if (assessment.percentage < 50) {
      critical.push('Overall quality below acceptable threshold');
    }
    
    return critical;
  }

  private generateComparisonRecommendation(
    assessment1: QualityAssessment,
    assessment2: QualityAssessment,
    comparison: any[]
  ): string {
    const winner = assessment1.percentage > assessment2.percentage ? 'first' : 'second';
    const difference = Math.abs(assessment1.percentage - assessment2.percentage);
    
    if (difference < 5) {
      return 'Both essays are of similar quality. Consider combining the strengths of both versions.';
    } else if (difference < 15) {
      return `The ${winner} essay is slightly stronger. Consider incorporating elements from both versions.`;
    } else {
      return `The ${winner} essay is significantly stronger and should be your primary choice.`;
    }
  }

  // Assessment helper methods
  private assessContentQuality(analysis: AnalysisResult, request: QualityAssessmentRequest): number {
    let score = 20; // Base score
    
    // Adjust based on analysis scores
    if (analysis.scores.impact >= 85) score += 3;
    else if (analysis.scores.impact < 70) score -= 3;
    
    if (analysis.scores.originality >= 85) score += 2;
    else if (analysis.scores.originality < 70) score -= 2;
    
    return Math.max(0, Math.min(25, score));
  }

  private assessStructure(analysis: AnalysisResult, request: QualityAssessmentRequest): number {
    let score = 16; // Base score
    
    // Check paragraph count
    if (analysis.metrics.paragraphCount >= 3 && analysis.metrics.paragraphCount <= 6) {
      score += 2;
    } else {
      score -= 1;
    }
    
    // Check sentence variety
    if (analysis.metrics.averageSentenceLength >= 15 && analysis.metrics.averageSentenceLength <= 25) {
      score += 2;
    }
    
    return Math.max(0, Math.min(20, score));
  }

  private assessCompliance(analysis: AnalysisResult, request: QualityAssessmentRequest): number {
    let score = 8; // Base score
    
    // Check word limit compliance
    if (request.requirements?.wordLimit) {
      const wordCount = analysis.metrics.wordCount;
      const limit = request.requirements.wordLimit;
      
      if (wordCount <= limit) {
        score += 2;
      } else if (wordCount <= limit * 1.1) {
        score += 1;
      } else {
        score -= 2;
      }
    }
    
    return Math.max(0, Math.min(10, score));
  }

  // Feedback generation methods
  private generateContentFeedback(analysis: AnalysisResult): string {
    if (analysis.scores.impact >= 85) {
      return 'Your content is engaging and impactful with strong examples and insights.';
    } else if (analysis.scores.impact >= 70) {
      return 'Your content is solid but could benefit from more specific examples or deeper insights.';
    } else {
      return 'Your content needs strengthening with more compelling examples and clearer arguments.';
    }
  }

  private generateMechanicsFeedback(analysis: AnalysisResult): string {
    if (analysis.scores.grammar >= 90) {
      return 'Excellent grammar and mechanics with minimal errors.';
    } else if (analysis.scores.grammar >= 75) {
      return 'Good grammar with minor errors that should be corrected.';
    } else {
      return 'Grammar and mechanics need significant improvement.';
    }
  }

  private generateStructureFeedback(analysis: AnalysisResult): string {
    return 'Consider the logical flow and organization of your ideas.';
  }

  private generateClarityFeedback(analysis: AnalysisResult): string {
    if (analysis.scores.clarity >= 80) {
      return 'Your writing is clear and easy to follow.';
    } else {
      return 'Some sentences could be clearer and more concise.';
    }
  }

  private generateImpactFeedback(analysis: AnalysisResult): string {
    return 'Focus on making your writing more engaging and memorable.';
  }

  private generateComplianceFeedback(analysis: AnalysisResult, request: QualityAssessmentRequest): string {
    return 'Ensure your essay meets all specified requirements.';
  }

  // Improvement generation methods
  private generateContentImprovements(analysis: AnalysisResult): string[] {
    return [
      'Add more specific examples',
      'Strengthen your main arguments',
      'Include more personal insights'
    ];
  }

  private generateMechanicsImprovements(analysis: AnalysisResult): string[] {
    return [
      'Proofread for grammar errors',
      'Check spelling and punctuation',
      'Review sentence structure'
    ];
  }

  private generateStructureImprovements(analysis: AnalysisResult): string[] {
    return [
      'Improve paragraph transitions',
      'Strengthen introduction and conclusion',
      'Ensure logical flow of ideas'
    ];
  }

  private generateClarityImprovements(analysis: AnalysisResult): string[] {
    return [
      'Simplify complex sentences',
      'Use more precise language',
      'Eliminate redundancy'
    ];
  }

  private generateImpactImprovements(analysis: AnalysisResult): string[] {
    return [
      'Use more vivid language',
      'Add emotional resonance',
      'Create stronger opening and closing'
    ];
  }

  private generateComplianceImprovements(analysis: AnalysisResult, request: QualityAssessmentRequest): string[] {
    const improvements: string[] = [];
    
    if (request.requirements?.wordLimit && analysis.metrics.wordCount > request.requirements.wordLimit) {
      improvements.push('Reduce word count to meet limit');
    }
    
    improvements.push('Review all requirements carefully');
    
    return improvements;
  }

  private async storeAssessment(userId: string, assessment: QualityAssessment): Promise<void> {
    try {
      await prisma.qualityAssessment.create({
        data: {
          id: assessment.id,
          userId,
          overallScore: assessment.overallScore,
          percentage: assessment.percentage,
          readinessLevel: assessment.readinessLevel,
          scores: assessment.scores,
          strengths: assessment.strengths,
          weaknesses: assessment.weaknesses,
          priorityImprovements: assessment.priorityImprovements,
          estimatedTimeToImprove: assessment.estimatedTimeToImprove,
          submissionRecommendation: assessment.submissionRecommendation,
          comparison: assessment.comparison,
          createdAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error storing assessment:', error);
    }
  }

  private generateId(): string {
    return `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}