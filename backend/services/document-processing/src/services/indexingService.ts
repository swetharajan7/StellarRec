import { Client } from '@elastic/elasticsearch';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { MetadataExtractionService } from './metadataExtractionService';
import { OCRService } from './ocrService';

export interface IndexingOptions {
  extractText?: boolean;
  extractMetadata?: boolean;
  performOCR?: boolean;
  ocrLanguage?: string;
  indexName?: string;
  documentType?: string;
  boost?: number;
  tags?: string[];
  customFields?: Record<string, any>;
}

export interface IndexedDocument {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  content: {
    text?: string;
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
  };
  metadata: any;
  tags: string[];
  customFields: Record<string, any>;
  indexedAt: Date;
  boost: number;
}

export interface SearchQuery {
  query: string;
  filters?: {
    mimeType?: string[];
    author?: string[];
    tags?: string[];
    dateRange?: {
      from?: Date;
      to?: Date;
    };
    sizeRange?: {
      min?: number;
      max?: number;
    };
  };
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  highlight?: boolean;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  total: number;
  documents: Array<{
    id: string;
    documentId: string;
    filename: string;
    mimeType: string;
    score: number;
    highlights?: Record<string, string[]>;
    content: {
      text?: string;
      title?: string;
      author?: string;
      subject?: string;
    };
    metadata: any;
    tags: string[];
    indexedAt: Date;
  }>;
  aggregations?: Record<string, any>;
  processingTime: number;
}

export class IndexingService {
  private client: Client;
  private defaultIndex: string;
  private metadataService: MetadataExtractionService;
  private ocrService: OCRService;

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      auth: process.env.ELASTICSEARCH_AUTH ? {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
      } : undefined
    });
    
    this.defaultIndex = process.env.ELASTICSEARCH_INDEX || 'stellarrec-documents';
    this.metadataService = new MetadataExtractionService();
    this.ocrService = new OCRService();
    
    this.initializeIndex();
  }

  private async initializeIndex(): Promise<void> {
    try {
      const indexExists = await this.client.indices.exists({
        index: this.defaultIndex
      });

      if (!indexExists) {
        await this.createIndex();
      }
    } catch (error) {
      logger.error('Failed to initialize Elasticsearch index:', error);
    }
  }

  private async createIndex(): Promise<void> {
    try {
      await this.client.indices.create({
        index: this.defaultIndex,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0,
            analysis: {
              analyzer: {
                document_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: [
                    'lowercase',
                    'stop',
                    'stemmer',
                    'word_delimiter'
                  ]
                }
              }
            }
          },
          mappings: {
            properties: {
              documentId: { type: 'keyword' },
              filename: { 
                type: 'text',
                analyzer: 'document_analyzer',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              mimeType: { type: 'keyword' },
              size: { type: 'long' },
              content: {
                properties: {
                  text: { 
                    type: 'text',
                    analyzer: 'document_analyzer'
                  },
                  title: { 
                    type: 'text',
                    analyzer: 'document_analyzer',
                    boost: 2.0
                  },
                  author: { 
                    type: 'text',
                    analyzer: 'document_analyzer',
                    fields: {
                      keyword: { type: 'keyword' }
                    }
                  },
                  subject: { 
                    type: 'text',
                    analyzer: 'document_analyzer'
                  },
                  keywords: { 
                    type: 'keyword'
                  }
                }
              },
              metadata: {
                type: 'object',
                enabled: true
              },
              tags: { type: 'keyword' },
              customFields: {
                type: 'object',
                enabled: true
              },
              indexedAt: { type: 'date' },
              boost: { type: 'float' }
            }
          }
        }
      });

      logger.info(`Elasticsearch index '${this.defaultIndex}' created successfully`);
    } catch (error) {
      logger.error('Failed to create Elasticsearch index:', error);
      throw error;
    }
  }

  async indexDocument(
    buffer: Buffer,
    mimeType: string,
    filename: string,
    documentId: string,
    options: IndexingOptions = {}
  ): Promise<{ success: boolean; indexId?: string; error?: string }> {
    try {
      logger.info(`Indexing document: ${filename} (${documentId})`);

      const indexId = uuidv4();
      const indexName = options.indexName || this.defaultIndex;

      // Extract metadata if requested
      let metadata: any = {};
      if (options.extractMetadata !== false) {
        metadata = await this.metadataService.extractMetadata(buffer, mimeType, filename);
      }

      // Extract text content
      let textContent = '';
      if (options.extractText !== false) {
        if (mimeType.startsWith('image/') && options.performOCR) {
          const ocrResult = await this.ocrService.extractTextFromImage(
            buffer,
            options.ocrLanguage || 'eng'
          );
          if (ocrResult.success) {
            textContent = ocrResult.text;
          }
        } else {
          textContent = await this.extractTextContent(buffer, mimeType);
        }
      }

      // Prepare document for indexing
      const document: IndexedDocument = {
        id: indexId,
        documentId,
        filename,
        mimeType,
        size: buffer.length,
        content: {
          text: textContent,
          title: metadata.title || filename,
          author: metadata.author,
          subject: metadata.subject,
          keywords: metadata.keywords || []
        },
        metadata,
        tags: options.tags || [],
        customFields: options.customFields || {},
        indexedAt: new Date(),
        boost: options.boost || 1.0
      };

      // Index the document
      await this.client.index({
        index: indexName,
        id: indexId,
        body: document
      });

      // Refresh the index to make the document searchable immediately
      await this.client.indices.refresh({ index: indexName });

      logger.info(`Document indexed successfully: ${indexId}`);
      return { success: true, indexId };

    } catch (error) {
      logger.error('Document indexing failed:', error);
      return { success: false, error: error.message };
    }
  }

  private async extractTextContent(buffer: Buffer, mimeType: string): Promise<string> {
    // This would use the same text extraction logic as in other services
    switch (mimeType) {
      case 'text/plain':
        return buffer.toString('utf-8');
      case 'application/pdf':
        // Would use pdf-parse
        return 'PDF text extraction placeholder';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        // Would use mammoth
        return 'DOCX text extraction placeholder';
      default:
        return '';
    }
  }

  async searchDocuments(query: SearchQuery): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      logger.info(`Searching documents with query: ${query.query}`);

      // Build Elasticsearch query
      const searchBody: any = {
        query: {
          bool: {
            must: [],
            filter: []
          }
        },
        sort: [],
        from: query.offset || 0,
        size: query.limit || 20
      };

      // Add main query
      if (query.query && query.query.trim()) {
        searchBody.query.bool.must.push({
          multi_match: {
            query: query.query,
            fields: [
              'content.text',
              'content.title^2',
              'content.author^1.5',
              'content.subject^1.5',
              'filename^1.2',
              'content.keywords^2'
            ],
            type: 'best_fields',
            fuzziness: 'AUTO'
          }
        });
      } else {
        searchBody.query.bool.must.push({ match_all: {} });
      }

      // Add filters
      if (query.filters) {
        if (query.filters.mimeType && query.filters.mimeType.length > 0) {
          searchBody.query.bool.filter.push({
            terms: { mimeType: query.filters.mimeType }
          });
        }

        if (query.filters.author && query.filters.author.length > 0) {
          searchBody.query.bool.filter.push({
            terms: { 'content.author.keyword': query.filters.author }
          });
        }

        if (query.filters.tags && query.filters.tags.length > 0) {
          searchBody.query.bool.filter.push({
            terms: { tags: query.filters.tags }
          });
        }

        if (query.filters.dateRange) {
          const dateFilter: any = { range: { indexedAt: {} } };
          if (query.filters.dateRange.from) {
            dateFilter.range.indexedAt.gte = query.filters.dateRange.from;
          }
          if (query.filters.dateRange.to) {
            dateFilter.range.indexedAt.lte = query.filters.dateRange.to;
          }
          searchBody.query.bool.filter.push(dateFilter);
        }

        if (query.filters.sizeRange) {
          const sizeFilter: any = { range: { size: {} } };
          if (query.filters.sizeRange.min) {
            sizeFilter.range.size.gte = query.filters.sizeRange.min;
          }
          if (query.filters.sizeRange.max) {
            sizeFilter.range.size.lte = query.filters.sizeRange.max;
          }
          searchBody.query.bool.filter.push(sizeFilter);
        }
      }

      // Add sorting
      if (query.sort) {
        searchBody.sort.push({
          [query.sort.field]: { order: query.sort.order }
        });
      } else {
        searchBody.sort.push({ _score: { order: 'desc' } });
        searchBody.sort.push({ indexedAt: { order: 'desc' } });
      }

      // Add highlighting
      if (query.highlight) {
        searchBody.highlight = {
          fields: {
            'content.text': {
              fragment_size: 150,
              number_of_fragments: 3
            },
            'content.title': {},
            'filename': {}
          }
        };
      }

      // Add aggregations for faceted search
      searchBody.aggs = {
        mimeTypes: {
          terms: { field: 'mimeType', size: 10 }
        },
        authors: {
          terms: { field: 'content.author.keyword', size: 10 }
        },
        tags: {
          terms: { field: 'tags', size: 20 }
        },
        sizeRanges: {
          range: {
            field: 'size',
            ranges: [
              { to: 1024 * 1024 }, // < 1MB
              { from: 1024 * 1024, to: 10 * 1024 * 1024 }, // 1-10MB
              { from: 10 * 1024 * 1024 } // > 10MB
            ]
          }
        }
      };

      // Execute search
      const response = await this.client.search({
        index: this.defaultIndex,
        body: searchBody
      });

      const processingTime = Date.now() - startTime;

      // Format results
      const documents = response.body.hits.hits.map((hit: any) => ({
        id: hit._id,
        documentId: hit._source.documentId,
        filename: hit._source.filename,
        mimeType: hit._source.mimeType,
        score: hit._score,
        highlights: hit.highlight,
        content: hit._source.content,
        metadata: hit._source.metadata,
        tags: hit._source.tags,
        indexedAt: new Date(hit._source.indexedAt)
      }));

      logger.info(`Search completed in ${processingTime}ms, found ${response.body.hits.total.value} documents`);

      return {
        total: response.body.hits.total.value,
        documents,
        aggregations: response.body.aggregations,
        processingTime
      };

    } catch (error) {
      logger.error('Document search failed:', error);
      return {
        total: 0,
        documents: [],
        processingTime: Date.now() - startTime
      };
    }
  }

  async updateDocument(
    indexId: string,
    updates: Partial<IndexedDocument>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.update({
        index: this.defaultIndex,
        id: indexId,
        body: {
          doc: updates
        }
      });

      logger.info(`Document updated: ${indexId}`);
      return { success: true };

    } catch (error) {
      logger.error('Document update failed:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteDocument(indexId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.delete({
        index: this.defaultIndex,
        id: indexId
      });

      logger.info(`Document deleted: ${indexId}`);
      return { success: true };

    } catch (error) {
      logger.error('Document deletion failed:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteDocumentsByDocumentId(documentId: string): Promise<{ success: boolean; deleted: number; error?: string }> {
    try {
      const response = await this.client.deleteByQuery({
        index: this.defaultIndex,
        body: {
          query: {
            term: { documentId }
          }
        }
      });

      logger.info(`Deleted ${response.body.deleted} documents for documentId: ${documentId}`);
      return { success: true, deleted: response.body.deleted };

    } catch (error) {
      logger.error('Bulk document deletion failed:', error);
      return { success: false, deleted: 0, error: error.message };
    }
  }

  async getDocumentById(indexId: string): Promise<IndexedDocument | null> {
    try {
      const response = await this.client.get({
        index: this.defaultIndex,
        id: indexId
      });

      return response.body._source as IndexedDocument;

    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      logger.error('Failed to get document by ID:', error);
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      const response = await this.client.indices.stats({
        index: this.defaultIndex
      });

      return {
        indexName: this.defaultIndex,
        documentCount: response.body._all.total.docs.count,
        indexSize: response.body._all.total.store.size_in_bytes,
        stats: response.body._all.total
      };

    } catch (error) {
      logger.error('Failed to get index stats:', error);
      throw error;
    }
  }

  async reindexDocument(
    documentId: string,
    buffer: Buffer,
    mimeType: string,
    filename: string,
    options: IndexingOptions = {}
  ): Promise<{ success: boolean; indexId?: string; error?: string }> {
    try {
      // Delete existing documents for this documentId
      await this.deleteDocumentsByDocumentId(documentId);

      // Index the document again
      return await this.indexDocument(buffer, mimeType, filename, documentId, options);

    } catch (error) {
      logger.error('Document reindexing failed:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.client.close();
      await this.ocrService.cleanup();
      logger.info('Indexing service cleanup completed');
    } catch (error) {
      logger.error('Indexing service cleanup failed:', error);
    }
  }
}