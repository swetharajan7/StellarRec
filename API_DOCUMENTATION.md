# StellarRec University Integration API Documentation

## 📋 **Overview**

The StellarRec University Integration API provides comprehensive access to our platform that connects to 2000+ universities across North America. This RESTful API enables seamless submission of recommendations to multiple universities through various integration types including CommonApp, Coalition, UC System, OUAC, and direct university APIs.

**Base URL:** `https://api.stellarrec.com/api/university-integration`  
**Version:** v1  
**Authentication:** Bearer Token (JWT)

## 🔐 **Authentication**

All API requests require authentication using a Bearer token in the Authorization header.

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

### Getting an Access Token

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "role": "student"
    }
  }
}
```

## 🏫 **Universities**

### Search Universities

Search and filter from 2000+ North American universities.

```http
GET /universities/search
```

**Query Parameters:**
- `search` (string, optional): Search term for university name or code
- `country` (string, optional): Filter by country (`US` or `CA`)
- `state` (string, optional): Filter by US state
- `province` (string, optional): Filter by Canadian province
- `integrationType` (string, optional): Filter by integration type
- `programType` (string, optional): Filter by supported program type
- `isActive` (boolean, optional): Filter by active status
- `limit` (integer, optional): Number of results (default: 50, max: 100)
- `offset` (integer, optional): Pagination offset (default: 0)

**Example Request:**
```http
GET /universities/search?search=Harvard&country=US&integrationType=commonapp&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "universities": [
      {
        "id": "harv_001",
        "name": "Harvard University",
        "code": "HARV",
        "country": "US",
        "state": "Massachusetts",
        "integrationType": "commonapp",
        "features": {
          "realTimeStatus": true,
          "bulkSubmission": true,
          "documentUpload": true,
          "statusWebhooks": true,
          "customFields": true
        },
        "requirements": {
          "requiredFields": ["student_name", "student_email", "recommender_name"],
          "maxRecommendationLength": 8000,
          "supportedPrograms": ["undergraduate", "graduate"],
          "deadlineBuffer": 48
        },
        "institutionType": "Private Research University",
        "isPublic": false,
        "websiteUrl": "https://www.harvard.edu"
      }
    ],
    "total": 1
  }
}
```

### Get Universities by Integration Type

```http
GET /universities/integration-type/{integrationType}
```

**Path Parameters:**
- `integrationType` (string): Integration type (`commonapp`, `coalition`, `uc_system`, `ouac`, `direct_api`, `email`)

**Example:**
```http
GET /universities/integration-type/commonapp
```

### Get Universities by Location

```http
GET /universities/location/{country}
```

**Path Parameters:**
- `country` (string): Country code (`US` or `CA`)

**Query Parameters:**
- `state` (string, optional): US state name
- `province` (string, optional): Canadian province name

**Example:**
```http
GET /universities/location/US?state=California
```

## 📤 **Submissions**

### Submit to Multiple Universities

Submit a recommendation to multiple universities in a single request.

```http
POST /submit
Content-Type: application/json
```

**Request Body:**
```json
{
  "recommendationId": "rec_123",
  "studentData": {
    "id": "student_456",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1-555-0123",
    "dateOfBirth": "1995-06-15T00:00:00Z",
    "address": {
      "street": "123 Main St",
      "city": "Boston",
      "state": "Massachusetts",
      "zipCode": "02101",
      "country": "US"
    },
    "academicInfo": {
      "currentInstitution": "Boston University",
      "gpa": 3.8,
      "graduationDate": "2024-05-15T00:00:00Z",
      "major": "Computer Science",
      "testScores": {
        "gre": {
          "verbal": 165,
          "quantitative": 170,
          "analytical": 5.0
        }
      }
    }
  },
  "recommenderData": {
    "id": "recommender_789",
    "firstName": "Dr. Jane",
    "lastName": "Smith",
    "title": "Professor",
    "institution": "Boston University",
    "email": "jane.smith@bu.edu",
    "phone": "+1-555-0456",
    "relationship": "Academic Advisor",
    "yearsKnown": 3
  },
  "recommendationContent": {
    "content": "John is an exceptional student who has demonstrated outstanding academic performance...",
    "wordCount": 750,
    "programType": "graduate",
    "customizations": {
      "harvard_specific": "Additional content for Harvard application..."
    }
  },
  "universities": [
    {
      "universityId": "harv_001",
      "universityCode": "HARV",
      "programType": "graduate",
      "applicationDeadline": "2024-12-01T23:59:59Z",
      "specificRequirements": {
        "program_focus": "Computer Science PhD"
      }
    },
    {
      "universityId": "stan_001",
      "universityCode": "STAN",
      "programType": "graduate",
      "applicationDeadline": "2024-12-15T23:59:59Z"
    }
  ],
  "metadata": {
    "submissionType": "recommendation",
    "priority": "normal",
    "deadline": "2024-12-01T00:00:00Z",
    "source": "web",
    "version": "1.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendationId": "rec_123",
    "totalUniversities": 2,
    "successful": 1,
    "failed": 0,
    "pending": 1,
    "results": [
      {
        "universityId": "harv_001",
        "status": "success",
        "submissionId": "sub_harv_789",
        "confirmationCode": "HARV_REC_2024_001",
        "metadata": {
          "submittedAt": "2024-01-15T10:30:00Z",
          "trackingUrl": "https://commonapp.org/track/sub_harv_789"
        }
      },
      {
        "universityId": "stan_001",
        "status": "pending",
        "submissionId": "sub_stan_790",
        "metadata": {
          "submittedAt": "2024-01-15T10:30:00Z",
          "estimatedProcessingTime": "2-5 minutes"
        }
      }
    ],
    "overallStatus": "partial"
  }
}
```

### Get Submission Status

Track the status of submissions for a specific recommendation.

```http
GET /status/{recommendationId}
```

**Path Parameters:**
- `recommendationId` (string): The recommendation ID

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "universityId": "harv_001",
      "universityName": "Harvard University",
      "universityCode": "HARV",
      "integrationType": "commonapp",
      "status": "confirmed",
      "submittedAt": "2024-01-15T10:30:00Z",
      "confirmedAt": "2024-01-15T10:32:00Z",
      "metadata": {
        "confirmationCode": "HARV_REC_2024_001",
        "trackingUrl": "https://commonapp.org/track/sub_harv_789"
      }
    },
    {
      "universityId": "stan_001",
      "universityName": "Stanford University",
      "universityCode": "STAN",
      "integrationType": "commonapp",
      "status": "processing",
      "submittedAt": "2024-01-15T10:30:00Z",
      "metadata": {
        "estimatedCompletion": "2024-01-15T10:35:00Z"
      }
    }
  ]
}
```

### Retry Failed Submissions

Retry submissions that failed due to temporary issues.

```http
POST /retry/{recommendationId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendationId": "rec_123",
    "retriedSubmissions": 1,
    "results": [
      {
        "universityId": "stan_001",
        "status": "success",
        "submissionId": "sub_stan_791",
        "confirmationCode": "STAN_REC_2024_002"
      }
    ]
  }
}
```

## 📊 **Statistics & Analytics**

### Get Integration Statistics

```http
GET /statistics/integrations
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUniversities": 2147,
    "byIntegrationType": {
      "commonapp": 742,
      "coalition": 156,
      "uc_system": 9,
      "ouac": 23,
      "direct_api": 45,
      "email": 1172
    },
    "byCountry": {
      "US": 1876,
      "CA": 271
    },
    "byState": {
      "California": 156,
      "New York": 134,
      "Texas": 98
    }
  }
}
```

### Get Submission Statistics

```http
GET /statistics/submissions
```

**Query Parameters:**
- `dateFrom` (string, optional): Start date (ISO 8601)
- `dateTo` (string, optional): End date (ISO 8601)
- `integrationType` (string, optional): Filter by integration type
- `universityId` (string, optional): Filter by university

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSubmissions": 15420,
    "successfulSubmissions": 15180,
    "failedSubmissions": 240,
    "pendingSubmissions": 0,
    "successRate": 98.4,
    "byIntegrationType": {
      "commonapp": {
        "total": 8500,
        "successful": 8430,
        "failed": 70,
        "successRate": 99.2
      },
      "coalition": {
        "total": 3200,
        "successful": 3164,
        "failed": 36,
        "successRate": 98.9
      }
    },
    "byStatus": {
      "confirmed": 12450,
      "delivered": 2730,
      "failed": 240
    }
  }
}
```

## 🏥 **Health & Monitoring**

### Get Integration Health

```http
GET /health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overall": "healthy",
    "integrations": {
      "commonapp": "healthy",
      "coalition": "healthy",
      "uc_system": "warning",
      "ouac": "healthy",
      "direct_api": "healthy",
      "email": "healthy"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "details": {
      "uc_system": {
        "status": "warning",
        "message": "Elevated response times detected",
        "responseTime": 3200
      }
    }
  }
}
```

## 🔧 **Admin Endpoints**

*Note: Admin endpoints require admin role permissions.*

### Test University Connection

```http
GET /admin/universities/{universityId}/test
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "responseTime": 1250,
    "details": {
      "endpoint": "https://api.commonapp.org/v2/health",
      "status": "healthy",
      "lastTested": "2024-01-15T10:30:00Z"
    }
  }
}
```

### Get Rate Limit Status

```http
GET /admin/rate-limits/{integrationType}
```

**Query Parameters:**
- `universityId` (string, optional): Specific university ID

**Response:**
```json
{
  "success": true,
  "data": {
    "minute": {
      "current": 15,
      "limit": 30,
      "resetTime": "2024-01-15T10:31:00Z"
    },
    "hour": {
      "current": 450,
      "limit": 500,
      "resetTime": "2024-01-15T11:00:00Z"
    },
    "day": {
      "current": 1200,
      "limit": 2000,
      "resetTime": "2024-01-16T00:00:00Z"
    }
  }
}
```

### Update University Integration

```http
PUT /admin/universities/{universityId}/integration
Content-Type: application/json
```

**Request Body:**
```json
{
  "integrationType": "commonapp",
  "features": {
    "realTimeStatus": true,
    "bulkSubmission": true,
    "documentUpload": true
  },
  "rateLimit": {
    "requestsPerMinute": 30,
    "requestsPerHour": 500,
    "requestsPerDay": 2000,
    "burstLimit": 10
  },
  "isActive": true
}
```

### Validate Credentials

```http
GET /admin/credentials/{integrationType}/validate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "expiresAt": "2024-12-31T23:59:59Z",
    "details": {
      "lastValidated": "2024-01-15T10:30:00Z",
      "scope": ["read", "write", "submit"]
    }
  }
}
```

## 🔄 **Webhooks**

StellarRec supports webhooks for real-time updates from university systems.

### CommonApp Confirmation Webhook

```http
POST /webhooks/commonapp/confirmation
Content-Type: application/json
X-CommonApp-Signature: sha256=...
```

**Request Body:**
```json
{
  "submission_id": "sub_harv_789",
  "status": "confirmed",
  "confirmation_code": "HARV_REC_2024_001",
  "university_code": "HARV",
  "timestamp": "2024-01-15T10:32:00Z",
  "metadata": {
    "processing_time": 120,
    "reviewer": "admissions_system"
  }
}
```

### Coalition Confirmation Webhook

```http
POST /webhooks/coalition/confirmation
Content-Type: application/json
X-Coalition-Signature: sha256=...
```

## 📈 **Rate Limits**

API rate limits vary by endpoint and user role:

| Endpoint Category | Rate Limit | Burst Limit |
|------------------|------------|-------------|
| University Search | 100/minute | 20 |
| Submissions | 10/minute | 5 |
| Status Checks | 60/minute | 15 |
| Admin Operations | 30/minute | 10 |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
```

## ❌ **Error Handling**

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "reason": "Invalid email format"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication token |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource does not exist |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit exceeded |
| `INTEGRATION_ERROR` | 502 | External university system error |
| `INTERNAL_ERROR` | 500 | Internal server error |

### Rate Limit Error

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded for CommonApp integration",
    "retryAfter": "2024-01-15T10:31:00Z",
    "details": {
      "limit": 30,
      "window": "minute",
      "resetTime": "2024-01-15T10:31:00Z"
    }
  }
}
```

## 🔍 **Filtering & Pagination**

### Query Parameters

Most list endpoints support these common parameters:

- `limit` (integer): Number of results (default: 50, max: 100)
- `offset` (integer): Pagination offset (default: 0)
- `sort` (string): Sort field (e.g., `name`, `created_at`)
- `order` (string): Sort order (`asc` or `desc`)

### Response Format

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 2147,
      "limit": 50,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

## 🧪 **Testing**

### Sandbox Environment

Use the sandbox environment for testing:

**Base URL:** `https://sandbox-api.stellarrec.com/api/university-integration`

### Test Data

The sandbox includes test universities and mock integrations:

```json
{
  "id": "test_harv_001",
  "name": "Harvard University (Test)",
  "code": "TEST_HARV",
  "integrationType": "test_commonapp"
}
```

### Example cURL Commands

```bash
# Search universities
curl -X GET "https://api.stellarrec.com/api/university-integration/universities/search?search=Harvard" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Submit to universities
curl -X POST "https://api.stellarrec.com/api/university-integration/submit" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @submission_request.json

# Check submission status
curl -X GET "https://api.stellarrec.com/api/university-integration/status/rec_123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📚 **SDKs & Libraries**

### JavaScript/TypeScript

```bash
npm install @stellarrec/university-integration-sdk
```

```typescript
import { StellarRecClient } from '@stellarrec/university-integration-sdk';

const client = new StellarRecClient({
  apiKey: 'your_api_key',
  environment: 'production' // or 'sandbox'
});

// Search universities
const universities = await client.universities.search({
  search: 'Harvard',
  country: 'US'
});

// Submit to universities
const result = await client.submissions.submit({
  recommendationId: 'rec_123',
  // ... other data
});
```

### Python

```bash
pip install stellarrec-university-integration
```

```python
from stellarrec import UniversityIntegrationClient

client = UniversityIntegrationClient(
    api_key='your_api_key',
    environment='production'
)

# Search universities
universities = client.universities.search(
    search='Harvard',
    country='US'
)

# Submit to universities
result = client.submissions.submit({
    'recommendationId': 'rec_123',
    # ... other data
})
```

## 🆘 **Support**

### Documentation
- **API Reference:** https://docs.stellarrec.com/api
- **Integration Guides:** https://docs.stellarrec.com/integrations
- **SDKs:** https://docs.stellarrec.com/sdks

### Contact
- **Technical Support:** api-support@stellarrec.com
- **Integration Help:** integrations@stellarrec.com
- **Status Page:** https://status.stellarrec.com

### Response Times
- **Critical Issues:** 2 hours
- **General Support:** 24 hours
- **Feature Requests:** 5 business days

---

*This documentation covers the StellarRec University Integration API v1. For the latest updates, visit our [documentation portal](https://docs.stellarrec.com).*