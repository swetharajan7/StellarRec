"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.RateLimiter = void 0;
const logger_1 = require("../logger");
const database_1 = require("../database");
class RateLimiter {
    constructor() {
        this.logger = new logger_1.Logger('RateLimiter');
        this.memoryCache = new Map();
        this.db = new database_1.DatabaseService();
        this.startCleanupTimer();
    }
    async checkRateLimit(integrationType, universityId) {
        try {
            const config = await this.getRateLimitConfig(integrationType, universityId);
            await Promise.all([
                this.checkTimeWindow(integrationType, universityId, 'minute', config.requestsPerMinute),
                this.checkTimeWindow(integrationType, universityId, 'hour', config.requestsPerHour),
                this.checkTimeWindow(integrationType, universityId, 'day', config.requestsPerDay)
            ]);
            await this.checkBurstLimit(integrationType, universityId, config.burstLimit);
            await this.recordRequest(integrationType, universityId);
        }
        catch (error) {
            this.logger.error(`Rate limit check failed for ${integrationType}:`, error);
            throw error;
        }
    }
    async getRateLimitConfig(integrationType, universityId) {
        try {
            let query;
            let params;
            if (universityId) {
                query = `
          SELECT rate_limit_config 
          FROM university_integrations 
          WHERE integration_type = $1 AND university_id = $2
        `;
                params = [integrationType, universityId];
            }
            else {
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
            return {
                requestsPerMinute: 10,
                requestsPerHour: 100,
                requestsPerDay: 1000,
                burstLimit: 5
            };
        }
        catch (error) {
            this.logger.error('Failed to get rate limit config:', error);
            return {
                requestsPerMinute: 5,
                requestsPerHour: 50,
                requestsPerDay: 200,
                burstLimit: 2
            };
        }
    }
    async checkTimeWindow(integrationType, universityId, timeWindow, limit) {
        try {
            const windowStart = this.getWindowStart(timeWindow);
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
                throw new RateLimitError(`Rate limit exceeded for ${integrationType}. Limit: ${limit}/${timeWindow}. Reset at: ${resetTime}`, timeWindow, limit, currentCount, resetTime);
            }
        }
        catch (error) {
            if (error instanceof RateLimitError) {
                throw error;
            }
            this.logger.error(`Failed to check ${timeWindow} rate limit:`, error);
            throw error;
        }
    }
    async checkBurstLimit(integrationType, universityId, burstLimit) {
        const key = `${integrationType}:${universityId || 'global'}`;
        const now = Date.now();
        const windowMs = 10000;
        const cached = this.memoryCache.get(key);
        if (cached) {
            if (now < cached.resetTime) {
                if (cached.count >= burstLimit) {
                    throw new RateLimitError(`Burst limit exceeded for ${integrationType}. Limit: ${burstLimit}/10s`, 'burst', burstLimit, cached.count, new Date(cached.resetTime));
                }
                cached.count++;
            }
            else {
                this.memoryCache.set(key, { count: 1, resetTime: now + windowMs });
            }
        }
        else {
            this.memoryCache.set(key, { count: 1, resetTime: now + windowMs });
        }
    }
    async recordRequest(integrationType, universityId) {
        try {
            const timeWindows = ['minute', 'hour', 'day'];
            for (const timeWindow of timeWindows) {
                const windowStart = this.getWindowStart(timeWindow);
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
        }
        catch (error) {
            this.logger.error('Failed to record request:', error);
        }
    }
    async getCurrentUsage(integrationType, universityId) {
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
            for (const timeWindow of ['minute', 'hour', 'day']) {
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
        }
        catch (error) {
            this.logger.error('Failed to get current usage:', error);
            throw error;
        }
    }
    async getRateLimitStatistics(integrationType) {
        try {
            let whereClause = '1=1';
            let params = [];
            if (integrationType) {
                whereClause = 'integration_type = $1';
                params = [integrationType];
            }
            const totalQuery = `
        SELECT SUM(request_count) as total
        FROM rate_limit_tracking 
        WHERE ${whereClause}
          AND time_window = 'hour'
          AND window_start >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      `;
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
                rateLimitHits: 0
            };
        }
        catch (error) {
            this.logger.error('Failed to get rate limit statistics:', error);
            throw error;
        }
    }
    async resetRateLimits(integrationType, universityId) {
        try {
            let query;
            let params;
            if (universityId) {
                query = `
          DELETE FROM rate_limit_tracking 
          WHERE integration_type = $1 AND university_id = $2
        `;
                params = [integrationType, universityId];
            }
            else {
                query = `
          DELETE FROM rate_limit_tracking 
          WHERE integration_type = $1
        `;
                params = [integrationType];
            }
            await this.db.query(query, params);
            const keyPrefix = `${integrationType}:`;
            for (const key of this.memoryCache.keys()) {
                if (key.startsWith(keyPrefix)) {
                    if (!universityId || key === `${integrationType}:${universityId}`) {
                        this.memoryCache.delete(key);
                    }
                }
            }
            this.logger.info(`Reset rate limits for ${integrationType}${universityId ? ` (${universityId})` : ''}`);
        }
        catch (error) {
            this.logger.error('Failed to reset rate limits:', error);
            throw error;
        }
    }
    getWindowStart(timeWindow) {
        const now = new Date();
        switch (timeWindow) {
            case 'minute':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
            case 'hour':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
            case 'day':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            default:
                throw new Error(`Invalid time window: ${timeWindow}`);
        }
    }
    getNextWindowStart(timeWindow) {
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
    startCleanupTimer() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.memoryCache.entries()) {
                if (now >= value.resetTime) {
                    this.memoryCache.delete(key);
                }
            }
        }, 30000);
    }
}
exports.RateLimiter = RateLimiter;
class RateLimitError extends Error {
    constructor(message, timeWindow, limit, current, resetTime) {
        super(message);
        this.timeWindow = timeWindow;
        this.limit = limit;
        this.current = current;
        this.resetTime = resetTime;
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
//# sourceMappingURL=RateLimiter.js.map