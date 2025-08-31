import { InvalidationConfig, InvalidationEvent } from '../types';

interface AdvancedCacheManager {
  delete: (key: string) => Promise<void>;
  redis: any;
  appCacheManager: any;
  cdnManager: any;
}

export class CacheInvalidationManager {
  private config: InvalidationConfig;
  private cacheManager: AdvancedCacheManager;
  private tagMappings: Map<string, Set<string>> = new Map(); // tag -> keys
  private keyTags: Map<string, Set<string>> = new Map(); // key -> tags
  private invalidationQueue: InvalidationEvent[] = [];
  private isProcessing = false;

  constructor(config: InvalidationConfig, cacheManager: AdvancedCacheManager) {
    this.config = config;
    this.cacheManager = cacheManager;

    if (config.enabled) {
      this.startInvalidationProcessor();
    }
  }

  private startInvalidationProcessor(): void {
    // Process invalidation queue every 5 seconds
    setInterval(async () => {
      if (!this.isProcessing && this.invalidationQueue.length > 0) {
        await this.processInvalidationQueue();
      }
    }, 5000);

    console.log('🗑️  Cache invalidation processor started');
  }

  async addTags(key: string, tags: string[]): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    // Add key to tag mappings
    for (const tag of tags) {
      if (!this.tagMappings.has(tag)) {
        this.tagMappings.set(tag, new Set());
      }
      this.tagMappings.get(tag)!.add(key);
    }

    // Add tags to key mapping
    if (!this.keyTags.has(key)) {
      this.keyTags.set(key, new Set());
    }
    for (const tag of tags) {
      this.keyTags.get(key)!.add(tag);
    }

    console.log(`🏷️  Added tags [${tags.join(', ')}] to key: ${key}`);
  }

  async removeTags(key: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const tags = this.keyTags.get(key);
    if (tags) {
      // Remove key from tag mappings
      for (const tag of tags) {
        const keys = this.tagMappings.get(tag);
        if (keys) {
          keys.delete(key);
          if (keys.size === 0) {
            this.tagMappings.delete(tag);
          }
        }
      }

      // Remove key from key mappings
      this.keyTags.delete(key);
      
      console.log(`🗑️  Removed tags for key: ${key}`);
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    console.log(`🗑️  Invalidating cache by tags: [${tags.join(', ')}]`);

    const keysToInvalidate = new Set<string>();

    // Collect all keys associated with the tags
    for (const tag of tags) {
      const keys = this.tagMappings.get(tag);
      if (keys) {
        for (const key of keys) {
          keysToInvalidate.add(key);
        }
      }
    }

    // Invalidate collected keys
    const invalidationPromises = Array.from(keysToInvalidate).map(key => 
      this.invalidateKey(key)
    );

    await Promise.allSettled(invalidationPromises);

    // Handle cascade invalidation
    if (this.config.cascadeDepth > 0) {
      await this.handleCascadeInvalidation(Array.from(keysToInvalidate), 1);
    }

    console.log(`🗑️  Invalidated ${keysToInvalidate.size} keys for tags: [${tags.join(', ')}]`);
  }

  private async invalidateKey(key: string): Promise<void> {
    try {
      await this.cacheManager.delete(key);
      await this.removeTags(key);
    } catch (error) {
      console.error(`Failed to invalidate key ${key}:`, error);
    }
  }

  private async handleCascadeInvalidation(invalidatedKeys: string[], depth: number): Promise<void> {
    if (depth >= this.config.cascadeDepth) {
      return;
    }

    const cascadeKeys = new Set<string>();

    // Find keys that should be invalidated due to cascade rules
    for (const key of invalidatedKeys) {
      const relatedKeys = await this.findRelatedKeys(key);
      for (const relatedKey of relatedKeys) {
        cascadeKeys.add(relatedKey);
      }
    }

    if (cascadeKeys.size > 0) {
      console.log(`🔄 Cascade invalidation (depth ${depth}): ${cascadeKeys.size} keys`);
      
      const cascadePromises = Array.from(cascadeKeys).map(key => this.invalidateKey(key));
      await Promise.allSettled(cascadePromises);

      // Continue cascade if needed
      await this.handleCascadeInvalidation(Array.from(cascadeKeys), depth + 1);
    }
  }

  private async findRelatedKeys(key: string): Promise<string[]> {
    const relatedKeys: string[] = [];

    // Define cascade rules based on key patterns
    if (key.startsWith('user:')) {
      const userId = key.split(':')[1];
      relatedKeys.push(
        `user:${userId}:profile`,
        `user:${userId}:applications`,
        `user:${userId}:preferences`,
        `applications:student:${userId}`,
        `matches:student:${userId}`
      );
    } else if (key.startsWith('university:')) {
      const universityId = key.split(':')[1];
      relatedKeys.push(
        `university:${universityId}:programs`,
        `university:${universityId}:stats`,
        `programs:university:${universityId}`,
        `matches:university:${universityId}`
      );
    } else if (key.startsWith('application:')) {
      const applicationId = key.split(':')[1];
      relatedKeys.push(
        `application:${applicationId}:timeline`,
        `application:${applicationId}:components`,
        `application:${applicationId}:letters`
      );
    }

    return relatedKeys;
  }

  async invalidateByEvent(event: InvalidationEvent): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    console.log(`📢 Processing invalidation event: ${event.type} ${event.entity}:${event.entityId}`);

    // Add to queue for batch processing
    this.invalidationQueue.push(event);

    // Process immediately if queue is getting large
    if (this.invalidationQueue.length >= this.config.batchSize) {
      await this.processInvalidationQueue();
    }
  }

  private async processInvalidationQueue(): Promise<void> {
    if (this.isProcessing || this.invalidationQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Processing ${this.invalidationQueue.length} invalidation events...`);

    try {
      // Group events by type for efficient processing
      const eventGroups = this.groupEventsByType(this.invalidationQueue);
      
      for (const [eventType, events] of eventGroups) {
        await this.processEventGroup(eventType, events);
      }

      // Clear processed events
      this.invalidationQueue = [];
      
      console.log('✅ Invalidation queue processed');
    } catch (error) {
      console.error('Invalidation queue processing failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private groupEventsByType(events: InvalidationEvent[]): Map<string, InvalidationEvent[]> {
    const groups = new Map<string, InvalidationEvent[]>();

    for (const event of events) {
      const key = `${event.entity}:${event.type}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(event);
    }

    return groups;
  }

  private async processEventGroup(eventType: string, events: InvalidationEvent[]): Promise<void> {
    const [entity, operation] = eventType.split(':');
    
    console.log(`Processing ${events.length} ${operation} events for ${entity}`);

    switch (entity) {
      case 'user':
        await this.processUserEvents(events);
        break;
      case 'university':
        await this.processUniversityEvents(events);
        break;
      case 'application':
        await this.processApplicationEvents(events);
        break;
      case 'letter':
        await this.processLetterEvents(events);
        break;
      default:
        await this.processGenericEvents(events);
    }
  }

  private async processUserEvents(events: InvalidationEvent[]): Promise<void> {
    const userIds = events.map(e => e.entityId);
    const tagsToInvalidate = [
      'users',
      'user-profiles',
      'user-preferences',
      ...userIds.map(id => `user:${id}`)
    ];

    await this.invalidateByTags(tagsToInvalidate);
  }

  private async processUniversityEvents(events: InvalidationEvent[]): Promise<void> {
    const universityIds = events.map(e => e.entityId);
    const tagsToInvalidate = [
      'universities',
      'university-programs',
      'university-stats',
      ...universityIds.map(id => `university:${id}`)
    ];

    await this.invalidateByTags(tagsToInvalidate);
  }

  private async processApplicationEvents(events: InvalidationEvent[]): Promise<void> {
    const applicationIds = events.map(e => e.entityId);
    const tagsToInvalidate = [
      'applications',
      'application-timeline',
      'application-components',
      ...applicationIds.map(id => `application:${id}`)
    ];

    await this.invalidateByTags(tagsToInvalidate);
  }

  private async processLetterEvents(events: InvalidationEvent[]): Promise<void> {
    const letterIds = events.map(e => e.entityId);
    const tagsToInvalidate = [
      'letters',
      'letter-collaborators',
      'letter-deliveries',
      ...letterIds.map(id => `letter:${id}`)
    ];

    await this.invalidateByTags(tagsToInvalidate);
  }

  private async processGenericEvents(events: InvalidationEvent[]): Promise<void> {
    // Process events that don't have specific handlers
    for (const event of events) {
      await this.invalidateByTags(event.tags);
    }
  }

  // Time-based invalidation
  async scheduleInvalidation(key: string, delay: number): Promise<void> {
    setTimeout(async () => {
      try {
        await this.invalidateKey(key);
        console.log(`⏰ Scheduled invalidation completed for key: ${key}`);
      } catch (error) {
        console.error(`Scheduled invalidation failed for key ${key}:`, error);
      }
    }, delay);

    console.log(`⏰ Scheduled invalidation for key ${key} in ${delay}ms`);
  }

  // Pattern-based invalidation
  async invalidateByPattern(pattern: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    console.log(`🎯 Invalidating cache by pattern: ${pattern}`);

    const keysToInvalidate: string[] = [];

    // Find keys matching the pattern
    for (const key of this.keyTags.keys()) {
      if (this.matchesPattern(key, pattern)) {
        keysToInvalidate.push(key);
      }
    }

    // Invalidate matching keys
    const invalidationPromises = keysToInvalidate.map(key => this.invalidateKey(key));
    await Promise.allSettled(invalidationPromises);

    console.log(`🎯 Invalidated ${keysToInvalidate.length} keys matching pattern: ${pattern}`);
  }

  private matchesPattern(key: string, pattern: string): boolean {
    // Simple pattern matching with wildcards
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(key);
  }

  // Bulk invalidation operations
  async invalidateAll(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    console.log('🧹 Invalidating all cache entries...');

    try {
      // Clear all cache levels
      await Promise.allSettled([
        this.cacheManager.redis.flushdb(),
        this.cacheManager.appCacheManager.clear(),
        this.cacheManager.cdnManager.purge({ everything: true })
      ]);

      // Clear tag mappings
      this.tagMappings.clear();
      this.keyTags.clear();

      console.log('✅ All cache entries invalidated');
    } catch (error) {
      console.error('Failed to invalidate all cache entries:', error);
      throw error;
    }
  }

  async invalidateByPrefix(prefix: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    console.log(`🔍 Invalidating cache entries with prefix: ${prefix}`);

    const keysToInvalidate = Array.from(this.keyTags.keys()).filter(key => 
      key.startsWith(prefix)
    );

    const invalidationPromises = keysToInvalidate.map(key => this.invalidateKey(key));
    await Promise.allSettled(invalidationPromises);

    console.log(`🔍 Invalidated ${keysToInvalidate.length} keys with prefix: ${prefix}`);
  }

  // Analytics and monitoring
  getInvalidationStats(): {
    totalTags: number;
    totalKeys: number;
    queueSize: number;
    avgKeysPerTag: number;
    topTags: Array<{ tag: string; keyCount: number }>;
  } {
    const totalTags = this.tagMappings.size;
    const totalKeys = this.keyTags.size;
    const queueSize = this.invalidationQueue.length;
    
    const avgKeysPerTag = totalTags > 0 
      ? Array.from(this.tagMappings.values()).reduce((sum, keys) => sum + keys.size, 0) / totalTags
      : 0;

    const topTags = Array.from(this.tagMappings.entries())
      .map(([tag, keys]) => ({ tag, keyCount: keys.size }))
      .sort((a, b) => b.keyCount - a.keyCount)
      .slice(0, 10);

    return {
      totalTags,
      totalKeys,
      queueSize,
      avgKeysPerTag: Math.round(avgKeysPerTag * 100) / 100,
      topTags
    };
  }

  getTagMappings(): Array<{ tag: string; keys: string[] }> {
    return Array.from(this.tagMappings.entries()).map(([tag, keys]) => ({
      tag,
      keys: Array.from(keys)
    }));
  }

  getKeyTags(): Array<{ key: string; tags: string[] }> {
    return Array.from(this.keyTags.entries()).map(([key, tags]) => ({
      key,
      tags: Array.from(tags)
    }));
  }

  // Event-driven invalidation helpers
  onUserUpdate(userId: string): void {
    this.invalidateByEvent({
      type: 'update',
      entity: 'user',
      entityId: userId,
      tags: [`user:${userId}`, 'users', 'user-profiles'],
      timestamp: new Date()
    });
  }

  onUniversityUpdate(universityId: string): void {
    this.invalidateByEvent({
      type: 'update',
      entity: 'university',
      entityId: universityId,
      tags: [`university:${universityId}`, 'universities', 'university-programs'],
      timestamp: new Date()
    });
  }

  onApplicationUpdate(applicationId: string, studentId: string): void {
    this.invalidateByEvent({
      type: 'update',
      entity: 'application',
      entityId: applicationId,
      tags: [
        `application:${applicationId}`,
        `applications:student:${studentId}`,
        'applications'
      ],
      timestamp: new Date()
    });
  }

  onLetterUpdate(letterId: string, studentId: string, recommenderId: string): void {
    this.invalidateByEvent({
      type: 'update',
      entity: 'letter',
      entityId: letterId,
      tags: [
        `letter:${letterId}`,
        `letters:student:${studentId}`,
        `letters:recommender:${recommenderId}`,
        'letters'
      ],
      timestamp: new Date()
    });
  }
}