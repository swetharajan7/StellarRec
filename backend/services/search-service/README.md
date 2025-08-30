# Search Service

A comprehensive search service for the StellarRec platform that provides advanced search functionality, faceted navigation, autocomplete, and search analytics powered by Elasticsearch.

## Features

### Core Search Capabilities
- **Full-Text Search**: Advanced text search with relevance scoring
- **Faceted Navigation**: Dynamic filters with real-time counts
- **Auto-Complete**: Intelligent search suggestions with fuzzy matching
- **Search Analytics**: Comprehensive search behavior tracking
- **Multi-Index Search**: Search across documents, universities, programs, scholarships
- **Advanced Ranking**: Custom relevance scoring with multiple factors

### Search Types
- **Documents**: Essays, letters, transcripts, certificates
- **Universities**: Institution profiles and information
- **Programs**: Academic programs and courses
- **Scholarships**: Funding opportunities and grants
- **Applications**: Application tracking and status
- **Users**: Student and recommender profiles

### Advanced Features
- **Contextual Search**: Personalized results based on user preferences
- **Trending Searches**: Real-time trending query detection
- **Query Optimization**: Automatic query improvement suggestions
- **Search Performance Monitoring**: Query performance analytics
- **A/B Testing**: Ranking algorithm experimentation

## API Endpoints

### Search Operations
- `GET /api/v1/search` - Main search with filters and facets
- `POST /api/v1/search/advanced` - Advanced search with complex queries
- `GET /api/v1/search/suggestions` - Get search suggestions
- `GET /api/v1/search/popular` - Get popular searches
- `GET /api/v1/search/trending` - Get trending searches
- `GET /api/v1/search/stats` - Get search index statistics

### Autocomplete
- `GET /api/v1/autocomplete` - Get autocomplete suggestions
- `GET /api/v1/autocomplete/categories` - Category-specific suggestions
- `GET /api/v1/autocomplete/locations` - Location-based suggestions
- `GET /api/v1/autocomplete/contextual` - Context-aware suggestions
- `GET /api/v1/autocomplete/recent` - User's recent searches

### Faceted Navigation
- `GET /api/v1/facets` - Get facets for search results
- `POST /api/v1/facets` - Get facets with complex filters
- `GET /api/v1/facets/values/:facetName` - Get values for specific facet
- `GET /api/v1/facets/config` - Get facet configurations
- `POST /api/v1/facets/config/:facetName` - Add/update facet config
- `DELETE /api/v1/facets/config/:facetName` - Remove facet config

### Analytics & Monitoring
- `POST /api/v1/analytics/search` - Log search analytics
- `POST /api/v1/analytics/click` - Log click analytics
- `GET /api/v1/analytics/popular-queries` - Get popular queries
- `GET /api/v1/analytics/trends` - Get search trends
- `GET /api/v1/analytics/query-performance/:query` - Get query performance
- `GET /api/v1/analytics/stats` - Get search statistics
- `GET /api/v1/analytics/failed-queries` - Get failed queries
- `GET /api/v1/analytics/user-history` - Get user search history
- `POST /api/v1/analytics/optimize-query` - Get query optimization

### Index Management
- `POST /api/v1/indexing/document` - Index single document
- `POST /api/v1/indexing/bulk` - Bulk index documents
- `PUT /api/v1/indexing/document/:id` - Update indexed document
- `DELETE /api/v1/indexing/document/:id` - Delete indexed document
- `POST /api/v1/indexing/reindex` - Reindex from source to target
- `GET /api/v1/indexing/stats` - Get indexing statistics
- `POST /api/v1/indexing/optimize` - Optimize indices
- `DELETE /api/v1/indexing/clear/:indexType` - Clear specific index

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set up Elasticsearch**
   ```bash
   # Using Docker
   docker run -d --name elasticsearch \
     -p 9200:9200 -p 9300:9300 \
     -e "discovery.type=single-node" \
     -e "xpack.security.enabled=false" \
     elasticsearch:8.11.0
   ```

3. **Set up Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up Database**
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```

5. **Build and Start**
   ```bash
   npm run build
   npm start
   ```

## Development

```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Server port | 3011 |
| `JWT_SECRET` | JWT signing secret | Required |
| `ELASTICSEARCH_URL` | Elasticsearch connection URL | http://localhost:9200 |
| `ELASTICSEARCH_USERNAME` | Elasticsearch username | elastic |
| `ELASTICSEARCH_PASSWORD` | Elasticsearch password | changeme |
| `DEFAULT_SEARCH_LIMIT` | Default search result limit | 20 |
| `MAX_SEARCH_LIMIT` | Maximum search result limit | 100 |

### Search Configuration

#### Query Parameters
```javascript
{
  q: "search query",
  type: "university,program",
  category: "engineering,science",
  tags: "ai,machine-learning",
  author: "john-doe",
  university: "harvard,mit",
  location: "massachusetts,california",
  sort: "relevance",
  limit: 20,
  offset: 0,
  highlight: true,
  facets: "type,category,location"
}
```

#### Facet Configuration
```javascript
{
  field: "category.keyword",
  type: "terms",
  size: 50,
  displayName: "Category",
  order: "count"
}
```

## Architecture

### Services
- **SearchService**: Main search orchestration with Elasticsearch
- **IndexingService**: Document indexing and index management
- **AnalyticsService**: Search behavior tracking and analysis
- **AutocompleteService**: Intelligent search suggestions
- **FacetService**: Dynamic faceted navigation
- **RankingService**: Advanced relevance scoring

### Database Schema
- `search_analytics`: Search query logging and metrics
- `search_clicks`: Click-through tracking
- `popular_queries`: Popular and trending queries
- `query_suggestions`: Autocomplete suggestions cache
- `search_performance`: Query performance optimization
- `facet_usage`: Facet usage analytics
- `search_sessions`: User search session tracking
- `index_metadata`: Elasticsearch index metadata

### Elasticsearch Indices
- **Documents**: User documents and files
- **Universities**: Institution profiles and data
- **Programs**: Academic programs and courses
- **Scholarships**: Funding opportunities
- **Applications**: Application tracking data
- **Users**: User profiles for discovery

## Search Features

### Text Search
- **Multi-field Search**: Search across title, description, content, tags
- **Fuzzy Matching**: Handle typos and variations
- **Phrase Matching**: Boost exact phrase matches
- **Synonym Support**: Handle synonyms and related terms
- **Boolean Operators**: Support AND, OR, NOT operations

### Faceted Navigation
- **Dynamic Facets**: Real-time facet generation based on results
- **Hierarchical Facets**: Nested category structures
- **Range Facets**: Numeric and date range filtering
- **Multi-select**: Multiple values per facet
- **Facet Counts**: Real-time result counts per facet value

### Autocomplete
- **Prefix Matching**: Fast prefix-based suggestions
- **Fuzzy Suggestions**: Handle typos in autocomplete
- **Contextual Suggestions**: Personalized based on user profile
- **Popular Queries**: Include trending and popular searches
- **Category-Specific**: Suggestions filtered by content type

### Analytics
- **Search Tracking**: Log all search queries and results
- **Click Tracking**: Monitor user engagement with results
- **Performance Monitoring**: Track query response times
- **Trend Analysis**: Identify trending searches and topics
- **Query Optimization**: Suggest improvements for poor-performing queries

## Performance

### Optimization Features
- **Query Caching**: Cache frequent search results
- **Index Optimization**: Regular index maintenance
- **Connection Pooling**: Efficient Elasticsearch connections
- **Batch Operations**: Bulk indexing and updates
- **Lazy Loading**: Progressive result loading

### Monitoring
- Search response times
- Index size and document counts
- Query success/failure rates
- User engagement metrics
- System resource usage

## Security

### Access Control
- JWT-based authentication for protected endpoints
- Role-based permissions for admin operations
- User isolation for personal search history
- Rate limiting for search operations

### Data Privacy
- Anonymized search analytics
- User consent for tracking
- Data retention policies
- GDPR compliance features

## Docker Deployment

```bash
# Build image
docker build -t stellarrec/search-service .

# Run container
docker run -p 3011:3011 \
  -e DATABASE_URL="your-db-url" \
  -e ELASTICSEARCH_URL="http://elasticsearch:9200" \
  -e JWT_SECRET="your-secret" \
  stellarrec/search-service
```

## Usage Examples

### Basic Search
```javascript
GET /api/v1/search?q=computer science&limit=10&highlight=true
```

### Faceted Search
```javascript
GET /api/v1/search?q=engineering&facets=type,location,difficulty&type=program
```

### Autocomplete
```javascript
GET /api/v1/autocomplete?q=harv&limit=5&types=university,program
```

### Advanced Search
```javascript
POST /api/v1/search/advanced
{
  "query": "machine learning",
  "filters": {
    "type": ["program"],
    "location": ["California", "Massachusetts"],
    "difficulty": ["moderate", "hard"]
  },
  "sort": [{"field": "ranking", "order": "asc"}],
  "facets": ["university", "duration", "tuition"]
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details