# StellarRec API Documentation

## Overview

This module provides comprehensive API documentation for the StellarRec platform, including OpenAPI 3.0 specifications, interactive Swagger UI, developer guides, and code examples in multiple programming languages.

## Features

- **OpenAPI 3.0 Specifications**: Complete API schema definitions
- **Interactive Swagger UI**: Live API testing and exploration
- **Developer Guides**: Step-by-step integration tutorials
- **Code Examples**: Multi-language client implementations
- **API Versioning**: Version management and deprecation policies
- **Authentication**: Comprehensive auth documentation
- **Error Handling**: Detailed error codes and responses

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OpenAPI 3.0   │    │   Swagger UI    │    │  Developer      │
│  Specifications │    │   Interactive   │    │   Portal        │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                API Documentation Generator                       │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│   Schema        │   Code Gen      │   Validation    │ Versioning│
│  Generator      │   Templates     │   Tools         │ Manager   │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Service       │    │   Client SDKs   │    │   Mock Server   │
│ Definitions     │    │  (Multi-lang)   │    │   & Testing     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Installation

```bash
npm install @stellarrec/api-docs
```

## Usage

### Generate API Documentation

```typescript
import { ApiDocumentationGenerator } from '@stellarrec/api-docs';

const generator = new ApiDocumentationGenerator({
  title: 'StellarRec API',
  version: '1.0.0',
  baseUrl: 'https://api.stellarrec.com',
  outputDir: './docs'
});

// Generate OpenAPI specs
await generator.generateOpenApiSpecs();

// Generate Swagger UI
await generator.generateSwaggerUI();

// Generate code examples
await generator.generateCodeExamples();
```

### Serve Documentation

```typescript
import { DocumentationServer } from '@stellarrec/api-docs';

const server = new DocumentationServer({
  port: 3001,
  docsPath: './docs',
  enableLiveReload: true
});

await server.start();
// Documentation available at http://localhost:3001
```

## API Endpoints Documentation

### Authentication Endpoints

#### POST /auth/login
Authenticate user and receive access token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "student"
  }
}
```

### User Management Endpoints

#### GET /users/profile
Get current user profile information.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "role": "student",
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "graduationYear": 2024
  }
}
```

### University Endpoints

#### GET /universities
Get list of universities with filtering and pagination.

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20)
- `search` (string): Search term
- `location` (string): Filter by location
- `ranking` (string): Filter by ranking range

**Response:**
```json
{
  "data": [
    {
      "id": "univ-123",
      "name": "Stanford University",
      "location": {
        "city": "Stanford",
        "state": "CA",
        "country": "USA"
      },
      "ranking": {
        "overall": 3,
        "category": "Research University"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "pages": 25
  }
}
```

## Code Examples

### JavaScript/TypeScript

```typescript
import { StellarRecAPI } from '@stellarrec/client-js';

const api = new StellarRecAPI({
  baseURL: 'https://api.stellarrec.com',
  apiKey: 'your-api-key'
});

// Authenticate
const auth = await api.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Get universities
const universities = await api.universities.list({
  search: 'Stanford',
  limit: 10
});

// Create application
const application = await api.applications.create({
  universityId: 'univ-123',
  programId: 'prog-456',
  deadline: '2024-12-01'
});
```

### Python

```python
from stellarrec import StellarRecAPI

api = StellarRecAPI(
    base_url='https://api.stellarrec.com',
    api_key='your-api-key'
)

# Authenticate
auth = api.auth.login(
    email='user@example.com',
    password='password'
)

# Get universities
universities = api.universities.list(
    search='Stanford',
    limit=10
)

# Create application
application = api.applications.create(
    university_id='univ-123',
    program_id='prog-456',
    deadline='2024-12-01'
)
```

### cURL

```bash
# Authenticate
curl -X POST https://api.stellarrec.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password"
  }'

# Get universities
curl -X GET "https://api.stellarrec.com/universities?search=Stanford&limit=10" \
  -H "Authorization: Bearer {access_token}"

# Create application
curl -X POST https://api.stellarrec.com/applications \
  -H "Authorization: Bearer {access_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "universityId": "univ-123",
    "programId": "prog-456",
    "deadline": "2024-12-01"
  }'
```

## API Versioning

### Version Strategy
- **URL Versioning**: `/v1/`, `/v2/`, etc.
- **Header Versioning**: `API-Version: 1.0`
- **Backward Compatibility**: Maintained for 2 major versions
- **Deprecation Notice**: 6 months advance notice

### Version Migration Guide

#### From v1.0 to v1.1
- Added `pagination` object to list responses
- Deprecated `total_count` field (use `pagination.total`)
- Added `created_at` and `updated_at` to all resources

#### From v1.1 to v2.0
- **Breaking Changes:**
  - Renamed `user_id` to `userId` in all responses
  - Changed date format from `YYYY-MM-DD` to ISO 8601
  - Removed deprecated fields from v1.0

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ],
    "request_id": "req-123456",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication |
| `AUTHORIZATION_FAILED` | 403 | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

## Rate Limiting

### Limits by Plan

| Plan | Requests/Hour | Burst Limit |
|------|---------------|-------------|
| Free | 1,000 | 100 |
| Basic | 10,000 | 500 |
| Pro | 100,000 | 2,000 |
| Enterprise | Unlimited | 10,000 |

### Rate Limit Headers

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642262400
X-RateLimit-Retry-After: 3600
```

## Webhooks

### Supported Events

- `user.created`
- `user.updated`
- `application.created`
- `application.submitted`
- `letter.completed`
- `university.match.found`

### Webhook Payload

```json
{
  "id": "evt_123456",
  "type": "application.submitted",
  "created": "2024-01-15T10:30:00Z",
  "data": {
    "object": {
      "id": "app-123",
      "student_id": "user-456",
      "university_id": "univ-789",
      "status": "submitted"
    }
  }
}
```

## Testing

### Mock Server
Use our mock server for development and testing:

```bash
npm install -g @stellarrec/mock-server
stellarrec-mock --port 3000
```

### Postman Collection
Import our Postman collection for easy API testing:
[Download Collection](./postman/StellarRec-API.postman_collection.json)

## Support

### Documentation
- **API Reference**: https://docs.stellarrec.com/api
- **Developer Guides**: https://docs.stellarrec.com/guides
- **Code Examples**: https://github.com/stellarrec/examples

### Community
- **Discord**: https://discord.gg/stellarrec
- **Stack Overflow**: Tag questions with `stellarrec-api`
- **GitHub Issues**: https://github.com/stellarrec/api/issues

### Contact
- **Email**: developers@stellarrec.com
- **Support Portal**: https://support.stellarrec.com