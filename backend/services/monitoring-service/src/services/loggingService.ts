import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import DailyRotateFile from 'winston-daily-rotate-file';
import { PrismaClient } from '@prisma/client';
import { Client } from '@elastic/elasticsearch';
import axios from 'axios';

const prisma = new PrismaClient();

export interface LogEntry {
  id?: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  stack?: string;
  duration?: number;
}

export interface LogQuery {
  service?: string;
  level?: string;
  startTime?: Date;
  endTime?: Date;
  userId?: string;
  requestId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface LogAggregation {
  service: string;
  level: string;
  count: number;
  timeframe: string;
}

export class LoggingService {
  private centralLogger: winston.Logger;
  private elasticsearchClient?: Client;
  private services: Map<string, winston.Logger> = new Map();

  constructor() {
    this.initializeCentralLogger();
    this.initializeElasticsearch();
    this.setupServiceLoggers();
  }

  async logEntry(entry: LogEntry): Promise<string> {
    try {
      const logId = this.generateId();
      const logEntry = {
        ...entry,
        id: logId,
        timestamp: entry.timestamp || new Date()
      };

      // Log to central logger
      this.centralLogger.log(entry.level, entry.message, {
        service: entry.service,
        userId: entry.userId,
        requestId: entry.requestId,
        metadata: entry.metadata,
        stack: entry.stack,
        duration: entry.duration
      });

      // Store in database for querying
      await this.storeLogEntry(logEntry);

      return logId;

    } catch (error) {
      console.error('Error logging entry:', error);
      throw new Error(`Failed to log entry: ${error.message}`);
    }
  }

  async queryLogs(query: LogQuery): Promise<{
    logs: LogEntry[];
    total: number;
    aggregations?: LogAggregation[];
  }> {
    try {
      // Query from Elasticsearch if available, otherwise from database
      if (this.elasticsearchClient) {
        return await this.queryElasticsearch(query);
      } else {
        return await this.queryDatabase(query);
      }

    } catch (error) {
      console.error('Error querying logs:', error);
      throw new Error(`Failed to query logs: ${error.message}`);
    }
  }

  async getLogAggregations(
    timeframe: 'hour' | 'day' | 'week' | 'month',
    services?: string[]
  ): Promise<LogAggregation[]> {
    try {
      const startTime = this.getTimeframeStart(timeframe);
      
      if (this.elasticsearchClient) {
        return await this.getElasticsearchAggregations(startTime, services);
      } else {
        return await this.getDatabaseAggregations(startTime, services);
      }

    } catch (error) {
      console.error('Error getting log aggregations:', error);
      throw new Error(`Failed to get log aggregations: ${error.message}`);
    }
  }

  async getErrorTrends(
    timeframe: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Array<{
    timestamp: Date;
    errorCount: number;
    warnCount: number;
    service: string;
  }>> {
    try {
      const startTime = this.getTimeframeStart(timeframe);
      
      const trends = await prisma.logEntry.groupBy({
        by: ['service', 'level'],
        where: {
          timestamp: { gte: startTime },
          level: { in: ['error', 'warn'] }
        },
        _count: {
          level: true
        },
        orderBy: {
          service: 'asc'
        }
      });

      // Process and format trends data
      const processedTrends = this.processTrendsData(trends);
      return processedTrends;

    } catch (error) {
      console.error('Error getting error trends:', error);
      throw new Error(`Failed to get error trends: ${error.message}`);
    }
  }

  async collectLogsFromServices(): Promise<void> {
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

      for (const service of services) {
        try {
          await this.collectServiceLogs(service);
        } catch (error) {
          console.warn(`Failed to collect logs from ${service}:`, error.message);
        }
      }

    } catch (error) {
      console.error('Error collecting logs from services:', error);
    }
  }

  getServiceLogger(serviceName: string): winston.Logger {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, this.createServiceLogger(serviceName));
    }
    return this.services.get(serviceName)!;
  }

  private initializeCentralLogger(): void {
    const transports: winston.transport[] = [
      // Console transport for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
            return `${timestamp} [${service || 'unknown'}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          })
        )
      }),

      // Daily rotate file transport
      new DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      }),

      // Error log file
      new DailyRotateFile({
        filename: 'logs/error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        )
      })
    ];

    // Add Elasticsearch transport if configured
    if (process.env.ELASTICSEARCH_URL) {
      transports.push(new ElasticsearchTransport({
        level: 'info',
        clientOpts: {
          node: process.env.ELASTICSEARCH_URL,
          auth: process.env.ELASTICSEARCH_AUTH ? {
            username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
            password: process.env.ELASTICSEARCH_PASSWORD || ''
          } : undefined
        },
        index: 'stellarrec-logs',
        indexTemplate: {
          name: 'stellarrec-logs-template',
          pattern: 'stellarrec-logs-*',
          settings: {
            number_of_shards: 1,
            number_of_replicas: 0
          },
          mappings: {
            properties: {
              '@timestamp': { type: 'date' },
              level: { type: 'keyword' },
              message: { type: 'text' },
              service: { type: 'keyword' },
              userId: { type: 'keyword' },
              requestId: { type: 'keyword' }
            }
          }
        }
      }));
    }

    this.centralLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports,
      exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/exceptions.log' })
      ],
      rejectionHandlers: [
        new winston.transports.File({ filename: 'logs/rejections.log' })
      ]
    });
  }

  private initializeElasticsearch(): void {
    if (process.env.ELASTICSEARCH_URL) {
      this.elasticsearchClient = new Client({
        node: process.env.ELASTICSEARCH_URL,
        auth: process.env.ELASTICSEARCH_AUTH ? {
          username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
          password: process.env.ELASTICSEARCH_PASSWORD || ''
        } : undefined
      });
    }
  }

  private setupServiceLoggers(): void {
    // Pre-create loggers for known services
    const services = [
      'user-service', 'application-service', 'ai-service',
      'notification-service', 'reminder-service', 'predictive-analytics'
    ];

    services.forEach(service => {
      this.services.set(service, this.createServiceLogger(service));
    });
  }

  private createServiceLogger(serviceName: string): winston.Logger {
    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.label({ label: serviceName }),
        winston.format.json()
      ),
      transports: [
        new DailyRotateFile({
          filename: `logs/${serviceName}-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d'
        })
      ]
    });
  }

  private async storeLogEntry(entry: LogEntry): Promise<void> {
    try {
      await prisma.logEntry.create({
        data: {
          id: entry.id!,
          timestamp: entry.timestamp,
          level: entry.level,
          message: entry.message,
          service: entry.service,
          userId: entry.userId,
          requestId: entry.requestId,
          metadata: entry.metadata || {},
          stack: entry.stack,
          duration: entry.duration
        }
      });
    } catch (error) {
      console.error('Error storing log entry:', error);
    }
  }

  private async queryElasticsearch(query: LogQuery): Promise<any> {
    if (!this.elasticsearchClient) {
      throw new Error('Elasticsearch not configured');
    }

    const esQuery: any = {
      bool: {
        must: []
      }
    };

    if (query.service) {
      esQuery.bool.must.push({ term: { service: query.service } });
    }

    if (query.level) {
      esQuery.bool.must.push({ term: { level: query.level } });
    }

    if (query.userId) {
      esQuery.bool.must.push({ term: { userId: query.userId } });
    }

    if (query.search) {
      esQuery.bool.must.push({
        multi_match: {
          query: query.search,
          fields: ['message', 'metadata.*']
        }
      });
    }

    if (query.startTime || query.endTime) {
      const range: any = {};
      if (query.startTime) range.gte = query.startTime;
      if (query.endTime) range.lte = query.endTime;
      esQuery.bool.must.push({ range: { '@timestamp': range } });
    }

    const response = await this.elasticsearchClient.search({
      index: 'stellarrec-logs-*',
      body: {
        query: esQuery,
        sort: [{ '@timestamp': { order: 'desc' } }],
        size: query.limit || 100,
        from: query.offset || 0
      }
    });

    return {
      logs: response.body.hits.hits.map((hit: any) => hit._source),
      total: response.body.hits.total.value
    };
  }

  private async queryDatabase(query: LogQuery): Promise<any> {
    const whereClause: any = {};

    if (query.service) whereClause.service = query.service;
    if (query.level) whereClause.level = query.level;
    if (query.userId) whereClause.userId = query.userId;
    if (query.requestId) whereClause.requestId = query.requestId;

    if (query.startTime || query.endTime) {
      whereClause.timestamp = {};
      if (query.startTime) whereClause.timestamp.gte = query.startTime;
      if (query.endTime) whereClause.timestamp.lte = query.endTime;
    }

    if (query.search) {
      whereClause.message = {
        contains: query.search,
        mode: 'insensitive'
      };
    }

    const [logs, total] = await Promise.all([
      prisma.logEntry.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: query.limit || 100,
        skip: query.offset || 0
      }),
      prisma.logEntry.count({ where: whereClause })
    ]);

    return { logs, total };
  }

  private async getElasticsearchAggregations(
    startTime: Date,
    services?: string[]
  ): Promise<LogAggregation[]> {
    // Implementation for Elasticsearch aggregations
    return [];
  }

  private async getDatabaseAggregations(
    startTime: Date,
    services?: string[]
  ): Promise<LogAggregation[]> {
    const whereClause: any = {
      timestamp: { gte: startTime }
    };

    if (services && services.length > 0) {
      whereClause.service = { in: services };
    }

    const aggregations = await prisma.logEntry.groupBy({
      by: ['service', 'level'],
      where: whereClause,
      _count: {
        level: true
      }
    });

    return aggregations.map(agg => ({
      service: agg.service,
      level: agg.level,
      count: agg._count.level,
      timeframe: 'day'
    }));
  }

  private async collectServiceLogs(serviceName: string): Promise<void> {
    try {
      const servicePort = this.getServicePort(serviceName);
      const response = await axios.get(`http://localhost:${servicePort}/health`, {
        timeout: 5000
      });

      // Log service health status
      await this.logEntry({
        level: 'info',
        message: `Service health check`,
        service: serviceName,
        metadata: {
          status: response.status,
          data: response.data
        }
      });

    } catch (error) {
      await this.logEntry({
        level: 'error',
        message: `Service health check failed`,
        service: serviceName,
        metadata: {
          error: error.message
        }
      });
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

  private getTimeframeStart(timeframe: 'hour' | 'day' | 'week' | 'month'): Date {
    const now = new Date();
    switch (timeframe) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  private processTrendsData(trends: any[]): Array<{
    timestamp: Date;
    errorCount: number;
    warnCount: number;
    service: string;
  }> {
    const processedData: Map<string, {
      timestamp: Date;
      errorCount: number;
      warnCount: number;
      service: string;
    }> = new Map();

    trends.forEach(trend => {
      const key = trend.service;
      if (!processedData.has(key)) {
        processedData.set(key, {
          timestamp: new Date(),
          errorCount: 0,
          warnCount: 0,
          service: trend.service
        });
      }

      const data = processedData.get(key)!;
      if (trend.level === 'error') {
        data.errorCount = trend._count.level;
      } else if (trend.level === 'warn') {
        data.warnCount = trend._count.level;
      }
    });

    return Array.from(processedData.values());
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}