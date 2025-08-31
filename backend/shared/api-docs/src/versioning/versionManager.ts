import { VersionConfig } from '../types';

export class VersionManager {
  private config: VersionConfig;

  constructor(config: VersionConfig) {
    this.config = config;
  }

  generateDocumentation(): {
    overview: string;
    migrationGuide: string;
    changelog: string;
  } {
    return {
      overview: this.generateVersionOverview(),
      migrationGuide: this.generateMigrationGuide(),
      changelog: this.generateChangelog()
    };
  }

  private generateVersionOverview(): string {
    return `# API Versioning

## Overview

The StellarRec API uses semantic versioning and maintains backward compatibility across versions.

## Current Version

**Current Version:** ${this.config.current}

## Versioning Strategy

We use **${this.config.strategy}** versioning:

${this.config.strategy === 'url' ? `
- URL-based versioning: \`/v1/\`, \`/v2/\`, etc.
- Example: \`https://api.stellarrec.com/v1/users\`
` : ''}

${this.config.strategy === 'header' ? `
- Header-based versioning: \`API-Version: 1.0\`
- Example: \`curl -H "API-Version: 1.0" https://api.stellarrec.com/users\`
` : ''}

${this.config.strategy === 'query' ? `
- Query parameter versioning: \`?version=1.0\`
- Example: \`https://api.stellarrec.com/users?version=1.0\`
` : ''}

## Supported Versions

| Version | Status | Support Until | Notes |
|---------|--------|---------------|-------|
${this.config.supported.map(version => {
  const isDeprecated = this.config.deprecated.includes(version);
  const status = version === this.config.current ? 'Current' : isDeprecated ? 'Deprecated' : 'Supported';
  const supportUntil = isDeprecated ? 'See migration guide' : 'TBD';
  return `| ${version} | ${status} | ${supportUntil} | ${isDeprecated ? 'Migration required' : 'Fully supported'} |`;
}).join('\n')}

## Deprecation Policy

- **Advance Notice:** ${this.config.deprecationNotice} months before deprecation
- **Support Period:** Deprecated versions are supported for 6 months
- **Breaking Changes:** Only introduced in major version updates

## Version Selection

### Default Behavior
If no version is specified, the API defaults to version ${this.config.current}.

### Explicit Version Selection
Always specify the API version explicitly in production applications:

\`\`\`bash
# URL versioning
curl https://api.stellarrec.com/v1/users

# Header versioning
curl -H "API-Version: 1.0" https://api.stellarrec.com/users

# Query parameter versioning
curl https://api.stellarrec.com/users?version=1.0
\`\`\`

## Version Compatibility

### Backward Compatibility
- Minor version updates (e.g., 1.0 → 1.1) are backward compatible
- Patch version updates (e.g., 1.0.0 → 1.0.1) are always backward compatible

### Breaking Changes
Breaking changes are only introduced in major version updates:
- New required fields
- Removed endpoints or fields
- Changed response formats
- Modified authentication requirements

## Best Practices

1. **Pin to Specific Versions:** Always specify the exact version in production
2. **Test Before Upgrading:** Thoroughly test your application with new versions
3. **Monitor Deprecation Notices:** Subscribe to our developer newsletter
4. **Gradual Migration:** Migrate endpoints incrementally when possible
5. **Fallback Strategy:** Implement fallback logic for version-specific features

## Getting Version Information

### API Version Endpoint
\`\`\`bash
curl https://api.stellarrec.com/version
\`\`\`

Response:
\`\`\`json
{
  "current": "${this.config.current}",
  "supported": ${JSON.stringify(this.config.supported)},
  "deprecated": ${JSON.stringify(this.config.deprecated)},
  "latest": "${this.config.current}"
}
\`\`\`

### Response Headers
All API responses include version information:
\`\`\`
API-Version: ${this.config.current}
API-Supported-Versions: ${this.config.supported.join(', ')}
API-Deprecated-Versions: ${this.config.deprecated.join(', ')}
\`\`\`
`;
  }

  private generateMigrationGuide(): string {
    return `# API Migration Guide

## Overview

This guide helps you migrate between different versions of the StellarRec API.

## Migration Checklist

Before migrating to a new API version:

- [ ] Review the changelog for breaking changes
- [ ] Update your API client or SDK
- [ ] Test all endpoints in a staging environment
- [ ] Update error handling for new error codes
- [ ] Verify authentication still works
- [ ] Check rate limiting changes
- [ ] Update webhook payload handling if applicable

## Version-Specific Migration Guides

### Migrating from v1.0 to v1.1

#### New Features
- Added pagination to list endpoints
- New webhook events for application status changes
- Enhanced error responses with detailed field validation

#### Changes
- **Non-breaking:** Added \`pagination\` object to list responses
- **Non-breaking:** Added \`created_at\` and \`updated_at\` to all resources
- **Deprecated:** \`total_count\` field (use \`pagination.total\` instead)

#### Migration Steps
1. Update your code to handle the new \`pagination\` object
2. Replace usage of \`total_count\` with \`pagination.total\`
3. Update webhook handlers for new events

#### Code Examples

**Before (v1.0):**
\`\`\`javascript
const response = await api.universities.list();
console.log('Total:', response.total_count);
console.log('Universities:', response.data);
\`\`\`

**After (v1.1):**
\`\`\`javascript
const response = await api.universities.list();
console.log('Total:', response.pagination.total);
console.log('Universities:', response.data);
\`\`\`

### Migrating from v1.1 to v2.0

#### Breaking Changes
- **Field Naming:** Changed from snake_case to camelCase
- **Date Format:** Changed from \`YYYY-MM-DD\` to ISO 8601
- **Authentication:** Removed API key authentication (OAuth only)
- **Removed Fields:** Deprecated fields from v1.0 are no longer available

#### Migration Steps
1. **Update Field Names:**
   - \`user_id\` → \`userId\`
   - \`created_at\` → \`createdAt\`
   - \`updated_at\` → \`updatedAt\`

2. **Update Date Handling:**
   - Old: \`"2024-01-15"\`
   - New: \`"2024-01-15T10:30:00Z"\`

3. **Migrate Authentication:**
   - Remove API key authentication
   - Implement OAuth 2.0 flow

#### Code Examples

**Before (v1.1):**
\`\`\`javascript
const user = {
  user_id: "123",
  created_at: "2024-01-15",
  profile: {
    first_name: "John",
    last_name: "Doe"
  }
};
\`\`\`

**After (v2.0):**
\`\`\`javascript
const user = {
  userId: "123",
  createdAt: "2024-01-15T10:30:00Z",
  profile: {
    firstName: "John",
    lastName: "Doe"
  }
};
\`\`\`

## Automated Migration Tools

### Migration Script
We provide migration scripts to help automate the process:

\`\`\`bash
# Install migration tool
npm install -g @stellarrec/api-migrator

# Run migration analysis
stellarrec-migrate analyze --from=v1.1 --to=v2.0 --input=./src

# Apply automated fixes
stellarrec-migrate fix --from=v1.1 --to=v2.0 --input=./src --output=./src-v2
\`\`\`

### SDK Updates
Update your SDK to the latest version:

\`\`\`bash
# JavaScript/TypeScript
npm update @stellarrec/client-js

# Python
pip install --upgrade stellarrec-python

# Java
# Update version in pom.xml or build.gradle
\`\`\`

## Testing Your Migration

### Staging Environment
Test your migration in our staging environment:
- **Staging URL:** \`https://staging-api.stellarrec.com\`
- **Test Data:** Use test API keys for safe testing

### Migration Validation
Use our validation endpoint to check compatibility:

\`\`\`bash
curl -X POST https://api.stellarrec.com/validate-migration \\
  -H "Content-Type: application/json" \\
  -d '{
    "from_version": "v1.1",
    "to_version": "v2.0",
    "endpoints": ["/users", "/applications"]
  }'
\`\`\`

## Rollback Strategy

If you encounter issues after migration:

1. **Immediate Rollback:** Switch back to the previous version
2. **Gradual Rollback:** Migrate endpoints back one by one
3. **Support:** Contact our support team for assistance

## Support and Resources

### Documentation
- [API Reference](../api-reference/)
- [SDK Documentation](../sdks/)
- [Code Examples](../examples/)

### Support Channels
- **Email:** api-support@stellarrec.com
- **Discord:** #api-migration channel
- **Office Hours:** Tuesdays 2-4 PM PST

### Migration Assistance
Our team offers free migration assistance for:
- Enterprise customers
- High-volume API users
- Complex integration scenarios

Contact us at migration-help@stellarrec.com to schedule a consultation.
`;
  }

  private generateChangelog(): string {
    return `# API Changelog

## Version ${this.config.current} (Current)

### Added
- Enhanced university matching algorithm with ML-based recommendations
- Real-time collaboration features for recommendation letters
- Advanced analytics and insights dashboard
- Webhook support for real-time notifications
- Comprehensive rate limiting with burst support

### Changed
- Improved error messages with detailed field validation
- Enhanced authentication with OAuth 2.0 support
- Optimized database queries for better performance
- Updated pagination to include more metadata

### Fixed
- Resolved timezone handling issues in deadline calculations
- Fixed race conditions in concurrent letter editing
- Improved error handling for file uploads
- Corrected sorting behavior in university search

### Security
- Implemented additional security headers
- Enhanced input validation and sanitization
- Added anomaly detection for suspicious activities
- Improved audit logging for compliance

---

## Version 1.1.0

**Release Date:** 2024-01-15

### Added
- Pagination support for all list endpoints
- New webhook events for application status changes
- Enhanced error responses with field-level validation
- Support for bulk operations on applications
- Advanced search filters for universities

### Changed
- Improved response times for university search
- Enhanced matching algorithm accuracy
- Updated rate limiting to be more flexible
- Better error messages for validation failures

### Deprecated
- \`total_count\` field in list responses (use \`pagination.total\`)
- Legacy date format (use ISO 8601 format)

### Fixed
- Fixed pagination edge cases
- Resolved issues with special characters in search
- Corrected timezone handling in date fields
- Fixed memory leaks in long-running processes

---

## Version 1.0.0

**Release Date:** 2023-12-01

### Added
- Initial API release
- User authentication and profile management
- University and program data access
- Application tracking and management
- Recommendation letter system
- Basic search and filtering capabilities
- File upload and management
- Email notifications

### Features
- RESTful API design
- JWT-based authentication
- Comprehensive error handling
- Rate limiting protection
- API key authentication
- Basic webhook support

---

## Upcoming Releases

### Version 2.1.0 (Planned: Q2 2024)

#### Planned Features
- GraphQL API support
- Advanced analytics API
- Machine learning insights
- Enhanced collaboration tools
- Mobile SDK support

#### Breaking Changes
None planned - this will be a backward-compatible release.

### Version 3.0.0 (Planned: Q4 2024)

#### Planned Features
- Complete API redesign with improved performance
- New authentication system
- Enhanced security features
- Microservices architecture
- Real-time subscriptions

#### Breaking Changes
- New authentication flow
- Updated response formats
- Restructured endpoints
- Migration tools will be provided

---

## Version Support Timeline

| Version | Release Date | End of Support | Status |
|---------|--------------|----------------|--------|
| 3.0.0 | Q4 2024 | TBD | Planned |
| 2.1.0 | Q2 2024 | TBD | Planned |
| ${this.config.current} | 2024-01-15 | TBD | Current |
| 1.1.0 | 2024-01-15 | 2025-01-15 | Supported |
| 1.0.0 | 2023-12-01 | 2024-06-01 | Deprecated |

## Deprecation Notices

### Version 1.0.0
- **Deprecated:** 2024-01-15
- **End of Support:** 2024-06-01
- **Reason:** Security improvements and performance optimizations
- **Migration Path:** Upgrade to version 1.1.0 or later

## How to Stay Updated

### Notification Channels
- **Developer Newsletter:** Subscribe at https://stellarrec.com/developers/newsletter
- **Discord:** Join our #api-announcements channel
- **GitHub:** Watch our API repository for releases
- **RSS Feed:** https://api.stellarrec.com/changelog.rss

### API Headers
All responses include version information:
\`\`\`
API-Version: ${this.config.current}
API-Changelog: https://docs.stellarrec.com/changelog
API-Migration-Guide: https://docs.stellarrec.com/migration
\`\`\`

### Webhook Notifications
Subscribe to version update webhooks:
\`\`\`json
{
  "event": "api.version.deprecated",
  "data": {
    "version": "1.0.0",
    "deprecation_date": "2024-01-15",
    "end_of_support": "2024-06-01",
    "migration_guide": "https://docs.stellarrec.com/migration/v1.0-to-v1.1"
  }
}
\`\`\`
`;
  }
}