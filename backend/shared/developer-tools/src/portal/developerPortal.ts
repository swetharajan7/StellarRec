import { DeveloperPortalConfig, DeveloperAccount, APIKey, UsageMetrics } from '../types';
import crypto from 'crypto';

export class DeveloperPortal {
  private accounts: Map<string, DeveloperAccount> = new Map();
  private apiKeys: Map<string, APIKey> = new Map();
  private usageMetrics: Map<string, UsageMetrics[]> = new Map();

  constructor(private config: DeveloperPortalConfig) {}

  async createAccount(accountData: Omit<DeveloperAccount, 'id' | 'createdAt' | 'apiKeys'>): Promise<DeveloperAccount> {
    const account: DeveloperAccount = {
      ...accountData,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      apiKeys: [],
    };

    this.accounts.set(account.id, account);
    return account;
  }

  async generateAPIKey(accountId: string, name: string, permissions: string[]): Promise<APIKey> {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error('Account not found');
    }

    const apiKey: APIKey = {
      id: crypto.randomUUID(),
      key: this.generateSecureKey(),
      name,
      accountId,
      permissions,
      isActive: true,
      createdAt: new Date(),
      lastUsed: null,
    };

    this.apiKeys.set(apiKey.key, apiKey);
    account.apiKeys.push(apiKey.id);

    return apiKey;
  }

  async revokeAPIKey(keyId: string): Promise<boolean> {
    const apiKey = Array.from(this.apiKeys.values()).find(k => k.id === keyId);
    if (!apiKey) {
      return false;
    }

    apiKey.isActive = false;
    return true;
  }

  async validateAPIKey(key: string): Promise<APIKey | null> {
    const apiKey = this.apiKeys.get(key);
    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    // Update last used timestamp
    apiKey.lastUsed = new Date();
    return apiKey;
  }

  async recordUsage(apiKey: string, endpoint: string, method: string, statusCode: number, responseTime: number): Promise<void> {
    const key = this.apiKeys.get(apiKey);
    if (!key) {
      return;
    }

    const usage: UsageMetrics = {
      apiKey: key.id,
      endpoint,
      method,
      statusCode,
      responseTime,
      timestamp: new Date(),
    };

    const keyUsage = this.usageMetrics.get(key.id) || [];
    keyUsage.push(usage);
    this.usageMetrics.set(key.id, keyUsage);
  }

  async getUsageMetrics(apiKeyId: string, startDate?: Date, endDate?: Date): Promise<UsageMetrics[]> {
    const usage = this.usageMetrics.get(apiKeyId) || [];
    
    if (!startDate && !endDate) {
      return usage;
    }

    return usage.filter(u => {
      if (startDate && u.timestamp < startDate) return false;
      if (endDate && u.timestamp > endDate) return false;
      return true;
    });
  }

  async getUsageSummary(apiKeyId: string, period: 'day' | 'week' | 'month' = 'day'): Promise<any> {
    const usage = await this.getUsageMetrics(apiKeyId);
    
    const summary = {
      totalRequests: usage.length,
      successfulRequests: usage.filter(u => u.statusCode >= 200 && u.statusCode < 300).length,
      errorRequests: usage.filter(u => u.statusCode >= 400).length,
      averageResponseTime: usage.reduce((sum, u) => sum + u.responseTime, 0) / usage.length || 0,
      topEndpoints: this.getTopEndpoints(usage),
      requestsByStatus: this.groupByStatus(usage),
    };

    return summary;
  }

  private getTopEndpoints(usage: UsageMetrics[]): Array<{ endpoint: string; count: number }> {
    const endpointCounts = usage.reduce((acc, u) => {
      acc[u.endpoint] = (acc[u.endpoint] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(endpointCounts)
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private groupByStatus(usage: UsageMetrics[]): Record<string, number> {
    return usage.reduce((acc, u) => {
      const statusGroup = Math.floor(u.statusCode / 100) * 100;
      const key = `${statusGroup}xx`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private generateSecureKey(): string {
    return `sk_${crypto.randomBytes(32).toString('hex')}`;
  }

  async getAccount(accountId: string): Promise<DeveloperAccount | null> {
    return this.accounts.get(accountId) || null;
  }

  async getAccountByEmail(email: string): Promise<DeveloperAccount | null> {
    return Array.from(this.accounts.values()).find(a => a.email === email) || null;
  }

  async listAPIKeys(accountId: string): Promise<APIKey[]> {
    const account = this.accounts.get(accountId);
    if (!account) {
      return [];
    }

    return account.apiKeys
      .map(keyId => Array.from(this.apiKeys.values()).find(k => k.id === keyId))
      .filter(Boolean) as APIKey[];
  }
}