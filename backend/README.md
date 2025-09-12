# StellarRec Backend API

AI-powered university application platform backend built with microservices architecture.

## 🏗️ Architecture

The StellarRec backend is built using a microservices architecture with the following services:

- **API Gateway** - Authentication, rate limiting, request routing
- **User Service** - User management, profiles, authentication
- **AI/ML Service** - University matching, essay analysis, predictions
- **Application Service** - Application tracking, deadline management
- **Letter Service** - Recommendation letter workflows
- **Notification Service** - Multi-channel notifications
- **Analytics Service** - Performance metrics and insights
- **File Service** - Document management and storage

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for full microservices)
- PostgreSQL 15+ (for full microservices)
- Redis 7+ (for full microservices)
- Elasticsearch 8+ (for full microservices)

### Simple Server Setup (Recommendation Emails)

For the basic recommendation email functionality:

1. **Setup the simple server:**
```bash
cd backend
cp .env.example .env
npm install
```

2. **Configure environment variables in `.env`:**
```bash
# Required for email functionality
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM=StellarRec <no-reply@yourdomain.com>
FRONTEND_BASE=https://stellarrec.netlify.app/dashboard
SIGNING_SECRET=your_strong_secret_here
```

3. **Start the server:**
```bash
# Start the recommendation server
npm start

# Or for development with auto-reload
npm run dev
```

4. **Server will be available at:**
- http://localhost:3000 (or PORT from .env)
- Endpoint: `POST /api/recommendations`

### Full Microservices Setup

1. **Clone and setup the project:**
```bash
cd backend
cp .env.example .env
npm install
```

2. **Start the development environment:**
```bash
# Start all services with Docker Compose
npm run dev

# Or start individual services
npm run dev:gateway
npm run dev:user
npm run dev:ai
npm run dev:application
```

3. **Initialize the database:**
```bash
npm run migrate
npm run seed
```

4. **Access the services:**
- API Gateway: http://localhost:3000
- User Service: http://localhost:3001
- AI/ML Service: http://localhost:3002
- Application Service: http://localhost:3003

## 📊 Database

The application uses PostgreSQL as the primary database with the following key tables:

- `users` - User accounts and authentication
- `student_profiles` - Student profile information
- `recommender_profiles` - Recommender profile information
- `universities` - University data and requirements
- `applications` - Application tracking
- `recommendation_letters` - Letter management
- `university_matches` - AI-generated university matches

## 🔧 Development

### Project Structure

```
backend/
├── services/
│   ├── api-gateway/          # API Gateway service
│   ├── user-service/         # User management
│   ├── ai-service/           # AI/ML operations
│   ├── application-service/  # Application tracking
│   ├── letter-service/       # Letter management
│   ├── notification-service/ # Notifications
│   ├── analytics-service/    # Analytics
│   └── file-service/         # File management
├── shared/
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Shared utilities
│   └── middleware/          # Shared middleware
├── database/
│   ├── init/                # Database initialization
│   ├── migrations/          # Database migrations
│   └── seeds/               # Seed data
└── docker-compose.yml       # Development environment
```

### Available Scripts

```bash
# Development
npm run dev                  # Start all services
npm run dev:gateway         # Start API Gateway only
npm run dev:user            # Start User Service only

# Testing
npm test                    # Run all tests
npm run test:unit           # Run unit tests
npm run test:integration    # Run integration tests
npm run test:e2e            # Run end-to-end tests

# Building
npm run build               # Build all services
npm run docker:build       # Build Docker images
npm run docker:up           # Start with Docker Compose

# Database
npm run migrate             # Run database migrations
npm run seed                # Seed database with test data
npm run db:reset            # Reset database
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://stellarrec:password@localhost:5432/stellarrec_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret_here

# External APIs
OPENAI_API_KEY=your_openai_key_here
SENDGRID_API_KEY=your_sendgrid_key_here
```

## 🧪 Testing

The project includes comprehensive testing:

- **Unit Tests** - Individual function and component testing
- **Integration Tests** - Service interaction testing
- **End-to-End Tests** - Complete workflow testing
- **Performance Tests** - Load and stress testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm run test:user-service
npm run test:ai-service
```

## 📚 API Documentation

API documentation is available at:
- Development: http://localhost:3000/docs
- Staging: https://staging-api.stellarrec.com/docs
- Production: https://api.stellarrec.com/docs

### Key Endpoints

```bash
# Recommendation Requests (Simple Server)
POST /api/recommendations          # Send recommendation request email

# Authentication (Full Microservices)
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/refresh

# Users
GET  /api/v1/users/profile
PUT  /api/v1/users/profile
POST /api/v1/users/upload-avatar

# AI Services
POST /api/v1/ai/university-matches
POST /api/v1/ai/essay-analysis
POST /api/v1/ai/success-prediction

# Applications
GET  /api/v1/applications
POST /api/v1/applications
PUT  /api/v1/applications/{id}

# Letters
GET  /api/v1/letters
POST /api/v1/letters
PUT  /api/v1/letters/{id}
```

#### Recommendation Request API

**POST /api/recommendations**

Sends a recommendation request email to a recommender with a pre-filled link to the dashboard.

**Request Body:**
```json
{
  "student_name": "John Doe",
  "student_email": "john@example.com",
  "student_first": "John",
  "student_last": "Doe",
  "recommender_name": "Prof. Jane Smith",
  "recommender_email": "jane@university.edu",
  "unitids": ["166027", "110635", "MOCK-1"],
  "waive": 1,
  "title": "Recommendation for John Doe"
}
```

**Response:**
```json
{
  "id": "sr_1703123456789_abc123",
  "status": "ok"
}
```

**Error Response:**
```json
{
  "error": "Missing fields"
}
```

## 🔒 Security

- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Rate limiting and request throttling
- Input validation and sanitization
- SQL injection protection
- CORS configuration
- Security headers
- Audit logging

## 🚀 Deployment

### Docker Deployment

```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose up --scale user-service=3 --scale ai-service=2
```

### Production Environment

The application is designed to run on:
- **Container Orchestration**: Kubernetes
- **Cloud Provider**: AWS/GCP/Azure
- **Database**: Amazon RDS PostgreSQL
- **Cache**: Amazon ElastiCache Redis
- **Search**: Amazon Elasticsearch Service
- **File Storage**: Amazon S3
- **Monitoring**: Prometheus + Grafana

## 📊 Monitoring

- **Application Performance**: New Relic/DataDog
- **Infrastructure**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Error Tracking**: Sentry
- **Uptime Monitoring**: Pingdom/StatusPage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Email: support@stellarrec.com
- Documentation: https://docs.stellarrec.com
- Issues: GitHub Issues
- Slack: #stellarrec-dev