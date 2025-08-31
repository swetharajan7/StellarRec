import { EventEmitter } from 'events';
import axios from 'axios';
import { ServiceConfig, ServiceStatus, OrchestrationResult } from '../types';
import { Logger } from '../utils/logger';

export class ServiceOrchestrator extends EventEmitter {
  private services: Map<string, ServiceConfig> = new Map();
  private serviceStatus: Map<string, ServiceStatus> = new Map();
  private logger = new Logger('ServiceOrchestrator');
  private startupOrder: string[] = [];

  constructor() {
    super();
    this.initializeServices();
  }

  private initializeServices(): void {
    // Define service configurations and startup order
    const serviceConfigs: ServiceConfig[] = [
      {
        name: 'api-gateway',
        url: 'http://localhost:3000',
        healthEndpoint: '/health',
        dependencies: [],
        startupTimeout: 30000,
        critical: true
      },
      {
        name: 'user-service',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
        dependencies: ['database'],
        startupTimeout: 20000,
        critical: true
      },
      {
        name: 'ai-service',
        url: 'http://localhost:3002',
        healthEndpoint: '/health',
        dependencies: ['database', 'redis'],
        startupTimeout: 45000,
        critical: true
      },
      {
        name: 'application-service',
        url: 'http://localhost:3003',
        healthEndpoint: '/health',
        dependencies: ['user-service', 'database'],
        startupTimeout: 25000,
        critical: true
      },
      {
        name: 'letter-service',
        url: 'http://localhost:3004',
        healthEndpoint: '/health',
        dependencies: ['user-service', 'notification-service'],
        startupTimeout: 20000,
        critical: true
      },
      {
        name: 'timeline-service',
        url: 'http://localhost:3005',
        healthEndpoint: '/health',
        dependencies: ['application-service', 'notification-service'],
        startupTimeout: 20000,
        critical: true
      },
      {
        name: 'collaboration-service',
        url: 'http://localhost:3006',
        healthEndpoint: '/health',
        dependencies: ['user-service', 'redis'],
        startupTimeout: 25000,
        critical: false
      },
      {
        name: 'ai-writing-assistant',
        url: 'http://localhost:3007',
        healthEndpoint: '/health',
        dependencies: ['ai-service', 'user-service'],
        startupTimeout: 30000,
        critical: false
      },
      {
        name: 'file-management',
        url: 'http://localhost:3008',
        healthEndpoint: '/health',
        dependencies: ['user-service'],
        startupTimeout: 20000,
        critical: true
      },
      {
        name: 'document-processing',
        url: 'http://localhost:3009',
        healthEndpoint: '/health',
        dependencies: ['file-management'],
        startupTimeout: 30000,
        critical: false
      },
      {
        name: 'search-service',
        url: 'http://localhost:3010',
        healthEndpoint: '/health',
        dependencies: ['elasticsearch'],
        startupTimeout: 35000,
        critical: false
      },
      {
        name: 'content-discovery',
        url: 'http://localhost:3011',
        healthEndpoint: '/health',
        dependencies: ['search-service', 'ai-service'],
        startupTimeout: 25000,
        critical: false
      },
      {
        name: 'analytics-service',
        url: 'http://localhost:3012',
        healthEndpoint: '/health',
        dependencies: ['database', 'redis'],
        startupTimeout: 25000,
        critical: false
      },
      {
        name: 'predictive-analytics',
        url: 'http://localhost:3013',
        healthEndpoint: '/health',
        dependencies: ['analytics-service', 'ai-service'],
        startupTimeout: 40000,
        critical: false
      },
      {
        name: 'notification-service',
        url: 'http://localhost:3014',
        healthEndpoint: '/health',
        dependencies: ['database', 'redis'],
        startupTimeout: 20000,
        critical: true
      },
      {
        name: 'reminder-service',
        url: 'http://localhost:3015',
        healthEndpoint: '/health',
        dependencies: ['notification-service', 'timeline-service'],
        startupTimeout: 20000,
        critical: false
      },
      {
        name: 'monitoring-service',
        url: 'http://localhost:3016',
        healthEndpoint: '/health',
        dependencies: [],
        startupTimeout: 15000,
        critical: false
      }
    ];

    // Store service configurations
    serviceConfigs.forEach(config => {
      this.services.set(config.name, config);
      this.serviceStatus.set(config.name, {
        name: config.name,
        status: 'stopped',
        lastCheck: new Date(),
        uptime: 0,
        errorCount: 0
      });
    });

    // Calculate startup order based on dependencies
    this.startupOrder = this.calculateStartupOrder(serviceConfigs);
  }

  private calculateStartupOrder(services: ServiceConfig[]): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (serviceName: string) => {
      if (visiting.has(serviceName)) {
        throw new Error(`Circular dependency detected involving ${serviceName}`);
      }
      if (visited.has(serviceName)) {
        return;
      }

      visiting.add(serviceName);
      const service = services.find(s => s.name === serviceName);
      
      if (service) {
        service.dependencies.forEach(dep => {
          if (services.find(s => s.name === dep)) {
            visit(dep);
          }
        });
      }

      visiting.delete(serviceName);
      visited.add(serviceName);
      order.push(serviceName);
    };

    services.forEach(service => {
      if (!visited.has(service.name)) {
        visit(service.name);
      }
    });

    return order;
  }

  async startAllServices(): Promise<OrchestrationResult> {
    this.logger.info('Starting system orchestration...');
    const results: OrchestrationResult = {
      success: true,
      startedServices: [],
      failedServices: [],
      warnings: [],
      totalTime: 0
    };

    const startTime = Date.now();

    try {
      // Start services in dependency order
      for (const serviceName of this.startupOrder) {
        const service = this.services.get(serviceName);
        if (!service) continue;

        this.logger.info(`Starting service: ${serviceName}`);
        
        try {
          await this.startService(service);
          results.startedServices.push(serviceName);
          this.logger.info(`✅ Service ${serviceName} started successfully`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(`❌ Failed to start service ${serviceName}: ${errorMessage}`);
          
          results.failedServices.push({
            name: serviceName,
            error: errorMessage
          });

          if (service.critical) {
            results.success = false;
            this.logger.error(`Critical service ${serviceName} failed to start. Aborting orchestration.`);
            break;
          } else {
            results.warnings.push(`Non-critical service ${serviceName} failed to start`);
          }
        }

        // Wait between service starts to avoid overwhelming the system
        await this.delay(2000);
      }

      results.totalTime = Date.now() - startTime;

      // Perform final health check
      await this.performSystemHealthCheck();

      this.logger.info(`System orchestration completed in ${results.totalTime}ms`);
      this.logger.info(`Started: ${results.startedServices.length}, Failed: ${results.failedServices.length}`);

      return results;

    } catch (error) {
      results.success = false;
      results.totalTime = Date.now() - startTime;
      this.logger.error('System orchestration failed:', error);
      return results;
    }
  }

  private async startService(service: ServiceConfig): Promise<void> {
    // Check if dependencies are ready
    await this.waitForDependencies(service);

    // Start the service (in real implementation, this would use Docker/K8s APIs)
    this.logger.info(`Starting ${service.name}...`);

    // Wait for service to be healthy
    await this.waitForServiceHealth(service);

    // Update service status
    this.serviceStatus.set(service.name, {
      name: service.name,
      status: 'running',
      lastCheck: new Date(),
      uptime: Date.now(),
      errorCount: 0
    });

    this.emit('serviceStarted', service.name);
  }

  private async waitForDependencies(service: ServiceConfig): Promise<void> {
    for (const dependency of service.dependencies) {
      const depStatus = this.serviceStatus.get(dependency);
      if (!depStatus || depStatus.status !== 'running') {
        // In real implementation, wait for dependency or start it
        this.logger.info(`Waiting for dependency: ${dependency}`);
        await this.delay(1000);
      }
    }
  }

  private async waitForServiceHealth(service: ServiceConfig): Promise<void> {
    const maxAttempts = service.startupTimeout / 1000; // 1 second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await axios.get(`${service.url}${service.healthEndpoint}`, {
          timeout: 5000
        });

        if (response.status === 200) {
          this.logger.info(`Service ${service.name} is healthy`);
          return;
        }
      } catch (error) {
        // Service not ready yet
      }

      attempts++;
      await this.delay(1000);
    }

    throw new Error(`Service ${service.name} failed to become healthy within ${service.startupTimeout}ms`);
  }

  async stopAllServices(): Promise<void> {
    this.logger.info('Stopping all services...');

    // Stop services in reverse order
    const stopOrder = [...this.startupOrder].reverse();

    for (const serviceName of stopOrder) {
      try {
        await this.stopService(serviceName);
        this.logger.info(`✅ Service ${serviceName} stopped`);
      } catch (error) {
        this.logger.error(`❌ Failed to stop service ${serviceName}:`, error);
      }
    }

    this.logger.info('All services stopped');
  }

  private async stopService(serviceName: string): Promise<void> {
    // In real implementation, this would use Docker/K8s APIs to stop the service
    this.serviceStatus.set(serviceName, {
      name: serviceName,
      status: 'stopped',
      lastCheck: new Date(),
      uptime: 0,
      errorCount: 0
    });

    this.emit('serviceStopped', serviceName);
  }

  async performSystemHealthCheck(): Promise<Map<string, ServiceStatus>> {
    this.logger.info('Performing system health check...');

    for (const [serviceName, service] of this.services.entries()) {
      try {
        const response = await axios.get(`${service.url}${service.healthEndpoint}`, {
          timeout: 5000
        });

        const status = this.serviceStatus.get(serviceName)!;
        status.status = response.status === 200 ? 'running' : 'unhealthy';
        status.lastCheck = new Date();
        
        if (response.status !== 200) {
          status.errorCount++;
        }

      } catch (error) {
        const status = this.serviceStatus.get(serviceName)!;
        status.status = 'unhealthy';
        status.lastCheck = new Date();
        status.errorCount++;
      }
    }

    return this.serviceStatus;
  }

  getSystemStatus(): {
    healthy: number;
    unhealthy: number;
    stopped: number;
    total: number;
    services: ServiceStatus[];
  } {
    const services = Array.from(this.serviceStatus.values());
    
    return {
      healthy: services.filter(s => s.status === 'running').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
      stopped: services.filter(s => s.status === 'stopped').length,
      total: services.length,
      services
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}