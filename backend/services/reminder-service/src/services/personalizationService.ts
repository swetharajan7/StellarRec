import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import handlebars from 'handlebars';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import axios from 'axios';

const prisma = new PrismaClient();

export interface PersonalizedContent {
  title: string;
  content: string;
  tone: 'formal' | 'casual' | 'urgent' | 'encouraging' | 'gentle';
  personalizationScore: number; // 0-1, how personalized the content is
}

export interface UserPersonalizationProfile {
  userId: string;
  preferredTone: 'formal' | 'casual' | 'urgent' | 'encouraging' | 'gentle';
  preferredLength: 'brief' | 'detailed' | 'comprehensive';
  motivationalFactors: string[]; // what motivates this user
  communicationStyle: 'direct' | 'supportive' | 'analytical' | 'creative';
  personalDetails: Record<string, any>; // name, goals, preferences, etc.
  responsePatterns: Record<string, number>; // which types of messages work best
  lastUpdated: Date;
}

export class PersonalizationService {
  private readonly USER_SERVICE_URL: string;
  private templateCache: Map<string, handlebars.TemplateDelegate> = new Map();

  constructor() {
    this.USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
    this.registerHandlebarsHelpers();
  }

  async generateReminderContent(
    userId: string,
    reminderContext: any,
    reminderType: string
  ): Promise<PersonalizedContent> {
    try {
      logger.info('Generating personalized reminder content', { 
        userId, 
        reminderType 
      });

      // Get user personalization profile
      const profile = await this.getUserPersonalizationProfile(userId);
      
      // Get user data for personalization
      const userData = await this.getUserData(userId);
      
      // Select appropriate template
      const template = await this.selectTemplate(reminderType, profile, reminderContext);
      
      // Generate personalized content
      const personalizedContent = await this.personalizeContent(
        template,
        userData,
        profile,
        reminderContext
      );

      logger.info('Personalized content generated', { 
        userId,
        tone: personalizedContent.tone,
        personalizationScore: personalizedContent.personalizationScore 
      });

      return personalizedContent;

    } catch (error) {
      logger.error('Error generating personalized content:', error);
      return this.getFallbackContent(reminderType, reminderContext);
    }
  }

  async generateEscalationMessage(
    userId: string,
    templateContent: string,
    escalationContext: any
  ): Promise<string> {
    try {
      const profile = await this.getUserPersonalizationProfile(userId);
      const userData = await this.getUserData(userId);

      // Compile template
      const template = handlebars.compile(templateContent);
      
      // Prepare context data
      const contextData = {
        user: userData,
        profile: profile,
        escalation: escalationContext,
        urgency: this.calculateUrgencyLevel(escalationContext),
        timeRemaining: this.formatTimeRemaining(escalationContext.targetDate)
      };

      const message = template(contextData);
      
      // Apply tone adjustment based on user preference
      return this.adjustTone(message, profile.preferredTone);

    } catch (error) {
      logger.error('Error generating escalation message:', error);
      return templateContent; // Return original template as fallback
    }
  }

  async updatePersonalizationProfile(
    userId: string,
    interactionData: {
      reminderType: string;
      responseTime?: number;
      actionTaken: boolean;
      tone: string;
      contentLength: string;
      feedback?: string;
    }
  ): Promise<void> {
    try {
      const profile = await this.getUserPersonalizationProfile(userId);
      
      // Update response patterns
      const responseKey = `${interactionData.reminderType}_${interactionData.tone}`;
      const currentScore = profile.responsePatterns[responseKey] || 0.5;
      const adjustment = interactionData.actionTaken ? 0.1 : -0.05;
      profile.responsePatterns[responseKey] = Math.max(0, Math.min(1, currentScore + adjustment));

      // Update preferred tone if user responded well
      if (interactionData.actionTaken && interactionData.responseTime && interactionData.responseTime < 24) {
        profile.preferredTone = interactionData.tone as any;
      }

      // Update communication style based on response patterns
      profile.communicationStyle = this.inferCommunicationStyle(profile.responsePatterns);

      profile.lastUpdated = new Date();
      await this.savePersonalizationProfile(profile);

      logger.info('Personalization profile updated', { userId });

    } catch (error) {
      logger.error('Error updating personalization profile:', error);
    }
  }

  async getPersonalizationInsights(userId: string): Promise<{
    profile: UserPersonalizationProfile;
    effectiveness: Record<string, number>;
    recommendations: string[];
    optimizationOpportunities: string[];
  }> {
    try {
      const profile = await this.getUserPersonalizationProfile(userId);
      const effectiveness = this.calculateEffectiveness(profile.responsePatterns);
      const recommendations = this.generatePersonalizationRecommendations(profile, effectiveness);
      const optimizationOpportunities = this.identifyOptimizationOpportunities(profile, effectiveness);

      return {
        profile,
        effectiveness,
        recommendations,
        optimizationOpportunities
      };

    } catch (error) {
      logger.error('Error getting personalization insights:', error);
      throw new Error(`Failed to get personalization insights: ${error.message}`);
    }
  }

  async optimizeContentForUser(
    userId: string,
    baseContent: string,
    context: any
  ): Promise<PersonalizedContent> {
    try {
      const profile = await this.getUserPersonalizationProfile(userId);
      const userData = await this.getUserData(userId);

      // Analyze base content
      const contentAnalysis = this.analyzeContent(baseContent);
      
      // Apply personalization optimizations
      let optimizedContent = baseContent;
      
      // Adjust tone
      optimizedContent = this.adjustTone(optimizedContent, profile.preferredTone);
      
      // Adjust length
      optimizedContent = this.adjustLength(optimizedContent, profile.preferredLength);
      
      // Add motivational elements
      optimizedContent = this.addMotivationalElements(optimizedContent, profile.motivationalFactors);
      
      // Personalize with user data
      optimizedContent = this.insertPersonalDetails(optimizedContent, userData);

      const personalizationScore = this.calculatePersonalizationScore(
        baseContent,
        optimizedContent,
        profile
      );

      return {
        title: this.generatePersonalizedTitle(context, userData, profile),
        content: optimizedContent,
        tone: profile.preferredTone,
        personalizationScore
      };

    } catch (error) {
      logger.error('Error optimizing content for user:', error);
      return {
        title: 'Reminder',
        content: baseContent,
        tone: 'formal',
        personalizationScore: 0
      };
    }
  }

  private async getUserPersonalizationProfile(userId: string): Promise<UserPersonalizationProfile> {
    try {
      const existingProfile = await prisma.userPersonalizationProfile.findUnique({
        where: { userId }
      });

      if (existingProfile && this.isProfileFresh(existingProfile.lastUpdated)) {
        return this.mapToPersonalizationProfile(existingProfile);
      }

      // Generate new profile
      const profile = await this.generatePersonalizationProfile(userId);
      await this.savePersonalizationProfile(profile);
      
      return profile;

    } catch (error) {
      logger.error('Error getting personalization profile:', error);
      return this.getDefaultPersonalizationProfile(userId);
    }
  }

  private async generatePersonalizationProfile(userId: string): Promise<UserPersonalizationProfile> {
    try {
      const userData = await this.getUserData(userId);
      const behaviorData = await this.getUserBehaviorData(userId);

      return {
        userId,
        preferredTone: this.inferPreferredTone(behaviorData),
        preferredLength: this.inferPreferredLength(behaviorData),
        motivationalFactors: this.identifyMotivationalFactors(userData, behaviorData),
        communicationStyle: this.inferCommunicationStyle(behaviorData.responsePatterns || {}),
        personalDetails: {
          name: userData.name || 'there',
          firstName: userData.firstName || userData.name?.split(' ')[0] || 'there',
          goals: userData.goals || [],
          interests: userData.interests || [],
          timezone: userData.timezone || 'UTC'
        },
        responsePatterns: behaviorData.responsePatterns || {},
        lastUpdated: new Date()
      };

    } catch (error) {
      logger.error('Error generating personalization profile:', error);
      return this.getDefaultPersonalizationProfile(userId);
    }
  }

  private async getUserData(userId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.USER_SERVICE_URL}/api/v1/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      logger.warn('Failed to get user data:', error);
      return { name: 'User' };
    }
  }

  private async getUserBehaviorData(userId: string): Promise<any> {
    try {
      // This would typically call the behavior analysis service
      return {
        responsePatterns: {},
        preferredTimes: [9, 14, 18],
        responsiveness: 0.5
      };
    } catch (error) {
      logger.warn('Failed to get user behavior data:', error);
      return {};
    }
  }

  private async selectTemplate(
    reminderType: string,
    profile: UserPersonalizationProfile,
    context: any
  ): Promise<string> {
    // Template selection logic based on type and user preferences
    const templates = {
      deadline: {
        formal: "Dear {{user.firstName}}, you have an upcoming deadline for {{context.title}} on {{formatDate context.targetDate}}. Please ensure you complete this task on time.",
        casual: "Hey {{user.firstName}}! Just a heads up - {{context.title}} is due {{formatDate context.targetDate}}. Don't forget! 😊",
        urgent: "⚠️ URGENT: {{user.firstName}}, {{context.title}} is due {{formatDate context.targetDate}}. Immediate action required!",
        encouraging: "Hi {{user.firstName}}! You're doing great! Just a friendly reminder that {{context.title}} is coming up on {{formatDate context.targetDate}}. You've got this! 💪",
        gentle: "Hello {{user.firstName}}, I hope you're having a good day. This is a gentle reminder about {{context.title}} which is due {{formatDate context.targetDate}}."
      },
      milestone: {
        formal: "Dear {{user.firstName}}, this is a reminder about your milestone: {{context.title}}.",
        casual: "Hey {{user.firstName}}! Time to check off another milestone: {{context.title}}! 🎯",
        urgent: "{{user.firstName}}, important milestone approaching: {{context.title}}",
        encouraging: "{{user.firstName}}, you're making great progress! Next milestone: {{context.title}} 🌟",
        gentle: "Hi {{user.firstName}}, just a gentle nudge about your milestone: {{context.title}}"
      },
      follow_up: {
        formal: "Dear {{user.firstName}}, this is a follow-up regarding {{context.title}}.",
        casual: "Hey {{user.firstName}}, just checking in about {{context.title}}!",
        urgent: "{{user.firstName}}, urgent follow-up needed for {{context.title}}",
        encouraging: "{{user.firstName}}, you're on the right track! Following up on {{context.title}}",
        gentle: "Hi {{user.firstName}}, hope all is well. Following up on {{context.title}}"
      }
    };

    const typeTemplates = templates[reminderType] || templates.deadline;
    return typeTemplates[profile.preferredTone] || typeTemplates.formal;
  }

  private async personalizeContent(
    template: string,
    userData: any,
    profile: UserPersonalizationProfile,
    context: any
  ): Promise<PersonalizedContent> {
    // Compile template
    let compiledTemplate = this.templateCache.get(template);
    if (!compiledTemplate) {
      compiledTemplate = handlebars.compile(template);
      this.templateCache.set(template, compiledTemplate);
    }

    // Prepare context data
    const contextData = {
      user: userData,
      profile: profile,
      context: context,
      urgency: this.calculateUrgencyLevel(context),
      timeRemaining: this.formatTimeRemaining(context.targetDate)
    };

    const content = compiledTemplate(contextData);
    const personalizationScore = this.calculatePersonalizationScore(template, content, profile);

    return {
      title: this.generatePersonalizedTitle(context, userData, profile),
      content,
      tone: profile.preferredTone,
      personalizationScore
    };
  }

  private generatePersonalizedTitle(context: any, userData: any, profile: UserPersonalizationProfile): string {
    const firstName = userData.firstName || userData.name?.split(' ')[0] || 'there';
    
    switch (profile.preferredTone) {
      case 'casual':
        return `Hey ${firstName}! About ${context.title}`;
      case 'urgent':
        return `⚠️ ${firstName}: ${context.title} - Action Required`;
      case 'encouraging':
        return `${firstName}, you've got this! ${context.title}`;
      case 'gentle':
        return `Gentle reminder for ${firstName}: ${context.title}`;
      default:
        return `Reminder: ${context.title}`;
    }
  }

  private adjustTone(content: string, tone: string): string {
    // Simple tone adjustment - in production would use more sophisticated NLP
    switch (tone) {
      case 'casual':
        return content.replace(/Dear/g, 'Hey').replace(/Please ensure/g, 'Make sure').replace(/\./g, '! 😊');
      case 'urgent':
        return `⚠️ URGENT: ${content.toUpperCase()}`;
      case 'encouraging':
        return content + ' You can do this! 💪';
      case 'gentle':
        return content.replace(/reminder/g, 'gentle reminder').replace(/!/g, '.');
      default:
        return content;
    }
  }

  private adjustLength(content: string, preferredLength: string): string {
    switch (preferredLength) {
      case 'brief':
        // Truncate to first sentence
        return content.split('.')[0] + '.';
      case 'comprehensive':
        // Add more detail (simplified)
        return content + ' If you need any assistance, please don\'t hesitate to reach out.';
      default:
        return content;
    }
  }

  private addMotivationalElements(content: string, motivationalFactors: string[]): string {
    if (motivationalFactors.includes('achievement')) {
      content += ' Completing this will bring you one step closer to your goals!';
    }
    if (motivationalFactors.includes('recognition')) {
      content += ' Your progress is being noticed and appreciated.';
    }
    if (motivationalFactors.includes('growth')) {
      content += ' This is a great opportunity for personal development.';
    }
    return content;
  }

  private insertPersonalDetails(content: string, userData: any): string {
    // Replace placeholders with actual user data
    return content
      .replace(/\{\{user\.name\}\}/g, userData.name || 'User')
      .replace(/\{\{user\.firstName\}\}/g, userData.firstName || userData.name?.split(' ')[0] || 'there');
  }

  private calculatePersonalizationScore(
    originalContent: string,
    personalizedContent: string,
    profile: UserPersonalizationProfile
  ): number {
    let score = 0;

    // Check for personal details
    if (personalizedContent.includes(profile.personalDetails.firstName)) score += 0.3;
    
    // Check for tone matching
    if (this.contentMatchesTone(personalizedContent, profile.preferredTone)) score += 0.3;
    
    // Check for motivational elements
    if (profile.motivationalFactors.some(factor => personalizedContent.toLowerCase().includes(factor))) {
      score += 0.2;
    }
    
    // Check for length preference
    if (this.contentMatchesLength(personalizedContent, profile.preferredLength)) score += 0.2;

    return Math.min(1, score);
  }

  private contentMatchesTone(content: string, tone: string): boolean {
    const toneIndicators = {
      casual: ['hey', 'hi', '😊', '!'],
      formal: ['dear', 'please', 'ensure', 'regards'],
      urgent: ['urgent', '⚠️', 'immediate', 'ASAP'],
      encouraging: ['great', 'you can do', '💪', 'awesome'],
      gentle: ['gentle', 'hope', 'when you have time']
    };

    const indicators = toneIndicators[tone] || [];
    return indicators.some(indicator => content.toLowerCase().includes(indicator.toLowerCase()));
  }

  private contentMatchesLength(content: string, preferredLength: string): boolean {
    const wordCount = content.split(' ').length;
    
    switch (preferredLength) {
      case 'brief':
        return wordCount <= 20;
      case 'detailed':
        return wordCount > 20 && wordCount <= 50;
      case 'comprehensive':
        return wordCount > 50;
      default:
        return true;
    }
  }

  private calculateUrgencyLevel(context: any): string {
    if (!context.targetDate) return 'normal';
    
    const daysUntilTarget = differenceInDays(new Date(context.targetDate), new Date());
    
    if (daysUntilTarget < 0) return 'overdue';
    if (daysUntilTarget <= 1) return 'urgent';
    if (daysUntilTarget <= 3) return 'high';
    if (daysUntilTarget <= 7) return 'medium';
    return 'normal';
  }

  private formatTimeRemaining(targetDate: Date): string {
    const days = differenceInDays(new Date(targetDate), new Date());
    const hours = differenceInHours(new Date(targetDate), new Date()) % 24;
    
    if (days < 0) return 'overdue';
    if (days === 0) return `${hours} hours`;
    if (days === 1) return '1 day';
    return `${days} days`;
  }

  private inferPreferredTone(behaviorData: any): 'formal' | 'casual' | 'urgent' | 'encouraging' | 'gentle' {
    // Simplified inference - in production would use more sophisticated analysis
    if (behaviorData.responsiveness > 0.8) return 'gentle';
    if (behaviorData.procrastinationTendency > 0.7) return 'urgent';
    return 'casual';
  }

  private inferPreferredLength(behaviorData: any): 'brief' | 'detailed' | 'comprehensive' {
    // Simplified inference
    if (behaviorData.attentionSpan < 2) return 'brief';
    if (behaviorData.attentionSpan > 6) return 'comprehensive';
    return 'detailed';
  }

  private identifyMotivationalFactors(userData: any, behaviorData: any): string[] {
    const factors = [];
    
    if (userData.goals && userData.goals.length > 0) factors.push('achievement');
    if (behaviorData.responsiveness > 0.7) factors.push('recognition');
    if (userData.interests && userData.interests.includes('learning')) factors.push('growth');
    
    return factors.length > 0 ? factors : ['achievement'];
  }

  private inferCommunicationStyle(responsePatterns: Record<string, number>): 'direct' | 'supportive' | 'analytical' | 'creative' {
    // Simplified inference based on response patterns
    const directScore = (responsePatterns['urgent_formal'] || 0) + (responsePatterns['deadline_urgent'] || 0);
    const supportiveScore = (responsePatterns['encouraging_casual'] || 0) + (responsePatterns['gentle_formal'] || 0);
    
    if (directScore > supportiveScore) return 'direct';
    if (supportiveScore > 0.6) return 'supportive';
    return 'direct';
  }

  private calculateEffectiveness(responsePatterns: Record<string, number>): Record<string, number> {
    const effectiveness: Record<string, number> = {};
    
    Object.entries(responsePatterns).forEach(([pattern, score]) => {
      const [type, tone] = pattern.split('_');
      if (!effectiveness[tone]) effectiveness[tone] = 0;
      effectiveness[tone] = Math.max(effectiveness[tone], score);
    });

    return effectiveness;
  }

  private generatePersonalizationRecommendations(
    profile: UserPersonalizationProfile,
    effectiveness: Record<string, number>
  ): string[] {
    const recommendations = [];

    const bestTone = Object.entries(effectiveness)
      .sort(([,a], [,b]) => b - a)[0];

    if (bestTone && bestTone[1] > 0.7 && bestTone[0] !== profile.preferredTone) {
      recommendations.push(`Consider switching to ${bestTone[0]} tone for better engagement`);
    }

    if (profile.motivationalFactors.length === 0) {
      recommendations.push('Add motivational elements to improve response rates');
    }

    if (Object.keys(profile.responsePatterns).length < 3) {
      recommendations.push('More interaction data needed for better personalization');
    }

    return recommendations;
  }

  private identifyOptimizationOpportunities(
    profile: UserPersonalizationProfile,
    effectiveness: Record<string, number>
  ): string[] {
    const opportunities = [];

    const avgEffectiveness = Object.values(effectiveness).reduce((sum, val) => sum + val, 0) / Object.values(effectiveness).length;

    if (avgEffectiveness < 0.5) {
      opportunities.push('Overall effectiveness is low - consider A/B testing different approaches');
    }

    if (profile.preferredLength === 'comprehensive' && effectiveness[profile.preferredTone] < 0.6) {
      opportunities.push('Try shorter, more concise messages');
    }

    if (profile.motivationalFactors.length === 1) {
      opportunities.push('Experiment with different motivational approaches');
    }

    return opportunities;
  }

  private getFallbackContent(reminderType: string, context: any): PersonalizedContent {
    const fallbackTemplates = {
      deadline: 'You have an upcoming deadline for {{title}} on {{date}}.',
      milestone: 'Reminder about your milestone: {{title}}.',
      task: 'Don\'t forget about: {{title}}.',
      follow_up: 'Following up on: {{title}}.'
    };

    const template = fallbackTemplates[reminderType] || fallbackTemplates.deadline;
    const content = template
      .replace('{{title}}', context.title || 'your task')
      .replace('{{date}}', context.targetDate ? format(new Date(context.targetDate), 'PPP') : 'soon');

    return {
      title: 'Reminder',
      content,
      tone: 'formal',
      personalizationScore: 0
    };
  }

  private getDefaultPersonalizationProfile(userId: string): UserPersonalizationProfile {
    return {
      userId,
      preferredTone: 'casual',
      preferredLength: 'detailed',
      motivationalFactors: ['achievement'],
      communicationStyle: 'supportive',
      personalDetails: {
        name: 'User',
        firstName: 'there'
      },
      responsePatterns: {},
      lastUpdated: new Date()
    };
  }

  private async savePersonalizationProfile(profile: UserPersonalizationProfile): Promise<void> {
    try {
      await prisma.userPersonalizationProfile.upsert({
        where: { userId: profile.userId },
        update: {
          preferredTone: profile.preferredTone,
          preferredLength: profile.preferredLength,
          motivationalFactors: profile.motivationalFactors,
          communicationStyle: profile.communicationStyle,
          personalDetails: profile.personalDetails,
          responsePatterns: profile.responsePatterns,
          lastUpdated: profile.lastUpdated
        },
        create: {
          userId: profile.userId,
          preferredTone: profile.preferredTone,
          preferredLength: profile.preferredLength,
          motivationalFactors: profile.motivationalFactors,
          communicationStyle: profile.communicationStyle,
          personalDetails: profile.personalDetails,
          responsePatterns: profile.responsePatterns,
          lastUpdated: profile.lastUpdated
        }
      });
    } catch (error) {
      logger.error('Error saving personalization profile:', error);
    }
  }

  private mapToPersonalizationProfile(dbProfile: any): UserPersonalizationProfile {
    return {
      userId: dbProfile.userId,
      preferredTone: dbProfile.preferredTone,
      preferredLength: dbProfile.preferredLength,
      motivationalFactors: dbProfile.motivationalFactors,
      communicationStyle: dbProfile.communicationStyle,
      personalDetails: dbProfile.personalDetails,
      responsePatterns: dbProfile.responsePatterns,
      lastUpdated: dbProfile.lastUpdated
    };
  }

  private isProfileFresh(lastUpdated: Date): boolean {
    const daysSinceUpdate = differenceInDays(new Date(), lastUpdated);
    return daysSinceUpdate < 14; // Profile is fresh for 2 weeks
  }

  private registerHandlebarsHelpers(): void {
    handlebars.registerHelper('formatDate', (date: Date, formatStr?: string) => {
      if (!date) return '';
      return format(new Date(date), formatStr || 'PPP');
    });

    handlebars.registerHelper('timeUntil', (date: Date) => {
      if (!date) return '';
      return this.formatTimeRemaining(new Date(date));
    });

    handlebars.registerHelper('capitalize', (str: string) => {
      return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    });
  }
}