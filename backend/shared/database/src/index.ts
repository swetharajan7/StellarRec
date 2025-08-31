export { OptimizedDatabaseClient } from './optimizedDatabase';
export { CacheManager } from './cache/cacheManager';
export { ConnectionPoolManager } from './pool/connectionPoolManager';
export { ReadReplicaManager } from './replicas/readReplicaManager';
export { PartitionManager } from './partitioning/partitionManager';
export { PerformanceMonitor } from './monitoring/performanceMonitor';
export { QueryOptimizer } from './optimization/queryOptimizer';

export type {
  DatabaseConfig,
  CacheConfig,
  PoolConfig,
  ReplicaConfig,
  PartitionConfig,
  MonitoringConfig,
  PerformanceMetrics,
  SlowQuery,
  CacheStats,
  PoolStatus
} from './types';