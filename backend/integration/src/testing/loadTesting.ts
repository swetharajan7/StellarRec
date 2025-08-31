import axios from 'axios';
import { performance } from 'perf_hooks';
import { Logger } from '../utils/logger';
import { LoadTestConfig, LoadTestResult, LoadTestScenario } from '../types';

export class LoadTesting {
  private logger = new Logger('LoadTesting');
  private baseUrl = 'http://localhost:3000';
  private results: LoadTestResult[] = [];

  async runLoadTests(): Promise<LoadTestResult[]> {
    this.logger.info('Starting comprehensive load testing...');

    const scenarios: LoadTestScenario[] = [
      {
        name: 'User Authentication Load',
        description: 'Test authentication endpoints under load',
        endpoint: '/api/auth/login',
        method: 'POST',
        concurrency: 50,
        duration: 60000, // 1 minute
        rampUpTime: 10000, // 10 seconds
        payload: {
          email: 'loadtest@example.com',
          password: 'TestPassword123!'
        }
      },
      {
        name: 'University Search Load',
        description: 'Test university search under high load',
        endpoint: '/api/universities/search',
        method: 'GET',
        concurrency: 100,
        duration: 120000, // 2 minutes
        rampUpTime: 15000, // 15 seconds
        queryParams: {
          query: 'computer science',
          location: 'California',
          limit: 20
        }
      },
      {
        name: 'AI Matching Load',
        description: 'Test AI matching algorithm under load',
        endpoint: '/api/ai/match',
        method: 'POST',
        concurrency: 30,
        duration: 180000, // 3 minutes
        rampUpTime: 20000, // 20 seconds
        requiresAuth: true,
        payload: {
          preferences: {
            majors: ['Computer Science', 'Engineering'],
            location: 'West Coast',
            size: 'medium'
          },
          academicProfile: {
            gpa: 3.7,
            satScore: 1450
          }
        }
      },
      {
        name: 'File Upload Load',
        description: 'Test file upload under concurrent load',
        endpoint: '/api/files/upload',
        method: 'POST',
        concurrency: 20,
        duration: 90000, // 1.5 minutes
        rampUpTime: 10000,
        requiresAuth: true,
        isFileUpload: true
      },
      {
        name: 'Essay Analysis Load',
        description: 'Test AI essay analysis under load',
        endpoint: '/api/ai/analyze-essay',
        method: 'POST',
        concurrency: 25,
        duration: 150000, // 2.5 minutes
        rampUpTime: 15000,
        requiresAuth: true,
        payload: {
          content: 'This is a sample essay for load testing the AI analysis system. It contains multiple sentences to provide adequate content for analysis.',
          type: 'personal_statement'
        }
      },
      {
        name: 'Dashboard Data Load',
        description: 'Test dashboard data retrieval under load',
        endpoint: '/api/dashboard/data',
        method: 'GET',
        concurrency: 75,
        duration: 60000,
        rampUpTime: 10000,
        requiresAuth: true
      }
    ];

    // Run each load test scenario
    for (const scenario of scenarios) {
      this.logger.info(`Running load test: ${scenario.name}`);
      
      try {
        const result = await this.runScenario(scenario);
        this.results.push(result);
        
        this.logger.info(`✅ ${scenario.name} completed`);
        this.logger.info(`   Requests: ${result.totalRequests}, Success Rate: ${result.successRate.toFixed(2)}%`);
        this.logger.info(`   Avg Response Time: ${result.avgResponseTime.toFixed(2)}ms`);
        
        // Wait between scenarios to avoid overwhelming the system
        await this.delay(30000); // 30 second break
        
      } catch (error) {
        this.logger.error(`❌ ${scenario.name} failed:`, error);
        
        this.results.push({
          scenarioName: scenario.name,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0,
          p50ResponseTime: 0,
          p95ResponseTime: 0,
          p99ResponseTime: 0,
          requestsPerSecond: 0,
          successRate: 0,
          errorBreakdown: {},
          duration: scenario.duration,
          concurrency: scenario.concurrency,
          timestamp: new Date()
        });
      }
    }

    this.generateLoadTestSummary();
    return this.results;
  }

  private async runScenario(scenario: LoadTestScenario): Promise<LoadTestResult> {
    const startTime = Date.now();
    const responseTimes: number[] = [];
    const errors: Record<string, number> = {};
    let successfulRequests = 0;
    let failedRequests = 0;
    let activeWorkers = 0;
    let totalRequests = 0;

    // Authentication token for scenarios that require it
    let authToken: string | null = null;
    if (scenario.requiresAuth) {
      authToken = await this.getAuthToken();
    }

    return new Promise((resolve) => {
      const workers: NodeJS.Timeout[] = [];
      const rampUpInterval = scenario.rampUpTime / scenario.concurrency;
      
      // Start workers with ramp-up
      for (let i = 0; i < scenario.concurrency; i++) {
        setTimeout(() => {
          const worker = this.createWorker(scenario, authToken, (result) => {
            totalRequests++;
            
            if (result.success) {
              successfulRequests++;
              responseTimes.push(result.responseTime);
            } else {
              failedRequests++;
              const errorKey = result.error || 'unknown';
              errors[errorKey] = (errors[errorKey] || 0) + 1;
            }
          });
          
          workers.push(worker);
          activeWorkers++;
        }, i * rampUpInterval);
      }

      // Stop all workers after duration
      setTimeout(() => {
        workers.forEach(worker => clearInterval(worker));
        
        const duration = Date.now() - startTime;
        const requestsPerSecond = totalRequests / (duration / 1000);
        
        // Calculate percentiles
        responseTimes.sort((a, b) => a - b);
        const p50 = this.calculatePercentile(responseTimes, 50);
        const p95 = this.calculatePercentile(responseTimes, 95);
        const p99 = this.calculatePercentile(responseTimes, 99);
        
        const result: LoadTestResult = {
          scenarioName: scenario.name,
          totalRequests,
          successfulRequests,
          failedRequests,
          avgResponseTime: responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
          minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
          maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
          p50ResponseTime: p50,
          p95ResponseTime: p95,
          p99ResponseTime: p99,
          requestsPerSecond,
          successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
          errorBreakdown: errors,
          duration,
          concurrency: scenario.concurrency,
          timestamp: new Date()
        };
        
        resolve(result);
      }, scenario.duration);
    });
  }

  private createWorker(
    scenario: LoadTestScenario,
    authToken: string | null,
    onResult: (result: { success: boolean; responseTime: number; error?: string }) => void
  ): NodeJS.Timeout {
    return setInterval(async () => {
      const requestStart = performance.now();
      
      try {
        const config: any = {
          method: scenario.method,
          url: `${this.baseUrl}${scenario.endpoint}`,
          timeout: 30000,
          headers: {}
        };

        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`;
        }

        if (scenario.payload) {
          config.data = scenario.payload;
        }

        if (scenario.queryParams) {
          config.params = scenario.queryParams;
        }

        if (scenario.isFileUpload) {
          // Create a mock file for upload testing
          const formData = new FormData();
          formData.append('file', new Blob(['test file content'], { type: 'text/plain' }), 'test.txt');
          config.data = formData;
          config.headers['Content-Type'] = 'multipart/form-data';
        }

        const response = await axios(config);
        const responseTime = performance.now() - requestStart;
        
        onResult({
          success: response.status >= 200 && response.status < 300,
          responseTime
        });
        
      } catch (error) {
        const responseTime = performance.now() - requestStart;
        let errorMessage = 'unknown';
        
        if (axios.isAxiosError(error)) {
          if (error.response) {
            errorMessage = `HTTP ${error.response.status}`;
          } else if (error.code === 'ECONNABORTED') {
            errorMessage = 'timeout';
          } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'connection_refused';
          } else {
            errorMessage = error.code || 'network_error';
          }
        }
        
        onResult({
          success: false,
          responseTime,
          error: errorMessage
        });
      }
    }, 100); // Make a request every 100ms per worker
  }

  private async getAuthToken(): Promise<string> {
    try {
      // Create a test user for load testing
      const testEmail = `loadtest-${Date.now()}@example.com`;
      
      const registerResponse = await axios.post(`${this.baseUrl}/api/auth/register`, {
        email: testEmail,
        password: 'LoadTest123!',
        firstName: 'Load',
        lastName: 'Test',
        userType: 'student'
      });

      return registerResponse.data.token;
    } catch (error) {
      // If registration fails, try to login with existing test user
      try {
        const loginResponse = await axios.post(`${this.baseUrl}/api/auth/login`, {
          email: 'loadtest@example.com',
          password: 'LoadTest123!'
        });
        
        return loginResponse.data.token;
      } catch (loginError) {
        throw new Error('Failed to obtain authentication token for load testing');
      }
    }
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedArray[lower];
    }
    
    const weight = index - lower;
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  private generateLoadTestSummary(): void {
    const totalRequests = this.results.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalSuccessful = this.results.reduce((sum, r) => sum + r.successfulRequests, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failedRequests, 0);
    const overallSuccessRate = totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0;

    this.logger.info('\n=== LOAD TEST SUMMARY ===');
    this.logger.info(`Total Scenarios: ${this.results.length}`);
    this.logger.info(`Total Requests: ${totalRequests.toLocaleString()}`);
    this.logger.info(`Successful Requests: ${totalSuccessful.toLocaleString()}`);
    this.logger.info(`Failed Requests: ${totalFailed.toLocaleString()}`);
    this.logger.info(`Overall Success Rate: ${overallSuccessRate.toFixed(2)}%`);

    // Find performance bottlenecks
    const slowestScenario = this.results.reduce((prev, current) => 
      prev.avgResponseTime > current.avgResponseTime ? prev : current
    );
    
    const fastestScenario = this.results.reduce((prev, current) => 
      prev.avgResponseTime < current.avgResponseTime ? prev : current
    );

    this.logger.info(`\nSlowest Scenario: ${slowestScenario.scenarioName} (${slowestScenario.avgResponseTime.toFixed(2)}ms avg)`);
    this.logger.info(`Fastest Scenario: ${fastestScenario.scenarioName} (${fastestScenario.avgResponseTime.toFixed(2)}ms avg)`);

    // Identify scenarios with high error rates
    const problematicScenarios = this.results.filter(r => r.successRate < 95);
    if (problematicScenarios.length > 0) {
      this.logger.warn('\nScenarios with high error rates:');
      problematicScenarios.forEach(scenario => {
        this.logger.warn(`- ${scenario.scenarioName}: ${scenario.successRate.toFixed(2)}% success rate`);
      });
    }
  }

  generateLoadTestReport(): string {
    const totalRequests = this.results.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalSuccessful = this.results.reduce((sum, r) => sum + r.successfulRequests, 0);
    const overallSuccessRate = totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0;

    let report = `# StellarRec Load Test Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    report += `## Summary\n`;
    report += `- **Total Scenarios:** ${this.results.length}\n`;
    report += `- **Total Requests:** ${totalRequests.toLocaleString()}\n`;
    report += `- **Successful Requests:** ${totalSuccessful.toLocaleString()}\n`;
    report += `- **Overall Success Rate:** ${overallSuccessRate.toFixed(2)}%\n\n`;

    report += `## Scenario Results\n\n`;
    
    this.results.forEach(result => {
      report += `### ${result.scenarioName}\n`;
      report += `- **Duration:** ${(result.duration / 1000).toFixed(1)}s\n`;
      report += `- **Concurrency:** ${result.concurrency}\n`;
      report += `- **Total Requests:** ${result.totalRequests.toLocaleString()}\n`;
      report += `- **Success Rate:** ${result.successRate.toFixed(2)}%\n`;
      report += `- **Requests/Second:** ${result.requestsPerSecond.toFixed(2)}\n`;
      report += `- **Avg Response Time:** ${result.avgResponseTime.toFixed(2)}ms\n`;
      report += `- **P95 Response Time:** ${result.p95ResponseTime.toFixed(2)}ms\n`;
      report += `- **P99 Response Time:** ${result.p99ResponseTime.toFixed(2)}ms\n`;
      
      if (Object.keys(result.errorBreakdown).length > 0) {
        report += `- **Error Breakdown:**\n`;
        Object.entries(result.errorBreakdown).forEach(([error, count]) => {
          report += `  - ${error}: ${count}\n`;
        });
      }
      
      report += `\n`;
    });

    return report;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}