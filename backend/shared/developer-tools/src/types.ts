export interface DeveloperToolsConfig {
  apiBaseUrl: string;
  portalUrl: string;
  webhookUrl: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  auth: AuthConfig;
  features: FeatureConfig;
}

export interface DatabaseConfig {
  url: string;
  ssl?: boolean;
  poolSize?: number;
}

export interface RedisConfig {
  url: string;
  keyPrefix?: string;
  ttl?: number;
}

export interface AuthConfig {
  jwtSecret: string;
  providers: ('github' | 'google' | 'email')[];
  sessionDuration: number;
}

export interface FeatureConfig {
  sdkGeneration: boolean;
  webhooks: boolean;
  rateLimiting: boolean;
  analytics: boolean;
  testing: boolean;
}

export interface SdkConfig {
  language: string;
  packageName: string;
  version: string;
  outputDir: string;
  author?: string;
  license?: string;
  repository?: string;
  dependencies?: Record<string, string>;
  templates?: Record<string, string>;
}

export interface WebhookConfig {
  signingSecret: string;
  retryAttempts: number;
  retryDelay: number;
  endpoint?: string;
  events?: string[];
  secret?: string;
  active?: boolean;
  timeout?: number;
}

export interface RateLimitConfig {
  defaultRules: Record<string, { windowMs: number; maxRequests: number }>;
  redis?: string;
  plans?: Record<string, RateLimitPlan>;
  defaultPlan?: string;
  headers?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitPlan {
  requests: number;
  window: string;
  burst?: number;
  scope?: 'global' | 'user' | 'ip';
}

export interface AnalyticsConfig {
  database: string;
  retention: string;
  aggregation: {
    intervals: string[];
    metrics: string[];
  };
  realtime: boolean;
}

export interface PortalConfig {
  port: number;
  host: string;
  database: string;
  redis: string;
  auth: AuthConfig;
  features: string[];
  customization: {
    logo?: string;
    primaryColor?: string;
    companyName?: string;
  };
}

export interface TestConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
  parallel: boolean;
  suites: string[];
}

export interface MockServerConfig {
  port: number;
  host: string;
  realistic: boolean;
  latency: {
    min: number;
    max: number;
  };
  errorRate: number;
  cors: boolean;
}

export interface LoadTestConfig {
  baseUrl: string;
  concurrent: number;
  duration: string;
  rampUp?: string;
  scenarios: LoadTestScenario[];
  metrics: string[];
}

export interface LoadTestScenario {
  name: string;
  endpoint: string;
  method: string;
  weight: number;
  headers?: Record<string, string>;
  body?: any;
  assertions?: LoadTestAssertion[];
}

export interface LoadTestAssertion {
  type: 'status' | 'response_time' | 'body_contains';
  value: any;
  operator?: 'eq' | 'lt' | 'gt' | 'contains';
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  userId: string;
  scopes: string[];
  plan: string;
  active: boolean;
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
  rateLimit: RateLimitPlan;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  version: string;
  attempt?: number;
  deliveredAt?: Date;
  failedAt?: Date;
  error?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  userId: string;
  createdAt: Date;
  lastDelivery?: Date;
  successCount: number;
  failureCount: number;
}

export interface UsageMetrics {
  apiKey: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ipAddress?: string;
  requestSize?: number;
  responseSize?: number;
}

export interface UsageStats {
  period: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    avgResponseTime: number;
  }>;
  errorBreakdown: Record<string, number>;
  timeSeriesData: Array<{
    timestamp: Date;
    requests: number;
    avgResponseTime: number;
  }>;
}

export interface TestResult {
  suite: string;
  test: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  assertions: TestAssertion[];
}

export interface TestAssertion {
  description: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
}

export interface LoadTestResult {
  scenario: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  errors: Record<string, number>;
}

export interface SdkTemplate {
  language: string;
  files: Record<string, string>;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
  metadata: {
    packageManager: string;
    buildCommand: string;
    testCommand: string;
    publishCommand: string;
  };
}

export interface DeveloperPortalUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: string;
  providerId: string;
  plan: string;
  apiKeys: ApiKey[];
  webhooks: WebhookEndpoint[];
  createdAt: Date;
  lastLogin: Date;
}

export interface PortalSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  ipAddress: string;
  userAgent: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  period: string;
  channels: string[];
  active: boolean;
  userId?: string;
  apiKey?: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata: Record<string, any>;
}

export interface SdkGenerationJob {
  id: string;
  language: string;
  config: SdkConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  outputPath?: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  event: WebhookEvent;
  url: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  error?: string;
  deliveredAt?: Date;
  createdAt: Date;
  webhookId?: string;
  eventId?: string;
  attempt?: number;
  responseStatus?: number;
  responseTime?: number;
  nextRetryAt?: Date;
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
  delay?: number;
}

export interface MockRule {
  method: string;
  path: string;
  response: MockResponse;
  condition?: (req: any) => boolean;
}

export interface CliConfig {
  apiKey?: string;
  baseUrl?: string;
  format?: 'json' | 'table' | 'csv';
  verbose?: boolean;
  profile?: string;
}

export interface CliCommand {
  name: string;
  description: string;
  options: CliOption[];
  action: (args: any, options: any) => Promise<void>;
}

export interface CliOption {
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  default?: any;
  choices?: string[];
}

// Additional types for developer tools components

export interface DeveloperAnalyticsConfig {
  retentionDays: number;
  aggregationIntervals: string[];
}

export interface APIUsageStats {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
}

export interface DeveloperMetrics {
  apiKeyId: string;
  timeRange: { start: Date; end: Date };
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  successRate: number;
  averageResponseTime: number;
  topEndpoints: Array<{ endpoint: string; count: number; avgResponseTime: number }>;
  errorBreakdown: Array<{ statusCode: number; count: number; percentage: number }>;
  requestsOverTime: Array<{ timestamp: Date; count: number }>;
  responseTimeDistribution: Array<{ range: string; count: number }>;
}

export interface ErrorAnalytics {
  apiKeyId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  errorMessage: string;
  timestamp: Date;
}

export interface DeveloperPortalConfig {
  companyName: string;
  primaryColor: string;
  features: string[];
}

export interface DeveloperAccount {
  id: string;
  email: string;
  name: string;
  company?: string;
  apiKeys: string[];
  createdAt: Date;
}

export interface APIKey {
  id: string;
  key: string;
  name: string;
  accountId: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date;
  lastUsed: Date | null;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter: number | null;
}

export interface RateLimitRule {
  id: string;
  name: string;
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: any) => string;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
}

export interface APITestSuite {
  id: string;
  name: string;
  tests: APITestCase[];
}

export interface APITestCase {
  id: string;
  name: string;
  method: string;
  endpoint: string;
  headers?: Record<string, string>;
  body?: any;
  expectedStatus?: number;
  assertions?: any[];
}

export interface APITestResult {
  testId: string;
  testName: string;
  passed: boolean;
  duration: number;
  response?: {
    status: number;
    headers: Record<string, string>;
    body: any;
  };
  assertions?: any[];
  error?: string;
  executedAt: Date;
}

export interface TestEnvironment {
  name: string;
  baseUrl: string;
  headers?: Record<string, string>;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret: string;
  createdAt: Date;
}