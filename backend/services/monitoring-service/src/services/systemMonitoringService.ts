import * as si from 'systeminformation';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { LoggingService } from './loggingService';

const prisma = new PrismaClient();

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    cores: number;
    speed: number;
    temperature?: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
  };
  load: {
    avg1: number;
    avg5: number;
    avg15: number;
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
  };
}

export interface SystemAlert {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  timestamp: Date;
  message: string;
}

export class SystemMonitoringService {
  private loggingService: LoggingService;
  private monitoringInterval?: NodeJS.Timeout;
  private systemMetrics: SystemMetrics[] = [];
  private isMonitoring: boolean = false;
  private thresholds: Map<string, { warning: number; critical: number }> = new Map();

  constructor() {
    this.loggingService = new LoggingService();
    this.initializeThresholds();
    this.loadSystemHistory();
  }

  async collectSystemMetrics(): Promise<SystemMetrics> {
    try {
      const timestamp = new Date();
      
      // Collect system information
      const [
        cpuData,
        memData,
        diskData,
        networkData,
        loadData,
        processData,
        tempData
      ] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        si.currentLoad(),
        si.processes(),
        si.cpuTemperature().catch(() => ({ main: null }))
      ]);

      // Process CPU data
      const cpu = {
        usage: loadData.currentLoad || 0,
        cores: cpuData.cores || 0,
        speed: cpuData.speed || 0,
        temperature: tempData.main || undefined
      };

      // Process memory data
      const memory = {
        total: Math.round(memData.total / 1024 / 1024), // MB
        used: Math.round(memData.used / 1024 / 1024), // MB
        free: Math.round(memData.free / 1024 / 1024), // MB
        usage: Math.round((memData.used / memData.total) * 100)
      };

      // Process disk data (primary disk)
      const primaryDisk = diskData[0] || { size: 0, used: 0, available: 0 };
      const disk = {
        total: Math.round(primaryDisk.size / 1024 / 1024 / 1024), // GB
        used: Math.round(primaryDisk.used / 1024 / 1024 / 1024), // GB
        free: Math.round(primaryDisk.available / 1024 / 1024 / 1024), // GB
        usage: Math.round((primaryDisk.used / primaryDisk.size) * 100)
      };

      // Process network data
      const primaryNetwork = networkData[0] || { rx_bytes: 0, tx_bytes: 0, rx_packets: 0, tx_packets: 0 };
      const network = {
        bytesIn: primaryNetwork.rx_bytes || 0,
        bytesOut: primaryNetwork.tx_bytes || 0,
        packetsIn: primaryNetwork.rx_packets || 0,
        packetsOut: primaryNetwork.tx_packets || 0
      };

      // Process load data
      const load = {
        avg1: loadData.avgLoad || 0,
        avg5: loadData.avgLoad || 0,
        avg15: loadData.avgLoad || 0
      };

      // Process data
      const processes = {
        total: processData.all || 0,
        running: processData.running || 0,
        sleeping: processData.sleeping || 0
      };

      const systemMetrics: SystemMetrics = {
        timestamp,
        cpu,
        memory,
        disk,
        network,
        load,
        processes
      };

      // Store metrics
      await this.storeSystemMetrics(systemMetrics);
      
      // Update cache
      this.updateSystemCache(systemMetrics);
      
      // Check thresholds
      await this.checkSystemThresholds(systemMetrics);

      return systemMetrics;

    } catch (error) {
      logger.error('Error collecting system metrics:', error);
      throw new Error(`Failed to collect system metrics: ${error.message}`);
    }
  }

  async getSystemMetrics(): Promise<SystemMetrics | null> {
    if (this.systemMetrics.length === 0) {
      return await this.collectSystemMetrics();
    }
    return this.systemMetrics[this.systemMetrics.length - 1];
  }

  async getSystemHistory(hours: number = 24): Promise<SystemMetrics[]> {
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const metrics = await prisma.systemMetrics.findMany({
        where: {
          timestamp: { gte: startTime }
        },
        orderBy: { timestamp: 'desc' },
        take: 1000
      });

      return metrics.map(m => ({
        timestamp: m.timestamp,
        cpu: {
          usage: m.cpuUsage,
          cores: m.cpuCores,
          speed: m.cpuSpeed,
          temperature: m.cpuTemperature
        },
        memory: {
          total: m.memoryTotal,
          used: m.memoryUsed,
          free: m.memoryFree,
          usage: m.memoryUsage
        },
        disk: {
          total: m.diskTotal,
          used: m.diskUsed,
          free: m.diskFree,
          usage: m.diskUsage
        },
        network: {
          bytesIn: m.networkBytesIn,
          bytesOut: m.networkBytesOut,
          packetsIn: m.networkPacketsIn,
          packetsOut: m.networkPacketsOut
        },
        load: {
          avg1: m.loadAvg1,
          avg5: m.loadAvg5,
          avg15: m.loadAvg15
        },
        processes: {
          total: m.processesTotal,
          running: m.processesRunning,
          sleeping: m.processesSleeping
        }
      }));

    } catch (error) {
      logger.error('Error getting system history:', error);
      throw new Error(`Failed to get system history: ${error.message}`);
    }
  }

  async getSystemOverview(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    loadAverage: number;
    activeProcesses: number;
    alerts: SystemAlert[];
  }> {
    try {
      const currentMetrics = await this.getSystemMetrics();
      if (!currentMetrics) {
        throw new Error('No system metrics available');
      }

      // Get system uptime
      const uptimeData = await si.time();
      const uptime = uptimeData.uptime || 0;

      // Determine overall status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      
      if (currentMetrics.cpu.usage > 90 || currentMetrics.memory.usage > 95 || currentMetrics.disk.usage > 95) {
        status = 'critical';
      } else if (currentMetrics.cpu.usage > 70 || currentMetrics.memory.usage > 80 || currentMetrics.disk.usage > 80) {
        status = 'warning';
      }

      // Get recent alerts
      const recentAlerts = await this.getRecentSystemAlerts();

      return {
        status,
        uptime,
        cpuUsage: currentMetrics.cpu.usage,
        memoryUsage: currentMetrics.memory.usage,
        diskUsage: currentMetrics.disk.usage,
        loadAverage: currentMetrics.load.avg1,
        activeProcesses: currentMetrics.processes.running,
        alerts: recentAlerts
      };

    } catch (error) {
      logger.error('Error getting system overview:', error);
      throw new Error(`Failed to get system overview: ${error.message}`);
    }
  }

  async setSystemThreshold(
    metric: string,
    warningThreshold: number,
    criticalThreshold: number
  ): Promise<void> {
    try {
      this.thresholds.set(metric, {
        warning: warningThreshold,
        critical: criticalThreshold
      });

      await prisma.systemThreshold.upsert({
        where: { metric },
        update: {
          warningThreshold,
          criticalThreshold
        },
        create: {
          metric,
          warningThreshold,
          criticalThreshold,
          enabled: true
        }
      });

      await this.loggingService.logEntry({
        level: 'info',
        message: `System threshold updated for ${metric}`,
        service: 'monitoring-service',
        metadata: { metric, warningThreshold, criticalThreshold }
      });

    } catch (error) {
      logger.error('Error setting system threshold:', error);
      throw new Error(`Failed to set system threshold: ${error.message}`);
    }
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('System monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    
    // Collect metrics every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        logger.error('Error in system monitoring cycle:', error);
      }
    }, 30000);

    // Perform initial collection
    this.collectSystemMetrics();
    
    logger.info('System monitoring started');
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    
    this.isMonitoring = false;
    logger.info('System monitoring stopped');
  }

  private async storeSystemMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      await prisma.systemMetrics.create({
        data: {
          id: this.generateId(),
          timestamp: metrics.timestamp,
          cpuUsage: metrics.cpu.usage,
          cpuCores: metrics.cpu.cores,
          cpuSpeed: metrics.cpu.speed,
          cpuTemperature: metrics.cpu.temperature,
          memoryTotal: metrics.memory.total,
          memoryUsed: metrics.memory.used,
          memoryFree: metrics.memory.free,
          memoryUsage: metrics.memory.usage,
          diskTotal: metrics.disk.total,
          diskUsed: metrics.disk.used,
          diskFree: metrics.disk.free,
          diskUsage: metrics.disk.usage,
          networkBytesIn: metrics.network.bytesIn,
          networkBytesOut: metrics.network.bytesOut,
          networkPacketsIn: metrics.network.packetsIn,
          networkPacketsOut: metrics.network.packetsOut,
          loadAvg1: metrics.load.avg1,
          loadAvg5: metrics.load.avg5,
          loadAvg15: metrics.load.avg15,
          processesTotal: metrics.processes.total,
          processesRunning: metrics.processes.running,
          processesSleeping: metrics.processes.sleeping
        }
      });

    } catch (error) {
      logger.error('Error storing system metrics:', error);
    }
  }

  private updateSystemCache(metrics: SystemMetrics): void {
    this.systemMetrics.push(metrics);
    
    // Keep only last 100 entries
    if (this.systemMetrics.length > 100) {
      this.systemMetrics.shift();
    }
  }

  private async checkSystemThresholds(metrics: SystemMetrics): Promise<void> {
    const checks = [
      { metric: 'cpu', value: metrics.cpu.usage },
      { metric: 'memory', value: metrics.memory.usage },
      { metric: 'disk', value: metrics.disk.usage },
      { metric: 'load', value: metrics.load.avg1 }
    ];

    for (const check of checks) {
      const threshold = this.thresholds.get(check.metric);
      if (!threshold) continue;

      let severity: 'warning' | 'critical' | null = null;
      let thresholdValue: number;

      if (check.value >= threshold.critical) {
        severity = 'critical';
        thresholdValue = threshold.critical;
      } else if (check.value >= threshold.warning) {
        severity = 'warning';
        thresholdValue = threshold.warning;
      }

      if (severity) {
        await this.triggerSystemAlert({
          metric: check.metric,
          value: check.value,
          threshold: thresholdValue,
          severity,
          timestamp: metrics.timestamp,
          message: `System ${check.metric} is ${check.value}% (threshold: ${thresholdValue}%)`
        });
      }
    }
  }

  private async triggerSystemAlert(alert: SystemAlert): Promise<void> {
    try {
      await this.loggingService.logEntry({
        level: alert.severity === 'critical' ? 'error' : 'warn',
        message: alert.message,
        service: 'monitoring-service',
        metadata: { alert }
      });

      // Store alert
      await prisma.systemAlert.create({
        data: {
          id: this.generateId(),
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold,
          severity: alert.severity,
          timestamp: alert.timestamp,
          message: alert.message
        }
      });

    } catch (error) {
      logger.error('Error triggering system alert:', error);
    }
  }

  private async getRecentSystemAlerts(): Promise<SystemAlert[]> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const alerts = await prisma.systemAlert.findMany({
        where: {
          timestamp: { gte: oneHourAgo }
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      return alerts.map(alert => ({
        metric: alert.metric,
        value: alert.value,
        threshold: alert.threshold,
        severity: alert.severity as SystemAlert['severity'],
        timestamp: alert.timestamp,
        message: alert.message
      }));

    } catch (error) {
      logger.error('Error getting recent system alerts:', error);
      return [];
    }
  }

  private initializeThresholds(): void {
    // Set default thresholds
    this.thresholds.set('cpu', { warning: 70, critical: 90 });
    this.thresholds.set('memory', { warning: 80, critical: 95 });
    this.thresholds.set('disk', { warning: 80, critical: 95 });
    this.thresholds.set('load', { warning: 2, critical: 4 });

    // Load custom thresholds from database
    this.loadThresholdsFromDatabase();
  }

  private async loadThresholdsFromDatabase(): Promise<void> {
    try {
      const thresholds = await prisma.systemThreshold.findMany({
        where: { enabled: true }
      });

      thresholds.forEach(threshold => {
        this.thresholds.set(threshold.metric, {
          warning: threshold.warningThreshold,
          critical: threshold.criticalThreshold
        });
      });

    } catch (error) {
      logger.error('Error loading thresholds from database:', error);
    }
  }

  private async loadSystemHistory(): Promise<void> {
    try {
      const recentMetrics = await prisma.systemMetrics.findMany({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        },
        orderBy: { timestamp: 'desc' },
        take: 60
      });

      this.systemMetrics = recentMetrics.map(m => ({
        timestamp: m.timestamp,
        cpu: {
          usage: m.cpuUsage,
          cores: m.cpuCores,
          speed: m.cpuSpeed,
          temperature: m.cpuTemperature
        },
        memory: {
          total: m.memoryTotal,
          used: m.memoryUsed,
          free: m.memoryFree,
          usage: m.memoryUsage
        },
        disk: {
          total: m.diskTotal,
          used: m.diskUsed,
          free: m.diskFree,
          usage: m.diskUsage
        },
        network: {
          bytesIn: m.networkBytesIn,
          bytesOut: m.networkBytesOut,
          packetsIn: m.networkPacketsIn,
          packetsOut: m.networkPacketsOut
        },
        load: {
          avg1: m.loadAvg1,
          avg5: m.loadAvg5,
          avg15: m.loadAvg15
        },
        processes: {
          total: m.processesTotal,
          running: m.processesRunning,
          sleeping: m.processesSleeping
        }
      }));

    } catch (error) {
      logger.error('Error loading system history:', error);
    }
  }

  private generateId(): string {
    return `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}