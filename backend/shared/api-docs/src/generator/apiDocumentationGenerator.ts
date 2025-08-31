import { OpenApiGenerator } from './openApiGenerator';
import { SwaggerUIGenerator } from './swaggerUIGenerator';
import { CodeExampleGenerator } from './codeExampleGenerator';
import { VersionManager } from '../versioning/versionManager';
import { MockServerGenerator } from '../testing/mockServerGenerator';
import { ApiDocumentationConfig, ServiceDefinition, GenerationOptions } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ApiDocumentationGenerator {
  private config: ApiDocumentationConfig;
  private openApiGenerator: OpenApiGenerator;
  private swaggerUIGenerator: SwaggerUIGenerator;
  private codeExampleGenerator: CodeExampleGenerator;
  private versionManager: VersionManager;
  private mockServerGenerator: MockServerGenerator;

  constructor(config: ApiDocumentationConfig) {
    this.config = config;
    this.openApiGenerator = new OpenApiGenerator(config);
    this.swaggerUIGenerator = new SwaggerUIGenerator(config);
    this.codeExampleGenerator = new CodeExampleGenerator(config);
    this.versionManager = new VersionManager(config.versioning);
    this.mockServerGenerator = new MockServerGenerator();
  }

  async generateComplete(services: ServiceDefinition[], options: GenerationOptions = {
    includeDeprecated: false,
    includeInternal: false,
    outputFormat: 'yaml',
    minify: false,
    validate: true
  }): Promise<void> {
    console.log('🚀 Starting comprehensive API documentation generation...');

    try {
      // Ensure output directory exists
      await this.ensureOutputDirectory();

      // Generate OpenAPI specifications
      console.log('📝 Generating OpenAPI specifications...');
      await this.generateOpenApiSpecs(services, options);

      // Generate Swagger UI
      console.log('🎨 Generating Swagger UI...');
      await this.generateSwaggerUI();

      // Generate code examples
      if (this.config.includeExamples) {
        console.log('💻 Generating code examples...');
        await this.generateCodeExamples(services);
      }

      // Generate developer guides
      console.log('📚 Generating developer guides...');
      await this.generateDeveloperGuides(services);

      // Generate mock server
      if (this.config.generateMockServer) {
        console.log('🔧 Generating mock server...');
        await this.generateMockServer(services);
      }

      // Generate version documentation
      console.log('🔄 Generating version documentation...');
      await this.generateVersionDocumentation();

      // Generate postman collection
      console.log('📮 Generating Postman collection...');
      await this.generatePostmanCollection(services);

      // Generate SDK documentation
      console.log('🛠️  Generating SDK documentation...');
      await this.generateSdkDocumentation(services);

      console.log('✅ API documentation generation completed successfully!');
      console.log(`📁 Documentation available at: ${this.config.outputDir}`);

    } catch (error) {
      console.error('❌ API documentation generation failed:', error);
      throw error;
    }
  }

  async generateOpenApiSpecs(services: ServiceDefinition[], options: GenerationOptions): Promise<void> {
    for (const service of services) {
      const spec = await this.openApiGenerator.generateSpec(service, options);
      
      const filename = `${service.name}-${service.version}.${options.outputFormat}`;
      const filepath = path.join(this.config.outputDir, 'specs', filename);
      
      await this.writeFile(filepath, this.formatSpec(spec, options.outputFormat));
      console.log(`✅ Generated OpenAPI spec: ${filename}`);
    }

    // Generate combined spec
    const combinedSpec = await this.openApiGenerator.generateCombinedSpec(services, options);
    const combinedPath = path.join(this.config.outputDir, 'specs', `stellarrec-api.${options.outputFormat}`);
    await this.writeFile(combinedPath, this.formatSpec(combinedSpec, options.outputFormat));
    console.log('✅ Generated combined OpenAPI specification');
  }

  async generateSwaggerUI(): Promise<void> {
    const swaggerFiles = await this.swaggerUIGenerator.generate();
    
    for (const [filename, content] of Object.entries(swaggerFiles)) {
      const filepath = path.join(this.config.outputDir, 'swagger-ui', filename);
      await this.writeFile(filepath, content);
    }

    console.log('✅ Generated Swagger UI interface');
  }

  async generateCodeExamples(services: ServiceDefinition[]): Promise<void> {
    for (const service of services) {
      const examples = await this.codeExampleGenerator.generateExamples(service);
      
      for (const [language, code] of Object.entries(examples)) {
        const filepath = path.join(
          this.config.outputDir, 
          'examples', 
          language, 
          `${service.name}.${this.getFileExtension(language)}`
        );
        await this.writeFile(filepath, code);
      }
    }

    console.log('✅ Generated code examples for all languages');
  }

  async generateDeveloperGuides(services: ServiceDefinition[]): Promise<void> {
    // Quick Start Guide
    const quickStartGuide = this.generateQuickStartGuide(services);
    await this.writeFile(
      path.join(this.config.outputDir, 'guides', 'quick-start.md'),
      quickStartGuide
    );

    // Authentication Guide
    const authGuide = this.generateAuthenticationGuide();
    await this.writeFile(
      path.join(this.config.outputDir, 'guides', 'authentication.md'),
      authGuide
    );

    // Error Handling Guide
    const errorGuide = this.generateErrorHandlingGuide();
    await this.writeFile(
      path.join(this.config.outputDir, 'guides', 'error-handling.md'),
      errorGuide
    );

    // Rate Limiting Guide
    const rateLimitGuide = this.generateRateLimitingGuide();
    await this.writeFile(
      path.join(this.config.outputDir, 'guides', 'rate-limiting.md'),
      rateLimitGuide
    );

    // Webhooks Guide
    const webhooksGuide = this.generateWebhooksGuide();
    await this.writeFile(
      path.join(this.config.outputDir, 'guides', 'webhooks.md'),
      webhooksGuide
    );

    // Service-specific guides
    for (const service of services) {
      const serviceGuide = this.generateServiceGuide(service);
      await this.writeFile(
        path.join(this.config.outputDir, 'guides', 'services', `${service.name}.md`),
        serviceGuide
      );
    }

    console.log('✅ Generated developer guides');
  }

  async generateMockServer(services: ServiceDefinition[]): Promise<void> {
    const mockServerCode = await this.mockServerGenerator.generate(services);
    
    await this.writeFile(
      path.join(this.config.outputDir, 'mock-server', 'server.js'),
      mockServerCode.server
    );

    await this.writeFile(
      path.join(this.config.outputDir, 'mock-server', 'package.json'),
      mockServerCode.packageJson
    );

    await this.writeFile(
      path.join(this.config.outputDir, 'mock-server', 'README.md'),
      mockServerCode.readme
    );

    console.log('✅ Generated mock server');
  }

  async generateVersionDocumentation(): Promise<void> {
    const versionDocs = this.versionManager.generateDocumentation();
    
    await this.writeFile(
      path.join(this.config.outputDir, 'versioning', 'versions.md'),
      versionDocs.overview
    );

    await this.writeFile(
      path.join(this.config.outputDir, 'versioning', 'migration-guide.md'),
      versionDocs.migrationGuide
    );

    await this.writeFile(
      path.join(this.config.outputDir, 'versioning', 'changelog.md'),
      versionDocs.changelog
    );

    console.log('✅ Generated version documentation');
  }

  async generatePostmanCollection(services: ServiceDefinition[]): Promise<void> {
    const collection = {
      info: {
        name: this.config.title,
        description: this.config.description,
        version: this.config.version,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{access_token}}',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'base_url',
          value: this.config.baseUrl,
          type: 'string'
        }
      ],
      item: []
    };

    for (const service of services) {
      const serviceFolder = {
        name: service.name,
        item: []
      };

      for (const endpoint of service.endpoints) {
        const request = {
          name: endpoint.summary,
          request: {
            method: endpoint.method?.toUpperCase() || 'GET',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json'
              }
            ],
            url: {
              raw: `{{base_url}}${endpoint.path}`,
              host: ['{{base_url}}'],
              path: endpoint.path.split('/').filter(p => p)
            }
          }
        };

        serviceFolder.item.push(request);
      }

      collection.item.push(serviceFolder);
    }

    await this.writeFile(
      path.join(this.config.outputDir, 'postman', 'StellarRec-API.postman_collection.json'),
      JSON.stringify(collection, null, 2)
    );

    console.log('✅ Generated Postman collection');
  }

  async generateSdkDocumentation(services: ServiceDefinition[]): Promise<void> {
    const sdkLanguages = ['javascript', 'python', 'java', 'csharp', 'php', 'ruby'];

    for (const language of sdkLanguages) {
      const sdkDocs = this.generateSdkGuide(language, services);
      await this.writeFile(
        path.join(this.config.outputDir, 'sdks', `${language}.md`),
        sdkDocs
      );
    }

    console.log('✅ Generated SDK documentation');
  }

  private generateQuickStartGuide(services: ServiceDefinition[]): string {
    return `# Quick Start Guide

## Overview

Welcome to the StellarRec API! This guide will help you get started with integrating our API into your application.

## Authentication

All API requests require authentication using Bearer tokens:

\`\`\`bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \\
  https://api.stellarrec.com/v1/users/profile
\`\`\`

## Getting Your API Token

1. Sign up for a StellarRec developer account
2. Create a new application in the developer portal
3. Copy your API key from the application settings

## Making Your First Request

\`\`\`javascript
const response = await fetch('https://api.stellarrec.com/v1/universities', {
  headers: {
    'Authorization': 'Bearer YOUR_API_TOKEN',
    'Content-Type': 'application/json'
  }
});

const universities = await response.json();
console.log(universities);
\`\`\`

## Common Use Cases

### 1. Search Universities
\`\`\`javascript
const universities = await api.universities.search({
  query: 'Stanford',
  location: 'California',
  limit: 10
});
\`\`\`

### 2. Create Application
\`\`\`javascript
const application = await api.applications.create({
  universityId: 'univ-123',
  programId: 'prog-456',
  deadline: '2024-12-01'
});
\`\`\`

### 3. Get Recommendations
\`\`\`javascript
const matches = await api.matching.getRecommendations({
  studentId: 'user-123',
  preferences: {
    location: ['CA', 'NY'],
    programType: 'undergraduate'
  }
});
\`\`\`

## Next Steps

- [Authentication Guide](./authentication.md)
- [Error Handling](./error-handling.md)
- [Rate Limiting](./rate-limiting.md)
- [Code Examples](../examples/)
`;
  }

  private generateAuthenticationGuide(): string {
    return `# Authentication Guide

## Overview

The StellarRec API uses Bearer token authentication for all requests.

## Authentication Methods

### 1. API Key Authentication
For server-to-server communication:

\`\`\`bash
curl -H "Authorization: Bearer sk_live_..." \\
  https://api.stellarrec.com/v1/universities
\`\`\`

### 2. OAuth 2.0 Flow
For user-facing applications:

\`\`\`javascript
// Step 1: Redirect user to authorization URL
const authUrl = 'https://api.stellarrec.com/oauth/authorize?' +
  'client_id=YOUR_CLIENT_ID&' +
  'response_type=code&' +
  'redirect_uri=YOUR_REDIRECT_URI&' +
  'scope=read:profile write:applications';

window.location.href = authUrl;

// Step 2: Exchange code for token
const tokenResponse = await fetch('https://api.stellarrec.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    code: 'AUTHORIZATION_CODE',
    grant_type: 'authorization_code'
  })
});

const { access_token } = await tokenResponse.json();
\`\`\`

## Token Management

### Refresh Tokens
\`\`\`javascript
const refreshResponse = await fetch('https://api.stellarrec.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: 'YOUR_CLIENT_ID',
    client_secret: 'YOUR_CLIENT_SECRET',
    refresh_token: 'YOUR_REFRESH_TOKEN',
    grant_type: 'refresh_token'
  })
});
\`\`\`

## Scopes

| Scope | Description |
|-------|-------------|
| \`read:profile\` | Read user profile information |
| \`write:profile\` | Update user profile |
| \`read:applications\` | Read application data |
| \`write:applications\` | Create and update applications |
| \`read:universities\` | Access university data |
| \`admin\` | Full administrative access |

## Security Best Practices

1. **Never expose API keys in client-side code**
2. **Use HTTPS for all requests**
3. **Implement token refresh logic**
4. **Store tokens securely**
5. **Use minimal required scopes**
`;
  }

  private generateErrorHandlingGuide(): string {
    return `# Error Handling Guide

## Error Response Format

All errors follow a consistent format:

\`\`\`json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_FORMAT"
      }
    ],
    "request_id": "req-123456",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
\`\`\`

## HTTP Status Codes

| Status | Description | Action |
|--------|-------------|--------|
| 200 | Success | Continue |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Fix request parameters |
| 401 | Unauthorized | Check authentication |
| 403 | Forbidden | Check permissions |
| 404 | Not Found | Verify resource exists |
| 429 | Rate Limited | Implement backoff |
| 500 | Server Error | Retry with backoff |

## Common Error Codes

### Authentication Errors
- \`AUTHENTICATION_REQUIRED\`: Missing authorization header
- \`INVALID_TOKEN\`: Token is invalid or expired
- \`TOKEN_EXPIRED\`: Token has expired, refresh needed

### Validation Errors
- \`VALIDATION_ERROR\`: Request validation failed
- \`MISSING_REQUIRED_FIELD\`: Required field is missing
- \`INVALID_FORMAT\`: Field format is invalid

### Resource Errors
- \`RESOURCE_NOT_FOUND\`: Requested resource doesn't exist
- \`RESOURCE_CONFLICT\`: Resource already exists
- \`RESOURCE_LOCKED\`: Resource is temporarily locked

## Error Handling Examples

### JavaScript
\`\`\`javascript
try {
  const response = await fetch('/api/v1/applications', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(applicationData)
  });

  if (!response.ok) {
    const error = await response.json();
    
    switch (error.error.code) {
      case 'VALIDATION_ERROR':
        // Handle validation errors
        error.error.details.forEach(detail => {
          console.error(\`\${detail.field}: \${detail.message}\`);
        });
        break;
        
      case 'RATE_LIMIT_EXCEEDED':
        // Implement exponential backoff
        const retryAfter = response.headers.get('Retry-After');
        setTimeout(() => retryRequest(), retryAfter * 1000);
        break;
        
      default:
        console.error('API Error:', error.error.message);
    }
    
    throw new Error(error.error.message);
  }

  const result = await response.json();
  return result;
} catch (error) {
  console.error('Request failed:', error);
  throw error;
}
\`\`\`

### Python
\`\`\`python
import requests
import time
from requests.exceptions import RequestException

def make_api_request(url, data=None, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.post(url, json=data, headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            })
            
            if response.status_code == 429:
                # Rate limited - implement backoff
                retry_after = int(response.headers.get('Retry-After', 60))
                time.sleep(retry_after)
                continue
                
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            error_data = response.json()
            
            if error_data['error']['code'] == 'VALIDATION_ERROR':
                for detail in error_data['error']['details']:
                    print(f"Validation error - {detail['field']}: {detail['message']}")
                    
            raise Exception(error_data['error']['message'])
            
        except RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
\`\`\`

## Retry Logic

Implement exponential backoff for transient errors:

\`\`\`javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
\`\`\`
`;
  }

  private generateRateLimitingGuide(): string {
    return `# Rate Limiting Guide

## Overview

The StellarRec API implements rate limiting to ensure fair usage and maintain service quality.

## Rate Limits by Plan

| Plan | Requests/Hour | Burst Limit | Concurrent Requests |
|------|---------------|-------------|-------------------|
| Free | 1,000 | 100 | 5 |
| Basic | 10,000 | 500 | 20 |
| Pro | 100,000 | 2,000 | 100 |
| Enterprise | Unlimited | 10,000 | 500 |

## Rate Limit Headers

Every API response includes rate limit information:

\`\`\`
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642262400
X-RateLimit-Retry-After: 3600
\`\`\`

## Handling Rate Limits

### JavaScript Example
\`\`\`javascript
async function makeApiRequest(url, options = {}) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('X-RateLimit-Retry-After');
    console.log(\`Rate limited. Retry after \${retryAfter} seconds\`);
    
    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return makeApiRequest(url, options);
  }
  
  return response;
}
\`\`\`

### Python Example
\`\`\`python
import time
import requests

def make_request_with_backoff(url, **kwargs):
    response = requests.get(url, **kwargs)
    
    if response.status_code == 429:
        retry_after = int(response.headers.get('X-RateLimit-Retry-After', 60))
        print(f"Rate limited. Waiting {retry_after} seconds...")
        time.sleep(retry_after)
        return make_request_with_backoff(url, **kwargs)
    
    return response
\`\`\`

## Best Practices

1. **Monitor Rate Limit Headers**: Check remaining requests before making calls
2. **Implement Exponential Backoff**: Gradually increase delay between retries
3. **Cache Responses**: Reduce API calls by caching frequently accessed data
4. **Batch Requests**: Use bulk endpoints when available
5. **Use Webhooks**: Receive real-time updates instead of polling

## Rate Limit Scopes

Rate limits are applied per:
- **API Key**: For server-to-server requests
- **User**: For OAuth-authenticated requests
- **IP Address**: As a fallback for unauthenticated requests

## Increasing Rate Limits

Contact our support team to discuss higher rate limits for your use case:
- Email: api-support@stellarrec.com
- Include your use case and expected traffic patterns
`;
  }

  private generateWebhooksGuide(): string {
    return `# Webhooks Guide

## Overview

Webhooks allow you to receive real-time notifications when events occur in your StellarRec account.

## Supported Events

| Event | Description |
|-------|-------------|
| \`user.created\` | New user registered |
| \`user.updated\` | User profile updated |
| \`application.created\` | New application created |
| \`application.submitted\` | Application submitted |
| \`application.status_changed\` | Application status updated |
| \`letter.requested\` | Recommendation letter requested |
| \`letter.completed\` | Recommendation letter completed |
| \`match.found\` | New university match found |

## Webhook Payload

\`\`\`json
{
  "id": "evt_123456",
  "type": "application.submitted",
  "created": "2024-01-15T10:30:00Z",
  "data": {
    "object": {
      "id": "app-123",
      "student_id": "user-456",
      "university_id": "univ-789",
      "status": "submitted",
      "submitted_at": "2024-01-15T10:30:00Z"
    }
  },
  "previous_attributes": {
    "status": "draft"
  }
}
\`\`\`

## Setting Up Webhooks

### 1. Create Webhook Endpoint
\`\`\`javascript
// Express.js example
app.post('/webhooks/stellarrec', (req, res) => {
  const event = req.body;
  
  // Verify webhook signature
  const signature = req.headers['x-stellarrec-signature'];
  if (!verifySignature(req.body, signature)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process event
  switch (event.type) {
    case 'application.submitted':
      handleApplicationSubmitted(event.data.object);
      break;
    case 'letter.completed':
      handleLetterCompleted(event.data.object);
      break;
    default:
      console.log(\`Unhandled event type: \${event.type}\`);
  }
  
  res.status(200).send('OK');
});
\`\`\`

### 2. Register Webhook URL
\`\`\`bash
curl -X POST https://api.stellarrec.com/v1/webhooks \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-app.com/webhooks/stellarrec",
    "events": ["application.submitted", "letter.completed"],
    "active": true
  }'
\`\`\`

## Security

### Signature Verification
\`\`\`javascript
const crypto = require('crypto');

function verifySignature(payload, signature) {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}
\`\`\`

## Retry Logic

StellarRec will retry failed webhook deliveries:
- **Retry Schedule**: 1m, 5m, 30m, 2h, 6h, 12h, 24h
- **Timeout**: 30 seconds per attempt
- **Success Codes**: 200-299
- **Failure Codes**: 400-599 (will retry), 200-299 (success)

## Testing Webhooks

Use our webhook testing tool:
\`\`\`bash
# Install CLI tool
npm install -g @stellarrec/webhook-tester

# Start local tunnel
stellarrec-webhook-test --port 3000 --path /webhooks/stellarrec
\`\`\`

## Best Practices

1. **Idempotency**: Handle duplicate events gracefully
2. **Quick Response**: Respond within 30 seconds
3. **Async Processing**: Queue heavy processing for later
4. **Signature Verification**: Always verify webhook signatures
5. **Error Handling**: Return appropriate HTTP status codes
`;
  }

  private generateServiceGuide(service: ServiceDefinition): string {
    return `# ${service.name} Service Guide

## Overview

${service.name} service provides functionality for [service description].

## Base URL
\`${service.baseUrl}\`

## Authentication
All endpoints require Bearer token authentication.

## Endpoints

${service.endpoints.map(endpoint => `
### ${endpoint.method?.toUpperCase()} ${endpoint.path}
${endpoint.summary}

${endpoint.description || ''}

**Parameters:**
${endpoint.parameters?.map(param => `- \`${param.name}\` (${param.required ? 'required' : 'optional'}): ${param.description || ''}`).join('\n') || 'None'}

**Example Request:**
\`\`\`bash
curl -X ${endpoint.method?.toUpperCase()} "${service.baseUrl}${endpoint.path}" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json"
\`\`\`
`).join('\n')}

## Error Codes

Common error codes for this service:
- \`400\`: Bad Request
- \`401\`: Unauthorized
- \`403\`: Forbidden
- \`404\`: Not Found
- \`500\`: Internal Server Error

## Rate Limits

This service follows the standard rate limiting policies.
`;
  }

  private generateSdkGuide(language: string, services: ServiceDefinition[]): string {
    const examples = {
      javascript: {
        install: 'npm install @stellarrec/client-js',
        import: "import { StellarRecAPI } from '@stellarrec/client-js';",
        init: `const api = new StellarRecAPI({
  baseURL: 'https://api.stellarrec.com',
  apiKey: 'your-api-key'
});`
      },
      python: {
        install: 'pip install stellarrec-python',
        import: 'from stellarrec import StellarRecAPI',
        init: `api = StellarRecAPI(
    base_url='https://api.stellarrec.com',
    api_key='your-api-key'
)`
      }
    };

    const lang = examples[language] || examples.javascript;

    return `# ${language.charAt(0).toUpperCase() + language.slice(1)} SDK

## Installation

\`\`\`bash
${lang.install}
\`\`\`

## Quick Start

\`\`\`${language}
${lang.import}

${lang.init}

// Example usage
const universities = await api.universities.list();
console.log(universities);
\`\`\`

## Available Methods

${services.map(service => `
### ${service.name}
${service.endpoints.map(endpoint => `- \`${endpoint.operationId}\`: ${endpoint.summary}`).join('\n')}
`).join('\n')}

## Error Handling

The SDK automatically handles common errors and provides structured error objects.

## Configuration

Configure the SDK with various options for timeout, retries, and more.
`;
  }

  private async ensureOutputDirectory(): Promise<void> {
    const dirs = [
      this.config.outputDir,
      path.join(this.config.outputDir, 'specs'),
      path.join(this.config.outputDir, 'swagger-ui'),
      path.join(this.config.outputDir, 'examples'),
      path.join(this.config.outputDir, 'guides'),
      path.join(this.config.outputDir, 'guides', 'services'),
      path.join(this.config.outputDir, 'versioning'),
      path.join(this.config.outputDir, 'postman'),
      path.join(this.config.outputDir, 'sdks'),
      path.join(this.config.outputDir, 'mock-server')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create language-specific example directories
    for (const language of this.config.languages) {
      await fs.mkdir(path.join(this.config.outputDir, 'examples', language), { recursive: true });
    }
  }

  private async writeFile(filepath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, content, 'utf8');
  }

  private formatSpec(spec: any, format: 'yaml' | 'json'): string {
    if (format === 'yaml') {
      const yaml = require('yaml');
      return yaml.stringify(spec);
    }
    return JSON.stringify(spec, null, 2);
  }

  private getFileExtension(language: string): string {
    const extensions = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      csharp: 'cs',
      php: 'php',
      ruby: 'rb',
      go: 'go',
      swift: 'swift',
      kotlin: 'kt'
    };
    return extensions[language] || 'txt';
  }
}