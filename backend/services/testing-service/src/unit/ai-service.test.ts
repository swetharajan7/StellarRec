import axios from 'axios';
import { UniversityMatcher } from '../../ai-service/src/services/university_matcher';
import { EssayAnalyzer } from '../../ai-service/src/services/essay_analyzer';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AI Service Unit Tests', () => {
  describe('University Matcher', () => {
    let universityMatcher: UniversityMatcher;

    beforeEach(() => {
      universityMatcher = new UniversityMatcher();
      jest.clearAllMocks();
    });

    it('should match universities based on student profile', async () => {
      const studentProfile = {
        gpa: 3.8,
        satScore: 1450,
        interests: ['Computer Science', 'AI'],
        location: 'California',
        budget: 50000
      };

      const mockUniversities = [
        {
          id: 'stanford',
          name: 'Stanford University',
          location: 'California',
          averageGPA: 3.9,
          averageSAT: 1500,
          tuition: 55000,
          programs: ['Computer Science', 'AI'],
          matchScore: 0.92
        },
        {
          id: 'berkeley',
          name: 'UC Berkeley',
          location: 'California',
          averageGPA: 3.7,
          averageSAT: 1400,
          tuition: 45000,
          programs: ['Computer Science'],
          matchScore: 0.88
        }
      ];

      const result = await universityMatcher.findMatches(studentProfile);

      expect(result).toHaveLength(2);
      expect(result[0].matchScore).toBeGreaterThan(result[1].matchScore);
      expect(result[0].name).toBe('Stanford University');
    });

    it('should calculate match score correctly', () => {
      const student = {
        gpa: 3.5,
        satScore: 1300,
        interests: ['Engineering']
      };

      const university = {
        averageGPA: 3.6,
        averageSAT: 1350,
        programs: ['Engineering', 'Computer Science']
      };

      const score = universityMatcher.calculateMatchScore(student, university);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should filter universities by budget', async () => {
      const studentProfile = {
        gpa: 3.5,
        budget: 30000
      };

      const mockUniversities = [
        { name: 'Expensive University', tuition: 60000 },
        { name: 'Affordable University', tuition: 25000 }
      ];

      const result = await universityMatcher.findMatches(studentProfile);

      const affordableUniversities = result.filter(u => u.tuition <= studentProfile.budget);
      expect(affordableUniversities).toHaveLength(1);
      expect(affordableUniversities[0].name).toBe('Affordable University');
    });

    it('should handle missing student data gracefully', async () => {
      const incompleteProfile = {
        gpa: 3.5
        // Missing other fields
      };

      const result = await universityMatcher.findMatches(incompleteProfile);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should provide match explanations', async () => {
      const studentProfile = {
        gpa: 3.8,
        satScore: 1450,
        interests: ['Computer Science']
      };

      const result = await universityMatcher.findMatches(studentProfile);

      expect(result[0]).toHaveProperty('explanation');
      expect(result[0].explanation).toContain('GPA');
      expect(result[0].explanation).toContain('SAT');
    });
  });

  describe('Essay Analyzer', () => {
    let essayAnalyzer: EssayAnalyzer;

    beforeEach(() => {
      essayAnalyzer = new EssayAnalyzer();
      jest.clearAllMocks();
    });

    it('should analyze essay grammar and style', async () => {
      const essay = `
        This is a sample essay about my passion for computer science.
        I have always been fascinated by technology and its potential to solve real-world problems.
        Through my coursework and projects, I have developed strong programming skills.
      `;

      mockedAxios.post.mockResolvedValue({
        data: {
          grammar_score: 85,
          style_score: 78,
          clarity_score: 82,
          suggestions: [
            {
              type: 'grammar',
              message: 'Consider using more varied sentence structures',
              position: { start: 50, end: 100 }
            }
          ]
        }
      });

      const result = await essayAnalyzer.analyzeEssay(essay);

      expect(result).toHaveProperty('grammarScore');
      expect(result).toHaveProperty('styleScore');
      expect(result).toHaveProperty('clarityScore');
      expect(result).toHaveProperty('suggestions');
      expect(result.grammarScore).toBe(85);
      expect(result.suggestions).toHaveLength(1);
    });

    it('should detect plagiarism', async () => {
      const essay = 'This is a potentially plagiarized essay content.';

      mockedAxios.post.mockResolvedValue({
        data: {
          plagiarism_score: 15,
          sources: [
            {
              url: 'https://example.com/source1',
              similarity: 12
            }
          ]
        }
      });

      const result = await essayAnalyzer.checkPlagiarism(essay);

      expect(result).toHaveProperty('plagiarismScore');
      expect(result).toHaveProperty('sources');
      expect(result.plagiarismScore).toBe(15);
      expect(result.sources).toHaveLength(1);
    });

    it('should calculate readability score', () => {
      const essay = `
        This is a simple sentence. This is another simple sentence.
        Here is a more complex sentence with multiple clauses and ideas.
      `;

      const readabilityScore = essayAnalyzer.calculateReadability(essay);

      expect(readabilityScore).toBeGreaterThan(0);
      expect(readabilityScore).toBeLessThanOrEqual(100);
    });

    it('should provide writing suggestions', async () => {
      const essay = 'This essay needs improvement in various areas.';

      const suggestions = await essayAnalyzer.generateSuggestions(essay);

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('type');
      expect(suggestions[0]).toHaveProperty('message');
    });

    it('should handle empty essay input', async () => {
      const essay = '';

      await expect(essayAnalyzer.analyzeEssay(essay))
        .rejects.toThrow('Essay content cannot be empty');
    });

    it('should handle API errors gracefully', async () => {
      const essay = 'Test essay content';

      mockedAxios.post.mockRejectedValue(new Error('API Error'));

      await expect(essayAnalyzer.analyzeEssay(essay))
        .rejects.toThrow('Failed to analyze essay');
    });

    it('should calculate word count and statistics', () => {
      const essay = `
        This is a test essay with multiple sentences.
        It contains various words and punctuation marks.
        The purpose is to test word counting functionality.
      `;

      const stats = essayAnalyzer.calculateStatistics(essay);

      expect(stats).toHaveProperty('wordCount');
      expect(stats).toHaveProperty('sentenceCount');
      expect(stats).toHaveProperty('paragraphCount');
      expect(stats.wordCount).toBeGreaterThan(0);
      expect(stats.sentenceCount).toBeGreaterThan(0);
    });

    it('should identify essay structure', () => {
      const essay = `
        Introduction paragraph with thesis statement.
        
        First body paragraph with supporting evidence.
        
        Second body paragraph with more evidence.
        
        Conclusion paragraph that summarizes main points.
      `;

      const structure = essayAnalyzer.analyzeStructure(essay);

      expect(structure).toHaveProperty('hasIntroduction');
      expect(structure).toHaveProperty('hasConclusion');
      expect(structure).toHaveProperty('bodyParagraphs');
      expect(structure.hasIntroduction).toBe(true);
      expect(structure.hasConclusion).toBe(true);
    });
  });

  describe('Model Manager', () => {
    it('should load and initialize models', async () => {
      // Test model loading and initialization
      const modelManager = require('../../ai-service/src/services/model_manager');
      
      const result = await modelManager.initializeModels();
      
      expect(result).toBe(true);
    });

    it('should handle model prediction requests', async () => {
      const modelManager = require('../../ai-service/src/services/model_manager');
      
      const inputData = {
        features: [3.5, 1300, 0.8, 0.6]
      };

      const prediction = await modelManager.predict('admission_model', inputData);

      expect(prediction).toHaveProperty('probability');
      expect(prediction).toHaveProperty('confidence');
      expect(prediction.probability).toBeGreaterThanOrEqual(0);
      expect(prediction.probability).toBeLessThanOrEqual(1);
    });

    it('should validate input data format', async () => {
      const modelManager = require('../../ai-service/src/services/model_manager');
      
      const invalidInput = {
        // Missing required features
      };

      await expect(modelManager.predict('admission_model', invalidInput))
        .rejects.toThrow('Invalid input format');
    });
  });

  describe('Caching', () => {
    it('should cache university match results', async () => {
      const universityMatcher = new UniversityMatcher();
      const studentProfile = {
        gpa: 3.8,
        satScore: 1450
      };

      // First call
      const result1 = await universityMatcher.findMatches(studentProfile);
      
      // Second call should use cache
      const result2 = await universityMatcher.findMatches(studentProfile);

      expect(result1).toEqual(result2);
    });

    it('should invalidate cache when profile changes', async () => {
      const universityMatcher = new UniversityMatcher();
      const studentProfile1 = { gpa: 3.8 };
      const studentProfile2 = { gpa: 3.9 };

      const result1 = await universityMatcher.findMatches(studentProfile1);
      const result2 = await universityMatcher.findMatches(studentProfile2);

      expect(result1).not.toEqual(result2);
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const universityMatcher = new UniversityMatcher();
      
      mockedAxios.get.mockRejectedValue(new Error('TIMEOUT'));

      await expect(universityMatcher.findMatches({}))
        .rejects.toThrow('Service temporarily unavailable');
    });

    it('should handle malformed API responses', async () => {
      const essayAnalyzer = new EssayAnalyzer();
      
      mockedAxios.post.mockResolvedValue({
        data: null // Malformed response
      });

      await expect(essayAnalyzer.analyzeEssay('test essay'))
        .rejects.toThrow('Invalid API response');
    });
  });
});