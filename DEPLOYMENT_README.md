# StellarRec™ Deployment Guide

This document provides comprehensive instructions for deploying and managing the StellarRec™ application using the CI/CD pipeline.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Database Migrations](#database-migrations)
6. [Deployment Monitoring](#deployment-monitoring)
7. [Security Scanning](#security-scanning)
8. [Rollback Procedures](#rollback-procedures)
9. [Troubleshooting](#troubleshooting)

## Overview

The StellarRec™ deployment system uses:
- **GitHub Actions** for CI/CD automation
- **Docker** for containerization
- **AWS ECR** for container registry
- **PostgreSQL** for database with automated migrations
- **Redis** for caching and session management
- **Automated security scanning** with multiple tools
- **Blue-green deployment** for zero-downtime releases
- **Comprehensive monitoring** and alerting

## Prerequisites

### Required Tools
- Docker and Docker Compose
- AWS CLI configured with appropriate permissions
- Node.js 18+ for local development
- PostgreSQL client tools

### Required Secrets
Configure the following secrets in your GitHub repository:

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY

# Security Scanning
SNYK_TOKEN
CODECOV_TOKEN

# Notifications
SLACK_WEBHOOK_URL
NOTIFICATION_EMAIL

# Application Secrets
JWT_SECRET
OPENAI_API_KEY
SENDGRID_API_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SENTRY_DSN
NEW_RELIC_LICENSE_KEY
```

## Environment Setup

### Staging Environment
```bash
# Copy environment template
cp deployment/staging/.env.example deployment/staging/.env

# Edit configuration
nano deployment/staging/.env

# Deploy to staging
docker-compose -f deployment/staging/docker-compose.yml up -d
```

### Production Environment
```bash
# Copy environment template
cp deployment/production/.env.example deployment/production/.env

# Edit configuration (use strong passwords and real API keys)
nano deployment/production/.env

# Deploy to production
docker-compose -f deployment/production/docker-compose.yml up -d
```

## CI/CD Pipeline

### Workflow Triggers
- **Push to `develop`**: Triggers staging deployment
- **Push to `main`**: Triggers production deployment
- **Pull Requests**: Runs tests and security scans
- **Scheduled**: Daily security scans

### Pipeline Stages

#### 1. Test Stage
```yaml
- Unit tests (backend & frontend)
- Integration tests
- End-to-end tests
- Code coverage reporting
```

#### 2. Security Scanning
```yaml
- Dependency vulnerability scanning
- Static code analysis (CodeQL)
- Container security scanning (Trivy)
- Secrets detection (TruffleHog)
```

#### 3. Build Stage
```yaml
- Docker image building
- Image tagging with commit SHA
- Artifact storage in ECR
```

#### 4. Deployment Stage
```yaml
- Database migrations
- Blue-green deployment
- Health checks
- Rollback on failure
```

### Manual Deployment

To manually trigger a deployment:

```bash
# Trigger staging deployment
git push origin develop

# Trigger production deployment
git push origin main

# Or use GitHub CLI
gh workflow run "CI/CD Pipeline" --ref main
```

## Database Migrations

### Creating Migrations

```bash
# Create a new migration
cd backend
npm run migrate:create add_user_preferences

# Edit the generated migration file
# migrations/20240101120000_add_user_preferences.sql
```

### Migration File Format

```sql
-- UP
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
DROP TABLE user_preferences;
```

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:rollback-one

# Rollback to specific migration
npm run migrate:rollback 20240101120000_add_user_preferences
```

### Production Migration Process

1. **Backup Database**
   ```bash
   ./deployment/production/backup-script.sh backup
   ```

2. **Run Migrations**
   ```bash
   npm run migrate
   ```

3. **Verify Migration**
   ```bash
   npm run migrate:status
   ```

4. **Rollback if Needed**
   ```bash
   npm run migrate:rollback-one
   ```

## Deployment Monitoring

### Health Checks

The system includes comprehensive health monitoring:

```bash
# Check application health
curl https://stellarrec.com/health

# Check API health
curl https://stellarrec.com/api/health

# Run deployment monitor
./scripts/deployment-monitor.sh production health
```

### Monitoring Workflows

- **Continuous Monitoring**: Runs every 5 minutes
- **Performance Monitoring**: Lighthouse audits
- **Uptime Monitoring**: Multi-endpoint checks
- **SSL Certificate Monitoring**: Expiry alerts

### Alerts and Notifications

Notifications are sent via:
- Slack webhooks for immediate alerts
- Email for critical issues
- GitHub issues for security vulnerabilities

## Security Scanning

### Automated Scans

1. **Dependency Scanning**
   - npm audit for known vulnerabilities
   - Snyk for comprehensive security analysis

2. **Code Analysis**
   - CodeQL for static analysis
   - Custom security rules

3. **Container Scanning**
   - Trivy for container vulnerabilities
   - Base image security assessment

4. **Secrets Detection**
   - TruffleHog for exposed secrets
   - Git history scanning

### Manual Security Checks

```bash
# Run security audit
cd backend && npm audit
cd frontend && npm audit

# Run Snyk scan
snyk test

# Scan Docker images
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image stellarrec-backend:latest
```

## Rollback Procedures

### Automatic Rollback

The system automatically rolls back if:
- Health checks fail after deployment
- Error rates exceed thresholds
- Performance degrades significantly

### Manual Rollback

#### Application Rollback
```bash
# Rollback to previous version
./scripts/deployment-monitor.sh production rollback

# Rollback to specific version
./scripts/deployment-monitor.sh production rollback v1.2.3
```

#### Database Rollback
```bash
# Rollback last migration
npm run migrate:rollback-one

# Restore from backup
./deployment/production/backup-script.sh restore /backup/stellarrec_backup_20240101_120000.sql.gz
```

### Blue-Green Deployment

For zero-downtime deployments:

1. **Deploy to Green Environment**
   ```bash
   # Deploy new version to green environment
   docker-compose -f deployment/production/docker-compose-green.yml up -d
   ```

2. **Run Health Checks**
   ```bash
   # Verify green environment health
   curl https://green.stellarrec.com/health
   ```

3. **Switch Traffic**
   ```bash
   # Update load balancer to point to green
   aws elbv2 modify-listener --listener-arn $LISTENER_ARN \
     --default-actions Type=forward,TargetGroupArn=$GREEN_TARGET_GROUP
   ```

4. **Monitor and Rollback if Needed**
   ```bash
   # Switch back to blue if issues occur
   aws elbv2 modify-listener --listener-arn $LISTENER_ARN \
     --default-actions Type=forward,TargetGroupArn=$BLUE_TARGET_GROUP
   ```

## Backup and Recovery

### Automated Backups

- **Database**: Daily automated backups with 30-day retention
- **File Storage**: Continuous backup to S3
- **Configuration**: Version controlled in Git

### Backup Commands

```bash
# Create manual backup
./deployment/production/backup-script.sh backup

# List available backups
./deployment/production/backup-script.sh list

# Verify backup integrity
./deployment/production/backup-script.sh verify /backup/stellarrec_backup_20240101_120000.sql.gz

# Restore from backup
./deployment/production/backup-script.sh restore /backup/stellarrec_backup_20240101_120000.sql.gz
```

### Disaster Recovery

1. **Assess Damage**
   - Identify affected components
   - Determine data loss extent

2. **Restore Infrastructure**
   ```bash
   # Redeploy from latest known good configuration
   git checkout last-known-good-commit
   docker-compose -f deployment/production/docker-compose.yml up -d
   ```

3. **Restore Data**
   ```bash
   # Restore from most recent backup
   ./deployment/production/backup-script.sh restore /backup/latest_backup.sql.gz
   ```

4. **Verify System**
   ```bash
   # Run comprehensive health checks
   ./scripts/deployment-monitor.sh production health
   ```

## Troubleshooting

### Common Issues

#### Deployment Failures

**Issue**: Docker build fails
```bash
# Check Docker logs
docker logs stellarrec-backend-production

# Rebuild with no cache
docker build --no-cache -t stellarrec-backend ./backend
```

**Issue**: Database migration fails
```bash
# Check migration status
npm run migrate:status

# Rollback problematic migration
npm run migrate:rollback-one

# Fix migration and retry
npm run migrate
```

#### Performance Issues

**Issue**: High response times
```bash
# Check container resources
docker stats

# Check database performance
psql -c "SELECT * FROM pg_stat_activity;"

# Check Redis performance
redis-cli info stats
```

#### Security Issues

**Issue**: Vulnerability detected
```bash
# Update dependencies
npm audit fix

# Check for security patches
npm outdated

# Run security scan
snyk test --severity-threshold=high
```

### Monitoring and Debugging

#### Application Logs
```bash
# View application logs
docker logs -f stellarrec-backend-production

# View database logs
docker logs -f stellarrec-postgres-production

# View nginx logs
docker logs -f stellarrec-nginx-production
```

#### Performance Monitoring
```bash
# Check system resources
docker stats

# Monitor database queries
psql -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Check Redis memory usage
redis-cli info memory
```

#### Health Check Endpoints
```bash
# Application health
curl https://stellarrec.com/health

# Database health
curl https://stellarrec.com/api/health/database

# Redis health
curl https://stellarrec.com/api/health/redis

# External services health
curl https://stellarrec.com/api/health/external
```

## Best Practices

### Development Workflow
1. Create feature branch from `develop`
2. Implement changes with tests
3. Create pull request
4. Wait for CI/CD checks to pass
5. Merge to `develop` for staging deployment
6. Test in staging environment
7. Merge to `main` for production deployment

### Security Best Practices
1. Regularly update dependencies
2. Use strong, unique passwords
3. Enable two-factor authentication
4. Monitor security alerts
5. Conduct regular security audits
6. Follow principle of least privilege

### Monitoring Best Practices
1. Set up comprehensive alerting
2. Monitor key business metrics
3. Track error rates and response times
4. Monitor resource utilization
5. Set up log aggregation
6. Create runbooks for common issues

## Support and Maintenance

### Regular Maintenance Tasks
- Weekly dependency updates
- Monthly security scans
- Quarterly disaster recovery tests
- Annual security audits

### Getting Help
- Check this documentation first
- Review application logs
- Check monitoring dashboards
- Contact the development team
- Create GitHub issues for bugs

### Emergency Contacts
- **Development Team**: dev-team@stellarrec.com
- **DevOps Team**: devops@stellarrec.com
- **Security Team**: security@stellarrec.com
- **On-call Engineer**: +1-555-STELLAR