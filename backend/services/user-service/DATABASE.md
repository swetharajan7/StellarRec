# StellarRec Database Schema Documentation

## Overview

The StellarRec database is designed to support a comprehensive university application platform with AI-powered features. It uses PostgreSQL as the primary database with Prisma as the ORM.

## Schema Design

### Core Entities

#### Users and Profiles
- **users**: Core user authentication and basic information
- **student_profiles**: Extended profile data for students
- **recommender_profiles**: Extended profile data for recommenders  
- **institution_profiles**: Extended profile data for institutions
- **user_preferences**: User settings and preferences

#### Universities and Programs
- **universities**: University information and integration settings
- **programs**: Academic programs offered by universities

#### Applications
- **applications**: Student applications to universities
- **application_components**: Individual components of applications
- **timeline_events**: Deadlines and milestones for applications

#### Recommendation Letters
- **recommendation_letters**: Letter content and metadata
- **letter_deliveries**: Delivery tracking to universities
- **letter_collaborators**: Collaboration permissions
- **letter_versions**: Version history for letters

#### AI and Analytics
- **university_matches**: AI-generated university recommendations
- **essay_analyses**: AI analysis of student essays
- **notifications**: System notifications to users
- **audit_logs**: Comprehensive audit trail

## Key Features

### 1. Soft Deletion
- Users, applications, and letters support soft deletion
- Records are marked with `deleted_at` timestamp instead of being permanently removed
- Soft deleted records are automatically excluded from queries
- Restoration functionality available through custom database client

### 2. Audit Logging
- Comprehensive audit trail for all sensitive operations
- Automatic logging of INSERT, UPDATE, DELETE operations
- Tracks user ID, IP address, user agent, and timestamps
- Stores both old and new values for UPDATE operations

### 3. Performance Optimization
- Strategic indexes on frequently queried columns
- Composite indexes for common query patterns
- GIN indexes for array and JSON columns
- Concurrent index creation to avoid blocking

### 4. Data Validation
- Database-level constraints for data integrity
- Email format validation
- GPA range validation (0.0 - 4.0)
- Progress percentage validation (0 - 100)
- Automatic timestamp updates via triggers

### 5. Business Logic Triggers
- Automatic application progress calculation
- Prevention of submitted application deletion
- Deadline validation and constraints
- Letter status updates on delivery

## Database Setup

### Prerequisites
- PostgreSQL 14+
- Node.js 18+
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database connection details
   ```

3. **Generate Prisma client**
   ```bash
   npm run db:generate
   ```

4. **Run database migrations**
   ```bash
   npm run migrate
   ```

5. **Apply custom SQL migrations**
   ```bash
   # Run the index and constraint migrations
   psql -d your_database -f prisma/migrations/001_add_indexes_and_constraints.sql
   psql -d your_database -f prisma/migrations/002_add_triggers_and_constraints.sql
   ```

6. **Seed the database**
   ```bash
   npm run seed
   ```

### Development Commands

```bash
# Generate Prisma client
npm run db:generate

# Create and apply new migration
npm run migrate

# Reset database (WARNING: destroys all data)
npm run db:reset

# Seed database with sample data
npm run seed

# Open Prisma Studio (database GUI)
npm run db:studio
```

## Database Client Usage

### Basic Operations

```typescript
import { db } from './src/utils/database';

// Standard operations (automatically exclude soft deleted)
const activeUsers = await db.users.findMany();
const user = await db.users.findUnique({ where: { id: userId } });

// Include soft deleted records
const allUsers = await db.findWithDeleted('users', {});

// Find only soft deleted records
const deletedUsers = await db.findDeleted('users', {});

// Soft delete (sets deleted_at timestamp)
await db.users.delete({ where: { id: userId } });

// Restore soft deleted record
await db.restore('users', { id: userId });

// Permanent deletion (use with caution)
await db.forceDelete('users', { id: userId });
```

### Audit Context

```typescript
// Set audit context for tracking changes
await db.setAuditContext(userId, ipAddress, userAgent);

// Perform operations (will be logged)
await db.users.update({
  where: { id: userId },
  data: { email: 'new@email.com' }
});

// Clear audit context
await db.clearAuditContext();
```

### Health Monitoring

```typescript
// Check database health
const health = await db.healthCheck();

// Get database statistics
const stats = await db.getDatabaseStats();

// Get table sizes
const sizes = await db.getTableSizes();

// Run maintenance tasks
await db.maintenanceTasks();
```

## Performance Considerations

### Indexes
- All foreign keys are indexed
- Frequently queried columns have individual indexes
- Composite indexes for common query patterns
- GIN indexes for array and JSON searches

### Query Optimization
- Use `select` to limit returned fields
- Leverage Prisma's `include` and `select` for efficient joins
- Use pagination for large result sets
- Consider using database views for complex queries

### Monitoring
- Monitor slow queries using `pg_stat_statements`
- Use `EXPLAIN ANALYZE` for query performance analysis
- Regular `VACUUM ANALYZE` for optimal performance
- Monitor index usage and effectiveness

## Security Features

### Data Protection
- Password hashing with bcrypt
- Sensitive data encryption at rest
- Audit logging for compliance
- Role-based access control

### Input Validation
- Database constraints prevent invalid data
- Prisma type safety prevents SQL injection
- Express-validator for API input validation
- Custom validation triggers

## Backup and Recovery

### Backup Strategy
```bash
# Create full database backup
pg_dump -h localhost -U username -d stellarrec > backup.sql

# Create compressed backup
pg_dump -h localhost -U username -d stellarrec | gzip > backup.sql.gz

# Backup specific tables
pg_dump -h localhost -U username -d stellarrec -t users -t applications > partial_backup.sql
```

### Recovery
```bash
# Restore from backup
psql -h localhost -U username -d stellarrec < backup.sql

# Restore compressed backup
gunzip -c backup.sql.gz | psql -h localhost -U username -d stellarrec
```

## Troubleshooting

### Common Issues

1. **Migration Failures**
   - Check database connection
   - Ensure user has proper permissions
   - Review migration SQL for syntax errors

2. **Performance Issues**
   - Run `ANALYZE` to update statistics
   - Check for missing indexes
   - Review slow query log

3. **Connection Issues**
   - Verify DATABASE_URL format
   - Check PostgreSQL service status
   - Ensure firewall allows connections

### Useful Queries

```sql
-- Check active connections
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Find slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;
```

## Migration History

- **Initial Schema**: Core tables and relationships
- **001_add_indexes_and_constraints**: Performance indexes and composite indexes
- **002_add_triggers_and_constraints**: Data validation, audit logging, and business logic triggers

## Contributing

When making schema changes:

1. Create a new Prisma migration
2. Add any custom SQL to separate migration files
3. Update this documentation
4. Test with sample data
5. Update seed script if needed

## Support

For database-related issues:
- Check the troubleshooting section
- Review Prisma documentation
- Check PostgreSQL logs
- Contact the development team