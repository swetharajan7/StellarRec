# StellarRec Compliance Package

Comprehensive regulatory compliance framework for educational technology platforms, ensuring adherence to FERPA, GDPR, CCPA, and other privacy regulations.

## Features

### 📋 Comprehensive Audit Logging
- Complete audit trail for all system activities
- Educational record access logging (FERPA compliance)
- Data processing records (GDPR compliance)
- Batch processing for high-performance logging
- Configurable retention periods
- Advanced filtering and reporting

### 🇪🇺 GDPR Compliance
- **Article 15**: Right of Access - Complete data export
- **Article 16**: Right to Rectification - Data correction workflows
- **Article 17**: Right to Erasure (Right to be Forgotten)
- **Article 18**: Right to Restriction of Processing
- **Article 20**: Right to Data Portability (JSON, CSV, XML exports)
- **Article 21**: Right to Object to Processing
- Consent management and tracking
- Data processing records and legal basis tracking

### 🎓 FERPA Compliance
- Educational record access control
- Legitimate educational interest verification
- Directory information management
- Parent/student access rights
- Consent tracking for disclosures
- Student rights request handling (access, amendment, hearing)

### 🗂️ Data Retention & Purging
- Automated data retention policy enforcement
- Multiple purge methods (soft delete, hard delete, anonymize, encrypt)
- Scheduled retention job execution
- Exception handling for legal holds
- Compliance violation detection
- Retention policy management

### 🔒 Privacy Controls
- Consent management system
- Data minimization enforcement
- Purpose limitation tracking
- Data subject rights automation
- Privacy impact assessments

## Installation

```bash
npm install @stellarrec/compliance
```

## Quick Start

```typescript
import express from 'express';
import { createComplianceStack, auditService } from '@stellarrec/compliance';

const app = express();

// Apply compliance middleware
app.use(createComplianceStack({
  enableAuditLogging: true,
  enableGDPRCompliance: true,
  enableFERPACompliance: true,
  enableDataRetention: true
}));

// Your routes here
app.get('/api/users/:id', async (req, res) => {
  // Compliance logging happens automatically
  const user = await getUserById(req.params.id);
  res.json(user);
});
```

## Audit Logging

### Automatic Logging
```typescript
import { auditService } from '@stellarrec/compliance';

// Automatic logging from Express requests
app.use(async (req, res, next) => {
  await auditService.logFromRequest(
    req,
    'USER_ACCESS',
    'users',
    req.params.id
  );
  next();
});
```

### Manual Logging
```typescript
// Manual audit logging
await auditService.logEvent({
  userId: 'user123',
  userEmail: 'user@example.com',
  action: 'DATA_EXPORT',
  resource: 'user_data',
  resourceId: 'user123',
  complianceFlags: ['GDPR'],
  dataCategory: 'PERSONAL',
  sensitivity: 'HIGH'
});
```

### Educational Record Access (FERPA)
```typescript
// Log educational record access
await auditService.logEducationalRecordAccess(
  'student123',
  'student@university.edu',
  'counselor456',
  'counselor@university.edu',
  'counselor',
  'TRANSCRIPT',
  'transcript789',
  'Academic advising'
);
```

## GDPR Compliance

### Data Subject Rights

#### Right of Access (Article 15)
```typescript
import { gdprService } from '@stellarrec/compliance';

const accessRequest = await gdprService.handleAccessRequest(
  'user123',
  'user@example.com'
);

console.log('Request ID:', accessRequest.requestId);
console.log('User Data:', accessRequest.data);
```

#### Right to Erasure (Article 17)
```typescript
const erasureRequest = await gdprService.handleErasureRequest({
  userId: 'user123',
  userEmail: 'user@example.com',
  reason: 'User requested account deletion',
  retainLegalBasis: false
});

console.log('Erased data:', erasureRequest.erasedData);
console.log('Retained data:', erasureRequest.retainedData);
```

#### Right to Data Portability (Article 20)
```typescript
const portabilityRequest = await gdprService.handlePortabilityRequest({
  userId: 'user123',
  userEmail: 'user@example.com',
  requestedData: ['profile', 'applications', 'letters'],
  format: 'JSON'
});

console.log('Download URL:', portabilityRequest.downloadUrl);
console.log('Expires:', portabilityRequest.expiryDate);
```

### Consent Management
```typescript
// Record consent
const consentId = await gdprService.recordConsent({
  userId: 'user123',
  userEmail: 'user@example.com',
  consentType: 'MARKETING',
  purpose: 'Email marketing campaigns',
  consentGiven: true,
  consentMethod: 'web_form'
});

// Withdraw consent
await gdprService.withdrawConsent(
  'user123',
  'user@example.com',
  'MARKETING',
  'user_request'
);
```

## FERPA Compliance

### Access Control
```typescript
import { ferpaService } from '@stellarrec/compliance';

// Check if user can access educational record
const accessCheck = await ferpaService.canAccessEducationalRecord(
  'counselor456',
  'counselor',
  'student123',
  'TRANSCRIPT',
  'transcript789'
);

if (accessCheck.canAccess) {
  // Allow access and log it
  await ferpaService.logEducationalRecordAccess(
    'student123',
    'student@university.edu',
    'counselor456',
    'counselor@university.edu',
    'counselor',
    'TRANSCRIPT',
    'transcript789',
    'Academic planning'
  );
}
```

### Directory Information
```typescript
// Handle directory information request
const directoryRequest = await ferpaService.handleDirectoryInformationRequest(
  'student123',
  {
    name: true,
    email: true,
    majorField: true,
    phone: false
  },
  'external_org',
  'Alumni directory'
);

console.log('Disclosable info:', directoryRequest.disclosableInfo);
console.log('Restricted info:', directoryRequest.restrictedInfo);
```

### Student Rights
```typescript
// Handle student access request
const rightsRequest = await ferpaService.handleStudentRightsRequest(
  'student123',
  'ACCESS',
  { recordTypes: ['TRANSCRIPT', 'GRADES'] }
);

console.log('Request status:', rightsRequest.status);
```

## Data Retention

### Policy Management
```typescript
import { dataRetentionService } from '@stellarrec/compliance';

// Create retention policy
await dataRetentionService.createOrUpdatePolicy({
  name: 'Student Applications',
  description: 'University application data retention',
  dataCategory: 'EDUCATIONAL',
  retentionPeriod: 1095, // 3 years
  purgeMethod: 'SOFT_DELETE',
  conditions: { applicationStatus: 'completed' },
  exceptions: { legalHold: false }
});
```

### Execute Retention Policies
```typescript
// Manual execution
const retentionResult = await dataRetentionService.executeRetentionPolicies();

console.log('Policies executed:', retentionResult.policiesExecuted);
console.log('Records purged:', retentionResult.totalRecordsPurged);
```

## Compliance Reporting

### Generate Comprehensive Report
```typescript
import { generateComplianceReport } from '@stellarrec/compliance';

const report = await generateComplianceReport(
  new Date('2024-01-01'),
  new Date('2024-12-31'),
  ['GDPR', 'FERPA']
);

console.log('Compliance Score:', report.summary.complianceScore);
console.log('Recommendations:', report.recommendations);
```

### Audit Log Analysis
```typescript
// Get filtered audit logs
const auditLogs = await auditService.getAuditLogs({
  userId: 'user123',
  action: 'ACCESS_EDUCATIONAL_RECORD',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  complianceFlags: ['FERPA'],
  limit: 100
});
```

## Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/compliance

# Logging
LOG_LEVEL=info
COMPLIANCE_LOG_LEVEL=info

# Data Retention
DATA_RETENTION_SCHEDULE="0 2 * * *"  # Daily at 2 AM
COMPLIANCE_REPORT_SCHEDULE="0 3 * * 0"  # Weekly on Sunday

# GDPR Settings
GDPR_DATA_EXPORT_EXPIRY_DAYS=30
GDPR_CONSENT_RENEWAL_PERIOD=365

# FERPA Settings
FERPA_DIRECTORY_INFO_ENABLED=true
FERPA_PARENT_ACCESS_AGE_LIMIT=18
```

### Service Configuration
```typescript
import { createComplianceConfig } from '@stellarrec/compliance';

const config = createComplianceConfig({
  enableAuditLogging: true,
  enableGDPRCompliance: true,
  enableFERPACompliance: true,
  enableDataRetention: true,
  auditLogRetention: 2190, // 6 years
  dataRetentionSchedule: '0 2 * * *',
  complianceReportSchedule: '0 3 * * 0'
});
```

## Database Schema

The compliance package includes a comprehensive Prisma schema with:

- **AuditLog**: Complete audit trail
- **DataProcessingRecord**: GDPR processing records
- **DataSubjectRequest**: GDPR rights requests
- **EducationalRecordAccess**: FERPA access logs
- **DataRetentionPolicy**: Retention policy definitions
- **PrivacyConsent**: Consent management
- **DataBreachIncident**: Breach tracking
- **ComplianceAssessment**: Compliance evaluations

## Integration Examples

### Express.js Integration
```typescript
import express from 'express';
import { complianceMiddleware, auditService } from '@stellarrec/compliance';

const app = express();

// Apply compliance middleware globally
app.use(complianceMiddleware);

// Or apply to specific routes
app.use('/api/users', complianceMiddleware);
app.use('/api/applications', complianceMiddleware);
```

### Custom Service Integration
```typescript
import { auditService, ferpaService } from '@stellarrec/compliance';

class UserService {
  async getUserById(id: string, accessorId: string, accessorRole: string) {
    // Check FERPA permissions if accessing student data
    if (accessorRole !== 'student' || id !== accessorId) {
      const canAccess = await ferpaService.canAccessEducationalRecord(
        accessorId,
        accessorRole,
        id,
        'PROFILE',
        id
      );
      
      if (!canAccess.canAccess) {
        throw new Error('Access denied: ' + canAccess.reason);
      }
    }

    const user = await this.database.user.findById(id);
    
    // Log the access
    await auditService.logEvent({
      userId: accessorId,
      action: 'USER_ACCESS',
      resource: 'users',
      resourceId: id,
      complianceFlags: ['FERPA'],
      dataCategory: 'PERSONAL',
      sensitivity: 'MEDIUM'
    });

    return user;
  }
}
```

## Monitoring & Alerting

### Compliance Violations
```typescript
// Set up monitoring for compliance violations
const violations = await auditService.getAuditLogs({
  action: 'COMPLIANCE_VIOLATION',
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  complianceFlags: ['GDPR', 'FERPA']
});

if (violations.length > 0) {
  // Send alert to compliance team
  await sendComplianceAlert(violations);
}
```

### Data Retention Monitoring
```typescript
// Monitor retention policy execution
const retentionReport = await dataRetentionService.generateRetentionComplianceReport();

if (retentionReport.retentionViolations.length > 0) {
  // Alert about retention violations
  await sendRetentionAlert(retentionReport.retentionViolations);
}
```

## Best Practices

1. **Enable All Compliance Features**: Use the complete compliance stack in production
2. **Regular Auditing**: Review audit logs and compliance reports regularly
3. **Data Minimization**: Only collect and process necessary data
4. **Consent Management**: Implement proper consent workflows
5. **Staff Training**: Ensure staff understand compliance requirements
6. **Regular Updates**: Keep compliance policies updated with legal changes
7. **Incident Response**: Have procedures for handling compliance violations
8. **Documentation**: Maintain comprehensive compliance documentation

## Legal Disclaimer

This package provides tools to help with regulatory compliance but does not guarantee legal compliance. Organizations should:

- Consult with legal counsel
- Conduct regular compliance audits
- Stay updated with regulatory changes
- Implement appropriate organizational measures
- Train staff on compliance requirements

## Contributing

1. Follow compliance best practices
2. Add tests for new compliance features
3. Update documentation
4. Ensure backward compatibility
5. Consider privacy implications

## License

MIT License - see LICENSE file for details.