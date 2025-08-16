import { Logger } from '../logger';
import { DatabaseService } from '../database';

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
  burstLimit: number;
}

export class RateLimiter {
  private logger = new Logger('RateLimiter');
  private db: DatabaseService;
  private memoryCache = new Map<string, { count: number; resetTime: number }>();

  constructor() {
    this.db = new DatabaseService();
    this.startCleanupTimer();
  }

  /**
   * Check if request is within rate limits
   */
  async checkRateLimit(integrationType: string, universityId?: string): Promise<void> {
    try {
      // Get rate limit configuration
      const config = await this.getRateLimitConfig(integrationType, universityId);
      
      // Check all time windows
      await Promise.all([
        this.checkTimeWindow(integrationType, universityId, 'minute', config.requestsPerMinute),
        this.checkTimeWindow(integrationType, universityId, 'hour', config.requestsPerHour),
        this.checkTimeWindow(integrationType, universityId, 'day', config.requestsPerDay)
      ]);

      // Check burst limit using memory cache
      await this.checkBurstLimit(integrationType, universityId, config.burstLimit);

      // Record the request
      await this.recordRequest(integrationType, universityId);

    } catch (error) {
      this.logger.error(`Rate limit check failed for ${integrationType}:`, error);
      throw error;
    }
  }

  /**
   * Get rate limit configuration for integration type
   */
  private async getRateLimitConfig(integrationType: string, universityId?: string): Promise<RateLimitConfig> {
    try {
      let query: string;
      let params: any[];

      if (universityId) {
        // Get university-specific configuration
        query = `
          SELECT rate_limit_config 
          FROM university_integrations 
          WHERE integration_type = $1 AND university_id = $2
        `;
        params = [integrationType, universityId];
      } else {
        // Get default configuration for integration type
        query = `
          SELECT rate_limit_config 
          FROM university_integrations 
          WHERE integration_type = $1 
          LIMIT 1
        `;
        params = [integrationType];
      }

      const result = await this.db.query(query, params);
      
      if (result.rows.length > 0) {
        return result.rows[0].rate_limit_config;
      }

      // Default fallback configuration
      return {
        requestsPerMinute: 10,
        requestsPerHour: 100,
        requestsPerDay: 1000,
        burstLimit: 5
      };
    } catch (error) {
      this.logger.error('Failed to get rate limit config:', error);
      // Return conservative defaults
      return {
        requestsPerMinute: 5,
        requestsPerHour: 50,
        requestsPerDay: 200,
        burstLimit: 2
      };
    }
  }

  /**
   * Check rate limit for specific time window
   */
  private async checkTimeWindow(
    integrationType: string, 
    universityId: string | undefined, 
    timeWindow: 'minute' | 'hour' | 'day', 
    limit: number
  ): Promise<void> {
    try {
      const windowStart = this.getWindowStart(timeWindow);
      
      // Get or create rate limit record
      const query = `
        INSERT INTO rate_limit_tracking (
          integration_type, university_id, time_window, window_start, request_count
        ) VALUES ($1, $2, $3, $4, 0)
        ON CONFLICT (integration_type, university_id, time_window, window_start)
        DO UPDATE SET request_count = rate_limit_tracking.request_count
        RETURNING request_count
      `;

      const result = await this.db.query(query, [
        integrationType,
        universityId || null,
        timeWindow,
        windowStart
      ]);

      const currentCount = result.rows[0].request_count;

      if (currentCount >= limit) {
        const resetTime = this.getNextWindowStart(timeWindow);
        throw new RateLimitError(
          `Rate limit exceeded for ${integrationType}. Limit: ${limit}/${timeWindow}. Reset at: ${resetTime}`,
          timeWindow,
          limit,
          currentCount,
          resetTime
        );
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      this.logger.error(`Failed to check ${timeWindow} rate limit:`, error);
      throw error;
    }
  }

  /**
   * Check burst limit using memory cache for fast response
   */
  private async checkBurstLimit(
    integrationType: string, 
    universityId: string | undefined, 
    burstLimit: number
  ): Promise<void> {
    const key = `${integrationType}:${universityId || 'global'}`;
    const now = Date.now();
    const windowMs = 10000; // 10 second burst window

    const cached = this.memoryCache.get(key);
    
    if (cached) {
      if (now < cached.resetTime) {
        if (cached.count >= burstLimit) {
          throw new RateLimitError(
            `Burst limit exceeded for ${integrationType}. Limit: ${burstLimit}/10s`,
            'burst',
            burstLimit,
            cached.count,
            new Date(cached.resetTime)
          );
        }
        cached.count++;
      } else {
        // Reset window
        this.memoryCache.set(key, { count: 1, resetTime: now + windowMs });
      }
    } else {
      // First request in window
      this.memoryCache.set(key, { count: 1, resetTime: now + windowMs });
    }
  }

  /**
   * Record a successful request
   */
  private async recordRequest(integrationType: string, universityId?: string): Promise<void> {
    try {
      const timeWindows = ['minute', 'hour', 'day'];
      
      for (const timeWindow of timeWindows) {
        const windowStart = this.getWindowStart(timeWindow as 'minute' | 'hour' | 'day');
        
        const query = `
          INSERT INTO rate_limit_tracking (
            integration_type, university_id, time_window, window_start, request_count
          ) VALUES ($1, $2, $3, $4, 1)
          ON CONFLICT (integration_type, university_id, time_window, window_start)
          DO UPDATE SET 
            request_count = rate_limit_tracking.request_count + 1,
            updated_at = CURRENT_TIMESTAMP
        `;

        await this.db.query(query, [
          integrationType,
          universityId || null,
          timeWindow,
          windowStart
        ]);
      }
    } catch (error) {
      this.logger.error('Failed to record request:', error);
      // Don't throw here as the request was already allowed
    }
  }

  /**
   * Get current usage for an integration
   */
  async getCurrentUsage(integrationType: string, universityId?: string): Promise<{
    minute: { current: number; limit: number; resetTime: Date };
    hour: { current: number; limit: number; resetTime: Date };
    day: { current: number; limit: number; resetTime: Date };
  }> {
    try {
      const config = await this.getRateLimitConfig(integrationType, universityId);
      
      const usage = {
        minute: { 
          current: 0, 
          limit: config.requestsPerMinute, 
          resetTime: this.getNextWindowStart('minute') 
        },
        hour: { 
          current: 0, 
          limit: config.requestsPerHour, 
          resetTime: this.getNextWindowStart('hour') 
        },
        day: { 
          current: 0, 
          limit: config.requestsPerDay, 
          resetTime: this.getNextWindowStart('day') 
        }
      };

      // Get current usage for each time window
      for (const timeWindow of ['minute', 'hour', 'day'] as const) {
        const windowStart = this.getWindowStart(timeWindow);
        
        const query = `
          SELECT request_count 
          FROM rate_limit_tracking 
          WHERE integration_type = $1 
            AND (university_id = $2 OR ($2 IS NULL AND university_id IS NULL))
            AND time_window = $3 
            AND window_start = $4
        `;

        const result = await this.db.query(query, [
          integrationType,
          universityId || null,
          timeWindow,
          windowStart
        ]);

        if (result.rows.length > 0) {
          usage[timeWindow].current = result.rows[0].request_count;
        }
      }

      return usage;
    } catch (error) {
      this.logger.error('Failed to get current usage:', error);
      throw error;
    }
  }

  /**
   * Get rate limit statistics
   */
  async getRateLimitStatistics(integrationType?: string): Promise<{
    totalRequests: number;
    requestsByHour: Array<{ hour: string; requests: number }>;
    topUniversities: Array<{ universityId: string; requests: number }>;
    rateLimitHits: number;
  }> {
    try {
      let whereClause = '1=1';
      let params: any[] = [];

      if (integrationType) {
        whereClause = 'integration_type = $1';
        params = [integrationType];
      }

      // Total requests in last 24 hours
      const totalQuery = `
        SELECT SUM(request_count) as total
        FROM rate_limit_tracking 
        WHERE ${whereClause}
          AND time_window = 'hour'
          AND window_start >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `;

      // Requests by hour
      const hourlyQuery = `
        SELECT 
          window_start as hour,
          SUM(request_count) as requests
        FROM rate_limit_tracking 
        WHERE ${whereClause}
          AND time_window = 'hour'
          AND window_start >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY window_start
        ORDER BY window_start DESC
      `;

      // Top universities by request count
      const topUniversitiesQuery = `
        SELECT 
          university_id,
          SUM(request_count) as requests
        FROM rate_limit_tracking 
        WHERE ${whereClause}
          AND university_id IS NOT NULL
          AND time_window = 'day'
          AND window_start >= CURRENT_DATE
        GROUP BY university_id
        ORDER BY requests DESC
        LIMIT 10
      `;

      const [totalResult, hourlyResult, topUniversitiesResult] = await Promise.all([
        this.db.query(totalQuery, params),
        this.db.query(hourlyQuery, params),
        this.db.query(topUniversitiesQuery, params)
      ]);

      return {
        totalRequests: parseInt(totalResult.rows[0]?.total || '0'),
        requestsByHour: hourlyResult.rows.map(row => ({
          hour: row.hour.toISOString(),
          requests: parseInt(row.requests)
        })),
        topUniversities: topUniversitiesResult.rows.map(row => ({
          universityId: row.university_id,
          requests: parseInt(row.requests)
        })),
        rateLimitHits: 0 // Would need separate tracking for this
      };
    } catch (error) {
      this.logger.error('Failed to get rate limit statistics:', error);
      throw error;
    }
  }

  /**
   * Reset rate limits for an integration (admin function)
   */
  async resetRateLimits(integrationType: string, universityId?: string): Promise<void> {
    try {
      let query: string;
      let params: any[];

      if (universityId) {
        query = `
          DELETE FROM rate_limit_tracking 
          WHERE integration_type = $1 AND university_id = $2
        `;
        params = [integrationType, universityId];
      } else {
        query = `
          DELETE FROM rate_limit_tracking 
          WHERE integration_type = $1
        `;
        params = [integrationType];
      }

      await this.db.query(query, params);
      
      // Clear memory cache
      const keyPrefix = `${integrationType}:`;
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(keyPrefix)) {
          if (!universityId || key === `${integrationType}:${universityId}`) {
            this.memoryCache.delete(key);
          }
        }
      }

      this.logger.info(`Reset rate limits for ${integrationType}${universityId ? ` (${universityId})` : ''}`);
    } catch (error) {
      this.logger.error('Failed to reset rate limits:', error);
      throw error;
    }
  }

  /**
   * Get window start time for different time periods
   */
  private getWindowStart(timeWindow: 'minute' | 'hour' | 'day'): Date {
    const now = new Date();
    
    switch (timeWindow) {
      case 'minute':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                       now.getHours(), now.getMinutes(), 0, 0);
      case 'hour':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                       now.getHours(), 0, 0, 0);
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 
                       0, 0, 0, 0);
      default:
        throw new Error(`Invalid time window: ${timeWindow}`);
    }
  }

  /**
   * Get next window start time
   */
  private getNextWindowStart(timeWindow: 'minute' | 'hour' | 'day'): Date {
    const current = this.getWindowStart(timeWindow);
    
    switch (timeWindow) {
      case 'minute':
        return new Date(current.getTime() + 60 * 1000);
      case 'hour':
        return new Date(current.getTime() + 60 * 60 * 1000);
      case 'day':
        return new Date(current.getTime() + 24 * 60 * 60 * 1000);
      default:
        throw new Error(`Invalid time window: ${timeWindow}`);
    }
  }

  /**
   * Start cleanup timer for memory cache
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.memoryCache.entries()) {
        if (now >= value.resetTime) {
          this.memoryCache.delete(key);
        }
      }
    }, 30000); // Clean up every 30 seconds
  }
}

/**
 * Rate limit error class
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public timeWindow: string,
    public limit: number,
    public current: number,
    public resetTime: Date
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}