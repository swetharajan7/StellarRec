// Service Orchestration Types
export interface ServiceConfig {
  name: string;
  url: string;
  healthEndpoint: string;
  dependencies: string[];
  startupTimeout: number;
  critical: boolean;
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'unhealthy';
  lastCheck: Date;
  uptime: number;
  errorCount: number;
}

export interface OrchestrationResult {
  success: boolean;
  startedServices: string[];
  failedServices: Array<{ name: string; error: string }>;
  warnings: string[];
  totalTime: number;
}

// Integration Testing Types
export interface IntegrationTestSuite {
  name: string;
  tests: Array<() => Promise<TestResult>>;
}

export interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  data?: any;
  error?: string;
  timestamp: Date;
}

export interface UserWorkflowTest {
  name: string;
  description: string;
  steps: TestStep[];
}

export interface TestStep {
  name: string;
  action: string;
  endpoint: string;
  method: string;
  payload?: any;
  expectedStatus: number;
  validation?: (response: any) => boolean;
}

// Data Consistency Types
export interface ConsistencyCheck {
  name: string;
  description: string;
  validator: () => Promise<ValidationResult>;
}

export interface ValidationResult {
  name: string;
  description: string;
  passed: boolean;
  duration: number;
  issues?: string[];
  recommendations?: string[];
  error?: string;
  timestamp: Date;
}

export interface DataIntegrityReport {
  timestamp: Date;
  overallStatus: 'healthy' | 'issues_found' | 'critical_issues';
  checks: ValidationResult[];
  issues: string[];
  recommendations: string[];
}

// Load Testing Types
export interface LoadTestConfig {
  baseUrl: string;
  scenarios: LoadTestScenario[];
  globalSettings: {
    maxConcurrency: number;
    testDuration: number;
    rampUpTime: number;
  };
}

export interface LoadTestScenario {
  name: string;
  description: string;
  endpoint: string;
  method: string;
  concurrency: number;
  duration: number;
  rampUpTime: number;
  payload?: any;
  queryParams?: Record<string, any>;
  requiresAuth?: boolean;
  isFileUpload?: boolean;
}

export interface LoadTestResult {
  scenarioName: string;
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
  successRate: number;
  errorBreakdown: Record<string, number>;
  duration: number;
  concurrency: number;
  timestamp: Date;
}

// Security Testing Types
export interface SecurityTestSuite {
  name: string;
  description: string;
  tests: Array<() => Promise<SecurityTestResult>>;
}

export interface SecurityTestResult {
  testName: string;
  passed: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  description: string;
  vulnerability?: Vulnerability;
  error?: string;
  timestamp: Date;
}

export interface Vulnerability {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  endpoint: string;
  description: string;
  impact: string;
  recommendation: string;
}

export interface VulnerabilityReport {
  timestamp: Date;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  vulnerabilities: Vulnerability[];
  recommendations: string[];
  testResults: SecurityTestResult[];
}

// System Monitoring Types
export interface SystemHealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  details?: any;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
  };
  services: SystemHealthCheck[];
}

// Transaction Testing Types
export interface TransactionTest {
  name: string;
  description: string;
  steps: TransactionStep[];
  rollbackOnFailure: boolean;
}

export interface TransactionStep {
  service: string;
  operation: string;
  payload: any;
  expectedResult: any;
  rollbackOperation?: string;
}

export interface TransactionResult {
  testName: string;
  success: boolean;
  completedSteps: number;
  totalSteps: number;
  rollbackPerformed: boolean;
  error?: string;
  duration: number;
  timestamp: Date;
}

// Performance Testing Types
export interface PerformanceTest {
  name: string;
  endpoint: string;
  method: string;
  payload?: any;
  expectedResponseTime: number;
  acceptableResponseTime: number;
}

export interface PerformanceResult {
  testName: string;
  passed: boolean;
  responseTime: number;
  expectedTime: number;
  acceptableTime: number;
  performanceRating: 'excellent' | 'good' | 'acceptable' | 'poor';
  timestamp: Date;
}

// Error Handling Types
export interface ErrorScenario {
  name: string;
  description: string;
  trigger: () => Promise<any>;
  expectedBehavior: string;
  validator: (response: any) => boolean;
}

export interface ErrorHandlingResult {
  scenarioName: string;
  passed: boolean;
  actualBehavior: string;
  expectedBehavior: string;
  gracefulDegradation: boolean;
  timestamp: Date;
}

// Comprehensive Test Report Types
export interface ComprehensiveTestReport {
  timestamp: Date;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    passRate: number;
  };
  integrationTests: TestResult[];
  loadTests: LoadTestResult[];
  securityTests: SecurityTestResult[];
  dataConsistency: ValidationResult[];
  performanceTests: PerformanceResult[];
  recommendations: string[];
  overallStatus: 'pass' | 'fail' | 'warning';
}