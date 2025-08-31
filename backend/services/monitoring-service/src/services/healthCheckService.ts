import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { LoggingService } from './loggingService';

const prisma = new PrismaClient();

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime: number;
  timestamp: Date;
  details?: Record<string, any>;
  error?: string;
}

export interface ServiceHealth {
  service: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  uptime: number;
  responseTime: number;
  consecutiveFailures: number;
  details: Record<string, any>;
}

export class HealthCheckService {
  private loggingService: LoggingService;
  private healthChecks: Map<string, ServiceHealth> = new Map();
  private checkInterval?: NodeJS.Timeout;
  private services: Array<{ name: string; url: string; port: number }>;

  constructor() {
    this.loggingService = new LoggingService();
    this.initializeServices();
    this.loadHealthHistory();
  }

  async performHealthCheck(serviceName: string): Promise<HealthCheck> {
    try {
      const service = this.services.find(s => s.name === serviceName);
      if (!service) {
        throw new Error(`Service ${serviceName} not found`);
      }

      const startTime = Date.now();
      const response = await axios.get(`${service.url}/health`, {
        timeout: 10000,
        validateStatus: (status) => status < 500 // Accept 4xx as healthy but degraded
      });
      
      const responseTime = Date.now() - startTime;
      const timestamp = new Date();

      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (response.status >= 200 && response.status < 300) {
        status = 'healthy';
      } else if (response.status >= 400 && response.status < 500) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      const healthCheck: HealthCheck = {
        service: serviceName,
        status,
        responseTime,
        timestamp,
        details: {
          statusCode: response.status,
          data: response.data
        }
      };

      // Update service health
      await this.updateServiceHealth(serviceName, healthCheck);

      // Store health check result
      await this.storeHealthCheck(healthCheck);

      return healthCheck;

    } catch (error) {
      const healthCheck: HealthCheck = {
        service: serviceName,
        status: 'unhealthy',
        responseTime: 0,
        timestamp: new Date(),
        error: error.message
      };

      await this.updateServiceHealth(serviceName, healthCheck);
      await this.storeHealthCheck(healthCheck);

      return healthCheck;
    }
  }

  async performAllHealthChecks(): Promise<HealthCheck[]> {
    const healthChecks: HealthCheck[] = [];
    
    for (const service of this.services) {
      try {
        const healthCheck = await this.performHealthCheck(service.name);
        healthChecks.push(healthCheck);
      } catch (error) {
        logger.error(`Error performing health check for ${service.name}:`, error);
        healthChecks.push({
          service: service.name,
          status: 'unhealthy',
          responseTime: 0,
          timestamp: new Date(),
          error: error.message
        });
      }
    }

    return healthChecks;
  }

  async getServiceHealth(serviceName: string): Promise<ServiceHealth | null> {
    return this.healthChecks.get(serviceName) || null;
  }

  async getAllServiceHealth(): Promise<ServiceHealth[]> {
    return Array.from(this.healthChecks.values());
  }

  async getHealthHistory(
    serviceName?: string,
    hours: number = 24
  ): Promise<HealthCheck[]> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const whereClause: any = {
        timestamp: { gte: startTime }
      };

      if (serviceName) {
        whereClause.service = serviceName;
      }

      const healthChecks = await prisma.healthCheck.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: 1000
      });

      return healthChecks.map(hc => ({
        service: hc.service,
        status: hc.status as HealthCheck['status'],
        responseTime: hc.responseTime,
        timestamp: hc.timestamp,
        details: hc.details as Record<string, any>,
        error: hc.error
      }));

    } catch (error) {
      logger.error('Error getting health history:', error);
      throw new Error(`Failed to get health history: ${error.message}`);
    }
  }

  async getSystemOverview(): Promise<{
    totalServices: number;
    healthyServices: number;
    unhealthyServices: number;
    degradedServices: number;
    averageResponseTime: number;
    uptime: number;
  }> {
    try {
      const allHealth = await this.getAllServiceHealth();
      
      const totalServices = allHealth.length;
      const healthyServices = allHealth.filter(h => h.status === 'healthy').length;
      const unhealthyServices = allHealth.filter(h => h.status === 'unhealthy').length;
      const degradedServices = allHealth.filter(h => h.status === 'degraded').length;
      
      const averageResponseTime = allHealth.length > 0
        ? allHealth.reduce((sum, h) => sum + h.responseTime, 0) / allHealth.length
        : 0;
      
      const uptime = totalServices > 0
        ? (healthyServices + degradedServices) / totalServices * 100
        : 0;

      return {
        totalServices,
        healthyServices,
        unhealthyServices,
        degradedServices,
        averageResponseTime,
        uptime
      };

    } catch (error) {
      logger.error('Error getting system overview:', error);
      throw new Error(`Failed to get system overview: ${error.message}`);
    }
  }

  startHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Perform health checks every 30 seconds
    this.checkInterval = setInterval(async () => {
      try {
        await this.performAllHealthChecks();
      } catch (error) {
        logger.error('Error in scheduled health checks:', error);
      }
    }, 30000);

    // Perform initial health check
    this.performAllHealthChecks();
    
    logger.info('Health check service started');
  }

  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    
    logger.info('Health check service stopped');
  }

  private initializeServices(): void {
    this.services = [
      { name: 'user-service', url: 'http://localhost:3001', port: 3001 },
      { name: 'application-service', url: 'http://localhost:3004', port: 3004 },
      { name: 'ai-service', url: 'http://localhost:8000', port: 8000 },
      { name: 'notification-service', url: 'http://localhost:3009', port: 3009 },
      { name: 'reminder-service', url: 'http://localhost:3010', port: 3010 },
      { name: 'predictive-analytics', url: 'http://localhost:3008', port: 3008 },
      { name: 'analytics-service', url: 'http://localhost:3006', port: 3006 },
      { name: 'search-service', url: 'http://localhost:3007', port: 3007 },
      { name: 'document-processing', url: 'http://localhost:3012', port: 3012 },
      { name: 'file-management', url: 'http://localhost:3013', port: 3013 },
      { name: 'content-discovery', url: 'http://localhost:3014', port: 3014 }
    ];

    // Initialize health check map
    this.services.forEach(service => {
      this.healthChecks.set(service.name, {
        service: service.name,
        url: service.url,
        status: 'unhealthy',
        lastCheck: new Date(),
        uptime: 0,
        responseTime: 0,
        consecutiveFailures: 0,
        details: {}
      });
    });
  }

  private async loadHealthHistory(): Promise<void> {
    try {
      // Load recent health status for each service
      for (const service of this.services) {
        const recentCheck = await prisma.healthCheck.findFirst({
          where: { service: service.name },
          orderBy: { timestamp: 'desc' }
        });

        if (recentCheck) {
          const serviceHealth = this.healthChecks.get(service.name);
          if (serviceHealth) {
            serviceHealth.status = recentCheck.status as ServiceHealth['status'];
            serviceHealth.lastCheck = recentCheck.timestamp;
            serviceHealth.responseTime = recentCheck.responseTime;
            serviceHealth.details = recentCheck.details as Record<string, any>;
          }
        }
      }

    } catch (error) {
      logger.error('Error loading health history:', error);
    }
  }

  private async updateServiceHealth(serviceName: string, healthCheck: HealthCheck): Promise<void> {
    const serviceHealth = this.healthChecks.get(serviceName);
    if (!serviceHealth) return;

    serviceHealth.status = healthCheck.status;
    serviceHealth.lastCheck = healthCheck.timestamp;
    serviceHealth.responseTime = healthCheck.responseTime;
    serviceHealth.details = healthCheck.details || {};

    if (healthCheck.status === 'unhealthy') {
      serviceHealth.consecutiveFailures++;
    } else {
      serviceHealth.consecutiveFailures = 0;
    }

    // Calculate uptime (simplified - based on recent checks)
    try {
      const recentChecks = await prisma.healthCheck.findMany({
        where: {
          service: serviceName,
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      if (recentChecks.length > 0) {
        const healthyChecks = recentChecks.filter(check => 
          check.status === 'healthy' || check.status === 'degraded'
        ).length;
        serviceHealth.uptime = (healthyChecks / recentChecks.length) * 100;
      }

    } catch (error) {
      logger.error('Error calculating uptime:', error);
    }

    // Log significant status changes
    if (healthCheck.status === 'unhealthy' && serviceHealth.consecutiveFailures === 1) {
      await this.loggingService.logEntry({
        level: 'error',
        message: `Service ${serviceName} became unhealthy`,
        service: 'monitoring-service',
        metadata: {
          serviceName,
          error: healthCheck.error,
          responseTime: healthCheck.responseTime
        }
      });
    } else if (healthCheck.status === 'healthy' && serviceHealth.consecutiveFailures > 0) {
      await this.loggingService.logEntry({
        level: 'info',
        message: `Service ${serviceName} recovered`,
        service: 'monitoring-service',
        metadata: {
          serviceName,
          responseTime: healthCheck.responseTime,
          previousFailures: serviceHealth.consecutiveFailures
        }
      });
    }
  }

  private async storeHealthCheck(healthCheck: HealthCheck): Promise<void> {
    try {
      await prisma.healthCheck.create({
        data: {
          id: this.generateId(),
          service: healthCheck.service,
          status: healthCheck.status,
          responseTime: healthCheck.responseTime,
          timestamp: healthCheck.timestamp,
          details: healthCheck.details || {},
          error: healthCheck.error
        }
      });

    } catch (error) {
      logger.error('Error storing health check:', error);
    }
  }

  private generateId(): string {
    return `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}