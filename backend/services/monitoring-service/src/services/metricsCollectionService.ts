import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import axios from 'axios';
import { logger } from '../utils/logger';

export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
  type: 'counter' | 'gauge' | 'histogram';
}

export interface ServiceMetrics {
  service: string;
  cpu: number;
  memory: number;
  requestCount: number;
  errorCount: number;
  responseTime: number;
  uptime: number;
}

export class MetricsCollectionService {
  private httpRequestsTotal: Counter<string>;
  private httpRequestDuration: Histogram<string>;
  private httpRequestsInFlight: Gauge<string>;
  private serviceUpGauge: Gauge<string>;
  private errorRateGauge: Gauge<string>;
  private responseTimeGauge: Gauge<string>;

  constructor() {
    this.initializeMetrics();
    this.startDefaultMetricsCollection();
  }

  async collectMetrics(): Promise<ServiceMetrics[]> {
    try {
      const services = [
        'user-service',
        'application-service',
        'ai-service',
        'notification-service',
        'reminder-service',
        'predictive-analytics',
        'analytics-service',
        'search-service',
        'document-processing',
        'file-management',
        'content-discovery'
      ];

      const metricsPromises = services.map(service => this.collectServiceMetrics(service));
      const results = await Promise.allSettled(metricsPromises);

      const serviceMetrics: ServiceMetrics[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          serviceMetrics.push(result.value);
        } else {
          logger.warn(`Failed to collect metrics for ${services[index]}:`, result.status === 'rejected' ? result.reason : 'Unknown error');
        }
      });

      return serviceMetrics;

    } catch (error) {
      logger.error('Error collecting metrics:', error);
      throw new Error(`Failed to collect metrics: ${error.message}`);
    }
  }

  async recordMetric(metric: MetricData): Promise<void> {
    try {
      switch (metric.type) {
        case 'counter':
          this.httpRequestsTotal.inc(metric.labels || {}, metric.value);
          break;
        case 'gauge':
          if (metric.name === 'service_up') {
            this.serviceUpGauge.set(metric.labels || {}, metric.value);
          } else if (metric.name === 'error_rate') {
            this.errorRateGauge.set(metric.labels || {}, metric.value);
          } else if (metric.name === 'response_time') {
            this.responseTimeGauge.set(metric.labels || {}, metric.value);
          }
          break;
        case 'histogram':
          this.httpRequestDuration.observe(metric.labels || {}, metric.value);
          break;
      }

    } catch (error) {
      logger.error('Error recording metric:', error);
      throw new Error(`Failed to record metric: ${error.message}`);
    }
  }

  async getMetricsForService(serviceName: string): Promise<ServiceMetrics | null> {
    try {
      return await this.collectServiceMetrics(serviceName);
    } catch (error) {
      logger.error(`Error getting metrics for ${serviceName}:`, error);
      return null;
    }
  }

  async getAggregatedMetrics(): Promise<{
    totalRequests: number;
    totalErrors: number;
    averageResponseTime: number;
    servicesUp: number;
    totalServices: number;
  }> {
    try {
      const serviceMetrics = await this.collectMetrics();
      
      const totalRequests = serviceMetrics.reduce((sum, metrics) => sum + metrics.requestCount, 0);
      const totalErrors = serviceMetrics.reduce((sum, metrics) => sum + metrics.errorCount, 0);
      const averageResponseTime = serviceMetrics.length > 0 
        ? serviceMetrics.reduce((sum, metrics) => sum + metrics.responseTime, 0) / serviceMetrics.length
        : 0;
      const servicesUp = serviceMetrics.filter(metrics => metrics.uptime > 0).length;
      const totalServices = serviceMetrics.length;

      return {
        totalRequests,
        totalErrors,
        averageResponseTime,
        servicesUp,
        totalServices
      };

    } catch (error) {
      logger.error('Error getting aggregated metrics:', error);
      throw new Error(`Failed to get aggregated metrics: ${error.message}`);
    }
  }

  getMetrics(): string {
    return register.metrics();
  }

  getContentType(): string {
    return register.contentType;
  }

  async exportMetricsToPrometheus(): Promise<void> {
    try {
      const serviceMetrics = await this.collectMetrics();
      
      serviceMetrics.forEach(metrics => {
        this.serviceUpGauge.set({ service: metrics.service }, metrics.uptime > 0 ? 1 : 0);
        this.errorRateGauge.set(
          { service: metrics.service }, 
          metrics.requestCount > 0 ? (metrics.errorCount / metrics.requestCount) * 100 : 0
        );
        this.responseTimeGauge.set({ service: metrics.service }, metrics.responseTime);
      });

    } catch (error) {
      logger.error('Error exporting metrics to Prometheus:', error);
    }
  }

  private initializeMetrics(): void {
    // HTTP request metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'service']
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code', 'service'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['service']
    });

    // Service health metrics
    this.serviceUpGauge = new Gauge({
      name: 'service_up',
      help: 'Whether the service is up (1) or down (0)',
      labelNames: ['service']
    });

    this.errorRateGauge = new Gauge({
      name: 'service_error_rate',
      help: 'Error rate percentage for the service',
      labelNames: ['service']
    });

    this.responseTimeGauge = new Gauge({
      name: 'service_response_time_ms',
      help: 'Average response time in milliseconds',
      labelNames: ['service']
    });

    // Register metrics
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.httpRequestsInFlight);
    register.registerMetric(this.serviceUpGauge);
    register.registerMetric(this.errorRateGauge);
    register.registerMetric(this.responseTimeGauge);
  }

  private startDefaultMetricsCollection(): void {
    // Collect default Node.js metrics
    collectDefaultMetrics({
      register,
      prefix: 'stellarrec_monitoring_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });
  }

  private async collectServiceMetrics(serviceName: string): Promise<ServiceMetrics | null> {
    try {
      const servicePort = this.getServicePort(serviceName);
      const startTime = Date.now();
      
      // Try to get health check from service
      const healthResponse = await axios.get(`http://localhost:${servicePort}/health`, {
        timeout: 5000
      });
      
      const responseTime = Date.now() - startTime;
      
      // Try to get metrics endpoint if available
      let requestCount = 0;
      let errorCount = 0;
      let cpuUsage = 0;
      let memoryUsage = 0;
      
      try {
        const metricsResponse = await axios.get(`http://localhost:${servicePort}/metrics`, {
          timeout: 3000
        });
        
        // Parse Prometheus metrics (simplified)
        const metricsText = metricsResponse.data;
        const requestMatch = metricsText.match(/http_requests_total\{.*?\}\s+(\d+)/);
        const errorMatch = metricsText.match(/http_requests_total\{.*?status_code="[45]\d\d".*?\}\s+(\d+)/g);
        
        if (requestMatch) {
          requestCount = parseInt(requestMatch[1]);
        }
        
        if (errorMatch) {
          errorCount = errorMatch.reduce((sum, match) => {
            const value = match.match(/\s+(\d+)$/);
            return sum + (value ? parseInt(value[1]) : 0);
          }, 0);
        }
        
      } catch (metricsError) {
        // Metrics endpoint not available, use defaults
        logger.debug(`Metrics endpoint not available for ${serviceName}`);
      }

      return {
        service: serviceName,
        cpu: cpuUsage,
        memory: memoryUsage,
        requestCount,
        errorCount,
        responseTime,
        uptime: healthResponse.status === 200 ? 1 : 0
      };

    } catch (error) {
      logger.warn(`Failed to collect metrics for ${serviceName}:`, error.message);
      
      // Return default metrics for down service
      return {
        service: serviceName,
        cpu: 0,
        memory: 0,
        requestCount: 0,
        errorCount: 1,
        responseTime: 0,
        uptime: 0
      };
    }
  }

  private getServicePort(serviceName: string): number {
    const portMap: Record<string, number> = {
      'user-service': 3001,
      'application-service': 3004,
      'ai-service': 8000,
      'notification-service': 3009,
      'reminder-service': 3010,
      'predictive-analytics': 3008,
      'analytics-service': 3006,
      'search-service': 3007,
      'document-processing': 3012,
      'file-management': 3013,
      'content-discovery': 3014
    };

    return portMap[serviceName] || 3000;
  }
}