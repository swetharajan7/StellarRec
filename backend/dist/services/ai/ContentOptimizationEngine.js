"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentOptimizationEngine = void 0;
const logger_1 = require("../logger");
class ContentOptimizationEngine {
    constructor() {
        this.logger = new logger_1.Logger('ContentOptimizationEngine');
    }
    async analyzeContent(content) {
        try {
            const analysis = {
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
        }
        catch (error) {
            this.logger.error('Failed to analyze content:', error);
            throw error;
        }
    }
    async optimizeForUniversity(content, university, studentProfile, contentAnalysis) {
        try {
            this.logger.info(`Optimizing content for ${university.name}`);
            const preferences = await this.getUniversityPreferences(university);
            let optimizedContent = content;
            const keywordOptimization = [];
            const culturalAdaptations = [];
            const toneAdjustments = [];
            const structureImprovements = [];
            const keywordResults = this.optimizeKeywords(optimizedContent, preferences, studentProfile);
            optimizedContent = keywordResults.content;
            keywordOptimization.push(...keywordResults.changes);
            const lengthResults = this.optimizeLength(optimizedContent, preferences);
            optimizedContent = lengthResults.content;
            const lengthOptimization = lengthResults.changed;
            const toneResults = this.adjustTone(optimizedContent, preferences, university);
            optimizedContent = toneResults.content;
            toneAdjustments.push(...toneResults.changes);
            const culturalResults = this.applyCulturalAdaptations(optimizedContent, university);
            optimizedContent = culturalResults.content;
            culturalAdaptations.push(...culturalResults.changes);
            const structureResults = this.improveStructure(optimizedContent, preferences);
            optimizedContent = structureResults.content;
            structureImprovements.push(...structureResults.changes);
            const reasoning = this.generateOptimizationReasoning(content, optimizedContent, university, preferences);
            return {
                content: optimizedContent,
                reasoning,
                keywordOptimization,
                culturalAdaptations,
                lengthOptimization,
                toneAdjustments,
                structureImprovements
            };
        }
        catch (error) {
            this.logger.error(`Failed to optimize content for ${university.name}:`, error);
            throw error;
        }
    }
    async generateImprovements(content, targets, studentProfile) {
        try {
            const improvements = [];
            const analysis = await this.analyzeContent(content);
            if (analysis.wordCount < 200) {
                improvements.push({
                    type: 'length',
                    description: 'Content is too short. Consider adding more specific examples and details.',
                    impact: 'high',
                    implementation: 'Add 2-3 specific examples of student achievements and expand on their significance.'
                });
            }
            else if (analysis.wordCount > 1000) {
                improvements.push({
                    type: 'length',
                    description: 'Content may be too long for some universities. Consider creating a more concise version.',
                    impact: 'medium',
                    implementation: 'Focus on the most impactful achievements and remove redundant information.'
                });
            }
            const missingKeywords = this.identifyMissingKeywords(content, studentProfile);
            if (missingKeywords.length > 0) {
                improvements.push({
                    type: 'keyword',
                    description: `Consider including these relevant keywords: ${missingKeywords.join(', ')}`,
                    impact: 'medium',
                    implementation: 'Naturally incorporate these terms when describing student achievements and qualities.'
                });
            }
            if (analysis.paragraphCount < 3) {
                improvements.push({
                    type: 'structure',
                    description: 'Consider organizing content into clear paragraphs for better readability.',
                    impact: 'medium',
                    implementation: 'Structure as: Introduction, Academic achievements, Personal qualities, Conclusion.'
                });
            }
            if (analysis.tone === 'informal') {
                improvements.push({
                    type: 'tone',
                    description: 'Consider using a more formal, academic tone for university applications.',
                    impact: 'high',
                    implementation: 'Use professional language and avoid contractions or casual expressions.'
                });
            }
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
        }
        catch (error) {
            this.logger.error('Failed to generate improvements:', error);
            throw error;
        }
    }
    async generateCulturalAdaptations(content, targets) {
        try {
            const adaptations = [];
            for (const university of targets) {
                const countryAdaptations = this.getCulturalAdaptationsForCountry(content, university.country);
                adaptations.push(...countryAdaptations);
            }
            const uniqueAdaptations = adaptations.filter((adaptation, index, self) => index === self.findIndex(a => a.targetCountry === adaptation.targetCountry &&
                a.adaptationType === adaptation.adaptationType));
            return uniqueAdaptations;
        }
        catch (error) {
            this.logger.error('Failed to generate cultural adaptations:', error);
            throw error;
        }
    }
    async calculateQualityScore(originalContent, optimizedVersions) {
        try {
            const originalAnalysis = await this.analyzeContent(originalContent);
            let baseScore = 0;
            baseScore += Math.min(originalAnalysis.readabilityScore, 100) * 0.3;
            baseScore += (originalAnalysis.wordCount >= 200 && originalAnalysis.wordCount <= 800) ? 25 : 10;
            baseScore += originalAnalysis.tone === 'academic' ? 20 : 10;
            baseScore += originalAnalysis.sentiment === 'positive' ? 15 : 5;
            const optimizationCount = Object.keys(optimizedVersions).length;
            const optimizationBonus = Math.min(optimizationCount * 2, 20);
            const totalScore = Math.min(baseScore + optimizationBonus, 100);
            return Math.round(totalScore);
        }
        catch (error) {
            this.logger.error('Failed to calculate quality score:', error);
            return 50;
        }
    }
    countWords(content) {
        return content.trim().split(/\s+/).length;
    }
    countSentences(content) {
        return content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    }
    countParagraphs(content) {
        return content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
    }
    calculateReadabilityScore(content) {
        const words = this.countWords(content);
        const sentences = this.countSentences(content);
        const syllables = this.countSyllables(content);
        if (sentences === 0 || words === 0)
            return 0;
        const avgSentenceLength = words / sentences;
        const avgSyllablesPerWord = syllables / words;
        const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
        return Math.max(0, Math.min(100, score));
    }
    countSyllables(content) {
        const words = content.toLowerCase().match(/\b\w+\b/g) || [];
        let syllableCount = 0;
        for (const word of words) {
            const vowels = word.match(/[aeiouy]+/g);
            syllableCount += vowels ? vowels.length : 1;
        }
        return syllableCount;
    }
    analyzeKeywordDensity(content) {
        const words = content.toLowerCase().match(/\b\w+\b/g) || [];
        const totalWords = words.length;
        const wordCount = {};
        for (const word of words) {
            if (word.length > 3) {
                wordCount[word] = (wordCount[word] || 0) + 1;
            }
        }
        const density = {};
        for (const [word, count] of Object.entries(wordCount)) {
            density[word] = (count / totalWords) * 100;
        }
        return Object.fromEntries(Object.entries(density)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20));
    }
    analyzeTone(content) {
        const formalIndicators = ['furthermore', 'moreover', 'consequently', 'therefore', 'thus'];
        const informalIndicators = ['really', 'pretty', 'quite', 'kind of', 'sort of'];
        const academicIndicators = ['research', 'analysis', 'methodology', 'hypothesis', 'theoretical'];
        const personalIndicators = ['I feel', 'I believe', 'personally', 'in my opinion'];
        const formalCount = this.countIndicators(content, formalIndicators);
        const informalCount = this.countIndicators(content, informalIndicators);
        const academicCount = this.countIndicators(content, academicIndicators);
        const personalCount = this.countIndicators(content, personalIndicators);
        const max = Math.max(formalCount, informalCount, academicCount, personalCount);
        if (max === academicCount)
            return 'academic';
        if (max === formalCount)
            return 'formal';
        if (max === personalCount)
            return 'personal';
        return 'informal';
    }
    analyzeSentiment(content) {
        const positiveWords = ['excellent', 'outstanding', 'exceptional', 'remarkable', 'impressive', 'strong', 'talented'];
        const negativeWords = ['weak', 'poor', 'lacking', 'insufficient', 'disappointing', 'concerning'];
        const positiveCount = this.countIndicators(content, positiveWords);
        const negativeCount = this.countIndicators(content, negativeWords);
        if (positiveCount > negativeCount * 2)
            return 'positive';
        if (negativeCount > positiveCount)
            return 'negative';
        return 'neutral';
    }
    countIndicators(content, indicators) {
        const lowerContent = content.toLowerCase();
        return indicators.reduce((count, indicator) => {
            const regex = new RegExp(`\\b${indicator}\\b`, 'g');
            const matches = lowerContent.match(regex);
            return count + (matches ? matches.length : 0);
        }, 0);
    }
    identifyStrengths(content) {
        const strengths = [];
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
    identifyWeaknesses(content) {
        const weaknesses = [];
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
    async getUniversityPreferences(university) {
        const basePreferences = {
            preferredLength: { min: 300, max: 800 },
            preferredTone: 'academic',
            keyKeywords: ['academic', 'research', 'leadership', 'achievement'],
            culturalConsiderations: [],
            structurePreferences: ['introduction', 'academic_achievements', 'personal_qualities', 'conclusion'],
            commonMistakes: ['too_generic', 'lack_of_specifics', 'informal_tone']
        };
        if (university.country === 'GB') {
            basePreferences.keyKeywords.push('intellectual_curiosity', 'independent_learning', 'critical_thinking');
            basePreferences.culturalConsiderations.push('british_academic_culture', 'tutorial_system');
        }
        else if (university.country === 'FR') {
            basePreferences.keyKeywords.push('analytical_thinking', 'cultural_awareness', 'international_perspective');
            basePreferences.culturalConsiderations.push('french_academic_rigor', 'grandes_ecoles_culture');
        }
        else if (university.country === 'AU') {
            basePreferences.keyKeywords.push('practical_experience', 'global_perspective', 'innovation');
            basePreferences.culturalConsiderations.push('australian_work_culture', 'multicultural_environment');
        }
        if (university.name.includes('Research University')) {
            basePreferences.keyKeywords.push('research_experience', 'scholarly_work', 'innovation');
        }
        else if (university.name.includes('Liberal Arts')) {
            basePreferences.keyKeywords.push('well_rounded', 'diverse_interests', 'critical_thinking');
        }
        else if (university.name.includes('Technology') || university.name.includes('Engineering')) {
            basePreferences.keyKeywords.push('technical_skills', 'problem_solving', 'innovation', 'STEM');
        }
        return basePreferences;
    }
    optimizeKeywords(content, preferences, studentProfile) {
        let optimizedContent = content;
        const changes = [];
        for (const keyword of preferences.keyKeywords) {
            if (!content.toLowerCase().includes(keyword.replace('_', ' '))) {
                const keywordPhrase = this.generateKeywordPhrase(keyword, studentProfile);
                if (keywordPhrase) {
                    optimizedContent = this.insertKeywordNaturally(optimizedContent, keywordPhrase);
                    changes.push(`Added "${keyword.replace('_', ' ')}" emphasis`);
                }
            }
        }
        return { content: optimizedContent, changes };
    }
    optimizeLength(content, preferences) {
        const wordCount = this.countWords(content);
        let optimizedContent = content;
        let changed = false;
        if (wordCount > preferences.preferredLength.max) {
            const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const targetSentences = Math.floor(sentences.length * (preferences.preferredLength.max / wordCount));
            optimizedContent = sentences.slice(0, targetSentences).join('. ') + '.';
            changed = true;
        }
        else if (wordCount < preferences.preferredLength.min) {
            optimizedContent += '\n\n[Consider expanding with specific examples and additional details about the student\'s achievements and potential.]';
            changed = true;
        }
        return { content: optimizedContent, changed };
    }
    adjustTone(content, preferences, university) {
        let optimizedContent = content;
        const changes = [];
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
    applyCulturalAdaptations(content, university) {
        let optimizedContent = content;
        const changes = [];
        switch (university.country) {
            case 'GB':
                if (!content.toLowerCase().includes('intellectual') && !content.toLowerCase().includes('curiosity')) {
                    optimizedContent += ' The student demonstrates strong intellectual curiosity and independent learning capabilities.';
                    changes.push('Added emphasis on intellectual curiosity (UK preference)');
                }
                break;
            case 'FR':
                if (!content.toLowerCase().includes('analytical') && !content.toLowerCase().includes('critical')) {
                    optimizedContent += ' The student shows excellent analytical and critical thinking skills.';
                    changes.push('Added emphasis on analytical thinking (French preference)');
                }
                break;
            case 'AU':
                if (!content.toLowerCase().includes('practical') && !content.toLowerCase().includes('global')) {
                    optimizedContent += ' The student brings practical experience and a global perspective to their studies.';
                    changes.push('Added emphasis on practical experience (Australian preference)');
                }
                break;
            case 'DE':
                if (!content.toLowerCase().includes('thorough') && !content.toLowerCase().includes('systematic')) {
                    optimizedContent += ' The student demonstrates thorough and systematic approach to learning.';
                    changes.push('Added emphasis on thoroughness (German preference)');
                }
                break;
        }
        return { content: optimizedContent, changes };
    }
    improveStructure(content, preferences) {
        let optimizedContent = content;
        const changes = [];
        const paragraphs = content.split(/\n\s*\n/);
        if (paragraphs.length === 1 && this.countWords(content) > 200) {
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
    generateOptimizationReasoning(originalContent, optimizedContent, university, preferences) {
        const reasons = [];
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
    identifyMissingKeywords(content, studentProfile) {
        const relevantKeywords = this.generateRelevantKeywords(studentProfile);
        const missingKeywords = [];
        for (const keyword of relevantKeywords) {
            if (!content.toLowerCase().includes(keyword.toLowerCase())) {
                missingKeywords.push(keyword);
            }
        }
        return missingKeywords.slice(0, 5);
    }
    generateRelevantKeywords(studentProfile) {
        const keywords = [];
        const majorKeywords = this.getMajorKeywords(studentProfile.academic.major);
        keywords.push(...majorKeywords);
        if (studentProfile.background.achievements.some(a => a.type === 'academic')) {
            keywords.push('academic excellence', 'scholarly achievement');
        }
        if (studentProfile.background.achievements.some(a => a.type === 'leadership')) {
            keywords.push('leadership', 'team management');
        }
        if (studentProfile.background.extracurriculars.some(e => e.type === 'community_service')) {
            keywords.push('community service', 'social responsibility');
        }
        if (studentProfile.goals.researchInterests.length > 0) {
            keywords.push('research experience', 'scholarly inquiry');
        }
        return [...new Set(keywords)];
    }
    getMajorKeywords(major) {
        const majorKeywordMap = {
            'Computer Science': ['programming', 'algorithms', 'software development', 'technical skills'],
            'Engineering': ['problem solving', 'technical analysis', 'innovation', 'design thinking'],
            'Business': ['leadership', 'strategic thinking', 'entrepreneurship', 'team collaboration'],
            'Biology': ['scientific research', 'analytical skills', 'laboratory experience', 'scientific method'],
            'Psychology': ['research methodology', 'analytical thinking', 'human behavior', 'statistical analysis'],
            'Mathematics': ['analytical reasoning', 'problem solving', 'logical thinking', 'quantitative skills']
        };
        return majorKeywordMap[major] || ['academic excellence', 'critical thinking'];
    }
    generateKeywordPhrase(keyword, studentProfile) {
        const keywordPhrases = {
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
    insertKeywordNaturally(content, phrase) {
        const sentences = content.split(/[.!?]+/);
        if (sentences.length > 2) {
            const insertIndex = Math.floor(sentences.length / 2);
            sentences.splice(insertIndex, 0, ` ${phrase}`);
            return sentences.join('.').replace(/\.\s*\./g, '.');
        }
        return content + ` ${phrase}.`;
    }
    getCulturalAdaptationsForCountry(content, country) {
        const adaptations = [];
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
exports.ContentOptimizationEngine = ContentOptimizationEngine;
//# sourceMappingURL=ContentOptimizationEngine.js.map