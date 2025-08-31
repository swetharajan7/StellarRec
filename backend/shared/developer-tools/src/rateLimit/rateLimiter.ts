import { RateLimitConfig, RateLimitResult, RateLimitRule } from '../types';

export class RateLimiter {
  private requestCounts: Map<string, Map<number, number>> = new Map();
  private rules: Map<string, RateLimitRule> = new Map();

  constructor(private config: RateLimitConfig) {
    this.setupDefaultRules();
    this.startCleanupInterval();
  }

  private setupDefaultRules(): void {
    // Default rate limit rules
    this.addRule({
      id: 'default',
      name: 'Default Rate Limit',
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      keyGenerator: (req) => req.apiKey || req.ip,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });

    this.addRule({
      id: 'premium',
      name: 'Premium Rate Limit',
      windowMs: 60000, // 1 minute
      maxRequests: 1000,
      keyGenerator: (req) => req.apiKey || req.ip,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });
  }

  addRule(rule: RateLimitRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  async checkRateLimit(request: any, ruleId: string = 'default'): Promise<RateLimitResult> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rate limit rule '${ruleId}' not found`);
    }

    const key = rule.keyGenerator(request);
    const windowStart = this.getWindowStart(rule.windowMs);
    
    // Get or create request count map for this key
    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, new Map());
    }
    
    const keyMap = this.requestCounts.get(key)!;
    const currentCount = keyMap.get(windowStart) || 0;

    // Check if request should be skipped based on rule configuration
    const shouldSkip = this.shouldSkipRequest(request, rule);
    
    if (shouldSkip) {
      return {
        allowed: true,
        limit: rule.maxRequests,
        remaining: rule.maxRequests - currentCount,
        resetTime: new Date(windowStart + rule.windowMs),
        retryAfter: null,
      };
    }

    // Check if limit is exceeded
    if (currentCount >= rule.maxRequests) {
      const resetTime = new Date(windowStart + rule.windowMs);
      const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

      return {
        allowed: false,
        limit: rule.maxRequests,
        remaining: 0,
        resetTime,
        retryAfter,
      };
    }

    // Increment counter
    keyMap.set(windowStart, currentCount + 1);

    return {
      allowed: true,
      limit: rule.maxRequests,
      remaining: rule.maxRequests - (currentCount + 1),
      resetTime: new Date(windowStart + rule.windowMs),
      retryAfter: null,
    };
  }

  private shouldSkipRequest(request: any, rule: RateLimitRule): boolean {
    if (rule.skipSuccessfulRequests && request.statusCode >= 200 && request.statusCode < 300) {
      return true;
    }
    
    if (rule.skipFailedRequests && request.statusCode >= 400) {
      return true;
    }

    return false;
  }

  private getWindowStart(windowMs: number): number {
    return Math.floor(Date.now() / windowMs) * windowMs;
  }

  private startCleanupInterval(): void {
    // Clean up old entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, windowMap] of this.requestCounts.entries()) {
      // Remove windows older than 1 hour
      const cutoff = now - (60 * 60 * 1000);
      
      for (const [windowStart] of windowMap.entries()) {
        if (windowStart < cutoff) {
          windowMap.delete(windowStart);
        }
      }
      
      // Remove empty maps
      if (windowMap.size === 0) {
        this.requestCounts.delete(key);
      }
    }
  }

  getRateLimitStatus(key: string, ruleId: string = 'default'): RateLimitResult | null {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return null;
    }

    const windowStart = this.getWindowStart(rule.windowMs);
    const keyMap = this.requestCounts.get(key);
    const currentCount = keyMap?.get(windowStart) || 0;

    return {
      allowed: currentCount < rule.maxRequests,
      limit: rule.maxRequests,
      remaining: Math.max(0, rule.maxRequests - currentCount),
      resetTime: new Date(windowStart + rule.windowMs),
      retryAfter: currentCount >= rule.maxRequests ? 
        Math.ceil((windowStart + rule.windowMs - Date.now()) / 1000) : null,
    };
  }

  resetRateLimit(key: string): void {
    this.requestCounts.delete(key);
  }

  getStats(): any {
    const stats = {
      totalKeys: this.requestCounts.size,
      totalRules: this.rules.size,
      activeWindows: 0,
      totalRequests: 0,
    };

    for (const windowMap of this.requestCounts.values()) {
      stats.activeWindows += windowMap.size;
      for (const count of windowMap.values()) {
        stats.totalRequests += count;
      }
    }

    return stats;
  }
}