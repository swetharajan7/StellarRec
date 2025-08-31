import { Request } from 'express';
import { createClient } from 'redis';
import { logger } from './logger';

interface RequestPattern {
  ip: string;
  userAgent: string;
  endpoint: string;
  method: string;
  timestamp: number;
  userId?: string;
}

interface AnomalyScore {
  score: number;
  reasons: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

class AnomalyDetectionService {
  private redisClient: any;
  private readonly WINDOW_SIZE = 60 * 60 * 1000; // 1 hour
  private readonly MAX_REQUESTS_PER_MINUTE = 60;
  private readonly MAX_FAILED_LOGINS = 5;
  private readonly SUSPICIOUS_USER_AGENTS = [
    'sqlmap',
    'nikto',
    'nmap',
    'masscan',
    'nessus',
    'openvas',
    'burp',
    'zap'
  ];

  constructor() {
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    
    this.redisClient.on('error', (err: Error) => {
      logger.error('Redis client error in anomaly detection:', err);
    });

    this.redisClient.connect().catch((err: Error) => {
      logger.error('Failed to connect to Redis for anomaly detection:', err);
    });
  }

  async analyzeRequest(req: Request): Promise<AnomalyScore> {
    const pattern: RequestPattern = {
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      endpoint: req.path,
      method: req.method,
      timestamp: Date.now(),
      userId: req.user?.id
    };

    const scores: number[] = [];
    const reasons: string[] = [];

    // Check request frequency
    const frequencyScore = await this.checkRequestFrequency(pattern);
    if (frequencyScore > 0) {
      scores.push(frequencyScore);
      reasons.push('High request frequency detected');
    }

    // Check for suspicious user agents
    const userAgentScore = this.checkSuspiciousUserAgent(pattern.userAgent);
    if (userAgentScore > 0) {
      scores.push(userAgentScore);
      reasons.push('Suspicious user agent detected');
    }

    // Check for unusual access patterns
    const accessPatternScore = await this.checkAccessPatterns(pattern);
    if (accessPatternScore > 0) {
      scores.push(accessPatternScore);
      reasons.push('Unusual access pattern detected');
    }

    // Check for failed authentication attempts
    const authScore = await this.checkFailedAuthentication(pattern);
    if (authScore > 0) {
      scores.push(authScore);
      reasons.push('Multiple failed authentication attempts');
    }

    // Check for geographic anomalies
    const geoScore = await this.checkGeographicAnomalies(pattern);
    if (geoScore > 0) {
      scores.push(geoScore);
      reasons.push('Unusual geographic access pattern');
    }

    // Calculate overall score
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const riskLevel = this.calculateRiskLevel(totalScore);

    // Store pattern for future analysis
    await this.storePattern(pattern, totalScore);

    return {
      score: totalScore,
      reasons,
      riskLevel
    };
  }

  private async checkRequestFrequency(pattern: RequestPattern): Promise<number> {
    try {
      const key = `freq:${pattern.ip}:${Math.floor(Date.now() / 60000)}`; // Per minute
      const count = await this.redisClient.incr(key);
      await this.redisClient.expire(key, 60);

      if (count > this.MAX_REQUESTS_PER_MINUTE) {
        return Math.min(50, count - this.MAX_REQUESTS_PER_MINUTE);
      }
      return 0;
    } catch (error) {
      logger.error('Error checking request frequency:', error);
      return 0;
    }
  }

  private checkSuspiciousUserAgent(userAgent: string): number {
    const lowerUA = userAgent.toLowerCase();
    
    // Check for known attack tools
    for (const suspicious of this.SUSPICIOUS_USER_AGENTS) {
      if (lowerUA.includes(suspicious)) {
        return 80;
      }
    }

    // Check for empty or very short user agents
    if (!userAgent || userAgent.length < 10) {
      return 30;
    }

    // Check for unusual patterns
    if (lowerUA.includes('bot') && !lowerUA.includes('googlebot') && !lowerUA.includes('bingbot')) {
      return 40;
    }

    return 0;
  }

  private async checkAccessPatterns(pattern: RequestPattern): Promise<number> {
    try {
      const key = `pattern:${pattern.ip}`;
      const patterns = await this.redisClient.lrange(key, 0, -1);
      
      if (patterns.length === 0) {
        await this.redisClient.lpush(key, JSON.stringify(pattern));
        await this.redisClient.expire(key, 3600);
        return 0;
      }

      const recentPatterns = patterns
        .map((p: string) => JSON.parse(p))
        .filter((p: RequestPattern) => Date.now() - p.timestamp < this.WINDOW_SIZE);

      // Check for rapid endpoint scanning
      const uniqueEndpoints = new Set(recentPatterns.map(p => p.endpoint));
      if (uniqueEndpoints.size > 20 && recentPatterns.length > 50) {
        return 60;
      }

      // Check for unusual method distribution
      const methods = recentPatterns.map(p => p.method);
      const methodCounts = methods.reduce((acc: any, method) => {
        acc[method] = (acc[method] || 0) + 1;
        return acc;
      }, {});

      if (methodCounts.OPTIONS > 10 || methodCounts.HEAD > 10) {
        return 40;
      }

      // Store current pattern
      await this.redisClient.lpush(key, JSON.stringify(pattern));
      await this.redisClient.ltrim(key, 0, 99); // Keep last 100 patterns
      await this.redisClient.expire(key, 3600);

      return 0;
    } catch (error) {
      logger.error('Error checking access patterns:', error);
      return 0;
    }
  }

  private async checkFailedAuthentication(pattern: RequestPattern): Promise<number> {
    try {
      if (!pattern.endpoint.includes('auth') && !pattern.endpoint.includes('login')) {
        return 0;
      }

      const key = `auth_fail:${pattern.ip}`;
      const failures = await this.redisClient.get(key);
      const failureCount = failures ? parseInt(failures) : 0;

      if (failureCount > this.MAX_FAILED_LOGINS) {
        return Math.min(70, failureCount * 10);
      }

      return 0;
    } catch (error) {
      logger.error('Error checking failed authentication:', error);
      return 0;
    }
  }

  private async checkGeographicAnomalies(pattern: RequestPattern): Promise<number> {
    try {
      if (!pattern.userId) {
        return 0;
      }

      const key = `geo:${pattern.userId}`;
      const lastLocation = await this.redisClient.get(key);

      if (!lastLocation) {
        // Store current location (simplified - in real implementation, use IP geolocation)
        await this.redisClient.setex(key, 86400, pattern.ip);
        return 0;
      }

      // In a real implementation, you would:
      // 1. Get geographic location from IP
      // 2. Calculate distance from last known location
      // 3. Check if the distance/time combination is suspicious
      
      return 0;
    } catch (error) {
      logger.error('Error checking geographic anomalies:', error);
      return 0;
    }
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  private async storePattern(pattern: RequestPattern, score: number): Promise<void> {
    try {
      if (score > 30) {
        const alertKey = `alert:${Date.now()}`;
        await this.redisClient.setex(alertKey, 86400, JSON.stringify({
          ...pattern,
          score,
          timestamp: new Date().toISOString()
        }));

        logger.warn('Anomaly detected', {
          pattern,
          score,
          riskLevel: this.calculateRiskLevel(score)
        });
      }
    } catch (error) {
      logger.error('Error storing anomaly pattern:', error);
    }
  }

  async recordFailedAuthentication(ip: string): Promise<void> {
    try {
      const key = `auth_fail:${ip}`;
      await this.redisClient.incr(key);
      await this.redisClient.expire(key, 3600); // 1 hour
    } catch (error) {
      logger.error('Error recording failed authentication:', error);
    }
  }

  async clearFailedAuthentication(ip: string): Promise<void> {
    try {
      const key = `auth_fail:${ip}`;
      await this.redisClient.del(key);
    } catch (error) {
      logger.error('Error clearing failed authentication:', error);
    }
  }

  async getRecentAlerts(limit: number = 50): Promise<any[]> {
    try {
      const keys = await this.redisClient.keys('alert:*');
      const alerts = [];

      for (const key of keys.slice(0, limit)) {
        const alert = await this.redisClient.get(key);
        if (alert) {
          alerts.push(JSON.parse(alert));
        }
      }

      return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      logger.error('Error getting recent alerts:', error);
      return [];
    }
  }
}

export const anomalyDetection = new AnomalyDetectionService();

export const anomalyDetectionMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const analysis = await anomalyDetection.analyzeRequest(req);
    
    if (analysis.riskLevel === 'critical') {
      logger.error('Critical security threat detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        analysis
      });
      return res.status(403).json({ error: 'Access denied' });
    }

    if (analysis.riskLevel === 'high') {
      logger.warn('High risk request detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.url,
        analysis
      });
      // Could implement additional verification here
    }

    // Attach analysis to request for logging
    (req as any).securityAnalysis = analysis;
    next();
  } catch (error) {
    logger.error('Anomaly detection middleware error:', error);
    next(); // Continue processing even if anomaly detection fails
  }
};