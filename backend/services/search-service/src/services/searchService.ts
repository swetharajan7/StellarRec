import { Client } from '@elastic/elasticsearch';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export interface SearchQuery {
  query: string;
  filters?: {
    type?: string[];
    category?: string[];
    tags?: string[];
    author?: string[];
    dateRange?: {
      from?: Date;
      to?: Date;
    };
    sizeRange?: {
      min?: number;
      max?: number;
    };
    university?: string[];
    program?: string[];
    location?: string[];
    difficulty?: string[];
    deadline?: {
      from?: Date;
      to?: Date;
    };
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  }[];
  highlight?: boolean;
  facets?: string[];
  limit?: number;
  offset?: number;
  userId?: string;
  sessionId?: string;
}

export interface SearchResult {
  total: number;
  documents: Array<{
    id: string;
    type: string;
    title: string;
    description?: string;
    content?: string;
    score: number;
    highlights?: Record<string, string[]>;
    metadata: any;
    url?: string;
    imageUrl?: string;
    tags: string[];
    category: string;
    author?: string;
    createdAt: Date;
    updatedAt?: Date;
  }>;
  facets?: Record<string, any>;
  suggestions?: string[];
  aggregations?: Record<string, any>;
  processingTime: number;
  searchId: string;
}

export interface SearchSuggestion {
  text: string;
  score: number;
  type: 'completion' | 'correction' | 'related';
  metadata?: any;
}

export class SearchService {
  private client: Client;
  private indices: {
    documents: string;
    universities: string;
    programs: string;
    scholarships: string;
    users: string;
    applications: string;
  };

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_AUTH ? {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
      } : undefined,
      requestTimeout: 30000,
      maxRetries: 3
    });

    this.indices = {
      documents: process.env.DOCUMENTS_INDEX || 'stellarrec-documents',
      universities: process.env.UNIVERSITIES_INDEX || 'stellarrec-universities',
      programs: process.env.PROGRAMS_INDEX || 'stellarrec-programs',
      scholarships: process.env.SCHOLARSHIPS_INDEX || 'stellarrec-scholarships',
      users: process.env.USERS_INDEX || 'stellarrec-users',
      applications: process.env.APPLICATIONS_INDEX || 'stellarrec-applications'
    };
  }

  async search(searchQuery: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();
    const searchId = uuidv4();

    try {
      logger.info(`Executing search: ${searchId}`, { query: searchQuery.query });

      // Determine which indices to search
      const indicesToSearch = this.getIndicesToSearch(searchQuery);

      // Build Elasticsearch query
      const esQuery = this.buildElasticsearchQuery(searchQuery);

      // Execute search
      const response = await this.client.search({
        index: indicesToSearch.join(','),
        body: esQuery
      });

      const processingTime = Date.now() - startTime;

      // Process and format results
      const result = this.formatSearchResults(response.body, searchQuery, searchId, processingTime);

      // Log search for analytics
      this.logSearch(searchQuery, result, searchId, processingTime);

      logger.info(`Search completed: ${searchId}`, {
        total: result.total,
        processingTime: `${processingTime}ms`
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error(`Search failed: ${searchId}`, error);

      return {
        total: 0,
        documents: [],
        processingTime,
        searchId,
        suggestions: await this.getSearchSuggestions(searchQuery.query)
      };
    }
  }

  private getIndicesToSearch(searchQuery: SearchQuery): string[] {
    // If specific types are requested, search only those indices
    if (searchQuery.filters?.type && searchQuery.filters.type.length > 0) {
      const typeToIndex: Record<string, string> = {
        'document': this.indices.documents,
        'university': this.indices.universities,
        'program': this.indices.programs,
        'scholarship': this.indices.scholarships,
        'user': this.indices.users,
        'application': this.indices.applications
      };

      return searchQuery.filters.type
        .map(type => typeToIndex[type])
        .filter(Boolean);
    }

    // Default: search all indices
    return Object.values(this.indices);
  }

  private buildElasticsearchQuery(searchQuery: SearchQuery): any {
    const query: any = {
      query: {
        bool: {
          must: [],
          filter: [],
          should: [],
          must_not: []
        }
      },
      sort: [],
      from: searchQuery.offset || 0,
      size: searchQuery.limit || 20,
      track_total_hits: true
    };

    // Main search query
    if (searchQuery.query && searchQuery.query.trim()) {
      query.query.bool.must.push({
        multi_match: {
          query: searchQuery.query,
          fields: [
            'title^3',
            'description^2',
            'content^1',
            'tags^2',
            'category^1.5',
            'author^1.2',
            'keywords^2',
            'name^3',
            'summary^2'
          ],
          type: 'best_fields',
          fuzziness: 'AUTO',
          operator: 'or',
          minimum_should_match: '75%'
        }
      });

      // Add phrase matching boost
      query.query.bool.should.push({
        multi_match: {
          query: searchQuery.query,
          fields: ['title^5', 'description^3'],
          type: 'phrase',
          boost: 2
        }
      });
    } else {
      query.query.bool.must.push({ match_all: {} });
    }

    // Apply filters
    this.applyFilters(query, searchQuery.filters);

    // Apply sorting
    this.applySorting(query, searchQuery.sort);

    // Add highlighting
    if (searchQuery.highlight) {
      query.highlight = {
        fields: {
          'title': {
            fragment_size: 150,
            number_of_fragments: 1
          },
          'description': {
            fragment_size: 200,
            number_of_fragments: 2
          },
          'content': {
            fragment_size: 150,
            number_of_fragments: 3
          }
        },
        pre_tags: ['<mark>'],
        post_tags: ['</mark>']
      };
    }

    // Add aggregations for facets
    if (searchQuery.facets && searchQuery.facets.length > 0) {
      query.aggs = this.buildAggregations(searchQuery.facets);
    }

    return query;
  }

  private applyFilters(query: any, filters?: SearchQuery['filters']): void {
    if (!filters) return;

    // Type filter
    if (filters.type && filters.type.length > 0) {
      query.query.bool.filter.push({
        terms: { type: filters.type }
      });
    }

    // Category filter
    if (filters.category && filters.category.length > 0) {
      query.query.bool.filter.push({
        terms: { category: filters.category }
      });
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      query.query.bool.filter.push({
        terms: { tags: filters.tags }
      });
    }

    // Author filter
    if (filters.author && filters.author.length > 0) {
      query.query.bool.filter.push({
        terms: { 'author.keyword': filters.author }
      });
    }

    // University filter
    if (filters.university && filters.university.length > 0) {
      query.query.bool.filter.push({
        terms: { 'university.keyword': filters.university }
      });
    }

    // Program filter
    if (filters.program && filters.program.length > 0) {
      query.query.bool.filter.push({
        terms: { 'program.keyword': filters.program }
      });
    }

    // Location filter
    if (filters.location && filters.location.length > 0) {
      query.query.bool.filter.push({
        terms: { 'location.keyword': filters.location }
      });
    }

    // Difficulty filter
    if (filters.difficulty && filters.difficulty.length > 0) {
      query.query.bool.filter.push({
        terms: { difficulty: filters.difficulty }
      });
    }

    // Date range filter
    if (filters.dateRange) {
      const dateFilter: any = { range: { createdAt: {} } };
      if (filters.dateRange.from) {
        dateFilter.range.createdAt.gte = filters.dateRange.from;
      }
      if (filters.dateRange.to) {
        dateFilter.range.createdAt.lte = filters.dateRange.to;
      }
      query.query.bool.filter.push(dateFilter);
    }

    // Deadline range filter
    if (filters.deadline) {
      const deadlineFilter: any = { range: { deadline: {} } };
      if (filters.deadline.from) {
        deadlineFilter.range.deadline.gte = filters.deadline.from;
      }
      if (filters.deadline.to) {
        deadlineFilter.range.deadline.lte = filters.deadline.to;
      }
      query.query.bool.filter.push(deadlineFilter);
    }

    // Size range filter
    if (filters.sizeRange) {
      const sizeFilter: any = { range: { size: {} } };
      if (filters.sizeRange.min) {
        sizeFilter.range.size.gte = filters.sizeRange.min;
      }
      if (filters.sizeRange.max) {
        sizeFilter.range.size.lte = filters.sizeRange.max;
      }
      query.query.bool.filter.push(sizeFilter);
    }
  }

  private applySorting(query: any, sort?: SearchQuery['sort']): void {
    if (sort && sort.length > 0) {
      query.sort = sort.map(s => ({
        [s.field]: { order: s.order }
      }));
    } else {
      // Default sorting: relevance score, then date
      query.sort = [
        { _score: { order: 'desc' } },
        { createdAt: { order: 'desc' } }
      ];
    }
  }

  private buildAggregations(facets: string[]): any {
    const aggs: any = {};

    for (const facet of facets) {
      switch (facet) {
        case 'type':
          aggs.types = {
            terms: { field: 'type', size: 20 }
          };
          break;
        case 'category':
          aggs.categories = {
            terms: { field: 'category.keyword', size: 50 }
          };
          break;
        case 'tags':
          aggs.tags = {
            terms: { field: 'tags', size: 100 }
          };
          break;
        case 'author':
          aggs.authors = {
            terms: { field: 'author.keyword', size: 50 }
          };
          break;
        case 'university':
          aggs.universities = {
            terms: { field: 'university.keyword', size: 100 }
          };
          break;
        case 'program':
          aggs.programs = {
            terms: { field: 'program.keyword', size: 100 }
          };
          break;
        case 'location':
          aggs.locations = {
            terms: { field: 'location.keyword', size: 100 }
          };
          break;
        case 'difficulty':
          aggs.difficulties = {
            terms: { field: 'difficulty', size: 10 }
          };
          break;
        case 'dateRange':
          aggs.dateRanges = {
            date_range: {
              field: 'createdAt',
              ranges: [
                { key: 'last_week', from: 'now-7d/d' },
                { key: 'last_month', from: 'now-1M/M' },
                { key: 'last_year', from: 'now-1y/y' }
              ]
            }
          };
          break;
      }
    }

    return aggs;
  }

  private formatSearchResults(
    response: any,
    searchQuery: SearchQuery,
    searchId: string,
    processingTime: number
  ): SearchResult {
    const documents = response.hits.hits.map((hit: any) => ({
      id: hit._id,
      type: hit._source.type || 'document',
      title: hit._source.title || hit._source.name || 'Untitled',
      description: hit._source.description || hit._source.summary,
      content: hit._source.content,
      score: hit._score,
      highlights: hit.highlight,
      metadata: hit._source.metadata || {},
      url: hit._source.url,
      imageUrl: hit._source.imageUrl,
      tags: hit._source.tags || [],
      category: hit._source.category || 'uncategorized',
      author: hit._source.author,
      createdAt: new Date(hit._source.createdAt),
      updatedAt: hit._source.updatedAt ? new Date(hit._source.updatedAt) : undefined
    }));

    const result: SearchResult = {
      total: response.hits.total.value,
      documents,
      processingTime,
      searchId
    };

    // Add facets if requested
    if (response.aggregations) {
      result.facets = this.formatAggregations(response.aggregations);
    }

    // Add search suggestions for low-result queries
    if (result.total < 5 && searchQuery.query) {
      result.suggestions = this.generateQuerySuggestions(searchQuery.query, response);
    }

    return result;
  }

  private formatAggregations(aggregations: any): Record<string, any> {
    const facets: Record<string, any> = {};

    for (const [key, agg] of Object.entries(aggregations)) {
      if (agg && typeof agg === 'object' && 'buckets' in agg) {
        facets[key] = (agg as any).buckets.map((bucket: any) => ({
          key: bucket.key,
          count: bucket.doc_count,
          selected: false
        }));
      }
    }

    return facets;
  }

  private generateQuerySuggestions(query: string, response: any): string[] {
    const suggestions: string[] = [];

    // Add spell correction suggestions
    if (response.suggest && response.suggest.text) {
      response.suggest.text.forEach((suggestion: any) => {
        suggestion.options.forEach((option: any) => {
          if (option.score > 0.5) {
            suggestions.push(option.text);
          }
        });
      });
    }

    // Add related term suggestions based on partial matches
    const terms = query.toLowerCase().split(' ');
    const relatedTerms = [
      'university', 'college', 'program', 'degree', 'scholarship',
      'application', 'admission', 'requirement', 'deadline', 'essay'
    ];

    for (const term of terms) {
      for (const related of relatedTerms) {
        if (related.includes(term) || term.includes(related)) {
          const suggestion = query.replace(term, related);
          if (!suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
        }
      }
    }

    return suggestions.slice(0, 5);
  }

  async getSearchSuggestions(query: string, limit: number = 10): Promise<SearchSuggestion[]> {
    try {
      const response = await this.client.search({
        index: Object.values(this.indices).join(','),
        body: {
          suggest: {
            title_suggest: {
              prefix: query,
              completion: {
                field: 'title_suggest',
                size: limit,
                skip_duplicates: true
              }
            },
            content_suggest: {
              prefix: query,
              completion: {
                field: 'content_suggest',
                size: limit / 2,
                skip_duplicates: true
              }
            }
          },
          size: 0
        }
      });

      const suggestions: SearchSuggestion[] = [];

      // Process title suggestions
      if (response.body.suggest.title_suggest) {
        response.body.suggest.title_suggest.forEach((suggest: any) => {
          suggest.options.forEach((option: any) => {
            suggestions.push({
              text: option.text,
              score: option._score,
              type: 'completion',
              metadata: option._source
            });
          });
        });
      }

      // Process content suggestions
      if (response.body.suggest.content_suggest) {
        response.body.suggest.content_suggest.forEach((suggest: any) => {
          suggest.options.forEach((option: any) => {
            suggestions.push({
              text: option.text,
              score: option._score,
              type: 'completion',
              metadata: option._source
            });
          });
        });
      }

      // Sort by score and remove duplicates
      return suggestions
        .sort((a, b) => b.score - a.score)
        .filter((suggestion, index, self) => 
          index === self.findIndex(s => s.text === suggestion.text)
        )
        .slice(0, limit);

    } catch (error) {
      logger.error('Error getting search suggestions:', error);
      return [];
    }
  }

  async getPopularSearches(limit: number = 10): Promise<string[]> {
    try {
      // This would typically come from analytics data
      // For now, return some common search terms
      return [
        'computer science programs',
        'ivy league universities',
        'engineering scholarships',
        'MBA programs',
        'medical school requirements',
        'study abroad programs',
        'graduate school applications',
        'undergraduate admissions',
        'research opportunities',
        'financial aid'
      ].slice(0, limit);
    } catch (error) {
      logger.error('Error getting popular searches:', error);
      return [];
    }
  }

  async getTrendingSearches(limit: number = 10): Promise<string[]> {
    try {
      // This would analyze recent search patterns
      // For now, return some trending terms
      return [
        'AI and machine learning programs',
        'remote learning options',
        'sustainability programs',
        'data science degrees',
        'cybersecurity courses',
        'digital marketing programs',
        'healthcare administration',
        'renewable energy studies',
        'biotechnology research',
        'fintech programs'
      ].slice(0, limit);
    } catch (error) {
      logger.error('Error getting trending searches:', error);
      return [];
    }
  }

  private async logSearch(
    searchQuery: SearchQuery,
    result: SearchResult,
    searchId: string,
    processingTime: number
  ): Promise<void> {
    try {
      // This would typically log to a separate analytics service
      logger.info('Search logged', {
        searchId,
        query: searchQuery.query,
        filters: searchQuery.filters,
        total: result.total,
        processingTime,
        userId: searchQuery.userId,
        sessionId: searchQuery.sessionId
      });
    } catch (error) {
      logger.error('Error logging search:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.client.close();
      logger.info('Search service cleanup completed');
    } catch (error) {
      logger.error('Search service cleanup failed:', error);
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      const stats = await this.client.indices.stats({
        index: Object.values(this.indices).join(',')
      });

      return {
        indices: this.indices,
        stats: stats.body._all.total
      };
    } catch (error) {
      logger.error('Error getting index stats:', error);
      throw error;
    }
  }
}