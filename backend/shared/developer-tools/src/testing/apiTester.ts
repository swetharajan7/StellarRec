import { APITestSuite, APITestCase, APITestResult, TestEnvironment } from '../types';

export class APITester {
  private environments: Map<string, TestEnvironment> = new Map();
  private testSuites: Map<string, APITestSuite> = new Map();

  addEnvironment(environment: TestEnvironment): void {
    this.environments.set(environment.name, environment);
  }

  addTestSuite(suite: APITestSuite): void {
    this.testSuites.set(suite.id, suite);
  }

  async runTestSuite(suiteId: string, environmentName: string): Promise<APITestResult[]> {
    const suite = this.testSuites.get(suiteId);
    const environment = this.environments.get(environmentName);

    if (!suite || !environment) {
      throw new Error('Test suite or environment not found');
    }

    const results: APITestResult[] = [];

    for (const testCase of suite.tests) {
      const result = await this.runTestCase(testCase, environment);
      results.push(result);
    }

    return results;
  }

  private async runTestCase(testCase: APITestCase, environment: TestEnvironment): Promise<APITestResult> {
    const startTime = Date.now();
    
    try {
      const url = `${environment.baseUrl}${testCase.endpoint}`;
      const headers = {
        ...environment.headers,
        ...testCase.headers,
      };

      // Mock response for testing - in real implementation would use fetch or axios
      const response = {
        status: testCase.expectedStatus || 200,
        headers: new Map([['content-type', 'application/json']]),
        ok: true
      };

      const parsedBody = { success: true, data: 'mock response' };

      const duration = Date.now() - startTime;
      const passed = this.validateResponse(response, parsedBody, testCase);

      return {
        testId: testCase.id,
        testName: testCase.name,
        passed,
        duration,
        response: {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedBody,
        },
        assertions: testCase.assertions?.map(assertion => ({
          ...assertion,
          passed: this.evaluateAssertion(assertion, response, parsedBody),
        })) || [],
        executedAt: new Date(),
      };
    } catch (error) {
      return {
        testId: testCase.id,
        testName: testCase.name,
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date(),
      };
    }
  }

  private validateResponse(response: any, body: any, testCase: APITestCase): boolean {
    // Check expected status code
    if (testCase.expectedStatus && response.status !== testCase.expectedStatus) {
      return false;
    }

    // Run custom assertions
    if (testCase.assertions) {
      return testCase.assertions.every(assertion => 
        this.evaluateAssertion(assertion, response, body)
      );
    }

    return true;
  }

  private evaluateAssertion(assertion: any, response: any, body: any): boolean {
    switch (assertion.type) {
      case 'status':
        return response.status === assertion.expected;
      
      case 'header':
        return response.headers.get ? response.headers.get(assertion.key) === assertion.expected : true;
      
      case 'body':
        return this.evaluateBodyAssertion(assertion, body);
      
      case 'response_time':
        // This would need to be implemented with timing data
        return true;
      
      default:
        return false;
    }
  }

  private evaluateBodyAssertion(assertion: any, body: any): boolean {
    const value = this.getNestedValue(body, assertion.path);
    
    switch (assertion.operator) {
      case 'equals':
        return value === assertion.expected;
      
      case 'contains':
        return typeof value === 'string' && value.includes(assertion.expected);
      
      case 'exists':
        return value !== undefined && value !== null;
      
      case 'type':
        return typeof value === assertion.expected;
      
      default:
        return false;
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  generateTestReport(results: APITestResult[]): string {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const passRate = ((passed / total) * 100).toFixed(1);

    let report = `API Test Report\n`;
    report += `===============\n\n`;
    report += `Total Tests: ${total}\n`;
    report += `Passed: ${passed}\n`;
    report += `Failed: ${total - passed}\n`;
    report += `Pass Rate: ${passRate}%\n\n`;

    report += `Test Results:\n`;
    report += `-------------\n`;

    for (const result of results) {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      report += `${status} ${result.testName} (${result.duration}ms)\n`;
      
      if (!result.passed && result.error) {
        report += `   Error: ${result.error}\n`;
      }
    }

    return report;
  }
}