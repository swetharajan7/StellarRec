import * as cron from 'node-cron';
import { WarmingConfig, WarmingJob, WarmingStrategy } from '../types';

interface AdvancedCacheManager {
  set: (key: string, value: any, options?: any) => Promise<void>;
  get: (key: string) => Promise<any>;
  getMetrics: () => Promise<any>;
}

export class CacheWarmingEngine {
  private config: WarmingConfig;
  private cacheManager: AdvancedCacheManager;
  private jobs: Map<string, WarmingJob> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;
  private usagePatterns: Map<string, { hits: number; lastAccess: Date }> = new Map();

  constructor(config: WarmingConfig, cacheManager: AdvancedCacheManager) {
    this.config = config;
    this.cacheManager = cacheManager;
  }

  start(): void {
    if (!this.config.enabled || this.isRunning) {
      return;
    }

    console.log('🔥 Starting cache warming engine...');
    this.isRunning = true;

    // Start predictive warming if enabled
    if (this.config.predictive) {
      this.startPredictiveWarming();
    }

    // Start pattern-based warming
    if (this.config.patterns.length > 0) {
      this.startPatternWarming();
    }

    // Start scheduled warming if configured
    if (this.config.schedule) {
      this.startScheduledWarming();
    }

    console.log('✅ Cache warming engine started');
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('⏹️  Stopping cache warming engine...');
    this.isRunning = false;

    // Stop all scheduled tasks
    for (const [jobId, task] of this.scheduledTasks) {
      task.stop();
      console.log(`Stopped warming job: ${jobId}`);
    }

    this.scheduledTasks.clear();
    console.log('✅ Cache warming engine stopped');
  }

  private startPredictiveWarming(): void {
    // Run predictive warming every 5 minutes
    const task = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.runPredictiveWarming();
      } catch (error) {
        console.error('Predictive warming error:', error);
      }
    });

    this.scheduledTasks.set('predictive', task);
    console.log('🔮 Predictive warming scheduled');
  }

  private startPatternWarming(): void {
    // Run pattern warming every 10 minutes
    const task = cron.schedule('*/10 * * * *', async () => {
      try {
        await this.warmPatterns(this.config.patterns);
      } catch (error) {
        console.error('Pattern warming error:', error);
      }
    });

    this.scheduledTasks.set('patterns', task);
    console.log('🎯 Pattern warming scheduled');
  }

  private startScheduledWarming(): void {
    if (!this.config.schedule) return;

    const task = cron.schedule(this.config.schedule, async () => {
      try {
        await this.runScheduledJobs();
      } catch (error) {
        console.error('Scheduled warming error:', error);
      }
    });

    this.scheduledTasks.set('scheduled', task);
    console.log(`⏰ Scheduled warming configured: ${this.config.schedule}`);
  }

  async runPredictiveWarming(): Promise<void> {
    console.log('🔮 Running predictive cache warming...');

    try {
      // Get current cache metrics
      const metrics = await this.cacheManager.getMetrics();
      
      if (metrics.overall.hitRate < this.config.threshold * 100) {
        console.log(`Hit rate (${metrics.overall.hitRate}%) below threshold, starting predictive warming`);
        
        // Analyze usage patterns
        const predictions = await this.analyzeUsagePatterns();
        
        // Warm predicted keys
        for (const prediction of predictions) {
          await this.warmKey(prediction.key, prediction.query);
        }
        
        console.log(`🔥 Predictively warmed ${predictions.length} cache entries`);
      }
    } catch (error) {
      console.error('Predictive warming failed:', error);
    }
  }

  private async analyzeUsagePatterns(): Promise<Array<{ key: string; query: () => Promise<any> }>> {
    const predictions: Array<{ key: string; query: () => Promise<any> }> = [];
    
    // Analyze historical access patterns
    const now = new Date();
    const lookaheadTime = new Date(now.getTime() + this.config.lookahead * 1000);
    
    for (const [pattern, usage] of this.usagePatterns) {
      // Predict if this pattern will be accessed soon based on historical data
      const timeSinceLastAccess = now.getTime() - usage.lastAccess.getTime();
      const accessFrequency = usage.hits / Math.max(1, timeSinceLastAccess / (1000 * 60 * 60)); // hits per hour
      
      if (accessFrequency > 0.1) { // If accessed more than once per 10 hours
        predictions.push({
          key: pattern,
          query: () => this.generateQueryForPattern(pattern)
        });
      }
    }
    
    return predictions.slice(0, 50); // Limit to top 50 predictions
  }

  private async generateQueryForPattern(pattern: string): Promise<any> {
    // Mock query generation based on pattern
    // In a real implementation, this would generate appropriate database queries
    
    if (pattern.includes('user:')) {
      return { type: 'user', data: { id: pattern.split(':')[1], active: true } };
    } else if (pattern.includes('university:')) {
      return { type: 'university', data: { id: pattern.split(':')[1], active: true } };
    } else if (pattern.includes('application:')) {
      return { type: 'application', data: { id: pattern.split(':')[1], status: 'active' } };
    }
    
    return { type: 'generic', pattern, timestamp: new Date() };
  }

  async warmPatterns(patterns: string[]): Promise<void> {
    console.log(`🎯 Warming ${patterns.length} cache patterns...`);

    const warmingPromises = patterns.map(async (pattern) => {
      try {
        await this.warmPattern(pattern);
        return { pattern, success: true };
      } catch (error) {
        console.error(`Failed to warm pattern ${pattern}:`, error);
        return { pattern, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(warmingPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`🔥 Pattern warming completed: ${successful}/${patterns.length} successful`);
  }

  private async warmPattern(pattern: string): Promise<void> {
    // Generate keys based on pattern
    const keys = await this.expandPattern(pattern);
    
    for (const key of keys) {
      const query = () => this.generateQueryForPattern(key);
      await this.warmKey(key, query);
    }
  }

  private async expandPattern(pattern: string): Promise<string[]> {
    // Expand wildcard patterns into actual keys
    const keys: string[] = [];
    
    if (pattern.includes('*')) {
      // Mock pattern expansion
      // In a real implementation, this would query the database or cache to find matching keys
      
      if (pattern === 'user:*') {
        // Generate some user keys
        for (let i = 1; i <= 10; i++) {
          keys.push(`user:${i}`);
        }
      } else if (pattern === 'university:*') {
        // Generate some university keys
        for (let i = 1; i <= 20; i++) {
          keys.push(`university:${i}`);
        }
      } else if (pattern === 'application:*') {
        // Generate some application keys
        for (let i = 1; i <= 50; i++) {
          keys.push(`application:${i}`);
        }
      }
    } else {
      keys.push(pattern);
    }
    
    return keys;
  }

  private async warmKey(key: string, query: () => Promise<any>): Promise<void> {
    try {
      // Check if key is already cached
      const cached = await this.cacheManager.get(key);
      
      if (cached === null) {
        // Key not in cache, warm it
        const data = await query();
        await this.cacheManager.set(key, data, { ttl: 300 }); // 5 minute TTL for warmed data
        
        console.log(`🔥 Warmed cache key: ${key}`);
      }
    } catch (error) {
      console.error(`Failed to warm key ${key}:`, error);
    }
  }

  async scheduleJobs(jobs: Array<{
    pattern: string;
    schedule: string;
    query: () => Promise<any>;
  }>): Promise<void> {
    for (const jobConfig of jobs) {
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const job: WarmingJob = {
        id: jobId,
        pattern: jobConfig.pattern,
        schedule: jobConfig.schedule,
        query: jobConfig.query,
        nextRun: this.calculateNextRun(jobConfig.schedule),
        status: 'pending'
      };

      this.jobs.set(jobId, job);

      // Schedule the job
      const task = cron.schedule(jobConfig.schedule, async () => {
        await this.runJob(jobId);
      });

      this.scheduledTasks.set(jobId, task);
      
      console.log(`📅 Scheduled warming job: ${jobId} (${jobConfig.schedule})`);
    }
  }

  private async runJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.error(`Job not found: ${jobId}`);
      return;
    }

    console.log(`🏃 Running warming job: ${jobId}`);
    
    job.status = 'running';
    job.lastRun = new Date();
    
    const startTime = Date.now();
    
    try {
      const data = await job.query();
      await this.cacheManager.set(job.pattern, data, { ttl: 600 }); // 10 minute TTL
      
      job.status = 'completed';
      job.duration = Date.now() - startTime;
      job.nextRun = this.calculateNextRun(job.schedule);
      
      console.log(`✅ Warming job completed: ${jobId} (${job.duration}ms)`);
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.duration = Date.now() - startTime;
      
      console.error(`❌ Warming job failed: ${jobId}`, error);
    }
  }

  private async runScheduledJobs(): Promise<void> {
    console.log('⏰ Running scheduled warming jobs...');
    
    const jobPromises = Array.from(this.jobs.keys()).map(jobId => this.runJob(jobId));
    await Promise.allSettled(jobPromises);
    
    console.log('✅ Scheduled warming jobs completed');
  }

  private calculateNextRun(schedule: string): Date {
    // Simple next run calculation - in a real implementation, use a proper cron parser
    const now = new Date();
    
    if (schedule === '*/5 * * * *') {
      return new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
    } else if (schedule === '0 */6 * * *') {
      return new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours
    } else if (schedule === '0 2 * * *') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0);
      return tomorrow;
    }
    
    // Default: 1 hour from now
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  // Public methods for manual warming
  async warmSpecificKeys(keys: string[], queries: Array<() => Promise<any>>): Promise<void> {
    console.log(`🔥 Manually warming ${keys.length} specific keys...`);
    
    const warmingPromises = keys.map(async (key, index) => {
      try {
        const query = queries[index] || (() => Promise.resolve({ key, warmed: true }));
        await this.warmKey(key, query);
        return { key, success: true };
      } catch (error) {
        console.error(`Failed to warm key ${key}:`, error);
        return { key, success: false, error: error.message };
      }
    });

    const results = await Promise.allSettled(warmingPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    console.log(`🔥 Manual warming completed: ${successful}/${keys.length} successful`);
  }

  async warmByStrategy(strategy: WarmingStrategy): Promise<void> {
    console.log(`🎯 Warming cache using ${strategy.type} strategy...`);
    
    switch (strategy.type) {
      case 'scheduled':
        if (strategy.config.schedule) {
          await this.scheduleJobs([{
            pattern: 'strategy-based',
            schedule: strategy.config.schedule,
            query: () => Promise.resolve({ strategy: strategy.type, timestamp: new Date() })
          }]);
        }
        break;
        
      case 'predictive':
        if (strategy.config.threshold) {
          this.config.threshold = strategy.config.threshold;
          await this.runPredictiveWarming();
        }
        break;
        
      case 'reactive':
        if (strategy.config.patterns) {
          await this.warmPatterns(strategy.config.patterns);
        }
        break;
    }
  }

  // Analytics and monitoring
  getJobStatus(): Array<{ id: string; status: string; lastRun?: Date; nextRun: Date; duration?: number }> {
    return Array.from(this.jobs.values()).map(job => ({
      id: job.id,
      status: job.status,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      duration: job.duration
    }));
  }

  getWarmingStats(): {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    avgDuration: number;
  } {
    const jobs = Array.from(this.jobs.values());
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const failedJobs = jobs.filter(j => j.status === 'failed');
    const activeJobs = jobs.filter(j => j.status === 'running');
    
    const avgDuration = completedJobs.length > 0
      ? completedJobs.reduce((sum, job) => sum + (job.duration || 0), 0) / completedJobs.length
      : 0;

    return {
      totalJobs: jobs.length,
      activeJobs: activeJobs.length,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      avgDuration: Math.round(avgDuration)
    };
  }

  // Usage pattern tracking
  recordAccess(key: string): void {
    const existing = this.usagePatterns.get(key) || { hits: 0, lastAccess: new Date() };
    existing.hits++;
    existing.lastAccess = new Date();
    this.usagePatterns.set(key, existing);
    
    // Keep only recent patterns
    if (this.usagePatterns.size > 10000) {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      for (const [pattern, usage] of this.usagePatterns) {
        if (usage.lastAccess < cutoff) {
          this.usagePatterns.delete(pattern);
        }
      }
    }
  }

  getUsagePatterns(): Array<{ pattern: string; hits: number; lastAccess: Date }> {
    return Array.from(this.usagePatterns.entries()).map(([pattern, usage]) => ({
      pattern,
      hits: usage.hits,
      lastAccess: usage.lastAccess
    })).sort((a, b) => b.hits - a.hits);
  }
}