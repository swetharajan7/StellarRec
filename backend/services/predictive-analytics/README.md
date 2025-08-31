# Predictive Analytics Engine

Advanced predictive analytics service for the StellarRec platform, providing admission probability calculations, success factor analysis, timeline optimization, and early warning systems.

## Features

### Core Capabilities
- **Admission Probability Prediction**: ML-powered admission chance calculations with confidence intervals
- **Success Factor Analysis**: Identify key factors contributing to application success
- **Benchmark Comparison**: Compare user profiles against anonymized peer data
- **Timeline Optimization**: Intelligent scheduling with deadline conflict detection
- **Early Warning System**: Proactive risk assessment and alerts

### Machine Learning Models
- **Admission Prediction Model**: Neural network trained on historical admission data
- **Success Factor Model**: Correlation analysis and feature importance ranking
- **Timeline Optimization**: Critical path analysis and resource allocation
- **Risk Assessment**: Multi-factor risk scoring with trend analysis

## API Endpoints

### Admission Predictions
- `POST /api/v1/admission/predict` - Predict admission probability for single university
- `POST /api/v1/admission/predict/batch` - Batch prediction for multiple universities
- `GET /api/v1/admission/trends/:universityId` - Get admission trends
- `POST /api/v1/admission/model/update` - Update prediction model (admin)

### Success Factor Analysis
- `GET /api/v1/success/analyze` - Analyze user success factors
- `GET /api/v1/success/patterns` - Identify success patterns
- `GET /api/v1/success/recommendations/:factor` - Get factor-specific recommendations
- `POST /api/v1/success/progress` - Track factor progress

### Benchmark Analysis
- `GET /api/v1/benchmark/compare` - Generate benchmark comparison
- `GET /api/v1/benchmark/peers` - Get peer analysis with filters

### Timeline Optimization
- `POST /api/v1/timeline/optimize` - Optimize user timeline
- `GET /api/v1/timeline/conflicts` - Detect deadline conflicts
- `POST /api/v1/timeline/adjust` - Adjust timeline for delays
- `GET /api/v1/timeline/completion` - Predict timeline completion

### Early Warning System
- `GET /api/v1/warning/assess` - Assess user risks
- `GET /api/v1/warning/active` - Get active warnings
- `POST /api/v1/warning/create` - Create warning (admin)
- `PATCH /api/v1/warning/:id/resolve` - Resolve warning
- `POST /api/v1/warning/configure` - Configure alert settings

### Model Management
- `POST /api/v1/models/train/admission` - Train admission model (admin)
- `POST /api/v1/models/train/success` - Train success factor model (admin)
- `POST /api/v1/models/retrain` - Retrain all models (admin)
- `GET /api/v1/models/performance/:type` - Get model performance
- `POST /api/v1/models/schedule/:type` - Schedule model retraining (admin)

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

4. Create model directories:
```bash
mkdir -p models/admission_prediction
mkdir -p models/success_factor
mkdir -p logs
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
- `JWT_SECRET`: Secret key for JWT token verification
- `MODEL_STORAGE_PATH`: Path for storing trained models
- `USER_SERVICE_URL`: URL of the user service
- `APPLICATION_SERVICE_URL`: URL of the application service
- `ANALYTICS_SERVICE_URL`: URL of the analytics service

### Model Configuration
Models can be configured via the training API with parameters:
- Architecture (layers, units, activation functions)
- Training parameters (learning rate, batch size, epochs)
- Validation settings (split ratio, cross-validation)

## Machine Learning Pipeline

### Data Preparation
1. **Feature Engineering**: Extract relevant features from user profiles
2. **Data Cleaning**: Handle missing values and outliers
3. **Normalization**: Scale features for optimal model performance
4. **Validation**: Split data for training and testing

### Model Training
1. **Architecture Design**: Define neural network structure
2. **Training Process**: Fit model with historical data
3. **Validation**: Evaluate model performance
4. **Deployment**: Save model for production use

### Performance Monitoring
- **Accuracy Tracking**: Monitor prediction accuracy over time
- **Drift Detection**: Identify when models need retraining
- **A/B Testing**: Compare model versions
- **Feedback Loop**: Incorporate new data for continuous improvement

## Risk Assessment Framework

### Risk Categories
1. **Deadline Risk**: Proximity to application deadlines
2. **Performance Risk**: Declining academic or engagement metrics
3. **Completion Risk**: Low probability of finishing applications
4. **Quality Risk**: Insufficient application quality

### Warning Levels
- **Low**: Minor concerns requiring attention
- **Medium**: Moderate risks needing action
- **High**: Significant risks requiring immediate attention
- **Critical**: Urgent issues threatening application success

### Mitigation Strategies
- **Proactive Alerts**: Early notification of potential issues
- **Personalized Recommendations**: Tailored action plans
- **Resource Allocation**: Prioritize high-risk areas
- **Timeline Adjustments**: Modify schedules to reduce risk

## Performance Optimization

### Caching Strategy
- **Model Predictions**: Cache frequent prediction requests
- **User Data**: Cache user profiles and application data
- **Benchmark Data**: Cache peer comparison data

### Database Optimization
- **Indexing**: Optimize queries with proper indexes
- **Connection Pooling**: Manage database connections efficiently
- **Query Optimization**: Use efficient database queries

### Model Optimization
- **Model Compression**: Reduce model size for faster inference
- **Batch Processing**: Process multiple predictions together
- **GPU Acceleration**: Use GPU for training and inference when available

## Monitoring and Logging

### Health Checks
- `/health` - Basic service health
- `/health/ready` - Readiness for traffic

### Metrics
- Prediction accuracy and latency
- Model performance metrics
- API response times
- Error rates and types

### Logging
- Structured JSON logging
- Request/response logging
- Error tracking and alerting
- Performance monitoring

## Security

### Authentication
- JWT token validation
- Role-based access control
- API rate limiting

### Data Protection
- Input validation and sanitization
- Secure model storage
- Encrypted data transmission
- Privacy-compliant data handling

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
docker build -t stellarrec-predictive-analytics .

# Run container
docker run -p 3008:3008 stellarrec-predictive-analytics
```

### Production Considerations
- Use production database
- Configure proper logging
- Set up monitoring and alerting
- Enable HTTPS
- Configure load balancing
- Set up backup and recovery

## Contributing

1. Follow TypeScript best practices
2. Write comprehensive tests
3. Document API changes
4. Follow semantic versioning
5. Update README for new features

## License

MIT License - see LICENSE file for details