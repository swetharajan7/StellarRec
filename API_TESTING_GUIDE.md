# StellarRec API Testing Guide

## 🧪 **Overview**

This guide provides comprehensive instructions for testing the StellarRec University Integration API. Whether you're a developer integrating with our system, a QA engineer validating functionality, or a partner testing the integration, this guide will help you thoroughly test all API endpoints.

## 🚀 **Quick Start**

### 1. **Import Postman Collection**
```bash
# Import the provided Postman collection
curl -o stellarrec-api.json https://raw.githubusercontent.com/swetharajan7/StellarRec/main/postman_collection.json
```

### 2. **Set Environment Variables**
```javascript
// In Postman, set these variables:
base_url: "https://api.stellarrec.com/api/university-integration"
sandbox_url: "https://sandbox-api.stellarrec.com/api/university-integration"
auth_token: "your_jwt_token_here"
```

### 3. **Get Authentication Token**
```bash
curl -X POST "https://api.stellarrec.com/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@stellarrec.com",
    "password": "demo_password"
  }'
```

## 🏫 **University Endpoints Testing**

### **Test 1: Basic University Search**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/universities/search?search=Harvard" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
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
        "integrationType": "commonapp"
      }
    ],
    "total": 1
  }
}
```

**Validation Checklist:**
- [ ] Response status is 200
- [ ] `success` field is `true`
- [ ] `universities` array contains expected data
- [ ] University object has all required fields
- [ ] `total` count matches array length

### **Test 2: Advanced Filtering**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/universities/search?country=US&integrationType=commonapp&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] All returned universities are in the US
- [ ] All universities use CommonApp integration
- [ ] Result count respects the limit parameter
- [ ] Response includes pagination information

### **Test 3: Integration Type Filtering**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/universities/integration-type/commonapp" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] All universities returned use CommonApp
- [ ] Response includes major universities (Harvard, Yale, etc.)
- [ ] Integration features are properly populated

### **Test 4: Location-Based Search**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/universities/location/US?state=California" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] All universities are in California
- [ ] Includes UC system universities
- [ ] Includes CSU system universities
- [ ] Private California universities included

## 📤 **Submission Testing**

### **Test 5: Single University Submission**
```bash
curl -X POST "https://api.stellarrec.com/api/university-integration/submit" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendationId": "test_rec_001",
    "studentData": {
      "id": "test_student_001",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@test.com",
      "dateOfBirth": "1995-06-15T00:00:00Z",
      "address": {
        "street": "123 Test St",
        "city": "Boston",
        "state": "Massachusetts",
        "zipCode": "02101",
        "country": "US"
      },
      "academicInfo": {
        "currentInstitution": "Test University",
        "gpa": 3.8,
        "graduationDate": "2024-05-15T00:00:00Z",
        "major": "Computer Science"
      }
    },
    "recommenderData": {
      "id": "test_recommender_001",
      "firstName": "Dr. Jane",
      "lastName": "Smith",
      "title": "Professor",
      "institution": "Test University",
      "email": "jane.smith@test.edu",
      "relationship": "Academic Advisor",
      "yearsKnown": 3
    },
    "recommendationContent": {
      "content": "This is a test recommendation for API validation purposes.",
      "wordCount": 100,
      "programType": "graduate"
    },
    "universities": [
      {
        "universityId": "harv_001",
        "universityCode": "HARV",
        "programType": "graduate",
        "applicationDeadline": "2024-12-01T23:59:59Z"
      }
    ],
    "metadata": {
      "submissionType": "recommendation",
      "priority": "normal",
      "deadline": "2024-12-01T00:00:00Z",
      "source": "api",
      "version": "1.0"
    }
  }'
```

**Validation Checklist:**
- [ ] Response status is 200
- [ ] `overallStatus` is appropriate
- [ ] `results` array contains submission details
- [ ] Each result has `universityId` and `status`
- [ ] Successful submissions have `submissionId`

### **Test 6: Multi-University Submission**
Test submitting to multiple universities with different integration types:

```json
{
  "universities": [
    {
      "universityId": "harv_001",
      "universityCode": "HARV",
      "programType": "graduate",
      "applicationDeadline": "2024-12-01T23:59:59Z"
    },
    {
      "universityId": "ucb_001",
      "universityCode": "UCB",
      "programType": "graduate",
      "applicationDeadline": "2024-12-15T23:59:59Z"
    },
    {
      "universityId": "utor_001",
      "universityCode": "UTOR",
      "programType": "graduate",
      "applicationDeadline": "2024-11-30T23:59:59Z"
    }
  ]
}
```

**Validation Checklist:**
- [ ] All universities processed
- [ ] Different integration types handled correctly
- [ ] Status tracking works for each submission
- [ ] Bulk submission statistics are accurate

### **Test 7: Submission Status Tracking**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/status/test_rec_001" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] Returns status for all submitted universities
- [ ] Status values are valid enum values
- [ ] Timestamps are properly formatted
- [ ] Metadata includes relevant information

### **Test 8: Retry Failed Submissions**
```bash
curl -X POST "https://api.stellarrec.com/api/university-integration/retry/test_rec_001" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] Only retries failed submissions
- [ ] Updates submission status appropriately
- [ ] Respects retry limits
- [ ] Returns updated results

## 📊 **Analytics Testing**

### **Test 9: Integration Statistics**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/statistics/integrations" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] `totalUniversities` count is accurate
- [ ] `byIntegrationType` breakdown is correct
- [ ] `byCountry` includes US and CA
- [ ] `byState` includes major states

### **Test 10: Submission Statistics**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/statistics/submissions?dateFrom=2024-01-01T00:00:00Z&dateTo=2024-01-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] Statistics respect date range filters
- [ ] Success rate calculations are accurate
- [ ] Integration type breakdown is correct
- [ ] Status distribution adds up correctly

## 🏥 **Health & Monitoring Testing**

### **Test 11: System Health Check**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/health" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] Overall health status is reported
- [ ] Individual integration health is shown
- [ ] Timestamp is current
- [ ] Warning/critical issues are detailed

### **Test 12: Performance Metrics**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/metrics/performance" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] Response times are reasonable
- [ ] Success rates are high (>95%)
- [ ] Uptime is tracked accurately
- [ ] Metrics are current

## 🔧 **Admin Endpoints Testing**

### **Test 13: University Connection Test**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/admin/universities/harv_001/test" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Validation Checklist:**
- [ ] Requires admin authentication
- [ ] Tests actual university connection
- [ ] Returns response time metrics
- [ ] Identifies connection issues

### **Test 14: Rate Limit Monitoring**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/admin/rate-limits/commonapp" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Validation Checklist:**
- [ ] Shows current usage across time windows
- [ ] Displays remaining capacity
- [ ] Reset times are accurate
- [ ] Warns when approaching limits

### **Test 15: Credential Validation**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/admin/credentials/commonapp/validate" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Validation Checklist:**
- [ ] Validates actual credentials
- [ ] Shows expiration information
- [ ] Identifies invalid credentials
- [ ] Suggests rotation when needed

## ❌ **Error Handling Testing**

### **Test 16: Authentication Errors**
```bash
# Test without token
curl -X GET "https://api.stellarrec.com/api/university-integration/universities/search"

# Test with invalid token
curl -X GET "https://api.stellarrec.com/api/university-integration/universities/search" \
  -H "Authorization: Bearer invalid_token"
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "Missing or invalid authentication token"
  }
}
```

### **Test 17: Validation Errors**
```bash
# Test with invalid data
curl -X POST "https://api.stellarrec.com/api/university-integration/submit" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recommendationId": "",
    "studentData": {
      "firstName": "",
      "email": "invalid-email"
    }
  }'
```

**Validation Checklist:**
- [ ] Returns 400 status code
- [ ] Error message is descriptive
- [ ] Field-specific validation errors
- [ ] Includes error code for programmatic handling

### **Test 18: Rate Limit Testing**
```bash
# Send multiple rapid requests to trigger rate limiting
for i in {1..50}; do
  curl -X GET "https://api.stellarrec.com/api/university-integration/universities/search" \
    -H "Authorization: Bearer YOUR_TOKEN" &
done
```

**Expected Response (after limit exceeded):**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "retryAfter": "2024-01-15T10:31:00Z"
  }
}
```

### **Test 19: Resource Not Found**
```bash
curl -X GET "https://api.stellarrec.com/api/university-integration/status/nonexistent_rec_id" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Validation Checklist:**
- [ ] Returns 404 status code
- [ ] Clear error message
- [ ] Suggests valid alternatives when possible

## 🔄 **Integration Testing Scenarios**

### **Scenario 1: Complete Application Workflow**
1. Search for universities
2. Submit to multiple universities
3. Track submission status
4. Retry any failures
5. Verify final status

### **Scenario 2: Cross-Integration Testing**
1. Submit to CommonApp universities
2. Submit to UC System universities
3. Submit to Canadian OUAC universities
4. Verify all integrations work correctly

### **Scenario 3: Load Testing**
1. Submit multiple recommendations simultaneously
2. Monitor system performance
3. Verify rate limiting works correctly
4. Check error handling under load

### **Scenario 4: Failure Recovery Testing**
1. Simulate network failures
2. Test retry mechanisms
3. Verify data consistency
4. Check error reporting

## 📋 **Test Data Sets**

### **Valid Test Universities**
```json
{
  "ivy_league": ["harv_001", "yale_001", "prin_001", "colu_001"],
  "uc_system": ["ucb_001", "ucla_001", "ucsd_001", "ucd_001"],
  "canadian": ["utor_001", "mcgi_001", "ubc_001"],
  "coalition": ["duke_001", "nwes_001", "uchi_001"]
}
```

### **Test Student Data**
```json
{
  "valid_student": {
    "id": "test_student_001",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@test.com",
    "dateOfBirth": "1995-06-15T00:00:00Z",
    "address": {
      "street": "123 Test St",
      "city": "Boston",
      "state": "Massachusetts",
      "zipCode": "02101",
      "country": "US"
    },
    "academicInfo": {
      "currentInstitution": "Test University",
      "gpa": 3.8,
      "graduationDate": "2024-05-15T00:00:00Z",
      "major": "Computer Science"
    }
  }
}
```

## 🚨 **Common Issues & Troubleshooting**

### **Issue 1: Authentication Failures**
**Symptoms:** 401 Unauthorized responses
**Solutions:**
- Verify token is not expired
- Check token format (Bearer prefix)
- Ensure user has required permissions

### **Issue 2: Rate Limiting**
**Symptoms:** 429 Too Many Requests
**Solutions:**
- Implement exponential backoff
- Respect Retry-After headers
- Monitor rate limit headers

### **Issue 3: Validation Errors**
**Symptoms:** 400 Bad Request with validation details
**Solutions:**
- Check required fields are present
- Validate email formats
- Ensure date formats are ISO 8601

### **Issue 4: University Integration Failures**
**Symptoms:** Submissions fail for specific universities
**Solutions:**
- Check university integration health
- Verify credentials are valid
- Test university connection endpoint

## 📊 **Performance Benchmarks**

### **Expected Response Times**
- University search: < 500ms
- Single submission: < 2s
- Multi-university submission: < 5s
- Status check: < 200ms
- Analytics queries: < 1s

### **Success Rate Targets**
- Overall system: > 99%
- CommonApp integration: > 99.5%
- UC System integration: > 98%
- Email fallback: > 95%

### **Rate Limits**
- University search: 100/minute
- Submissions: 10/minute
- Status checks: 60/minute
- Admin operations: 30/minute

## 🔍 **Monitoring & Alerting**

### **Key Metrics to Monitor**
- API response times
- Error rates by endpoint
- Integration health status
- Rate limit utilization
- Submission success rates

### **Alert Thresholds**
- Response time > 5s
- Error rate > 5%
- Integration down > 5 minutes
- Success rate < 95%

## 📝 **Test Reporting**

### **Test Results Template**
```markdown
## Test Execution Report

**Date:** 2024-01-15
**Environment:** Production
**Tester:** John Doe

### Summary
- Total Tests: 50
- Passed: 48
- Failed: 2
- Success Rate: 96%

### Failed Tests
1. Test 15: Credential Validation - CommonApp credentials expired
2. Test 18: Rate Limiting - Threshold too low for current load

### Recommendations
- Update CommonApp credentials
- Increase rate limits for peak hours
```

This comprehensive testing guide ensures thorough validation of all API functionality and helps maintain high quality standards for the StellarRec University Integration System.