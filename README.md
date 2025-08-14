# StellarRec™ - Universal College and Graduate Recommendation System

StellarRec™ is a revolutionary platform that streamlines the university recommendation process by allowing one recommendation letter to be submitted to multiple universities simultaneously. The system eliminates redundant work for recommenders while providing AI-powered writing assistance and seamless integration with university portals.

## 🚀 Features

- **Universal Recommendations**: One letter submitted to multiple universities
- **AI-Powered Writing Assistant**: ChatGPT-5 integration for recommendation writing
- **Secure Authentication**: Role-based access control for students, recommenders, and admins
- **University Integration**: Automated submission to university portals
- **Real-time Tracking**: Live status updates and notifications
- **Google Docs Integration**: Automatic document creation and management
- **FERPA & GDPR Compliant**: Enterprise-grade security and privacy

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React.js with TypeScript
- Material-UI for design components
- Redux for state management
- React Query for data fetching

**Backend:**
- Node.js with Express.js
- TypeScript for type safety
- PostgreSQL with connection pooling
- Redis for caching and sessions

**Infrastructure:**
- Docker for containerization
- AWS for cloud deployment
- SendGrid for email notifications
- OpenAI API for AI assistance

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stellarrec-system
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start the development environment**
   ```bash
   docker-compose up -d
   ```

4. **Access the applications**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Database Admin (pgAdmin): http://localhost:5050

### Manual Setup (without Docker)

1. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Set up PostgreSQL**
   ```bash
   # Create database
   createdb stellarrec
   
   # Run initial schema
   psql stellarrec < database/init.sql
   ```

3. **Set up Redis**
   ```bash
   # Install and start Redis
   redis-server
   ```

4. **Start the applications**
   ```bash
   # Backend (in backend directory)
   npm run dev
   
   # Frontend (in frontend directory)
   npm start
   ```

## 📁 Project Structure

```
stellarrec-system/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── config/         # Database, Redis, and other configs
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Custom middleware
│   │   ├── models/         # Data models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── utils/          # Utility functions
│   ├── Dockerfile
│   └── package.json
├── frontend/               # React.js application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── store/          # Redux store
│   │   ├── theme/          # Material-UI theme
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utility functions
│   ├── Dockerfile
│   └── package.json
├── database/               # Database schemas and migrations
│   └── init.sql
├── docker-compose.yml      # Docker services configuration
└── README.md
```

## 🔧 Available Scripts

### Backend
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests

### Frontend
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

### Docker
- `docker-compose up -d` - Start all services in background
- `docker-compose down` - Stop all services
- `docker-compose logs -f [service]` - View service logs

## 🗄️ Database Schema

The system uses PostgreSQL with the following main tables:
- `users` - User accounts (students, recommenders, admins)
- `applications` - Student applications
- `universities` - University information
- `recommendations` - Recommendation letters
- `submissions` - University submission tracking
- `audit_logs` - System audit trail

## 🔐 Environment Variables

Key environment variables (see `.env.example`):
- `DB_*` - Database configuration
- `REDIS_*` - Redis configuration
- `JWT_SECRET` - JWT signing secret
- `OPENAI_API_KEY` - OpenAI API key
- `SENDGRID_API_KEY` - Email service API key

## 🚀 Deployment

### Production Deployment

1. **Set up cloud infrastructure**
   - AWS EC2 instances with auto-scaling
   - AWS RDS PostgreSQL
   - AWS ElastiCache Redis
   - AWS S3 for file storage

2. **Configure environment**
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export DB_HOST=your-rds-endpoint
   # ... other production configs
   ```

3. **Deploy application**
   ```bash
   # Build and deploy
   npm run build
   # Deploy to your cloud provider
   ```

## 📊 Monitoring and Logging

- **Application Monitoring**: New Relic integration
- **Error Tracking**: Sentry for error monitoring
- **Logging**: Centralized logging with AWS CloudWatch
- **Health Checks**: Built-in health check endpoints

## 🧪 Testing

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Integration tests
npm run test:integration
```

### Test Coverage
- Unit tests for business logic
- Integration tests for API endpoints
- End-to-end tests for user workflows

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.


---
