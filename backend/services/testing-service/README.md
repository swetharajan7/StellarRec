# StellarRec Testing Service

Comprehensive testing suite for the StellarRec platform with unit tests, integration tests, end-to-end tests, performance tests, and security testing to ensure 90%+ code coverage and system reliability.

## Features

### 🧪 **Unit Testing**
- Service-level unit tests with 90%+ coverage requirement
- Mock external dependencies and database connections
- Test individual functions, classes, and modules
- Fast execution with parallel test running
- Comprehensive assertion library with custom matchers

### 🔗 **Integration Testing**
- Cross-service integration testing with test containers
- Database integration testing with real PostgreSQL instances
- API endpoint testing with authentication flows
- Service-to-service communication validation
- Data consistency and transaction integrity testing

### 🌐 **End-to-End Testing**
- Complete user workflow testing with Puppeteer
- Browser automation for frontend interactions
- Mobile responsiveness testing
- Cross-browser compatibility testing
- User journey validation from registration to application submission

### ⚡ **Performance Testing**
- Load testing with concurrent user simulation
- Stress testing for system limits
- Response time benchmarking
- Memory leak detection
- Database performance optimization testing

### 🔒 **Security Testing**
- Authentication and authorization testing
- Input validation and sanitization testing
- SQL injection and XSS prevention testing
- Rate limiting and DoS protection testing
- Security header validation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Testing Service                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Unit Tests      │  │ Integration     │  │ E2E Tests   │ │
│  │                 │  │ Tests           │  │             │ │
│  │ • Service Tests │  │ • API Tests     │  │ • User Flow │ │
│  │ • Mock Objects  │  │ • DB Tests      │  │ • Browser   │ │
│  │ • Fast Exec     │  │ • Cross-Service │  │ • Mobile    │ │
│  │ • 90% Coverage  │  │ • Real Data     │  │ • Workflows │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Performance     │  │ Security Tests  │  │ Test        │ │
│  │ Tests           │  │                 │  │ Reporting   │ │
│  │                 │  │ • Auth Tests    │  │             │ │
│  │ • Load Testing  │  │ • Input Valid   │  │ • HTML      │ │
│  │ • Stress Tests  │  │ • XSS/SQL Inj   │  │ • JSON      │ │
│  │ • Memory Tests  │  │ • Rate Limiting │  │ • JUnit XML │ │
│  │ • Benchmarks    │  │ • Headers       │  │ • Coverage  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up test environment:**
   ```bash
   cp .env.example .env.test
   # Edit .env.test with test configuration
   ```

3. **Install test containers:**
   ```bash
   docker pull postgres:15
   docker pull redis:7
   ```

## Usage

### Running Tests

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:security

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run CI pipeline
npm run ci
```

### Test Configuration

```bash
# View current test configuration
curl http://localhost:3016/api/v1/tests/config

# Update test configuration
curl -X PUT http://localhost:3016/api/v1/tests/config \
  -H "Content-Type: application/json" \
  -d '{"coverageThreshold": {"lines": 95}}'
```

### Test Reporting

```bash
# Generate test reports
npm run report

# View test metrics
curl http://localhost:3016/api/v1/tests/metrics

# Get latest test report
curl http://localhost:3016/api/v1/tests/reports/latest
```

## Test Types

### Unit Tests
- **Location**: `src/unit/`
- **Coverage**: 90%+ required
- **Execution**: Parallel, fast
- **Dependencies**: Mocked

```typescript
describe('User Service Unit Tests', () => {
  it('should create user with valid data', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe'
    };

    const result = await userService.createUser(userData);
    expect(result.id).toBeValidUUID();
    expect(result.email).toBe(userData.email);
  });
});
```

### Integration Tests
- **Location**: `src/integration/`
- **Scope**: Cross-service communication
- **Environment**: Test containers
- **Data**: Real database connections

```typescript
describe('Service Integration Tests', () => {
  it('should create user and retrieve profile', async () => {
    const userResponse = await axios.post('/api/v1/users', userData);
    const userId = userResponse.data.data.id;
    
    const getResponse = await axios.get(`/api/v1/users/${userId}`);
    expect(getResponse.data.data.email).toBe(userData.email);
  });
});
```

### End-to-End Tests
- **Location**: `src/e2e/`
- **Tool**: Puppeteer
- **Scope**: Complete user workflows
- **Environment**: Real browser

```typescript
describe('User Registration Workflow', () => {
  it('should complete full registration flow', async () => {
    await page.goto('http://localhost:3000');
    await page.click('[data-testid="register-button"]');
    await page.type('[data-testid="email-input"]', 'test@example.com');
    // ... complete workflow
    await page.waitForSelector('[data-testid="dashboard"]');
  });
});
```

### Performance Tests
- **Location**: `src/performance/`
- **Metrics**: Response time, throughput, memory
- **Load**: Concurrent users simulation
- **Benchmarks**: SLA compliance

```typescript
describe('Performance Tests', () => {
  it('should handle 50 concurrent users', async () => {
    const promises = Array(50).fill(null).map(() => 
      axios.post('/api/v1/users', userData)
    );
    
    const responses = await Promise.all(promises);
    const successRate = responses.filter(r => r.status === 201).length / 50;
    expect(successRate).toBeGreaterThan(0.95);
  });
});
```

### Security Tests
- **Location**: `src/security/`
- **Scope**: Authentication, authorization, input validation
- **Attacks**: SQL injection, XSS, CSRF
- **Compliance**: Security best practices

```typescript
describe('Security Tests', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    
    try {
      await axios.post('/api/v1/auth/login', {
        email: maliciousInput,
        password: 'password'
      });
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toContain('validation');
    }
  });
});
```

## Test Configuration

### Coverage Thresholds
```json
{
  "coverageThreshold": {
    "global": {
      "branches": 90,
      "functions": 90,
      "lines": 90,
      "statements": 90
    }
  }
}
```

### Test Timeouts
```json
{
  "timeouts": {
    "unit": 5000,
    "integration": 30000,
    "e2e": 60000,
    "performance": 120000,
    "security": 180000
  }
}
```

### Parallel Execution
```json
{
  "parallelism": {
    "unit": 4,
    "integration": 2,
    "e2e": 1,
    "performance": 1,
    "security": 1
  }
}
```

## Test Reports

### HTML Report
- **Location**: `test-reports/test-report.html`
- **Features**: Interactive dashboard, coverage visualization
- **Metrics**: Pass rates, execution times, trends

### JSON Report
- **Location**: `test-reports/test-report.json`
- **Format**: Structured data for CI/CD integration
- **Usage**: Automated analysis and alerting

### JUnit XML
- **Location**: `test-reports/junit.xml`
- **Format**: Standard JUnit XML for CI/CD tools
- **Integration**: Jenkins, GitHub Actions, etc.

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Tests
  run: |
    npm run test:all
    npm run test:coverage
    
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
    
- name: Publish Test Results
  uses: dorny/test-reporter@v1
  with:
    name: Test Results
    path: test-reports/junit.xml
    reporter: java-junit
```

### Quality Gates
- **Coverage**: Minimum 90% line coverage
- **Pass Rate**: Minimum 95% test pass rate
- **Performance**: Response times within SLA
- **Security**: Zero high-severity vulnerabilities

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Keep tests independent and isolated

### Mock Strategy
- Mock external dependencies
- Use real data for integration tests
- Avoid over-mocking in integration tests
- Reset mocks between tests

### Data Management
- Use test containers for databases
- Clean up test data after each test
- Use factories for test data generation
- Avoid shared test data

### Performance Considerations
- Run unit tests in parallel
- Use test containers efficiently
- Optimize test data setup
- Monitor test execution times

## Troubleshooting

### Common Issues

1. **Test timeouts**
   - Increase timeout values in jest.config.js
   - Check for async operations without proper awaiting
   - Verify test container startup times

2. **Coverage issues**
   - Ensure all code paths are tested
   - Check for untested error conditions
   - Verify mock implementations

3. **Flaky tests**
   - Add proper wait conditions
   - Use deterministic test data
   - Avoid time-dependent assertions

### Debug Mode
```bash
# Run tests with debug output
DEBUG=* npm test

# Run specific test with debugging
npm test -- --testNamePattern="should create user"

# Run tests with coverage debugging
npm run test:coverage -- --verbose
```

## Contributing

1. Write tests for all new features
2. Maintain 90%+ code coverage
3. Follow testing best practices
4. Update test documentation
5. Run full test suite before submitting

## License

MIT License - see LICENSE file for details.