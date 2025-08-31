# StellarRec Security Package

Comprehensive security middleware and utilities for the StellarRec backend services.

## Features

### 🛡️ Web Application Firewall (WAF)
- SQL injection protection
- XSS attack prevention
- Command injection detection
- Path traversal protection
- File inclusion attack prevention
- LDAP injection protection
- XML/XXE attack prevention
- NoSQL injection protection
- HTTP header injection protection
- Server-side template injection protection

### 🔍 Anomaly Detection
- Request frequency analysis
- Suspicious user agent detection
- Unusual access pattern identification
- Failed authentication tracking
- Geographic anomaly detection
- Automated threat scoring

### 🔒 Input Validation & Sanitization
- Comprehensive input sanitization
- XSS protection with DOMPurify
- SQL injection prevention
- Prototype pollution protection
- Common validation patterns

### 📋 Compliance Checking
- FERPA compliance for educational records
- GDPR compliance for personal data
- Data retention policy enforcement
- Audit logging requirements
- Consent verification

### 🔐 Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Referrer Policy

### ⚡ Rate Limiting
- Configurable rate limits per service
- Authentication endpoint protection
- File upload rate limiting
- IP-based throttling

## Installation

```bash
npm install @stellarrec/security
```

## Quick Start

```typescript
import express from 'express';
import { createSecurityStack, getSecurityConfig } from '@stellarrec/security';

const app = express();

// Get security configuration for your service
const securityConfig = getSecurityConfig('api-gateway');

// Apply comprehensive security middleware
app.use(createSecurityStack(securityConfig));

// Your routes here
app.get('/api/users', (req, res) => {
  res.json({ message: 'Secure endpoint' });
});
```

## Configuration

### Environment-Specific Configuration

```typescript
import { getSecurityConfig } from '@stellarrec/security';

// Development configuration
const devConfig = getSecurityConfig('user-service');

// Production configuration (automatically detected)
process.env.NODE_ENV = 'production';
const prodConfig = getSecurityConfig('user-service');
```

### Custom Configuration

```typescript
import { createSecurityConfig, createSecurityStack } from '@stellarrec/security';

const customConfig = createSecurityConfig({
  enableWAF: true,
  enableAnomalyDetection: true,
  rateLimitMax: 50,
  corsOrigins: ['https://myapp.com']
});

app.use(createSecurityStack(customConfig));
```

## Individual Middleware Usage

### WAF Protection

```typescript
import { wafMiddleware } from '@stellarrec/security';

app.use(wafMiddleware);
```

### Anomaly Detection

```typescript
import { anomalyDetectionMiddleware } from '@stellarrec/security';

app.use(anomalyDetectionMiddleware);
```

### Compliance Checking

```typescript
import { complianceMiddleware } from '@stellarrec/security';

app.use(complianceMiddleware);
```

### Input Sanitization

```typescript
import { sanitizeInput, sqlInjectionProtection, xssProtection } from '@stellarrec/security';

app.use(sanitizeInput);
app.use(sqlInjectionProtection);
app.use(xssProtection);
```

### Rate Limiting

```typescript
import { authRateLimit, apiRateLimit, uploadRateLimit } from '@stellarrec/security';

// Strict rate limiting for auth endpoints
app.use('/auth', authRateLimit);

// General API rate limiting
app.use('/api', apiRateLimit);

// File upload rate limiting
app.use('/upload', uploadRateLimit);
```

## Security Testing

```typescript
import { securityTester } from '@stellarrec/security';

// Run comprehensive security tests
const report = await securityTester.generateSecurityReport();

console.log(`Overall Security Score: ${report.overallScore}%`);
console.log(`Critical Issues: ${report.criticalIssues}`);
console.log(`Recommendations:`, report.recommendations);
```

## Compliance Reporting

```typescript
import { complianceChecker } from '@stellarrec/security';

// Generate compliance report
const complianceReport = await complianceChecker.generateComplianceReport();

// Get audit logs
const auditLogs = complianceChecker.getAuditLogs(100);
```

## WAF Management

```typescript
import { waf } from '@stellarrec/security';

// Block an IP address
waf.blockIP('192.168.1.100');

// Unblock an IP address
waf.unblockIP('192.168.1.100');

// Get blocked IPs
const blockedIPs = waf.getBlockedIPs();

// Get suspicious IPs
const suspiciousIPs = waf.getSuspiciousIPs();

// Add custom WAF rule
waf.addCustomRule({
  name: 'CUSTOM_ATTACK_PATTERN',
  pattern: /malicious-pattern/gi,
  severity: 'high',
  action: 'block',
  description: 'Custom attack pattern detection'
});
```

## Anomaly Detection Management

```typescript
import { anomalyDetection } from '@stellarrec/security';

// Record failed authentication
await anomalyDetection.recordFailedAuthentication('192.168.1.100');

// Clear failed authentication record
await anomalyDetection.clearFailedAuthentication('192.168.1.100');

// Get recent security alerts
const alerts = await anomalyDetection.getRecentAlerts(50);
```

## Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key

# Redis Configuration
REDIS_URL=redis://localhost:6379

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Security Features
ENABLE_WAF=true
ENABLE_ANOMALY_DETECTION=true
ENABLE_COMPLIANCE_CHECKING=true

# Logging
LOG_LEVEL=info
SECURITY_LOG_LEVEL=warn
```

## Service Integration

### API Gateway

```typescript
import { createSecurityStack, authRateLimit } from '@stellarrec/security';

// Apply security stack
app.use(createSecurityStack());

// Extra protection for auth routes
app.use('/auth', authRateLimit);
```

### User Service

```typescript
import { getSecurityConfig, createSecurityStack } from '@stellarrec/security';

const config = getSecurityConfig('user-service');
app.use(createSecurityStack(config));
```

### File Management Service

```typescript
import { getSecurityConfig, uploadRateLimit } from '@stellarrec/security';

const config = getSecurityConfig('file-management');
app.use(createSecurityStack(config));
app.use('/upload', uploadRateLimit);
```

## Security Best Practices

1. **Always use HTTPS in production**
2. **Configure strong JWT secrets**
3. **Enable all security middleware in production**
4. **Monitor security logs regularly**
5. **Update security rules based on threat intelligence**
6. **Conduct regular security testing**
7. **Implement proper error handling**
8. **Use environment-specific configurations**

## Monitoring & Alerting

The security package provides comprehensive logging through Winston:

- **Security events** are logged to `logs/security.log`
- **General logs** are logged to `logs/combined.log`
- **Error logs** are logged to `logs/error.log`

Set up log monitoring and alerting for:
- Critical security violations
- High anomaly scores
- Multiple failed authentication attempts
- WAF rule violations
- Compliance violations

## Contributing

1. Follow security best practices
2. Add tests for new security features
3. Update documentation
4. Test against common attack vectors
5. Ensure compliance with regulations

## License

MIT License - see LICENSE file for details.