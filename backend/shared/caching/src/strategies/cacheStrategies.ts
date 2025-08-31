interface AdvancedCacheManager {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any, options?: any) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export class CacheStrategies {
  private cacheManager: AdvancedCacheManager;
  private writeBehindQueue: Map<string, { value: any; timestamp: Date; options?: any }> = new Map();
  private writeBehindTimer?: NodeJS.Timeout;

  constructor(cacheManager: AdvancedCacheManager) {
    this.cacheManager = cacheManager;
    this.startWriteBehindProcessor();
  }

  // Cache-Aside Pattern (Lazy Loading)
  async cacheAside<T>(
    key: string, 
    fallback: () => Promise<T>, 
    options?: { ttl?: number; tags?: string[] }
  ): Promise<T> {
    console.log(`🔄 Cache-Aside: Checking cache for key ${key}`);
    
    // Try to get from cache first
    let value = await this.cacheManager.get(key);
    
    if (value !== null) {
      console.log(`✅ Cache-Aside: Cache hit for key ${key}`);
      return value;
    }

    console.log(`❌ Cache-Aside: Cache miss for key ${key}, executing fallback`);
    
    // Cache miss - execute fallback and cache the result
    try {
      value = await fallback();
      
      // Store in cache for future requests
      await this.cacheManager.set(key, value, options);
      
      console.log(`💾 Cache-Aside: Cached result for key ${key}`);
      return value;
    } catch (error) {
      console.error(`❌ Cache-Aside: Fallback failed for key ${key}:`, error);
      throw error;
    }
  }

  // Write-Through Pattern
  async writeThrough<T>(
    key: string, 
    value: T, 
    writer: (value: T) => Promise<T>, 
    options?: { ttl?: number; tags?: string[] }
  ): Promise<T> {
    console.log(`📝 Write-Through: Writing key ${key}`);
    
    try {
      // Write to persistent storage first
      const writtenValue = await writer(value);
      
      // Then update cache
      await this.cacheManager.set(key, writtenValue, options);
      
      console.log(`✅ Write-Through: Successfully wrote and cached key ${key}`);
      return writtenValue;
    } catch (error) {
      console.error(`❌ Write-Through: Failed to write key ${key}:`, error);
      
      // Remove from cache if write failed
      await this.cacheManager.delete(key);
      throw error;
    }
  }

  // Write-Behind Pattern (Write-Back)
  async writeBehind<T>(
    key: string, 
    value: T, 
    options?: { 
      ttl?: number; 
      tags?: string[]; 
      batchSize?: number; 
      flushInterval?: number;
    }
  ): Promise<void> {
    console.log(`⏳ Write-Behind: Queuing write for key ${key}`);
    
    // Update cache immediately
    await this.cacheManager.set(key, value, { ttl: options?.ttl, tags: options?.tags });
    
    // Queue for later write to persistent storage
    this.writeBehindQueue.set(key, {
      value,
      timestamp: new Date(),
      options
    });

    console.log(`📋 Write-Behind: Queued key ${key} (queue size: ${this.writeBehindQueue.size})`);
    
    // Trigger immediate flush if queue is getting large
    const batchSize = options?.batchSize || 100;
    if (this.writeBehindQueue.size >= batchSize) {
      await this.flushWriteBehindQueue();
    }
  }

  // Refresh-Ahead Pattern
  async refreshAhead<T>(
    key: string, 
    refresher: () => Promise<T>, 
    options?: { 
      ttl?: number; 
      refreshThreshold?: number; // Percentage of TTL remaining when to refresh
    }
  ): Promise<T | null> {
    console.log(`🔄 Refresh-Ahead: Checking key ${key}`);
    
    const value = await this.cacheManager.get(key);
    
    if (value === null) {
      console.log(`❌ Refresh-Ahead: Cache miss for key ${key}`);
      return null;
    }

    // Check if we should refresh proactively
    const refreshThreshold = options?.refreshThreshold || 0.8; // 80% of TTL
    const shouldRefresh = await this.shouldRefreshAhead(key, refreshThreshold);
    
    if (shouldRefresh) {
      console.log(`🔄 Refresh-Ahead: Proactively refreshing key ${key}`);
      
      // Refresh in background (don't await)
      this.refreshInBackground(key, refresher, options);
    }

    return value;
  }

  // Read-Through Pattern
  async readThrough<T>(
    key: string, 
    loader: () => Promise<T>, 
    options?: { ttl?: number; tags?: string[] }
  ): Promise<T> {
    console.log(`📖 Read-Through: Reading key ${key}`);
    
    // This is essentially the same as cache-aside but with different semantics
    // In read-through, the cache is responsible for loading data
    return this.cacheAside(key, loader, options);
  }

  // Multi-Level Cache Strategy
  async multiLevel<T>(
    key: string,
    levels: Array<{
      name: string;
      get: () => Promise<T | null>;
      set: (value: T) => Promise<void>;
      ttl: number;
    }>,
    fallback?: () => Promise<T>
  ): Promise<T | null> {
    console.log(`🏗️  Multi-Level: Checking ${levels.length} cache levels for key ${key}`);
    
    // Try each level in order
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      
      try {
        const value = await level.get();
        
        if (value !== null) {
          console.log(`✅ Multi-Level: Hit at level ${i + 1} (${level.name}) for key ${key}`);
          
          // Populate higher levels (cache promotion)
          for (let j = 0; j < i; j++) {
            try {
              await levels[j].set(value);
              console.log(`⬆️  Multi-Level: Promoted to level ${j + 1} (${levels[j].name})`);
            } catch (error) {
              console.error(`Failed to promote to level ${j + 1}:`, error);
            }
          }
          
          return value;
        }
      } catch (error) {
        console.error(`Multi-Level: Error at level ${i + 1} (${level.name}):`, error);
      }
    }

    // All levels missed - use fallback if provided
    if (fallback) {
      console.log(`🔄 Multi-Level: All levels missed, using fallback for key ${key}`);
      
      try {
        const value = await fallback();
        
        // Populate all levels
        for (const level of levels) {
          try {
            await level.set(value);
          } catch (error) {
            console.error(`Failed to populate level ${level.name}:`, error);
          }
        }
        
        return value;
      } catch (error) {
        console.error(`Multi-Level: Fallback failed for key ${key}:`, error);
        throw error;
      }
    }

    console.log(`❌ Multi-Level: Complete miss for key ${key}`);
    return null;
  }

  // Circuit Breaker Pattern for Cache
  async withCircuitBreaker<T>(
    key: string,
    operation: () => Promise<T>,
    options?: {
      failureThreshold?: number;
      recoveryTimeout?: number;
      fallback?: () => Promise<T>;
    }
  ): Promise<T> {
    const failureThreshold = options?.failureThreshold || 5;
    const recoveryTimeout = options?.recoveryTimeout || 60000; // 1 minute
    
    const circuitKey = `circuit:${key}`;
    const circuitState = await this.getCircuitState(circuitKey);
    
    // Check if circuit is open
    if (circuitState.state === 'open') {
      const timeSinceOpen = Date.now() - circuitState.openedAt;
      
      if (timeSinceOpen < recoveryTimeout) {
        console.log(`🚫 Circuit Breaker: Circuit open for key ${key}, using fallback`);
        
        if (options?.fallback) {
          return await options.fallback();
        } else {
          throw new Error(`Circuit breaker open for ${key}`);
        }
      } else {
        // Try to close circuit (half-open state)
        await this.setCircuitState(circuitKey, { state: 'half-open', failures: 0, openedAt: 0 });
        console.log(`🔄 Circuit Breaker: Attempting to close circuit for key ${key}`);
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit
      if (circuitState.state !== 'closed') {
        await this.setCircuitState(circuitKey, { state: 'closed', failures: 0, openedAt: 0 });
        console.log(`✅ Circuit Breaker: Circuit closed for key ${key}`);
      }
      
      return result;
    } catch (error) {
      // Failure - increment counter
      const newFailures = circuitState.failures + 1;
      
      if (newFailures >= failureThreshold) {
        await this.setCircuitState(circuitKey, { 
          state: 'open', 
          failures: newFailures, 
          openedAt: Date.now() 
        });
        console.log(`🚫 Circuit Breaker: Circuit opened for key ${key} after ${newFailures} failures`);
      } else {
        await this.setCircuitState(circuitKey, { 
          state: circuitState.state, 
          failures: newFailures, 
          openedAt: circuitState.openedAt 
        });
      }
      
      throw error;
    }
  }

  // Bulk Operations Strategy
  async bulkGet<T>(keys: string[]): Promise<Map<string, T | null>> {
    console.log(`📦 Bulk Get: Retrieving ${keys.length} keys`);
    
    const results = new Map<string, T | null>();
    
    // Try to get all keys in parallel
    const promises = keys.map(async (key) => {
      try {
        const value = await this.cacheManager.get(key);
        return { key, value };
      } catch (error) {
        console.error(`Bulk Get: Failed to get key ${key}:`, error);
        return { key, value: null };
      }
    });

    const responses = await Promise.allSettled(promises);
    
    for (const response of responses) {
      if (response.status === 'fulfilled') {
        results.set(response.value.key, response.value.value);
      }
    }

    console.log(`📦 Bulk Get: Retrieved ${results.size}/${keys.length} keys successfully`);
    return results;
  }

  async bulkSet<T>(entries: Array<{ key: string; value: T; options?: any }>): Promise<void> {
    console.log(`📦 Bulk Set: Setting ${entries.length} keys`);
    
    const promises = entries.map(async (entry) => {
      try {
        await this.cacheManager.set(entry.key, entry.value, entry.options);
        return { key: entry.key, success: true };
      } catch (error) {
        console.error(`Bulk Set: Failed to set key ${entry.key}:`, error);
        return { key: entry.key, success: false, error };
      }
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`📦 Bulk Set: Set ${successful}/${entries.length} keys successfully`);
  }

  // Private helper methods
  private startWriteBehindProcessor(): void {
    // Process write-behind queue every 5 seconds
    this.writeBehindTimer = setInterval(async () => {
      if (this.writeBehindQueue.size > 0) {
        await this.flushWriteBehindQueue();
      }
    }, 5000);
  }

  private async flushWriteBehindQueue(): Promise<void> {
    if (this.writeBehindQueue.size === 0) {
      return;
    }

    console.log(`🚀 Write-Behind: Flushing queue with ${this.writeBehindQueue.size} items`);
    
    const entries = Array.from(this.writeBehindQueue.entries());
    this.writeBehindQueue.clear();

    // In a real implementation, this would write to persistent storage
    // For now, we'll just simulate the write operation
    const writePromises = entries.map(async ([key, data]) => {
      try {
        // Simulate database write
        await new Promise(resolve => setTimeout(resolve, 10));
        console.log(`💾 Write-Behind: Wrote key ${key} to persistent storage`);
        return { key, success: true };
      } catch (error) {
        console.error(`Write-Behind: Failed to write key ${key}:`, error);
        return { key, success: false, error };
      }
    });

    const results = await Promise.allSettled(writePromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`✅ Write-Behind: Flushed ${successful}/${entries.length} items successfully`);
  }

  private async shouldRefreshAhead(key: string, threshold: number): Promise<boolean> {
    // In a real implementation, this would check the TTL of the cached item
    // For now, we'll use a simple probability-based approach
    return Math.random() < 0.1; // 10% chance to refresh
  }

  private async refreshInBackground<T>(
    key: string, 
    refresher: () => Promise<T>, 
    options?: { ttl?: number }
  ): Promise<void> {
    try {
      const newValue = await refresher();
      await this.cacheManager.set(key, newValue, options);
      console.log(`🔄 Refresh-Ahead: Background refresh completed for key ${key}`);
    } catch (error) {
      console.error(`Refresh-Ahead: Background refresh failed for key ${key}:`, error);
    }
  }

  private async getCircuitState(key: string): Promise<{
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    openedAt: number;
  }> {
    try {
      const state = await this.cacheManager.get(key);
      return state || { state: 'closed', failures: 0, openedAt: 0 };
    } catch (error) {
      return { state: 'closed', failures: 0, openedAt: 0 };
    }
  }

  private async setCircuitState(key: string, state: {
    state: 'closed' | 'open' | 'half-open';
    failures: number;
    openedAt: number;
  }): Promise<void> {
    try {
      await this.cacheManager.set(key, state, { ttl: 300 }); // 5 minutes TTL
    } catch (error) {
      console.error(`Failed to set circuit state for ${key}:`, error);
    }
  }

  // Cleanup
  destroy(): void {
    if (this.writeBehindTimer) {
      clearInterval(this.writeBehindTimer);
    }
    
    // Flush any remaining items
    if (this.writeBehindQueue.size > 0) {
      this.flushWriteBehindQueue();
    }
  }

  // Statistics
  getStrategyStats(): {
    writeBehindQueueSize: number;
    totalOperations: number;
    strategyUsage: Record<string, number>;
  } {
    return {
      writeBehindQueueSize: this.writeBehindQueue.size,
      totalOperations: 0, // Would track this in a real implementation
      strategyUsage: {} // Would track strategy usage patterns
    };
  }
}