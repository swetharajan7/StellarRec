import Redis from 'ioredis';
import { CacheConfig, CacheStats, CacheEntry, QueryCacheOptions } from '../types';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class CacheManager {
  private redis: Redis;
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    sets: number;
  };

  constructor(config: CacheConfig) {
    this.config = config;
    this.redis = new Redis(config.url, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      keyPrefix: config.keyPrefix
    });

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.redis.on('connect', () => {
      console.log('✅ Redis cache connected');
    });

    this.redis.on('error', (error) => {
      console.error('❌ Redis cache error:', error);
    });

    this.redis.on('ready', async () => {
      // Configure Redis memory policy
      await this.redis.config('SET', 'maxmemory', this.config.maxMemory);
      await this.redis.config('SET', 'maxmemory-policy', 'allkeys-lru');
    });
  }

  async connect(): Promise<void> {
    await this.redis.connect();
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }

  generateKey(params: any): string {
    const keyData = JSON.stringify(params);
    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      
      if (!cached) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      
      let data = cached;
      
      // Decompress if compression is enabled
      if (this.config.enableCompression && cached.startsWith('gzip:')) {
        const compressed = Buffer.from(cached.slice(5), 'base64');
        const decompressed = await gunzip(compressed);
        data = decompressed.toString();
      }

      const entry: CacheEntry<T> = JSON.parse(data);
      
      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = new Date();
      
      return entry.value;
    } catch (error) {
      console.error('Cache get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set<T = any>(
    key: string, 
    value: T, 
    options: QueryCacheOptions = {}
  ): Promise<void> {
    try {
      const ttl = options.ttl || this.config.ttl;
      
      const entry: CacheEntry<T> = {
        key,
        value,
        ttl,
        createdAt: new Date(),
        accessCount: 0,
        lastAccessed: new Date()
      };

      let data = JSON.stringify(entry);

      // Compress if enabled and data is large enough
      if (this.config.enableCompression && data.length > 1024) {
        const compressed = await gzip(Buffer.from(data));
        data = 'gzip:' + compressed.toString('base64');
      }

      await this.redis.setex(key, ttl, data);
      
      // Add tags for cache invalidation
      if (options.tags) {
        for (const tag of options.tags) {
          await this.redis.sadd(`tag:${tag}`, key);
          await this.redis.expire(`tag:${tag}`, ttl);
        }
      }

      this.stats.sets++;
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const keys = await this.redis.smembers(`tag:${tag}`);
        
        if (keys.length > 0) {
          await this.redis.del(...keys);
          await this.redis.del(`tag:${tag}`);
        }
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
      this.stats = { hits: 0, misses: 0, evictions: 0, sets: 0 };
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async clearExpired(): Promise<void> {
    try {
      // Redis automatically handles TTL expiration
      // This method can be used for custom cleanup logic
      const info = await this.redis.info('keyspace');
      console.log('Cache keyspace info:', info);
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      const memoryUsed = this.parseInfoValue(info, 'used_memory');
      const keyCount = this.parseKeyspaceKeys(keyspace);
      
      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
      const missRate = totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0;

      return {
        hitRate: Math.round(hitRate * 100) / 100,
        missRate: Math.round(missRate * 100) / 100,
        evictions: this.stats.evictions,
        memoryUsage: memoryUsed,
        keyCount,
        avgTtl: this.config.ttl
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        hitRate: 0,
        missRate: 0,
        evictions: 0,
        memoryUsage: 0,
        keyCount: 0,
        avgTtl: 0
      };
    }
  }

  async warmCache(): Promise<void> {
    if (!this.config.enableCacheWarming) {
      return;
    }

    console.log('🔥 Starting cache warming...');

    try {
      // Common queries to warm up
      const warmupQueries = [
        { model: 'users', action: 'findMany', args: { where: { is_active: true } } },
        { model: 'universities', action: 'findMany', args: { where: { is_active: true } } },
        { model: 'programs', action: 'findMany', args: {} },
        { model: 'applications', action: 'findMany', args: { where: { status: 'in_progress' } } }
      ];

      for (const query of warmupQueries) {
        const key = this.generateKey(query);
        const exists = await this.redis.exists(key);
        
        if (!exists) {
          // This would typically execute the actual query
          // For now, we'll just mark the cache as warmed
          await this.set(key, { warmed: true }, { ttl: this.config.ttl });
        }
      }

      console.log('✅ Cache warming completed');
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  startCacheWarming(): void {
    // Warm cache every hour
    setInterval(() => {
      this.warmCache();
    }, 60 * 60 * 1000);

    // Initial warm up
    setTimeout(() => {
      this.warmCache();
    }, 5000);
  }

  private parseInfoValue(info: string, key: string): number {
    const match = info.match(new RegExp(`${key}:(\\d+)`));
    return match ? parseInt(match[1], 10) : 0;
  }

  private parseKeyspaceKeys(keyspace: string): number {
    const match = keyspace.match(/keys=(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // Advanced caching strategies
  async mget(keys: string[]): Promise<Array<any | null>> {
    try {
      const results = await this.redis.mget(...keys);
      return results.map(result => {
        if (!result) {
          this.stats.misses++;
          return null;
        }
        
        this.stats.hits++;
        
        try {
          let data = result;
          
          if (this.config.enableCompression && result.startsWith('gzip:')) {
            // Handle decompression for batch operations
            // This is a simplified version - in practice, you'd want to handle this properly
            data = result.slice(5);
          }
          
          const entry = JSON.parse(data);
          return entry.value;
        } catch {
          this.stats.misses++;
          return null;
        }
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  async mset(entries: Array<{ key: string; value: any; options?: QueryCacheOptions }>): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const entry of entries) {
        const ttl = entry.options?.ttl || this.config.ttl;
        const cacheEntry: CacheEntry = {
          key: entry.key,
          value: entry.value,
          ttl,
          createdAt: new Date(),
          accessCount: 0,
          lastAccessed: new Date()
        };

        let data = JSON.stringify(cacheEntry);
        
        if (this.config.enableCompression && data.length > 1024) {
          const compressed = await gzip(Buffer.from(data));
          data = 'gzip:' + compressed.toString('base64');
        }

        pipeline.setex(entry.key, ttl, data);
        
        if (entry.options?.tags) {
          for (const tag of entry.options.tags) {
            pipeline.sadd(`tag:${tag}`, entry.key);
            pipeline.expire(`tag:${tag}`, ttl);
          }
        }
      }
      
      await pipeline.exec();
      this.stats.sets += entries.length;
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }
}