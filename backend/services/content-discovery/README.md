# Content Discovery Service

ML-powered content discovery and recommendation engine for the StellarRec platform. This service provides personalized recommendations, trending content analysis, opportunity discovery, and user behavior tracking.

## Features

### 🤖 **ML-Powered Recommendations**
- Collaborative filtering based on user behavior
- Content-based filtering using item features
- Hybrid recommendation algorithms
- Real-time personalization with confidence scoring
- AI-enhanced university matching integration

### 📈 **Trending Analysis**
- Real-time trending content calculation
- Multi-timeframe trend analysis (1h, 6h, 24h, 7d)
- Emerging content detection
- Viral content identification
- Popular search tracking

### 🔍 **Opportunity Discovery**
- Personalized scholarship recommendations
- Grant and fellowship discovery
- Internship opportunity matching
- Competition and program suggestions
- Deadline-aware urgent opportunities
- High-value opportunity filtering

### 📊 **Behavior Tracking**
- Comprehensive user interaction tracking
- Behavior pattern analysis
- User similarity detection
- Engagement metrics calculation
- Content performance analytics

### 🎯 **Personalization Engine**
- Multi-factor personalization scoring
- Context-aware recommendations
- Diversity filtering to avoid echo chambers
- Confidence-based recommendation quality
- User preference learning and adaptation

## API Endpoints

### Recommendations
- `GET /api/v1/recommendations` - Get personalized recommendations
- `GET /api/v1/recommendations/universities` - University recommendations
- `GET /api/v1/recommendations/programs` - Program recommendations
- `GET /api/v1/recommendations/scholarships` - Scholarship recommendations
- `GET /api/v1/recommendations/similar/:contentId` - Similar content
- `POST /api/v1/recommendations/feedback` - Recommendation feedback

### Trending Content
- `GET /api/v1/trending` - Get trending content
- `GET /api/v1/trending/universities` - Trending universities
- `GET /api/v1/trending/programs` - Trending programs
- `GET /api/v1/trending/scholarships` - Trending scholarships
- `GET /api/v1/trending/searches` - Popular searches
- `GET /api/v1/trending/emerging` - Emerging content
- `GET /api/v1/trending/viral` - Viral content

### Discovery
- `GET /api/v1/discovery/opportunities` - Discover opportunities
- `GET /api/v1/discovery/scholarships` - Scholarship discovery
- `GET /api/v1/discovery/grants` - Grant discovery
- `GET /api/v1/discovery/internships` - Internship discovery
- `GET /api/v1/discovery/competitions` - Competition discovery
- `GET /api/v1/discovery/urgent` - Urgent opportunities
- `GET /api/v1/discovery/high-value` - High-value opportunities
- `GET /api/v1/discovery/search` - Search opportunities
- `GET /api/v1/discovery/opportunity/:id` - Get specific opportunity
- `GET /api/v1/discovery/opportunity/:id/similar` - Similar opportunities

### Behavior Tracking
- `POST /api/v1/behavior/track` - Track user behavior
- `POST /api/v1/behavior/track-batch` - Track multiple behaviors
- `GET /api/v1/behavior/profile` - Get user behavior profile
- `GET /api/v1/behavior/insights` - Get behavior insights
- `GET /api/v1/behavior/similar-users` - Get similar users
- `GET /api/v1/behavior/content-popularity` - Content popularity
- `GET /api/v1/behavior/engagement-metrics` - Engagement metrics

## Architecture

### Services
- **RecommendationService**: Core recommendation algorithms
- **TrendingService**: Trending content analysis and calculation
- **DiscoveryService**: Opportunity discovery and matching
- **BehaviorTrackingService**: User behavior tracking and analysis
- **PersonalizationService**: Personalization engine and scoring

### Database Schema
- **user_behavior**: Individual user interactions
- **user_behavior_profile**: Aggregated user behavior profiles
- **trending_content**: Trending content scores and metadata
- **opportunity**: Available opportunities and their details
- **recommendation_log**: Recommendation history and performance
- **user_personalization**: User personalization preferences
- **content_similarity**: Content similarity calculations
- **content_performance**: Content engagement metrics

### Machine Learning Components
- Collaborative filtering using user-item interactions
- Content-based filtering using item features
- Clustering for user segmentation
- Similarity calculations using cosine similarity
- Trending score calculation with time decay
- Personalization scoring with multiple factors

## Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/stellarrec_discovery

# Services
USER_SERVICE_URL=http://localhost:3001
SEARCH_SERVICE_URL=http://localhost:3003
AI_SERVICE_URL=http://localhost:3002

# Recommendation Settings
RECOMMENDATION_CACHE_TTL=3600
RECOMMENDATION_BATCH_SIZE=50

# Behavior Tracking
BEHAVIOR_BATCH_SIZE=100
BEHAVIOR_RETENTION_DAYS=90

# ML Configuration
ML_SIMILARITY_THRESHOLD=0.7
ML_CLUSTERING_ENABLED=true
```

### Recommendation Algorithms
The service supports multiple recommendation strategies:

1. **Profile-based**: For new users with minimal behavior data
2. **Behavior-weighted**: For users with moderate interaction history
3. **Hybrid-advanced**: For users with rich behavior data
4. **Popularity-based**: Fallback for cold-start scenarios

### Personalization Factors
- **Behavior Match**: Based on user interaction patterns
- **Profile Match**: Based on user profile information
- **Context Match**: Based on current context (time, location, device)
- **Trending Boost**: Based on content popularity and trends
- **Diversity Score**: To ensure recommendation variety

## Performance Features

### Caching Strategy
- Recommendation results cached for 1 hour
- Trending data cached for 30 minutes
- User behavior profiles cached for 1 hour
- Content similarity cached for 24 hours

### Batch Processing
- User behavior events processed in batches
- Trending scores calculated periodically
- User profiles updated asynchronously
- Analytics data aggregated in batches

### Optimization
- Database indexes on frequently queried fields
- Connection pooling for database connections
- Lazy loading of expensive computations
- Background processing for non-critical tasks

## Monitoring and Analytics

### Health Checks
- Database connectivity monitoring
- Service dependency health checks
- Memory usage monitoring
- Performance metrics tracking

### Metrics
- Recommendation click-through rates
- User engagement metrics
- Content performance analytics
- System performance monitoring

### Logging
- Structured logging with Winston
- Request/response logging
- Error tracking and alerting
- Performance monitoring

## Development

### Setup
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Testing
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Building
```bash
# Build for production
npm run build

# Start production server
npm start
```

## Docker Deployment

```bash
# Build image
docker build -t stellarrec/content-discovery .

# Run container
docker run -p 3005:3005 \
  -e DATABASE_URL=postgresql://... \
  -e USER_SERVICE_URL=http://user-service:3001 \
  stellarrec/content-discovery
```

## Integration

### With Search Service
- Fetches candidate content for recommendations
- Uses search analytics for trending calculations
- Integrates with faceted search for discovery

### With AI Service
- Enhanced university matching using ML models
- Advanced content similarity calculations
- Predictive analytics for user behavior

### With User Service
- User profile data for personalization
- Authentication and authorization
- User preference management

## Security

- JWT-based authentication
- Input validation and sanitization
- Rate limiting on all endpoints
- CORS configuration
- Helmet security headers
- SQL injection prevention

## Scalability

- Horizontal scaling support
- Database read replicas
- Caching layers (Redis)
- Background job processing
- Load balancing ready
- Microservice architecture

## License

MIT License - see LICENSE file for details.