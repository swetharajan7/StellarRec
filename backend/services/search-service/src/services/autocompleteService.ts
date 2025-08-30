import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';

export interface AutocompleteResult {
  suggestions: Array<{
    text: string;
    type: 'query' | 'university' | 'program' | 'scholarship' | 'category';
    score: number;
    metadata?: any;
    highlight?: string;
  }>;
  processingTime: number;
}

export interface AutocompleteOptions {
  limit?: number;
  types?: string[];
  fuzzy?: boolean;
  includePopular?: boolean;
  userId?: string;
}

export class AutocompleteService {
  private client: Client;
  private indices: Record<string, string>;
  private popularQueries: string[] = [];
  private lastPopularUpdate: Date = new Date(0);

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_AUTH ? {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
      } : undefined
    });

    this.indices = {
      documents: process.env.DOCUMENTS_INDEX || 'stellarrec-documents',
      universities: process.env.UNIVERSITIES_INDEX || 'stellarrec-universities',
      programs: process.env.PROGRAMS_INDEX || 'stellarrec-programs',
      scholarships: process.env.SCHOLARSHIPS_INDEX || 'stellarrec-scholarships',
      users: process.env.USERS_INDEX || 'stellarrec-users',
      applications: process.env.APPLICATIONS_INDEX || 'stellarrec-applications'
    };

    // Initialize popular queries
    this.updatePopularQueries();
  }

  async getSuggestions(query: string, options: AutocompleteOptions = {}): Promise<AutocompleteResult> {
    const startTime = Date.now();

    try {
      const {
        limit = 10,
        types = ['query', 'university', 'program', 'scholarship'],
        fuzzy = true,
        includePopular = true
      } = options;

      const suggestions: AutocompleteResult['suggestions'] = [];

      // Get completion suggestions from Elasticsearch
      const esSuggestions = await this.getElasticsearchSuggestions(query, types, limit, fuzzy);
      suggestions.push(...esSuggestions);

      // Add popular query suggestions if requested
      if (includePopular && query.length >= 2) {
        const popularSuggestions = this.getPopularQuerySuggestions(query, Math.min(3, limit));
        suggestions.push(...popularSuggestions);
      }

      // Add spell correction suggestions
      if (suggestions.length < limit / 2) {
        const spellSuggestions = await this.getSpellingSuggestions(query, limit - suggestions.length);
        suggestions.push(...spellSuggestions);
      }

      // Sort by score and remove duplicates
      const uniqueSuggestions = this.deduplicateAndSort(suggestions, limit);

      const processingTime = Date.now() - startTime;

      logger.info(`Autocomplete completed for "${query}": ${uniqueSuggestions.length} suggestions in ${processingTime}ms`);

      return {
        suggestions: uniqueSuggestions,
        processingTime
      };

    } catch (error) {
      logger.error('Autocomplete failed:', error);
      return {
        suggestions: [],
        processingTime: Date.now() - startTime
      };
    }
  }

  private async getElasticsearchSuggestions(
    query: string,
    types: string[],
    limit: number,
    fuzzy: boolean
  ): Promise<AutocompleteResult['suggestions']> {
    const suggestions: AutocompleteResult['suggestions'] = [];

    try {
      // Build suggest query for each type
      const suggestBody: any = {};

      if (types.includes('university')) {
        suggestBody.university_suggest = {
          prefix: query,
          completion: {
            field: 'name.suggest',
            size: Math.ceil(limit / types.length),
            skip_duplicates: true,
            fuzzy: fuzzy ? { fuzziness: 'AUTO' } : undefined
          }
        };
      }

      if (types.includes('program')) {
        suggestBody.program_suggest = {
          prefix: query,
          completion: {
            field: 'name.suggest',
            size: Math.ceil(limit / types.length),
            skip_duplicates: true,
            fuzzy: fuzzy ? { fuzziness: 'AUTO' } : undefined
          }
        };
      }

      if (types.includes('scholarship')) {
        suggestBody.scholarship_suggest = {
          prefix: query,
          completion: {
            field: 'name.suggest',
            size: Math.ceil(limit / types.length),
            skip_duplicates: true,
            fuzzy: fuzzy ? { fuzziness: 'AUTO' } : undefined
          }
        };
      }

      // Execute suggest queries
      const responses = await Promise.all([
        types.includes('university') ? this.client.search({
          index: this.indices.universities,
          body: { suggest: { university_suggest: suggestBody.university_suggest }, size: 0 }
        }) : null,
        types.includes('program') ? this.client.search({
          index: this.indices.programs,
          body: { suggest: { program_suggest: suggestBody.program_suggest }, size: 0 }
        }) : null,
        types.includes('scholarship') ? this.client.search({
          index: this.indices.scholarships,
          body: { suggest: { scholarship_suggest: suggestBody.scholarship_suggest }, size: 0 }
        }) : null
      ]);

      // Process university suggestions
      if (responses[0] && responses[0].body.suggest.university_suggest) {
        responses[0].body.suggest.university_suggest.forEach((suggest: any) => {
          suggest.options.forEach((option: any) => {
            suggestions.push({
              text: option.text,
              type: 'university',
              score: option._score,
              metadata: option._source,
              highlight: this.highlightMatch(option.text, query)
            });
          });
        });
      }

      // Process program suggestions
      if (responses[1] && responses[1].body.suggest.program_suggest) {
        responses[1].body.suggest.program_suggest.forEach((suggest: any) => {
          suggest.options.forEach((option: any) => {
            suggestions.push({
              text: option.text,
              type: 'program',
              score: option._score,
              metadata: option._source,
              highlight: this.highlightMatch(option.text, query)
            });
          });
        });
      }

      // Process scholarship suggestions
      if (responses[2] && responses[2].body.suggest.scholarship_suggest) {
        responses[2].body.suggest.scholarship_suggest.forEach((suggest: any) => {
          suggest.options.forEach((option: any) => {
            suggestions.push({
              text: option.text,
              type: 'scholarship',
              score: option._score,
              metadata: option._source,
              highlight: this.highlightMatch(option.text, query)
            });
          });
        });
      }

    } catch (error) {
      logger.error('Elasticsearch suggestions failed:', error);
    }

    return suggestions;
  }

  private getPopularQuerySuggestions(query: string, limit: number): AutocompleteResult['suggestions'] {
    const suggestions: AutocompleteResult['suggestions'] = [];
    const queryLower = query.toLowerCase();

    for (const popularQuery of this.popularQueries) {
      if (suggestions.length >= limit) break;

      if (popularQuery.toLowerCase().includes(queryLower)) {
        suggestions.push({
          text: popularQuery,
          type: 'query',
          score: 0.8, // High score for popular queries
          highlight: this.highlightMatch(popularQuery, query)
        });
      }
    }

    return suggestions;
  }

  private async getSpellingSuggestions(query: string, limit: number): Promise<AutocompleteResult['suggestions']> {
    const suggestions: AutocompleteResult['suggestions'] = [];

    try {
      const response = await this.client.search({
        index: Object.values(this.indices).join(','),
        body: {
          suggest: {
            spell_suggest: {
              text: query,
              term: {
                field: 'title',
                size: limit,
                suggest_mode: 'popular',
                min_word_length: 3
              }
            }
          },
          size: 0
        }
      });

      if (response.body.suggest.spell_suggest) {
        response.body.suggest.spell_suggest.forEach((suggest: any) => {
          suggest.options.forEach((option: any) => {
            if (option.score > 0.5) { // Only include high-confidence corrections
              suggestions.push({
                text: option.text,
                type: 'query',
                score: option.score * 0.6, // Lower score for spell corrections
                highlight: this.highlightMatch(option.text, query)
              });
            }
          });
        });
      }

    } catch (error) {
      logger.error('Spelling suggestions failed:', error);
    }

    return suggestions;
  }

  private highlightMatch(text: string, query: string): string {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    const index = textLower.indexOf(queryLower);

    if (index === -1) return text;

    return text.substring(0, index) +
           '<mark>' + text.substring(index, index + query.length) + '</mark>' +
           text.substring(index + query.length);
  }

  private deduplicateAndSort(
    suggestions: AutocompleteResult['suggestions'],
    limit: number
  ): AutocompleteResult['suggestions'] {
    // Remove duplicates based on text
    const seen = new Set<string>();
    const unique = suggestions.filter(suggestion => {
      const key = suggestion.text.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    // Sort by score (descending) and then by type priority
    const typePriority: Record<string, number> = {
      'university': 4,
      'program': 3,
      'scholarship': 2,
      'query': 1,
      'category': 0
    };

    unique.sort((a, b) => {
      // First sort by score
      if (Math.abs(a.score - b.score) > 0.1) {
        return b.score - a.score;
      }
      // Then by type priority
      return (typePriority[b.type] || 0) - (typePriority[a.type] || 0);
    });

    return unique.slice(0, limit);
  }

  async getCategorySuggestions(query: string, limit: number = 10): Promise<string[]> {
    try {
      const categories = [
        'Computer Science', 'Engineering', 'Business', 'Medicine', 'Law',
        'Arts', 'Sciences', 'Education', 'Psychology', 'Economics',
        'Mathematics', 'Physics', 'Chemistry', 'Biology', 'History',
        'Literature', 'Philosophy', 'Political Science', 'Sociology', 'Anthropology'
      ];

      const queryLower = query.toLowerCase();
      return categories
        .filter(category => category.toLowerCase().includes(queryLower))
        .slice(0, limit);

    } catch (error) {
      logger.error('Category suggestions failed:', error);
      return [];
    }
  }

  async getLocationSuggestions(query: string, limit: number = 10): Promise<string[]> {
    try {
      const locations = [
        'United States', 'California', 'New York', 'Texas', 'Florida',
        'Massachusetts', 'Pennsylvania', 'Illinois', 'Ohio', 'Michigan',
        'United Kingdom', 'Canada', 'Australia', 'Germany', 'France',
        'Boston', 'San Francisco', 'Los Angeles', 'Chicago', 'Philadelphia'
      ];

      const queryLower = query.toLowerCase();
      return locations
        .filter(location => location.toLowerCase().includes(queryLower))
        .slice(0, limit);

    } catch (error) {
      logger.error('Location suggestions failed:', error);
      return [];
    }
  }

  private async updatePopularQueries(): Promise<void> {
    try {
      // Update popular queries every hour
      const now = new Date();
      if (now.getTime() - this.lastPopularUpdate.getTime() < 60 * 60 * 1000) {
        return;
      }

      // This would typically come from analytics service
      // For now, use static popular queries
      this.popularQueries = [
        'computer science programs',
        'harvard university',
        'stanford university',
        'mit programs',
        'engineering scholarships',
        'medical school requirements',
        'mba programs',
        'ivy league universities',
        'study abroad programs',
        'graduate school applications',
        'undergraduate admissions',
        'financial aid',
        'research opportunities',
        'online degrees',
        'community college transfer'
      ];

      this.lastPopularUpdate = now;
      logger.info('Popular queries updated');

    } catch (error) {
      logger.error('Failed to update popular queries:', error);
    }
  }

  async getRecentSearches(userId: string, limit: number = 10): Promise<string[]> {
    try {
      // This would typically come from user's search history
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Failed to get recent searches:', error);
      return [];
    }
  }

  async getSuggestionsWithContext(
    query: string,
    context: {
      userType?: 'student' | 'recommender';
      interests?: string[];
      location?: string;
      academicLevel?: string;
    },
    options: AutocompleteOptions = {}
  ): Promise<AutocompleteResult> {
    try {
      // Get base suggestions
      const baseSuggestions = await this.getSuggestions(query, options);

      // Enhance suggestions with context
      const contextualSuggestions = baseSuggestions.suggestions.map(suggestion => {
        let score = suggestion.score;

        // Boost suggestions based on user interests
        if (context.interests && suggestion.metadata) {
          const suggestionText = suggestion.text.toLowerCase();
          for (const interest of context.interests) {
            if (suggestionText.includes(interest.toLowerCase())) {
              score += 0.2;
            }
          }
        }

        // Boost suggestions based on user type
        if (context.userType === 'student') {
          if (suggestion.type === 'program' || suggestion.type === 'university') {
            score += 0.1;
          }
        } else if (context.userType === 'recommender') {
          if (suggestion.type === 'university') {
            score += 0.1;
          }
        }

        // Boost suggestions based on location
        if (context.location && suggestion.metadata?.location) {
          if (suggestion.metadata.location.toLowerCase().includes(context.location.toLowerCase())) {
            score += 0.15;
          }
        }

        return {
          ...suggestion,
          score: Math.min(score, 1.0) // Cap score at 1.0
        };
      });

      // Re-sort with updated scores
      contextualSuggestions.sort((a, b) => b.score - a.score);

      return {
        suggestions: contextualSuggestions,
        processingTime: baseSuggestions.processingTime
      };

    } catch (error) {
      logger.error('Contextual suggestions failed:', error);
      return this.getSuggestions(query, options);
    }
  }
}