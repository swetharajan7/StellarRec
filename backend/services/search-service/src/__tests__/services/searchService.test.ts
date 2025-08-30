import { SearchService } from '../../services/searchService';
import { Client } from '@elastic/elasticsearch';

describe('SearchService', () => {
  let searchService: SearchService;
  let mockElasticsearchClient: jest.Mocked<Client>;

  beforeEach(() => {
    mockElasticsearchClient = new Client({ node: 'http://localhost:9200' }) as jest.Mocked<Client>;
    searchService = new SearchService();
    (searchService as any).client = mockElasticsearchClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should perform a basic search successfully', async () => {
      const mockSearchResponse = {
        body: {
          hits: {
            total: { value: 1 },
            hits: [
              {
                _id: '1',
                _source: {
                  title: 'Test University',
                  description: 'A great university for testing',
                  type: 'university'
                },
                _score: 1.0
              }
            ]
          },
          aggregations: {}
        }
      };

      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);

      const searchQuery = {
        query: 'test university',
        filters: {},
        limit: 20,
        offset: 0
      };

      const result = await searchService.search(searchQuery);

      expect(result).toEqual({
        documents: expect.any(Array),
        total: 1,
        facets: {},
        processingTime: expect.any(Number)
      });

      expect(result.documents).toHaveLength(1);
      expect(result.documents[0]).toMatchObject({
        id: '1',
        title: 'Test University',
        description: 'A great university for testing',
        type: 'university',
        score: 1.0
      });
    });

    it('should handle search errors gracefully', async () => {
      mockElasticsearchClient.search.mockRejectedValue(new Error('Elasticsearch error'));

      const searchQuery = {
        query: 'test',
        filters: {},
        limit: 20,
        offset: 0
      };

      await expect(searchService.search(searchQuery)).rejects.toThrow('Search failed');
    });

    it('should apply filters correctly', async () => {
      const mockSearchResponse = {
        body: {
          hits: {
            total: { value: 0 },
            hits: []
          },
          aggregations: {}
        }
      };

      mockElasticsearchClient.search.mockResolvedValue(mockSearchResponse);

      const searchQuery = {
        query: 'university',
        filters: {
          type: ['university'],
          location: ['California']
        },
        limit: 20,
        offset: 0
      };

      await searchService.search(searchQuery);

      expect(mockElasticsearchClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            query: expect.objectContaining({
              bool: expect.objectContaining({
                filter: expect.arrayContaining([
                  expect.objectContaining({
                    terms: { type: ['university'] }
                  }),
                  expect.objectContaining({
                    terms: { location: ['California'] }
                  })
                ])
              })
            })
          })
        })
      );
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return search suggestions', async () => {
      const mockSuggestResponse = {
        body: {
          suggest: {
            query_suggestion: [
              {
                options: [
                  { text: 'university of california', _score: 1.0 },
                  { text: 'university of texas', _score: 0.8 }
                ]
              }
            ]
          }
        }
      };

      mockElasticsearchClient.search.mockResolvedValue(mockSuggestResponse);

      const suggestions = await searchService.getSearchSuggestions('univer', 5);

      expect(suggestions).toEqual([
        'university of california',
        'university of texas'
      ]);
    });
  });

  describe('getIndexStats', () => {
    it('should return index statistics', async () => {
      const mockStatsResponse = {
        body: {
          indices: {
            'stellarrec-universities': {
              total: {
                docs: { count: 100 },
                store: { size_in_bytes: 1024000 }
              }
            },
            'stellarrec-programs': {
              total: {
                docs: { count: 500 },
                store: { size_in_bytes: 2048000 }
              }
            }
          }
        }
      };

      mockElasticsearchClient.indices.stats.mockResolvedValue(mockStatsResponse);

      const stats = await searchService.getIndexStats();

      expect(stats).toEqual({
        totalDocuments: 600,
        totalSize: '2.93 MB',
        indices: {
          'stellarrec-universities': {
            documents: 100,
            size: '1000.00 KB'
          },
          'stellarrec-programs': {
            documents: 500,
            size: '2000.00 KB'
          }
        }
      });
    });
  });
});