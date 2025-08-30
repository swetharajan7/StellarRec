import { Client } from '@elastic/elasticsearch';
import { logger } from '../utils/logger';

export interface IndexDocument {
  id: string;
  type: string;
  title: string;
  description?: string;
  content?: string;
  tags: string[];
  category: string;
  author?: string;
  metadata: any;
  url?: string;
  imageUrl?: string;
  createdAt: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export class IndexingService {
  private client: Client;
  private indices: Record<string, string>;

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
  }

  async initializeIndices(): Promise<void> {
    for (const [type, indexName] of Object.entries(this.indices)) {
      try {
        const exists = await this.client.indices.exists({ index: indexName });
        
        if (!exists) {
          await this.createIndex(type, indexName);
          logger.info(`Created index: ${indexName}`);
        } else {
          logger.info(`Index already exists: ${indexName}`);
        }
      } catch (error) {
        logger.error(`Failed to initialize index ${indexName}:`, error);
      }
    }
  }

  private async createIndex(type: string, indexName: string): Promise<void> {
    const settings = {
      number_of_shards: 1,
      number_of_replicas: 0,
      analysis: {
        analyzer: {
          custom_text_analyzer: {
            type: 'custom',
            tokenizer: 'standard',
            filter: [
              'lowercase',
              'stop',
              'stemmer',
              'word_delimiter_graph',
              'synonym_filter'
            ]
          },
          autocomplete_analyzer: {
            type: 'custom',
            tokenizer: 'keyword',
            filter: ['lowercase', 'edge_ngram_filter']
          },
          search_analyzer: {
            type: 'custom',
            tokenizer: 'keyword',
            filter: ['lowercase']
          }
        },
        filter: {
          edge_ngram_filter: {
            type: 'edge_ngram',
            min_gram: 2,
            max_gram: 20
          },
          synonym_filter: {
            type: 'synonym',
            synonyms: [
              'university,college,school',
              'program,course,degree',
              'scholarship,grant,funding',
              'application,admission,enrollment'
            ]
          }
        }
      }
    };

    const mappings = this.getMappingsForType(type);

    await this.client.indices.create({
      index: indexName,
      body: {
        settings,
        mappings
      }
    });
  }

  private getMappingsForType(type: string): any {
    const baseMapping = {
      properties: {
        id: { type: 'keyword' },
        type: { type: 'keyword' },
        title: {
          type: 'text',
          analyzer: 'custom_text_analyzer',
          fields: {
            keyword: { type: 'keyword' },
            suggest: {
              type: 'completion',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'search_analyzer'
            }
          }
        },
        description: {
          type: 'text',
          analyzer: 'custom_text_analyzer'
        },
        content: {
          type: 'text',
          analyzer: 'custom_text_analyzer',
          fields: {
            suggest: {
              type: 'completion',
              analyzer: 'autocomplete_analyzer',
              search_analyzer: 'search_analyzer'
            }
          }
        },
        tags: { type: 'keyword' },
        category: {
          type: 'text',
          analyzer: 'custom_text_analyzer',
          fields: {
            keyword: { type: 'keyword' }
          }
        },
        author: {
          type: 'text',
          analyzer: 'custom_text_analyzer',
          fields: {
            keyword: { type: 'keyword' }
          }
        },
        url: { type: 'keyword' },
        imageUrl: { type: 'keyword' },
        createdAt: { type: 'date' },
        updatedAt: { type: 'date' },
        metadata: {
          type: 'object',
          enabled: true
        }
      }
    };

    // Add type-specific mappings
    switch (type) {
      case 'universities':
        return {
          ...baseMapping,
          properties: {
            ...baseMapping.properties,
            name: {
              type: 'text',
              analyzer: 'custom_text_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            location: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            ranking: { type: 'integer' },
            acceptanceRate: { type: 'float' },
            tuition: { type: 'float' },
            studentCount: { type: 'integer' },
            establishedYear: { type: 'integer' },
            website: { type: 'keyword' },
            coordinates: { type: 'geo_point' }
          }
        };

      case 'programs':
        return {
          ...baseMapping,
          properties: {
            ...baseMapping.properties,
            name: {
              type: 'text',
              analyzer: 'custom_text_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            university: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            degree: { type: 'keyword' },
            duration: { type: 'keyword' },
            tuition: { type: 'float' },
            requirements: {
              type: 'text',
              analyzer: 'custom_text_analyzer'
            },
            deadline: { type: 'date' },
            difficulty: { type: 'keyword' },
            field: { type: 'keyword' }
          }
        };

      case 'scholarships':
        return {
          ...baseMapping,
          properties: {
            ...baseMapping.properties,
            name: {
              type: 'text',
              analyzer: 'custom_text_analyzer',
              fields: {
                keyword: { type: 'keyword' },
                suggest: { type: 'completion' }
              }
            },
            amount: { type: 'float' },
            deadline: { type: 'date' },
            eligibility: {
              type: 'text',
              analyzer: 'custom_text_analyzer'
            },
            provider: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            renewable: { type: 'boolean' },
            field: { type: 'keyword' },
            level: { type: 'keyword' }
          }
        };

      case 'applications':
        return {
          ...baseMapping,
          properties: {
            ...baseMapping.properties,
            userId: { type: 'keyword' },
            universityId: { type: 'keyword' },
            programId: { type: 'keyword' },
            status: { type: 'keyword' },
            submittedAt: { type: 'date' },
            deadline: { type: 'date' },
            priority: { type: 'integer' },
            requirements: {
              type: 'nested',
              properties: {
                type: { type: 'keyword' },
                status: { type: 'keyword' },
                dueDate: { type: 'date' }
              }
            }
          }
        };

      case 'users':
        return {
          ...baseMapping,
          properties: {
            ...baseMapping.properties,
            firstName: {
              type: 'text',
              analyzer: 'custom_text_analyzer'
            },
            lastName: {
              type: 'text',
              analyzer: 'custom_text_analyzer'
            },
            email: { type: 'keyword' },
            userType: { type: 'keyword' },
            interests: { type: 'keyword' },
            location: {
              type: 'text',
              fields: {
                keyword: { type: 'keyword' }
              }
            },
            graduationYear: { type: 'integer' },
            gpa: { type: 'float' },
            testScores: {
              type: 'nested',
              properties: {
                type: { type: 'keyword' },
                score: { type: 'integer' },
                date: { type: 'date' }
              }
            }
          }
        };

      default:
        return baseMapping;
    }
  }

  async indexDocument(document: IndexDocument, indexType?: string): Promise<boolean> {
    try {
      const indexName = indexType ? this.indices[indexType] : this.getIndexForType(document.type);
      
      if (!indexName) {
        throw new Error(`No index found for type: ${document.type}`);
      }

      // Prepare document for indexing
      const indexDoc = {
        ...document,
        title_suggest: {
          input: [document.title, ...document.tags],
          weight: 10
        },
        content_suggest: document.content ? {
          input: document.content.split(' ').slice(0, 50),
          weight: 5
        } : undefined
      };

      await this.client.index({
        index: indexName,
        id: document.id,
        body: indexDoc
      });

      // Refresh index to make document searchable immediately
      await this.client.indices.refresh({ index: indexName });

      logger.info(`Document indexed: ${document.id} in ${indexName}`);
      return true;

    } catch (error) {
      logger.error(`Failed to index document ${document.id}:`, error);
      return false;
    }
  }

  async bulkIndex(documents: IndexDocument[], indexType?: string): Promise<{ success: number; failed: number }> {
    try {
      const body: any[] = [];

      for (const document of documents) {
        const indexName = indexType ? this.indices[indexType] : this.getIndexForType(document.type);
        
        if (!indexName) {
          logger.warn(`No index found for type: ${document.type}, skipping document ${document.id}`);
          continue;
        }

        // Add index operation
        body.push({
          index: {
            _index: indexName,
            _id: document.id
          }
        });

        // Add document data
        body.push({
          ...document,
          title_suggest: {
            input: [document.title, ...document.tags],
            weight: 10
          },
          content_suggest: document.content ? {
            input: document.content.split(' ').slice(0, 50),
            weight: 5
          } : undefined
        });
      }

      if (body.length === 0) {
        return { success: 0, failed: 0 };
      }

      const response = await this.client.bulk({ body });

      let success = 0;
      let failed = 0;

      if (response.body.items) {
        for (const item of response.body.items) {
          if (item.index && item.index.error) {
            failed++;
            logger.error('Bulk index error:', item.index.error);
          } else {
            success++;
          }
        }
      }

      // Refresh all indices
      await this.client.indices.refresh({
        index: Object.values(this.indices).join(',')
      });

      logger.info(`Bulk indexing completed: ${success} success, ${failed} failed`);
      return { success, failed };

    } catch (error) {
      logger.error('Bulk indexing failed:', error);
      return { success: 0, failed: documents.length };
    }
  }

  async updateDocument(id: string, updates: Partial<IndexDocument>, indexType?: string): Promise<boolean> {
    try {
      const indexName = indexType ? this.indices[indexType] : this.findDocumentIndex(id);
      
      if (!indexName) {
        throw new Error(`Cannot find document ${id} in any index`);
      }

      await this.client.update({
        index: indexName,
        id,
        body: {
          doc: updates
        }
      });

      logger.info(`Document updated: ${id} in ${indexName}`);
      return true;

    } catch (error) {
      logger.error(`Failed to update document ${id}:`, error);
      return false;
    }
  }

  async deleteDocument(id: string, indexType?: string): Promise<boolean> {
    try {
      const indexName = indexType ? this.indices[indexType] : this.findDocumentIndex(id);
      
      if (!indexName) {
        throw new Error(`Cannot find document ${id} in any index`);
      }

      await this.client.delete({
        index: indexName,
        id
      });

      logger.info(`Document deleted: ${id} from ${indexName}`);
      return true;

    } catch (error) {
      logger.error(`Failed to delete document ${id}:`, error);
      return false;
    }
  }

  private getIndexForType(type: string): string | undefined {
    return this.indices[type];
  }

  private async findDocumentIndex(id: string): Promise<string | undefined> {
    for (const indexName of Object.values(this.indices)) {
      try {
        const exists = await this.client.exists({
          index: indexName,
          id
        });

        if (exists.body) {
          return indexName;
        }
      } catch (error) {
        // Continue searching in other indices
      }
    }
    return undefined;
  }

  async reindexAll(sourceIndex: string, targetIndex: string): Promise<boolean> {
    try {
      const response = await this.client.reindex({
        body: {
          source: { index: sourceIndex },
          dest: { index: targetIndex }
        }
      });

      logger.info(`Reindexing completed from ${sourceIndex} to ${targetIndex}:`, response.body);
      return true;

    } catch (error) {
      logger.error(`Reindexing failed from ${sourceIndex} to ${targetIndex}:`, error);
      return false;
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      const stats = await this.client.indices.stats({
        index: Object.values(this.indices).join(',')
      });

      return {
        indices: this.indices,
        stats: stats.body.indices
      };

    } catch (error) {
      logger.error('Error getting index stats:', error);
      throw error;
    }
  }

  async optimizeIndices(): Promise<void> {
    try {
      await this.client.indices.forcemerge({
        index: Object.values(this.indices).join(','),
        max_num_segments: 1
      });

      logger.info('Index optimization completed');

    } catch (error) {
      logger.error('Index optimization failed:', error);
    }
  }

  async clearIndex(indexType: string): Promise<boolean> {
    try {
      const indexName = this.indices[indexType];
      if (!indexName) {
        throw new Error(`Unknown index type: ${indexType}`);
      }

      await this.client.deleteByQuery({
        index: indexName,
        body: {
          query: { match_all: {} }
        }
      });

      logger.info(`Index cleared: ${indexName}`);
      return true;

    } catch (error) {
      logger.error(`Failed to clear index ${indexType}:`, error);
      return false;
    }
  }
}