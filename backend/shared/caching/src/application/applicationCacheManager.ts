import NodeCache from 'node-cache';
import LRU from 'lru-cache';
import { ApplicationCacheConfig, CacheHealthCheck, CacheStats } from '../types';

export class ApplicationCacheManager {
  private cache: NodeCache | LRU<string, any>;
  private config: ApplicationCacheConfig;
  private stats: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    evictions: number;
  };

  constructor(config: ApplicationCacheConfig) {
    this.config = config;
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };

    this.initializeCache();
  }

  private initializeCache() {
    if (!this.config.enabled) {
      return;
    }

    const maxSizeBytes = this.parseSize(this.config.maxSize);

    switch (this.config.algorithm) {
      case 'lru':
        this.cache = new LRU({
          max: 10000, // Max number of items
          maxSize: maxSizeBytes,
          sizeCalculation: (value) => {
            return JSON.stringify(value).length;
          },
          ttl: this.config.ttl * 1000, // Convert to milliseconds
          allowStale: false,
          updateAgeOnGet: true,
          updateAgeOnHas: false,
          dispose: (value, key) => {
            this.stats.evictions++;
            console.log(`🗑️  LRU: Evicted key ${key}`);
          }
        });
        break;

      case 'lfu':
      case 'fifo':
      default:
        this.cache = new NodeCache({
          stdTTL: this.config.ttl,
          checkperiod: Math.floor(this.config.ttl / 10),
          useClones: false,
          deleteOnExpire: true,
          enableLegacyCallbacks: false,
          maxKeys: 10000
        });

        // Set up event listeners for NodeCache
        (this.cache as NodeCache).on('expired', (key, value) => {
          this.stats.evictions++;
          console.log(`⏰ Cache: Key ${key} expired`);
        });

        (this.cache as NodeCache).on('del', (key, value) => {
          console.log(`🗑️  Cache: Key ${key} deleted`);
        });
        break;
    }

    console.log(`✅ Application cache initialized with ${this.config.algorithm} algorithm`);
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.config.enabled || !this.cache) {
      return null;
    }

    try {
      let value: T | undefined;

      if (this.cache instanceof LRU) {
        value = this.cache.get(key);
      } else {
        value = (this.cache as NodeCache).get<T>(key);
      }

      if (value !== undefined) {
        this.stats.hits++;
        return value;
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      console.error('Application cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: { ttl?: number }): Promise<void> {
    if (!this.config.enabled || !this.cache) {
      return;
    }

    try {
      const ttl = options?.ttl || this.config.ttl;

      if (this.cache instanceof LRU) {
        this.cache.set(key, value, { ttl: ttl * 1000 });
      } else {
        (this.cache as NodeCache).set(key, value, ttl);
      }

      this.stats.sets++;
    } catch (error) {
      console.error('Application cache set error:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.config.enabled || !this.cache) {
      return;
    }

    try {
      if (this.cache instanceof LRU) {
        this.cache.delete(key);
      } else {
        (this.cache as NodeCache).del(key);
      }

      this.stats.deletes++;
    } catch (error) {
      console.error('Application cache delete error:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (!this.config.enabled || !this.cache) {
      return;
    }

    try {
      if (this.cache instanceof LRU) {
        this.cache.clear();
      } else {
        (this.cache as NodeCache).flushAll();
      }

      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0
      };

      console.log('🧹 Application cache cleared');
    } catch (error) {
      console.error('Application cache clear error:', error);
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    if (!this.config.enabled || !this.cache) {
      return false;
    }

    try {
      if (this.cache instanceof LRU) {
        return this.cache.has(key);
      } else {
        return (this.cache as NodeCache).has(key);
      }
    } catch (error) {
      console.error('Application cache has error:', error);
      return false;
    }
  }

  async keys(): Promise<string[]> {
    if (!this.config.enabled || !this.cache) {
      return [];
    }

    try {
      if (this.cache instanceof LRU) {
        return Array.from(this.cache.keys());
      } else {
        return (this.cache as NodeCache).keys();
      }
    } catch (error) {
      console.error('Application cache keys error:', error);
      return [];
    }
  }

  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    if (!this.config.enabled || !this.cache) {
      return keys.map(() => null);
    }

    const results: Array<T | null> = [];

    for (const key of keys) {
      const value = await this.get<T>(key);
      results.push(value);
    }

    return results;
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (!this.config.enabled || !this.cache) {
      return;
    }

    for (const entry of entries) {
      await this.set(entry.key, entry.value, { ttl: entry.ttl });
    }
  }

  async getStats(): Promise<CacheStats> {
    if (!this.config.enabled || !this.cache) {
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        avgTtl: 0,
        topKeys: []
      };
    }

    try {
      let totalKeys = 0;
      let memoryUsage = 0;

      if (this.cache instanceof LRU) {
        totalKeys = this.cache.size;
        memoryUsage = this.cache.calculatedSize || 0;
      } else {
        const nodeCache = this.cache as NodeCache;
        totalKeys = nodeCache.keys().length;
        
        // Estimate memory usage for NodeCache
        const keys = nodeCache.keys();
        for (const key of keys) {
          const value = nodeCache.get(key);
          if (value !== undefined) {
            memoryUsage += JSON.stringify(value).length + key.length;
          }
        }
      }

      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
      const missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;
      const evictionRate = this.stats.sets > 0 ? (this.stats.evictions / this.stats.sets) * 100 : 0;

      // Get top keys (mock implementation)
      const keys = await this.keys();
      const topKeys = keys.slice(0, 10).map(key => ({
        key,
        hits: Math.floor(Math.random() * 100), // Mock data
        size: key.length + 100, // Estimated size
        lastAccessed: new Date()
      }));

      return {
        totalKeys,
        memoryUsage,
        hitRate: Math.round(hitRate * 100) / 100,
        missRate: Math.round(missRate * 100) / 100,
        evictionRate: Math.round(evictionRate * 100) / 100,
        avgTtl: this.config.ttl,
        topKeys
      };
    } catch (error) {
      console.error('Application cache stats error:', error);
      return {
        totalKeys: 0,
        memoryUsage: 0,
        hitRate: 0,
        missRate: 0,
        evictionRate: 0,
        avgTtl: 0,
        topKeys: []
      };
    }
  }

  async getHealthCheck(): Promise<CacheHealthCheck> {
    if (!this.config.enabled) {
      return {
        level: 'application',
        healthy: false,
        latency: -1,
        errorRate: 0,
        memoryUsage: 0,
        lastCheck: new Date(),
        issues: ['Application cache disabled']
      };
    }

    try {
      const start = Date.now();
      
      // Test cache operations
      const testKey = `health-check-${Date.now()}`;
      const testValue = { test: true, timestamp: Date.now() };
      
      await this.set(testKey, testValue);
      const retrieved = await this.get(testKey);
      await this.delete(testKey);
      
      const latency = Date.now() - start;
      const stats = await this.getStats();
      
      const healthy = latency < 10 && retrieved !== null;
      const issues: string[] = [];
      
      if (latency > 10) {
        issues.push('High latency');
      }
      
      if (retrieved === null) {
        issues.push('Cache operation failed');
      }
      
      if (stats.memoryUsage > this.parseSize(this.config.maxSize) * 0.9) {
        issues.push('High memory usage');
      }
      
      if (stats.hitRate < 50) {
        issues.push('Low hit rate');
      }

      return {
        level: 'application',
        healthy,
        latency,
        errorRate: stats.missRate,
        memoryUsage: stats.memoryUsage,
        lastCheck: new Date(),
        issues
      };
    } catch (error) {
      return {
        level: 'application',
        healthy: false,
        latency: -1,
        errorRate: 100,
        memoryUsage: 0,
        lastCheck: new Date(),
        issues: ['Health check failed', error.message]
      };
    }
  }

  // Advanced cache operations
  async getOrSet<T>(key: string, factory: () => Promise<T>, options?: { ttl?: number }): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  async increment(key: string, delta: number = 1): Promise<number> {
    const current = await this.get<number>(key) || 0;
    const newValue = current + delta;
    await this.set(key, newValue);
    return newValue;
  }

  async decrement(key: string, delta: number = 1): Promise<number> {
    return this.increment(key, -delta);
  }

  async expire(key: string, ttl: number): Promise<void> {
    const value = await this.get(key);
    if (value !== null) {
      await this.set(key, value, { ttl });
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.config.enabled || !this.cache) {
      return -1;
    }

    try {
      if (this.cache instanceof LRU) {
        const remainingTTL = this.cache.getRemainingTTL(key);
        return remainingTTL > 0 ? Math.floor(remainingTTL / 1000) : -1;
      } else {
        const nodeCache = this.cache as NodeCache;
        const ttl = nodeCache.getTtl(key);
        return ttl ? Math.floor((ttl - Date.now()) / 1000) : -1;
      }
    } catch (error) {
      console.error('Application cache TTL error:', error);
      return -1;
    }
  }

  // Memory management
  async optimize(): Promise<void> {
    if (!this.config.enabled || !this.cache) {
      return;
    }

    try {
      const stats = await this.getStats();
      const maxSize = this.parseSize(this.config.maxSize);
      
      if (stats.memoryUsage > maxSize * 0.8) {
        console.log('🧹 Application cache: Starting optimization due to high memory usage');
        
        if (this.cache instanceof LRU) {
          // LRU automatically handles eviction
          console.log('LRU cache will automatically evict least recently used items');
        } else {
          // For NodeCache, we can implement custom eviction logic
          const keys = await this.keys();
          const keysToEvict = Math.floor(keys.length * 0.1); // Evict 10% of keys
          
          for (let i = 0; i < keysToEvict; i++) {
            await this.delete(keys[i]);
          }
          
          console.log(`🧹 Application cache: Evicted ${keysToEvict} keys`);
        }
      }
    } catch (error) {
      console.error('Application cache optimization error:', error);
    }
  }

  private parseSize(sizeStr: string): number {
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) {
      throw new Error(`Invalid size format: ${sizeStr}`);
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase() as keyof typeof units;
    
    return value * units[unit];
  }

  async disconnect(): Promise<void> {
    if (this.cache instanceof NodeCache) {
      (this.cache as NodeCache).close();
    }
    console.log('🔌 Application cache disconnected');
  }
}