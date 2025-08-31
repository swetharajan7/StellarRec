# Database Performance Optimization

## Overview

This module provides comprehensive database performance optimization features for the StellarRec platform, including connection pooling, query caching, read replicas, partitioning, and monitoring.

## Features

- **Connection Pooling**: Optimized connection management with configurable pool sizes
- **Query Caching**: Redis-based caching for frequently accessed data
- **Read Replicas**: Load balancing between primary and read-only database instances
- **Database Partitioning**: Automatic partitioning for large tables
- **Performance Monitoring**: Real-time monitoring and slow query analysis
- **Cache Warming**: Intelligent cache preloading strategies

## Installation

```bash
npm install
```

## Configuration

Set up environment variables:

```bash
# Primary database
DATABASE_URL="postgresql://user:password@localhost:5432/stellarrec"

# Read replica (optional)
DATABASE_READ_URL="postgresql://user:password@localhost:5433/stellarrec_read"

# Redis cache
REDIS_URL="redis://localhost:6379"

# Connection pool settings
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=5000

# Cache settings
CACHE_TTL=300
CACHE_MAX_MEMORY="100mb"
```

## Usage

```typescript
import { OptimizedDatabaseClient } from './src/optimizedDatabase';

const db = new OptimizedDatabaseClient();

// Use cached queries
const users = await db.cached.users.findMany({
  where: { is_active: true },
  ttl: 300 // 5 minutes
});

// Use read replica for read operations
const stats = await db.read.getDatabaseStats();

// Force primary database for writes
const newUser = await db.primary.users.create({
  data: { email: 'user@example.com' }
});
```

## Performance Features

### Connection Pooling
- Automatic connection pool management
- Configurable min/max connections
- Connection health monitoring
- Automatic reconnection on failures

### Query Caching
- Redis-based result caching
- Configurable TTL per query
- Automatic cache invalidation
- Cache warming strategies

### Read Replicas
- Automatic read/write splitting
- Load balancing across replicas
- Failover to primary on replica failure
- Connection health monitoring

### Database Partitioning
- Automatic table partitioning by date
- Partition pruning for better performance
- Automatic partition maintenance
- Support for range and hash partitioning

### Performance Monitoring
- Real-time query performance metrics
- Slow query detection and logging
- Connection pool monitoring
- Cache hit rate tracking
- Automated performance alerts

## Monitoring

Access performance metrics:

```typescript
// Get performance metrics
const metrics = await db.getPerformanceMetrics();

// Get slow queries
const slowQueries = await db.getSlowQueries();

// Get cache statistics
const cacheStats = await db.getCacheStats();

// Get connection pool status
const poolStatus = await db.getPoolStatus();
```

## Maintenance

Regular maintenance tasks:

```typescript
// Run database maintenance
await db.runMaintenance();

// Warm cache
await db.warmCache();

// Analyze query performance
await db.analyzePerformance();

// Clean up old partitions
await db.cleanupPartitions();
```

## Best Practices

1. **Use appropriate caching TTL** - Balance between data freshness and performance
2. **Monitor cache hit rates** - Aim for >80% cache hit rate for frequently accessed data
3. **Use read replicas for analytics** - Offload heavy analytical queries to read replicas
4. **Regular maintenance** - Run VACUUM ANALYZE regularly on large tables
5. **Monitor slow queries** - Set up alerts for queries taking >1 second
6. **Partition large tables** - Consider partitioning tables with >1M rows

## Troubleshooting

Common issues and solutions:

### High Connection Count
- Increase connection pool size
- Check for connection leaks
- Implement connection timeout

### Cache Misses
- Increase cache TTL for stable data
- Implement cache warming
- Check cache memory limits

### Slow Queries
- Add missing indexes
- Optimize query structure
- Consider query result caching

### Replica Lag
- Monitor replication lag
- Implement read preference routing
- Consider read-after-write consistency