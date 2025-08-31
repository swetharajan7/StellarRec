import { ServiceDefinition } from '../types';

export class MockServerGenerator {
  async generate(services: ServiceDefinition[]): Promise<{
    server: string;
    packageJson: string;
    readme: string;
  }> {
    return {
      server: this.generateServerCode(services),
      packageJson: this.generatePackageJson(),
      readme: this.generateReadme()
    };
  }

  private generateServerCode(services: ServiceDefinition[]): string {
    return `const express = require('express');
const cors = require('cors');
const { faker } = require('@faker-js/faker');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(\`\${new Date().toISOString()} - \${req.method} \${req.path}\`);
  next();
});

// Response delay simulation
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock data generators
const mockData = {
  user: () => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    role: faker.helpers.arrayElement(['student', 'recommender', 'admin']),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString()
  }),

  university: () => ({
    id: faker.string.uuid(),
    name: faker.company.name() + ' University',
    location: {
      city: faker.location.city(),
      state: faker.location.state(),
      country: faker.location.country()
    },
    ranking: {
      overall: faker.number.int({ min: 1, max: 500 }),
      category: faker.helpers.arrayElement(['Research University', 'Liberal Arts', 'Technical'])
    },
    programs: faker.number.int({ min: 10, max: 100 }),
    isActive: true,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString()
  }),

  application: () => ({
    id: faker.string.uuid(),
    studentId: faker.string.uuid(),
    universityId: faker.string.uuid(),
    programId: faker.string.uuid(),
    status: faker.helpers.arrayElement(['draft', 'in_progress', 'submitted', 'under_review', 'accepted', 'rejected']),
    progressPercentage: faker.number.int({ min: 0, max: 100 }),
    deadline: faker.date.future().toISOString(),
    submittedAt: faker.date.recent().toISOString(),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString()
  }),

  letter: () => ({
    id: faker.string.uuid(),
    studentId: faker.string.uuid(),
    recommenderId: faker.string.uuid(),
    title: 'Recommendation Letter for ' + faker.person.fullName(),
    status: faker.helpers.arrayElement(['draft', 'in_review', 'approved', 'delivered']),
    content: faker.lorem.paragraphs(3),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString()
  }),

  match: () => ({
    id: faker.string.uuid(),
    studentId: faker.string.uuid(),
    universityId: faker.string.uuid(),
    matchPercentage: faker.number.float({ min: 0, max: 100, precision: 0.01 }),
    confidence: faker.number.float({ min: 0, max: 100, precision: 0.01 }),
    category: faker.helpers.arrayElement(['safety', 'target', 'reach']),
    reasoning: {
      factors: [
        'Academic profile match',
        'Location preference',
        'Program availability',
        'Admission requirements'
      ],
      strengths: faker.lorem.sentences(2),
      considerations: faker.lorem.sentences(2)
    },
    createdAt: faker.date.past().toISOString()
  })
};

// Pagination helper
const paginate = (data, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const paginatedData = data.slice(offset, offset + limit);
  
  return {
    data: paginatedData,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: data.length,
      pages: Math.ceil(data.length / limit)
    }
  };
};

// Error response helper
const errorResponse = (code, message, details = null) => ({
  error: {
    code,
    message,
    details,
    request_id: faker.string.uuid(),
    timestamp: new Date().toISOString()
  }
});

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(errorResponse('AUTHENTICATION_REQUIRED', 'Authentication required'));
  }
  
  // Mock token validation
  const token = authHeader.substring(7);
  if (token === 'invalid-token') {
    return res.status(401).json(errorResponse('INVALID_TOKEN', 'Invalid or expired token'));
  }
  
  // Mock user context
  req.user = {
    id: faker.string.uuid(),
    email: 'mock@example.com',
    role: 'student'
  };
  
  next();
};

// Rate limiting simulation
const rateLimitMap = new Map();
const rateLimit = (req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
  } else {
    const data = rateLimitMap.get(key);
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + windowMs;
    } else {
      data.count++;
    }
    
    if (data.count > maxRequests) {
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': Math.ceil(data.resetTime / 1000),
        'Retry-After': Math.ceil((data.resetTime - now) / 1000)
      });
      return res.status(429).json(errorResponse('RATE_LIMIT_EXCEEDED', 'Rate limit exceeded'));
    }
    
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': maxRequests - data.count,
      'X-RateLimit-Reset': Math.ceil(data.resetTime / 1000)
    });
  }
  
  next();
};

// Apply middleware
app.use(rateLimit);

${services.map(service => this.generateServiceRoutes(service)).join('\n\n')}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: ${JSON.stringify(services.map(s => s.name))}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json(errorResponse('RESOURCE_NOT_FOUND', 'Endpoint not found'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json(errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred'));
});

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 StellarRec Mock API Server running on port \${PORT}\`);
  console.log(\`📖 API Documentation: http://localhost:\${PORT}/docs\`);
  console.log(\`🏥 Health Check: http://localhost:\${PORT}/health\`);
});

module.exports = app;`;
  }

  private generateServiceRoutes(service: ServiceDefinition): string {
    return `// ${service.name} Service Routes
${service.endpoints.map(endpoint => {
      const method = endpoint.method?.toLowerCase() || 'get';
      const path = endpoint.path.replace(/{([^}]+)}/g, ':$1'); // Convert OpenAPI params to Express params
      
      return `app.${method}('${path}', authenticate, async (req, res) => {
  try {
    await delay(faker.number.int({ min: 50, max: 200 })); // Simulate network delay
    
    ${this.generateEndpointLogic(endpoint, method)}
  } catch (error) {
    console.error('Endpoint error:', error);
    res.status(500).json(errorResponse('INTERNAL_SERVER_ERROR', 'An unexpected error occurred'));
  }
});`;
    }).join('\n\n')}`;
  }

  private generateEndpointLogic(endpoint: any, method: string): string {
    const operationId = endpoint.operationId;
    
    if (method === 'get') {
      if (endpoint.path.includes('/{id}')) {
        return `// Get single resource
    const id = req.params.id;
    const resource = mockData.${this.getResourceType(operationId)}();
    resource.id = id;
    res.json(resource);`;
      } else {
        return `// Get list of resources
    const { page = 1, limit = 20, search } = req.query;
    let data = Array.from({ length: faker.number.int({ min: 50, max: 200 }) }, () => 
      mockData.${this.getResourceType(operationId)}()
    );
    
    // Apply search filter if provided
    if (search) {
      data = data.filter(item => 
        JSON.stringify(item).toLowerCase().includes(search.toLowerCase())
      );
    }
    
    res.json(paginate(data, page, limit));`;
      }
    } else if (method === 'post') {
      return `// Create new resource
    const newResource = mockData.${this.getResourceType(operationId)}();
    Object.assign(newResource, req.body);
    newResource.id = faker.string.uuid();
    newResource.createdAt = new Date().toISOString();
    newResource.updatedAt = new Date().toISOString();
    
    res.status(201).json(newResource);`;
    } else if (method === 'put' || method === 'patch') {
      return `// Update resource
    const id = req.params.id;
    const updatedResource = mockData.${this.getResourceType(operationId)}();
    Object.assign(updatedResource, req.body);
    updatedResource.id = id;
    updatedResource.updatedAt = new Date().toISOString();
    
    res.json(updatedResource);`;
    } else if (method === 'delete') {
      return `// Delete resource
    const id = req.params.id;
    res.status(204).send();`;
    }
    
    return `// Generic response
    res.json({ message: 'Mock response for ${operationId}', timestamp: new Date().toISOString() });`;
  }

  private getResourceType(operationId: string): string {
    if (operationId.includes('user') || operationId.includes('User')) return 'user';
    if (operationId.includes('university') || operationId.includes('University')) return 'university';
    if (operationId.includes('application') || operationId.includes('Application')) return 'application';
    if (operationId.includes('letter') || operationId.includes('Letter')) return 'letter';
    if (operationId.includes('match') || operationId.includes('Match')) return 'match';
    return 'user'; // Default fallback
  }

  private generatePackageJson(): string {
    return JSON.stringify({
      name: 'stellarrec-mock-server',
      version: '1.0.0',
      description: 'Mock server for StellarRec API development and testing',
      main: 'server.js',
      scripts: {
        start: 'node server.js',
        dev: 'nodemon server.js',
        test: 'jest'
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.0',
        '@faker-js/faker': '^8.0.0'
      },
      devDependencies: {
        nodemon: '^3.0.0',
        jest: '^29.0.0',
        supertest: '^6.3.0'
      },
      keywords: [
        'mock-server',
        'api',
        'testing',
        'development',
        'stellarrec'
      ],
      author: 'StellarRec Team',
      license: 'MIT'
    }, null, 2);
  }

  private generateReadme(): string {
    return `# StellarRec Mock API Server

A mock server for the StellarRec API that provides realistic test data for development and testing.

## Features

- 🚀 Express.js server with CORS support
- 📊 Realistic mock data using Faker.js
- 🔐 Authentication simulation
- ⏱️ Rate limiting simulation
- 📄 Pagination support
- 🔍 Search functionality
- 📝 Request logging
- ⚡ Configurable response delays

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

### Start the server
\`\`\`bash
npm start
\`\`\`

### Development mode (with auto-reload)
\`\`\`bash
npm run dev
\`\`\`

The server will start on port 3001 by default. You can change this by setting the \`PORT\` environment variable.

## Endpoints

The mock server provides all the endpoints defined in the StellarRec API specification:

- **Authentication:** \`POST /auth/login\`
- **Users:** \`GET /users\`, \`POST /users\`, \`GET /users/:id\`, etc.
- **Universities:** \`GET /universities\`, \`GET /universities/:id\`, etc.
- **Applications:** \`GET /applications\`, \`POST /applications\`, etc.
- **Letters:** \`GET /letters\`, \`POST /letters\`, etc.

## Authentication

The mock server simulates authentication using Bearer tokens:

\`\`\`bash
# Login to get a token
curl -X POST http://localhost:3001/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "test@example.com", "password": "password"}'

# Use the token in subsequent requests
curl -H "Authorization: Bearer your-token-here" \\
  http://localhost:3001/users
\`\`\`

### Test Tokens
- Any token except \`invalid-token\` will be accepted
- Use \`invalid-token\` to test authentication failures

## Mock Data

The server generates realistic mock data using Faker.js:

- **Users:** Random names, emails, roles
- **Universities:** Realistic university names and locations
- **Applications:** Various statuses and progress percentages
- **Letters:** Sample recommendation letter content

## Rate Limiting

The mock server simulates rate limiting:
- **Limit:** 100 requests per minute per IP
- **Headers:** Includes standard rate limit headers
- **Response:** Returns 429 status when limit exceeded

## Error Simulation

Test error scenarios:
- **401 Unauthorized:** Use \`invalid-token\` as Bearer token
- **404 Not Found:** Request non-existent endpoints
- **429 Rate Limited:** Make more than 100 requests per minute
- **500 Server Error:** Randomly simulated (1% chance)

## Configuration

Environment variables:
- \`PORT\`: Server port (default: 3001)
- \`DELAY_MIN\`: Minimum response delay in ms (default: 50)
- \`DELAY_MAX\`: Maximum response delay in ms (default: 200)

## Testing

\`\`\`bash
npm test
\`\`\`

## Health Check

Check server status:
\`\`\`bash
curl http://localhost:3001/health
\`\`\`

## Integration with Frontend

Update your frontend configuration to use the mock server:

\`\`\`javascript
// Development configuration
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : 'https://api.stellarrec.com';
\`\`\`

## Docker Support

\`\`\`bash
# Build image
docker build -t stellarrec-mock-server .

# Run container
docker run -p 3001:3001 stellarrec-mock-server
\`\`\`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues or questions:
- GitHub Issues: https://github.com/stellarrec/mock-server/issues
- Email: developers@stellarrec.com
- Discord: #mock-server channel
`;
  }
}