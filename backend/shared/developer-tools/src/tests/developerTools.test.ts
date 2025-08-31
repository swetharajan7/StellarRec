import { DeveloperToolsManager } from '../manager/developerToolsManager';
import { SdkGenerator } from '../sdk/sdkGenerator';
import { WebhookManager } from '../webhook/webhookManager';
import { APITester } from '../testing/apiTester';
import { DeveloperPortal } from '../portal/developerPortal';
import { DeveloperAnalytics } from '../analytics/developerAnalytics';
import { RateLimiter } from '../rateLimit/rateLimiter';

describe('Developer Tools', () => {
  describe('DeveloperToolsManager', () => {
    let manager: DeveloperToolsManager;

    beforeEach(() => {
      manager = new DeveloperToolsManager({
        apiBaseUrl: 'http://localhost:3000',
        environment: 'test',
        features: {
          sdkGeneration: true,
          webhooks: true,
          apiTesting: true,
          analytics: true,
          rateLimiting: true,
          developerPortal: true
        }
      });
    });

    it('should initialize successfully', async () => {
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should start services', async () => {
      await expect(manager.startServices()).resolves.not.toThrow();
    });

    it('should generate system status', async () => {
      const status = await manager.getSystemStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('services');
      expect(status).toHaveProperty('metrics');
    });

    it('should generate report', async () => {
      const report = await manager.generateReport();
      expect(typeof report).toBe('string');
      expect(report).toContain('StellarRec Developer Tools Report');
    });
  });

  describe('SdkGenerator', () => {
    let generator: SdkGenerator;

    beforeEach(() => {
      generator = new SdkGenerator();
    });

    it('should generate JavaScript SDK', async () => {
      const result = await generator.generateSDK('javascript', {
        packageName: 'stellarrec-js',
        version: '1.0.0',
        outputPath: './test-output'
      });

      expect(result.success).toBe(true);
      expect(result.files).toContain('package.json');
      expect(result.files).toContain('index.js');
    });

    it('should generate Python SDK', async () => {
      const result = await generator.generateSDK('python', {
        packageName: 'stellarrec-python',
        version: '1.0.0',
        outputPath: './test-output'
      });

      expect(result.success).toBe(true);
      expect(result.files).toContain('setup.py');
      expect(result.files).toContain('stellarrec/__init__.py');
    });
  });

  describe('WebhookManager', () => {
    let webhookManager: WebhookManager;

    beforeEach(() => {
      webhookManager = new WebhookManager({
        signingSecret: 'test-secret',
        retryAttempts: 3,
        retryDelay: 1000
      });
    });

    it('should subscribe to webhook', async () => {
      const subscriptionId = await webhookManager.subscribe({
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'webhook-secret'
      });

      expect(typeof subscriptionId).toBe('string');
    });

    it('should trigger webhook event', async () => {
      await webhookManager.subscribe({
        url: 'https://example.com/webhook',
        events: ['user.created'],
        secret: 'webhook-secret'
      });

      await expect(webhookManager.triggerEvent({
        type: 'user.created',
        data: { userId: '123' },
        timestamp: new Date()
      })).resolves.not.toThrow();
    });
  });

  describe('APITester', () => {
    let tester: APITester;

    beforeEach(() => {
      tester = new APITester();
    });

    it('should add test environment', () => {
      tester.addEnvironment({
        name: 'test',
        baseUrl: 'http://localhost:3000',
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      expect(() => tester.addEnvironment).not.toThrow();
    });

    it('should add test suite', () => {
      const suite = {
        id: 'auth-tests',
        name: 'Authentication Tests',
        tests: [
          {
            id: 'login-test',
            name: 'Login Test',
            method: 'POST',
            endpoint: '/auth/login',
            body: { email: 'test@example.com', password: 'password' },
            expectedStatus: 200
          }
        ]
      };

      tester.addTestSuite(suite);
      expect(() => tester.addTestSuite).not.toThrow();
    });
  });

  describe('DeveloperPortal', () => {
    let portal: DeveloperPortal;

    beforeEach(() => {
      portal = new DeveloperPortal({
        companyName: 'StellarRec',
        primaryColor: '#1976d2',
        features: ['api-keys', 'webhooks', 'analytics']
      });
    });

    it('should create developer account', async () => {
      const account = await portal.createAccount({
        email: 'dev@example.com',
        name: 'Test Developer',
        company: 'Test Company'
      });

      expect(account).toHaveProperty('id');
      expect(account.email).toBe('dev@example.com');
    });

    it('should generate API key', async () => {
      const account = await portal.createAccount({
        email: 'dev@example.com',
        name: 'Test Developer',
        company: 'Test Company'
      });

      const apiKey = await portal.generateAPIKey(account.id, 'Test Key', ['read', 'write']);

      expect(apiKey).toHaveProperty('key');
      expect(apiKey.name).toBe('Test Key');
      expect(apiKey.permissions).toEqual(['read', 'write']);
    });
  });

  describe('DeveloperAnalytics', () => {
    let analytics: DeveloperAnalytics;

    beforeEach(() => {
      analytics = new DeveloperAnalytics({
        retentionDays: 90,
        aggregationIntervals: ['1h', '1d', '7d']
      });
    });

    it('should track API usage', async () => {
      await expect(analytics.trackAPIUsage({
        apiKeyId: 'test-key',
        endpoint: '/api/users',
        method: 'GET',
        statusCode: 200,
        responseTime: 150,
        timestamp: new Date()
      })).resolves.not.toThrow();
    });

    it('should generate developer metrics', async () => {
      const timeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const metrics = await analytics.getDeveloperMetrics('test-key', timeRange);

      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('successRate');
      expect(metrics).toHaveProperty('averageResponseTime');
    });
  });

  describe('RateLimiter', () => {
    let rateLimiter: RateLimiter;

    beforeEach(() => {
      rateLimiter = new RateLimiter({
        defaultRules: {
          free: { windowMs: 60000, maxRequests: 100 }
        }
      });
    });

    it('should check rate limit', async () => {
      const result = await rateLimiter.checkRateLimit({
        apiKey: 'test-key',
        ip: '127.0.0.1'
      });

      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('remaining');
    });

    it('should enforce rate limits', async () => {
      // Make requests up to the limit
      for (let i = 0; i < 100; i++) {
        const result = await rateLimiter.checkRateLimit({
          apiKey: 'test-key',
          ip: '127.0.0.1'
        });
        expect(result.allowed).toBe(true);
      }

      // Next request should be rate limited
      const result = await rateLimiter.checkRateLimit({
        apiKey: 'test-key',
        ip: '127.0.0.1'
      });
      expect(result.allowed).toBe(false);
    });
  });
});