# Intelligent Reminder Service

Advanced intelligent reminder system for the StellarRec platform, providing deadline-based scheduling, smart timing based on user behavior, escalation workflows, personalized content, and effectiveness tracking.

## Features

### Core Capabilities
- **Deadline-Based Reminder Scheduling**: Automatic reminder generation for deadlines and milestones
- **Smart Timing**: ML-powered optimal timing based on user behavior analysis
- **Escalation Workflows**: Configurable escalation paths for critical deadlines
- **Personalized Content**: Dynamic content generation based on user preferences and behavior
- **Effectiveness Tracking**: Comprehensive analytics and optimization of reminder performance

### Intelligent Features
- **Behavioral Analysis**: User response pattern analysis and preference learning
- **Predictive Timing**: ML models to predict optimal reminder times
- **A/B Testing**: Built-in testing framework for reminder optimization
- **Frequency Optimization**: Automatic adjustment of reminder frequency based on effectiveness
- **Content Personalization**: Tone, length, and motivational factor customization

## API Endpoints

### Reminder Management
- `POST /api/v1/reminders` - Create reminder schedule
- `GET /api/v1/reminders` - Get user reminders
- `GET /api/v1/reminders/upcoming` - Get upcoming reminders
- `PUT /api/v1/reminders/:id` - Update reminder schedule
- `DELETE /api/v1/reminders/:id` - Cancel reminder schedule

### Smart Scheduling
- `POST /api/v1/scheduling/optimize` - Optimize reminder timing
- `GET /api/v1/scheduling/recommendations` - Get timing recommendations
- `POST /api/v1/scheduling/frequency` - Optimize reminder frequency

### Escalation Workflows
- `POST /api/v1/escalation/workflows` - Create escalation workflow
- `GET /api/v1/escalation/active` - Get active escalations
- `POST /api/v1/escalation/:id/acknowledge` - Acknowledge escalation
- `POST /api/v1/escalation/:id/resolve` - Resolve escalation

### Analytics & Effectiveness
- `GET /api/v1/analytics/effectiveness` - Get effectiveness metrics
- `GET /api/v1/analytics/insights` - Get effectiveness insights
- `POST /api/v1/analytics/ab-test` - Start A/B test
- `GET /api/v1/analytics/ab-test/:id` - Get A/B test results

### User Preferences
- `GET /api/v1/preferences` - Get user reminder preferences
- `PUT /api/v1/preferences` - Update user preferences
- `GET /api/v1/preferences/behavior` - Get behavior profile
- `POST /api/v1/preferences/feedback` - Submit reminder feedback

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Set up database:
```bash
npx prisma migrate dev
npx prisma generate
```

4. Set up Redis:
```bash
# Make sure Redis is running
redis-server
```

5. Start the service:
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Configuration

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string for job queues
- `JWT_SECRET`: Secret key for JWT token verification
- `NOTIFICATION_SERVICE_URL`: URL of the notification service
- `USER_SERVICE_URL`: URL of the user service

### Machine Learning Configuration
- `ML_MODEL_PATH`: Path for storing ML models
- `ENABLE_ML_OPTIMIZATION`: Enable/disable ML-based optimizations

## Architecture

### Core Services

#### ReminderSchedulingService
- Creates and manages reminder schedules
- Processes scheduled reminders
- Handles reminder lifecycle management

#### SmartTimingService
- Analyzes user behavior patterns
- Calculates optimal reminder times
- Provides timing recommendations
- Manages user behavior profiles

#### EscalationWorkflowService
- Manages escalation workflows
- Triggers escalations based on conditions
- Handles escalation acknowledgments and resolutions

#### PersonalizationService
- Generates personalized reminder content
- Manages user personalization profiles
- Optimizes content based on user preferences

#### EffectivenessTrackingService
- Tracks reminder interactions and effectiveness
- Provides analytics and insights
- Manages A/B testing framework

### Machine Learning Components

#### Behavioral Analysis
- Response pattern recognition
- Preference learning algorithms
- Procrastination tendency analysis
- Channel effectiveness modeling

#### Predictive Timing
- Optimal timing prediction models
- Frequency optimization algorithms
- Response probability estimation
- Engagement pattern analysis

#### Content Optimization
- Tone preference learning
- Length optimization
- Motivational factor identification
- Personalization scoring

## Smart Features

### Behavioral Learning
The system continuously learns from user interactions:
- **Response Patterns**: Tracks when users respond to reminders
- **Channel Preferences**: Learns which channels are most effective
- **Timing Preferences**: Identifies optimal times for each user
- **Content Preferences**: Adapts tone, length, and style

### Intelligent Scheduling
- **Predictive Timing**: Uses ML to predict optimal reminder times
- **Conflict Detection**: Identifies and resolves scheduling conflicts
- **Load Balancing**: Distributes reminders to avoid overwhelming users
- **Adaptive Frequency**: Adjusts frequency based on effectiveness

### Escalation Intelligence
- **Smart Triggers**: Context-aware escalation triggers
- **Dynamic Workflows**: Adaptive escalation paths
- **Stakeholder Identification**: Automatic recipient selection
- **Resolution Tracking**: Comprehensive escalation analytics

## Effectiveness Tracking

### Metrics Collected
- **Response Rate**: Percentage of reminders that receive responses
- **Response Time**: Average time from reminder to response
- **Channel Effectiveness**: Performance by communication channel
- **Content Effectiveness**: Performance by content type and tone
- **Timing Effectiveness**: Performance by time of day/week

### Analytics Features
- **Real-time Dashboards**: Live effectiveness monitoring
- **Trend Analysis**: Historical performance trends
- **A/B Testing**: Built-in testing framework
- **Predictive Analytics**: Future performance predictions
- **Optimization Recommendations**: AI-powered improvement suggestions

## Personalization Engine

### User Profiling
- **Communication Style**: Direct, supportive, analytical, creative
- **Preferred Tone**: Formal, casual, urgent, encouraging, gentle
- **Content Length**: Brief, detailed, comprehensive
- **Motivational Factors**: Achievement, recognition, growth

### Content Generation
- **Dynamic Templates**: Handlebars-based template system
- **Tone Adaptation**: Automatic tone adjustment
- **Length Optimization**: Content length based on preferences
- **Motivational Elements**: Personalized motivational content

## Escalation Workflows

### Workflow Configuration
- **Trigger Conditions**: Deadline proximity, no response, priority changes
- **Escalation Levels**: Multi-level escalation paths
- **Recipient Management**: Dynamic recipient selection
- **Timing Control**: Configurable delays and timeouts

### Workflow Types
- **Standard**: Basic escalation for normal priorities
- **Aggressive**: Frequent escalation for procrastinators
- **Gentle**: Minimal escalation for responsive users
- **Custom**: Fully customizable workflows

## Performance Optimization

### Caching Strategy
- **User Profiles**: Cache behavior and personalization profiles
- **ML Models**: Cache trained models for fast inference
- **Timing Predictions**: Cache optimal timing calculations

### Queue Management
- **Priority Queues**: Process high-priority reminders first
- **Batch Processing**: Efficient bulk reminder processing
- **Rate Limiting**: Prevent notification spam

### Database Optimization
- **Indexing**: Optimized indexes for common queries
- **Partitioning**: Time-based partitioning for large tables
- **Connection Pooling**: Efficient database connections

## Security

### Authentication & Authorization
- JWT token validation
- Role-based access control
- API rate limiting

### Data Protection
- Input validation and sanitization
- Encrypted sensitive data
- Privacy-compliant data handling
- GDPR compliance features

## Monitoring

### Health Checks
- `/health` - Basic service health
- `/health/ready` - Readiness for traffic

### Metrics
- Reminder processing rates
- ML model performance
- User engagement metrics
- System performance metrics

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking and alerting
- Performance monitoring

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Deployment

### Docker
```bash
# Build image
docker build -t stellarrec-reminder-service .

# Run container
docker run -p 3010:3010 stellarrec-reminder-service
```

### Production Considerations
- Use production database and Redis
- Configure proper logging and monitoring
- Set up load balancing
- Enable HTTPS
- Configure backup and recovery
- Set up alerting for failed reminders

## Contributing

1. Follow TypeScript best practices
2. Write comprehensive tests
3. Document API changes
4. Follow semantic versioning
5. Update README for new features

## License

MIT License - see LICENSE file for details