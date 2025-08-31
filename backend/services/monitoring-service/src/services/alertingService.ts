import nodemailer from 'nodemailer';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { MetricsCollectionService } from './metricsCollectionService';
import { LoggingService } from './loggingService';

const prisma = new PrismaClient();

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  service?: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  timeWindow: number; // in minutes
  cooldown: number; // in minutes
  channels: string[]; // email, slack, webhook
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  service: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'resolved' | 'acknowledged';
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook';
  config: Record<string, any>;
  enabled: boolean;
}

export class AlertingService {
  private metricsService: MetricsCollectionService;
  private loggingService: LoggingService;
  private emailTransporter?: nodemailer.Transporter;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();

  constructor() {
    this.metricsService = new MetricsCollectionService();
    this.loggingService = new LoggingService();
    this.initializeEmailTransporter();
    this.loadAlertRules();
    this.startAlertEvaluation();
  }

  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    try {
      const alertRule: AlertRule = {
        ...rule,
        id: this.generateId()
      };

      // Store in database
      await prisma.alertRule.create({
        data: {
          id: alertRule.id,
          name: alertRule.name,
          description: alertRule.description,
          condition: alertRule.condition,
          threshold: alertRule.threshold,
          severity: alertRule.severity,
          enabled: alertRule.enabled,
          service: alertRule.service,
          metric: alertRule.metric,
          operator: alertRule.operator,
          timeWindow: alertRule.timeWindow,
          cooldown: alertRule.cooldown,
          channels: alertRule.channels
        }
      });

      this.alertRules.set(alertRule.id, alertRule);
      
      await this.loggingService.logEntry({
        level: 'info',
        message: `Alert rule created: ${alertRule.name}`,
        service: 'monitoring-service',
        metadata: { ruleId: alertRule.id }
      });

      return alertRule;

    } catch (error) {
      logger.error('Error creating alert rule:', error);
      throw new Error(`Failed to create alert rule: ${error.message}`);
    }
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    try {
      const existingRule = this.alertRules.get(id);
      if (!existingRule) {
        throw new Error('Alert rule not found');
      }

      const updatedRule = { ...existingRule, ...updates };
      
      await prisma.alertRule.update({
        where: { id },
        data: {
          name: updatedRule.name,
          description: updatedRule.description,
          condition: updatedRule.condition,
          threshold: updatedRule.threshold,
          severity: updatedRule.severity,
          enabled: updatedRule.enabled,
          service: updatedRule.service,
          metric: updatedRule.metric,
          operator: updatedRule.operator,
          timeWindow: updatedRule.timeWindow,
          cooldown: updatedRule.cooldown,
          channels: updatedRule.channels
        }
      });

      this.alertRules.set(id, updatedRule);

      await this.loggingService.logEntry({
        level: 'info',
        message: `Alert rule updated: ${updatedRule.name}`,
        service: 'monitoring-service',
        metadata: { ruleId: id }
      });

      return updatedRule;

    } catch (error) {
      logger.error('Error updating alert rule:', error);
      throw new Error(`Failed to update alert rule: ${error.message}`);
    }
  }

  async deleteAlertRule(id: string): Promise<void> {
    try {
      const rule = this.alertRules.get(id);
      if (!rule) {
        throw new Error('Alert rule not found');
      }

      await prisma.alertRule.delete({
        where: { id }
      });

      this.alertRules.delete(id);

      await this.loggingService.logEntry({
        level: 'info',
        message: `Alert rule deleted: ${rule.name}`,
        service: 'monitoring-service',
        metadata: { ruleId: id }
      });

    } catch (error) {
      logger.error('Error deleting alert rule:', error);
      throw new Error(`Failed to delete alert rule: ${error.message}`);
    }
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return Array.from(this.alertRules.values());
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values());
  }

  async getAlertHistory(
    limit: number = 100,
    offset: number = 0
  ): Promise<{ alerts: Alert[]; total: number }> {
    try {
      const [alerts, total] = await Promise.all([
        prisma.alert.findMany({
          orderBy: { triggeredAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.alert.count()
      ]);

      return {
        alerts: alerts.map(alert => ({
          id: alert.id,
          ruleId: alert.ruleId,
          ruleName: alert.ruleName,
          service: alert.service,
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold,
          severity: alert.severity as Alert['severity'],
          status: alert.status as Alert['status'],
          triggeredAt: alert.triggeredAt,
          resolvedAt: alert.resolvedAt,
          acknowledgedAt: alert.acknowledgedAt,
          acknowledgedBy: alert.acknowledgedBy,
          message: alert.message,
          metadata: alert.metadata as Record<string, any>
        })),
        total
      };

    } catch (error) {
      logger.error('Error getting alert history:', error);
      throw new Error(`Failed to get alert history: ${error.message}`);
    }
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = acknowledgedBy;

      await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'acknowledged',
          acknowledgedAt: alert.acknowledgedAt,
          acknowledgedBy
        }
      });

      await this.loggingService.logEntry({
        level: 'info',
        message: `Alert acknowledged: ${alert.ruleName}`,
        service: 'monitoring-service',
        metadata: { alertId, acknowledgedBy }
      });

    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      throw new Error(`Failed to acknowledge alert: ${error.message}`);
    }
  }

  async resolveAlert(alertId: string): Promise<void> {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      alert.status = 'resolved';
      alert.resolvedAt = new Date();

      await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'resolved',
          resolvedAt: alert.resolvedAt
        }
      });

      this.activeAlerts.delete(alertId);

      await this.loggingService.logEntry({
        level: 'info',
        message: `Alert resolved: ${alert.ruleName}`,
        service: 'monitoring-service',
        metadata: { alertId }
      });

    } catch (error) {
      logger.error('Error resolving alert:', error);
      throw new Error(`Failed to resolve alert: ${error.message}`);
    }
  }

  private async loadAlertRules(): Promise<void> {
    try {
      const rules = await prisma.alertRule.findMany({
        where: { enabled: true }
      });

      rules.forEach(rule => {
        this.alertRules.set(rule.id, {
          id: rule.id,
          name: rule.name,
          description: rule.description,
          condition: rule.condition,
          threshold: rule.threshold,
          severity: rule.severity as AlertRule['severity'],
          enabled: rule.enabled,
          service: rule.service,
          metric: rule.metric,
          operator: rule.operator as AlertRule['operator'],
          timeWindow: rule.timeWindow,
          cooldown: rule.cooldown,
          channels: rule.channels
        });
      });

      logger.info(`Loaded ${rules.length} alert rules`);

    } catch (error) {
      logger.error('Error loading alert rules:', error);
    }
  }

  private startAlertEvaluation(): void {
    // Evaluate alerts every 30 seconds
    setInterval(async () => {
      try {
        await this.evaluateAlerts();
      } catch (error) {
        logger.error('Error evaluating alerts:', error);
      }
    }, 30000);
  }

  private async evaluateAlerts(): Promise<void> {
    try {
      const serviceMetrics = await this.metricsService.collectMetrics();
      
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) continue;

        // Check cooldown
        const lastAlert = this.lastAlertTime.get(rule.id);
        if (lastAlert && Date.now() - lastAlert.getTime() < rule.cooldown * 60 * 1000) {
          continue;
        }

        // Evaluate rule condition
        const shouldAlert = await this.evaluateRule(rule, serviceMetrics);
        
        if (shouldAlert) {
          await this.triggerAlert(rule, serviceMetrics);
        }
      }

    } catch (error) {
      logger.error('Error in alert evaluation:', error);
    }
  }

  private async evaluateRule(rule: AlertRule, serviceMetrics: any[]): Promise<boolean> {
    try {
      // Find relevant metrics
      const relevantMetrics = rule.service 
        ? serviceMetrics.filter(m => m.service === rule.service)
        : serviceMetrics;

      if (relevantMetrics.length === 0) {
        return false;
      }

      // Get metric value
      let metricValue: number;
      switch (rule.metric) {
        case 'error_rate':
          metricValue = relevantMetrics.reduce((sum, m) => {
            return sum + (m.requestCount > 0 ? (m.errorCount / m.requestCount) * 100 : 0);
          }, 0) / relevantMetrics.length;
          break;
        case 'response_time':
          metricValue = relevantMetrics.reduce((sum, m) => sum + m.responseTime, 0) / relevantMetrics.length;
          break;
        case 'uptime':
          metricValue = relevantMetrics.filter(m => m.uptime > 0).length / relevantMetrics.length * 100;
          break;
        case 'cpu':
          metricValue = relevantMetrics.reduce((sum, m) => sum + m.cpu, 0) / relevantMetrics.length;
          break;
        case 'memory':
          metricValue = relevantMetrics.reduce((sum, m) => sum + m.memory, 0) / relevantMetrics.length;
          break;
        default:
          return false;
      }

      // Evaluate condition
      switch (rule.operator) {
        case 'gt':
          return metricValue > rule.threshold;
        case 'gte':
          return metricValue >= rule.threshold;
        case 'lt':
          return metricValue < rule.threshold;
        case 'lte':
          return metricValue <= rule.threshold;
        case 'eq':
          return metricValue === rule.threshold;
        default:
          return false;
      }

    } catch (error) {
      logger.error('Error evaluating rule:', error);
      return false;
    }
  }

  private async triggerAlert(rule: AlertRule, serviceMetrics: any[]): Promise<void> {
    try {
      const alert: Alert = {
        id: this.generateId(),
        ruleId: rule.id,
        ruleName: rule.name,
        service: rule.service || 'all',
        metric: rule.metric,
        value: 0, // Will be calculated
        threshold: rule.threshold,
        severity: rule.severity,
        status: 'active',
        triggeredAt: new Date(),
        message: `Alert triggered: ${rule.name} - ${rule.description}`
      };

      // Store alert
      await prisma.alert.create({
        data: {
          id: alert.id,
          ruleId: alert.ruleId,
          ruleName: alert.ruleName,
          service: alert.service,
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold,
          severity: alert.severity,
          status: alert.status,
          triggeredAt: alert.triggeredAt,
          message: alert.message,
          metadata: alert.metadata || {}
        }
      });

      this.activeAlerts.set(alert.id, alert);
      this.lastAlertTime.set(rule.id, new Date());

      // Send notifications
      await this.sendNotifications(alert, rule);

      await this.loggingService.logEntry({
        level: 'error',
        message: `Alert triggered: ${rule.name}`,
        service: 'monitoring-service',
        metadata: { alertId: alert.id, ruleId: rule.id }
      });

    } catch (error) {
      logger.error('Error triggering alert:', error);
    }
  }

  private async sendNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    for (const channel of rule.channels) {
      try {
        switch (channel) {
          case 'email':
            await this.sendEmailNotification(alert);
            break;
          case 'slack':
            await this.sendSlackNotification(alert);
            break;
          case 'webhook':
            await this.sendWebhookNotification(alert);
            break;
        }
      } catch (error) {
        logger.error(`Error sending ${channel} notification:`, error);
      }
    }
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    if (!this.emailTransporter) {
      logger.warn('Email transporter not configured');
      return;
    }

    const subject = `[${alert.severity.toUpperCase()}] StellarRec Alert: ${alert.ruleName}`;
    const html = `
      <h2>Alert Triggered</h2>
      <p><strong>Service:</strong> ${alert.service}</p>
      <p><strong>Metric:</strong> ${alert.metric}</p>
      <p><strong>Value:</strong> ${alert.value}</p>
      <p><strong>Threshold:</strong> ${alert.threshold}</p>
      <p><strong>Severity:</strong> ${alert.severity}</p>
      <p><strong>Time:</strong> ${alert.triggeredAt.toISOString()}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
    `;

    await this.emailTransporter.sendMail({
      from: process.env.ALERT_EMAIL_FROM || 'alerts@stellarrec.com',
      to: process.env.ALERT_EMAIL_TO || 'admin@stellarrec.com',
      subject,
      html
    });
  }

  private async sendSlackNotification(alert: Alert): Promise<void> {
    if (!process.env.SLACK_WEBHOOK_URL) {
      logger.warn('Slack webhook URL not configured');
      return;
    }

    const color = {
      low: '#36a64f',
      medium: '#ff9500',
      high: '#ff0000',
      critical: '#8b0000'
    }[alert.severity];

    const payload = {
      text: `Alert Triggered: ${alert.ruleName}`,
      attachments: [{
        color,
        fields: [
          { title: 'Service', value: alert.service, short: true },
          { title: 'Metric', value: alert.metric, short: true },
          { title: 'Value', value: alert.value.toString(), short: true },
          { title: 'Threshold', value: alert.threshold.toString(), short: true },
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Time', value: alert.triggeredAt.toISOString(), short: true }
        ],
        text: alert.message
      }]
    };

    await axios.post(process.env.SLACK_WEBHOOK_URL, payload);
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    if (!process.env.ALERT_WEBHOOK_URL) {
      logger.warn('Alert webhook URL not configured');
      return;
    }

    await axios.post(process.env.ALERT_WEBHOOK_URL, {
      type: 'alert',
      alert
    });
  }

  private initializeEmailTransporter(): void {
    if (process.env.SMTP_HOST) {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}