import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';

export interface FacetConfig {
  field: string;
  type: 'terms' | 'range' | 'date_range' | 'histogram';
  size?: number;
  ranges?: Array<{ key: string; from?: any; to?: any }>;
  interval?: string;
  displayName: string;
  order?: 'count' | 'key';
}

export interface FacetResult {
  field: string;
  displayName: string;
  type: string;
  buckets: Array<{
    key: string;
    count: number;
    selected: boolean;
    displayName?: string;
  }>;
  totalCount: number;
}

export interface FacetQuery {
  query?: string;
  filters?: Record<string, string[]>;
  facets: string[];
}

export class FacetService {
  private client: Client;
  private indices: Record<string, string>;
  private facetConfigs: Record<string, FacetConfig>;

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

    this.facetConfigs = this.initializeFacetConfigs();
  }

  private initializeFacetConfigs(): Record<string, FacetConfig> {
    return {
      type: {
        field: 'type',
        type: 'terms',
        size: 20,
        displayName: 'Content Type',
        order: 'count'
      },
      category: {
        field: 'category.keyword',
        type: 'terms',
        size: 50,
        displayName: 'Category',
        order: 'count'
      },
      tags: {
        field: 'tags',
        type: 'terms',
        size: 100,
        displayName: 'Tags',
        order: 'count'
      },
      author: {
        field: 'author.keyword',
        type: 'terms',
        size: 50,
        displayName: 'Author',
        order: 'count'
      },
      university: {
        field: 'university.keyword',
        type: 'terms',
        size: 100,
        displayName: 'University',
        order: 'count'
      },
      location: {
        field: 'location.keyword',
        type: 'terms',
        size: 100,
        displayName: 'Location',
        order: 'count'
      },
      program: {
        field: 'program.keyword',
        type: 'terms',
        size: 100,
        displayName: 'Program',
        order: 'count'
      },
      difficulty: {
        field: 'difficulty',
        type: 'terms',
        size: 10,
        displayName: 'Difficulty',
        order: 'key'
      },
      tuition: {
        field: 'tuition',
        type: 'range',
        displayName: 'Tuition',
        ranges: [
          { key: 'free', to: 0 },
          { key: 'low', from: 0, to: 20000 },
          { key: 'medium', from: 20000, to: 50000 },
          { key: 'high', from: 50000, to: 100000 },
          { key: 'premium', from: 100000 }
        ]
      },
      acceptanceRate: {
        field: 'acceptanceRate',
        type: 'range',
        displayName: 'Acceptance Rate',
        ranges: [
          { key: 'very_selective', to: 10 },
          { key: 'selective', from: 10, to: 25 },
          { key: 'moderate', from: 25, to: 50 },
          { key: 'accessible', from: 50, to: 75 },
          { key: 'open', from: 75 }
        ]
      },
      dateRange: {
        field: 'createdAt',
        type: 'date_range',
        displayName: 'Date Created',
        ranges: [
          { key: 'last_week', from: 'now-7d/d' },
          { key: 'last_month', from: 'now-1M/M' },
          { key: 'last_3_months', from: 'now-3M/M' },
          { key: 'last_year', from: 'now-1y/y' },
          { key: 'older', to: 'now-1y/y' }
        ]
      },
      deadline: {
        field: 'deadline',
        type: 'date_range',
        displayName: 'Application Deadline',
        ranges: [
          { key: 'next_month', from: 'now', to: 'now+1M/M' },
          { key: 'next_3_months', from: 'now', to: 'now+3M/M' },
          { key: 'next_6_months', from: 'now', to: 'now+6M/M' },
          { key: 'next_year', from: 'now', to: 'now+1y/y' },
          { key: 'later', from: 'now+1y/y' }
        ]
      },
      ranking: {
        field: 'ranking',
        type: 'range',
        displayName: 'University Ranking',
        ranges: [
          { key: 'top_10', to: 10 },
          { key: 'top_25', from: 10, to: 25 },
          { key: 'top_50', from: 25, to: 50 },
          { key: 'top_100', from: 50, to: 100 },
          { key: 'other', from: 100 }
        ]
      },
      studentCount: {
        field: 'studentCount',
        type: 'range',
        displayName: 'Student Population',
        ranges: [
          { key: 'small', to: 5000 },
          { key: 'medium', from: 5000, to: 15000 },
          { key: 'large', from: 15000, to: 30000 },
          { key: 'very_large', from: 30000 }
        ]
      }
    };
  }

  async getFacets(facetQuery: FacetQuery): Promise<FacetResult[]> {
    try {
      logger.info('Getting facets', { facets: facetQuery.facets });

      // Build Elasticsearch aggregation query
      const aggs = this.buildAggregations(facetQuery.facets);
      const query = this.buildQuery(facetQuery);

      // Execute search with aggregations
      const response = await this.client.search({
        index: Object.values(this.indices).join(','),
        body: {
          query,
          aggs,
          size: 0 // We only want aggregations, not documents
        }
      });

      // Process aggregation results
      const facetResults = this.processAggregations(
        response.body.aggregations,
        facetQuery.facets,
        facetQuery.filters || {}
      );

      logger.info(`Facets processed: ${facetResults.length} facets`);
      return facetResults;

    } catch (error) {
      logger.error('Failed to get facets:', error);
      return [];
    }
  }

  private buildQuery(facetQuery: FacetQuery): any {
    const query: any = {
      bool: {
        must: [],
        filter: []
      }
    };

    // Add main search query if provided
    if (facetQuery.query && facetQuery.query.trim()) {
      query.bool.must.push({
        multi_match: {
          query: facetQuery.query,
          fields: [
            'title^3',
            'description^2',
            'content^1',
            'tags^2',
            'category^1.5',
            'name^3'
          ],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    } else {
      query.bool.must.push({ match_all: {} });
    }

    // Add filters
    if (facetQuery.filters) {
      for (const [field, values] of Object.entries(facetQuery.filters)) {
        if (values && values.length > 0) {
          const config = this.facetConfigs[field];
          if (config) {
            if (config.type === 'terms') {
              query.bool.filter.push({
                terms: { [config.field]: values }
              });
            } else if (config.type === 'range' && config.ranges) {
              const rangeFilters = values.map(value => {
                const range = config.ranges!.find(r => r.key === value);
                if (range) {
                  const rangeQuery: any = { range: { [config.field]: {} } };
                  if (range.from !== undefined) rangeQuery.range[config.field].gte = range.from;
                  if (range.to !== undefined) rangeQuery.range[config.field].lt = range.to;
                  return rangeQuery;
                }
                return null;
              }).filter(Boolean);

              if (rangeFilters.length > 0) {
                query.bool.filter.push({
                  bool: { should: rangeFilters }
                });
              }
            }
          }
        }
      }
    }

    return query;
  }

  private buildAggregations(facetNames: string[]): any {
    const aggs: any = {};

    for (const facetName of facetNames) {
      const config = this.facetConfigs[facetName];
      if (!config) {
        logger.warn(`Unknown facet: ${facetName}`);
        continue;
      }

      switch (config.type) {
        case 'terms':
          aggs[facetName] = {
            terms: {
              field: config.field,
              size: config.size || 50,
              order: config.order === 'key' ? { _key: 'asc' } : { _count: 'desc' }
            }
          };
          break;

        case 'range':
          if (config.ranges) {
            aggs[facetName] = {
              range: {
                field: config.field,
                ranges: config.ranges.map(range => ({
                  key: range.key,
                  ...(range.from !== undefined && { from: range.from }),
                  ...(range.to !== undefined && { to: range.to })
                }))
              }
            };
          }
          break;

        case 'date_range':
          if (config.ranges) {
            aggs[facetName] = {
              date_range: {
                field: config.field,
                ranges: config.ranges.map(range => ({
                  key: range.key,
                  ...(range.from !== undefined && { from: range.from }),
                  ...(range.to !== undefined && { to: range.to })
                }))
              }
            };
          }
          break;

        case 'histogram':
          aggs[facetName] = {
            histogram: {
              field: config.field,
              interval: config.interval || 1
            }
          };
          break;
      }
    }

    return aggs;
  }

  private processAggregations(
    aggregations: any,
    facetNames: string[],
    selectedFilters: Record<string, string[]>
  ): FacetResult[] {
    const results: FacetResult[] = [];

    for (const facetName of facetNames) {
      const config = this.facetConfigs[facetName];
      const agg = aggregations[facetName];

      if (!config || !agg) continue;

      const buckets = this.processBuckets(agg.buckets || [], config, selectedFilters[facetName] || []);
      const totalCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

      results.push({
        field: facetName,
        displayName: config.displayName,
        type: config.type,
        buckets,
        totalCount
      });
    }

    return results;
  }

  private processBuckets(
    buckets: any[],
    config: FacetConfig,
    selectedValues: string[]
  ): FacetResult['buckets'] {
    return buckets
      .filter(bucket => bucket.doc_count > 0) // Only include buckets with results
      .map(bucket => ({
        key: bucket.key,
        count: bucket.doc_count,
        selected: selectedValues.includes(bucket.key),
        displayName: this.getDisplayName(bucket.key, config)
      }))
      .sort((a, b) => {
        // Sort selected items first, then by count or key based on config
        if (a.selected && !b.selected) return -1;
        if (!a.selected && b.selected) return 1;
        
        if (config.order === 'key') {
          return a.key.localeCompare(b.key);
        } else {
          return b.count - a.count;
        }
      });
  }

  private getDisplayName(key: string, config: FacetConfig): string {
    // Custom display names for certain values
    const displayNames: Record<string, Record<string, string>> = {
      difficulty: {
        'easy': 'Easy',
        'moderate': 'Moderate',
        'hard': 'Hard',
        'very_hard': 'Very Hard'
      },
      tuition: {
        'free': 'Free',
        'low': 'Under $20K',
        'medium': '$20K - $50K',
        'high': '$50K - $100K',
        'premium': 'Over $100K'
      },
      acceptanceRate: {
        'very_selective': 'Very Selective (<10%)',
        'selective': 'Selective (10-25%)',
        'moderate': 'Moderate (25-50%)',
        'accessible': 'Accessible (50-75%)',
        'open': 'Open (>75%)'
      },
      dateRange: {
        'last_week': 'Last Week',
        'last_month': 'Last Month',
        'last_3_months': 'Last 3 Months',
        'last_year': 'Last Year',
        'older': 'Older'
      },
      deadline: {
        'next_month': 'Next Month',
        'next_3_months': 'Next 3 Months',
        'next_6_months': 'Next 6 Months',
        'next_year': 'Next Year',
        'later': 'Later'
      },
      ranking: {
        'top_10': 'Top 10',
        'top_25': 'Top 25',
        'top_50': 'Top 50',
        'top_100': 'Top 100',
        'other': 'Other'
      },
      studentCount: {
        'small': 'Small (<5K)',
        'medium': 'Medium (5K-15K)',
        'large': 'Large (15K-30K)',
        'very_large': 'Very Large (>30K)'
      }
    };

    const fieldDisplayNames = displayNames[config.field] || displayNames[config.field.replace('.keyword', '')];
    return fieldDisplayNames?.[key] || this.formatKey(key);
  }

  private formatKey(key: string): string {
    // Convert snake_case and kebab-case to Title Case
    return key
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  async getFacetValues(facetName: string, query?: string, limit: number = 50): Promise<string[]> {
    try {
      const config = this.facetConfigs[facetName];
      if (!config || config.type !== 'terms') {
        return [];
      }

      const searchQuery: any = {
        bool: {
          must: query ? [{
            wildcard: {
              [config.field]: `*${query.toLowerCase()}*`
            }
          }] : [{ match_all: {} }]
        }
      };

      const response = await this.client.search({
        index: Object.values(this.indices).join(','),
        body: {
          query: searchQuery,
          aggs: {
            values: {
              terms: {
                field: config.field,
                size: limit,
                order: { _key: 'asc' }
              }
            }
          },
          size: 0
        }
      });

      if (response.body.aggregations?.values?.buckets) {
        return response.body.aggregations.values.buckets.map((bucket: any) => bucket.key);
      }

      return [];

    } catch (error) {
      logger.error(`Failed to get facet values for ${facetName}:`, error);
      return [];
    }
  }

  getFacetConfig(facetName: string): FacetConfig | undefined {
    return this.facetConfigs[facetName];
  }

  getAllFacetConfigs(): Record<string, FacetConfig> {
    return { ...this.facetConfigs };
  }

  addFacetConfig(name: string, config: FacetConfig): void {
    this.facetConfigs[name] = config;
    logger.info(`Added facet config: ${name}`);
  }

  removeFacetConfig(name: string): boolean {
    if (this.facetConfigs[name]) {
      delete this.facetConfigs[name];
      logger.info(`Removed facet config: ${name}`);
      return true;
    }
    return false;
  }
}