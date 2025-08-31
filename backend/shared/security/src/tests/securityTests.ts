import { Request, Response } from 'express';
import { waf } from '../utils/wafRules';
import { anomalyDetection } from '../utils/anomalyDetection';
import { complianceChecker } from '../utils/complianceChecker';

interface SecurityTestResult {
  testName: string;
  passed: boolean;
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityTestSuite {
  name: string;
  tests: SecurityTestResult[];
  overallScore: number;
  recommendations: string[];
}

class SecurityTester {
  async runAllTests(): Promise<SecurityTestSuite[]> {
    const testSuites: SecurityTestSuite[] = [];

    // Run WAF tests
    testSuites.push(await this.runWAFTests());
    
    // Run input validation tests
    testSuites.push(await this.runInputValidationTests());
    
    // Run authentication tests
    testSuites.push(await this.runAuthenticationTests());
    
    // Run compliance tests
    testSuites.push(await this.runComplianceTests());
    
    // Run anomaly detection tests
    testSuites.push(await this.runAnomalyDetectionTests());

    return testSuites;
  }

  private async runWAFTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = [];

    // Test SQL injection detection
    const sqlInjectionPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "UNION SELECT * FROM users",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --"
    ];

    for (const payload of sqlInjectionPayloads) {
      const mockReq = this.createMockRequest({
        body: { input: payload },
        path: '/api/test'
      });

      const result = waf.checkRequest(mockReq);
      tests.push({
        testName: `SQL Injection Detection: ${payload.substring(0, 20)}...`,
        passed: result.blocked,
        details: result.blocked ? 'Blocked successfully' : 'Failed to block SQL injection',
        severity: 'critical'
      });
    }

    // Test XSS detection
    const xssPayloads = [
      "<script>alert('xss')</script>",
      "<img src=x onerror=alert('xss')>",
      "javascript:alert('xss')",
      "<iframe src='javascript:alert(\"xss\")'></iframe>"
    ];

    for (const payload of xssPayloads) {
      const mockReq = this.createMockRequest({
        body: { content: payload },
        path: '/api/test'
      });

      const result = waf.checkRequest(mockReq);
      tests.push({
        testName: `XSS Detection: ${payload.substring(0, 20)}...`,
        passed: result.blocked,
        details: result.blocked ? 'Blocked successfully' : 'Failed to block XSS',
        severity: 'critical'
      });
    }

    // Test command injection detection
    const commandInjectionPayloads = [
      "; cat /etc/passwd",
      "| whoami",
      "&& rm -rf /",
      "`id`"
    ];

    for (const payload of commandInjectionPayloads) {
      const mockReq = this.createMockRequest({
        body: { command: payload },
        path: '/api/test'
      });

      const result = waf.checkRequest(mockReq);
      tests.push({
        testName: `Command Injection Detection: ${payload}`,
        passed: result.blocked,
        details: result.blocked ? 'Blocked successfully' : 'Failed to block command injection',
        severity: 'high'
      });
    }

    const passedTests = tests.filter(t => t.passed).length;
    const overallScore = (passedTests / tests.length) * 100;

    return {
      name: 'Web Application Firewall (WAF)',
      tests,
      overallScore,
      recommendations: this.generateWAFRecommendations(tests)
    };
  }

  private async runInputValidationTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = [];

    // Test email validation
    const emailTests = [
      { email: 'valid@example.com', shouldPass: true },
      { email: 'invalid-email', shouldPass: false },
      { email: 'test@', shouldPass: false },
      { email: '@example.com', shouldPass: false },
      { email: 'test..test@example.com', shouldPass: false }
    ];

    for (const test of emailTests) {
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(test.email);
      const passed = (isValid && test.shouldPass) || (!isValid && !test.shouldPass);
      
      tests.push({
        testName: `Email Validation: ${test.email}`,
        passed,
        details: passed ? 'Validation correct' : 'Validation failed',
        severity: 'medium'
      });
    }

    // Test password strength validation
    const passwordTests = [
      { password: 'StrongP@ss123', shouldPass: true },
      { password: 'weak', shouldPass: false },
      { password: 'NoNumbers!', shouldPass: false },
      { password: 'nonumbers123', shouldPass: false },
      { password: 'NOLOWERCASE123!', shouldPass: false }
    ];

    for (const test of passwordTests) {
      const isStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(test.password);
      const passed = (isStrong && test.shouldPass) || (!isStrong && !test.shouldPass);
      
      tests.push({
        testName: `Password Strength: ${test.password.substring(0, 10)}...`,
        passed,
        details: passed ? 'Validation correct' : 'Validation failed',
        severity: 'high'
      });
    }

    const passedTests = tests.filter(t => t.passed).length;
    const overallScore = (passedTests / tests.length) * 100;

    return {
      name: 'Input Validation',
      tests,
      overallScore,
      recommendations: this.generateInputValidationRecommendations(tests)
    };
  }

  private async runAuthenticationTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = [];

    // Test JWT token validation
    tests.push({
      testName: 'JWT Secret Configuration',
      passed: process.env.JWT_SECRET !== undefined && process.env.JWT_SECRET !== 'fallback_secret',
      details: process.env.JWT_SECRET ? 'JWT secret is configured' : 'JWT secret not properly configured',
      severity: 'critical'
    });

    // Test session security
    tests.push({
      testName: 'Secure Session Configuration',
      passed: process.env.NODE_ENV === 'production' ? process.env.SESSION_SECRET !== undefined : true,
      details: 'Session security configuration check',
      severity: 'high'
    });

    // Test HTTPS enforcement
    tests.push({
      testName: 'HTTPS Enforcement',
      passed: process.env.NODE_ENV === 'production' ? process.env.FORCE_HTTPS === 'true' : true,
      details: 'HTTPS enforcement check',
      severity: 'high'
    });

    const passedTests = tests.filter(t => t.passed).length;
    const overallScore = (passedTests / tests.length) * 100;

    return {
      name: 'Authentication & Authorization',
      tests,
      overallScore,
      recommendations: this.generateAuthRecommendations(tests)
    };
  }

  private async runComplianceTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = [];

    // Test FERPA compliance
    const ferpaReq = this.createMockRequest({
      path: '/api/applications/123',
      user: { id: '456', role: 'student' }
    });

    try {
      const complianceResult = await complianceChecker.checkCompliance(ferpaReq);
      tests.push({
        testName: 'FERPA Educational Records Access',
        passed: complianceResult.overallCompliant,
        details: complianceResult.overallCompliant ? 'FERPA compliant' : 'FERPA violations detected',
        severity: 'critical'
      });
    } catch (error) {
      tests.push({
        testName: 'FERPA Educational Records Access',
        passed: false,
        details: 'Compliance check failed',
        severity: 'critical'
      });
    }

    // Test GDPR compliance
    const gdprReq = this.createMockRequest({
      path: '/api/users/profile',
      body: { email: 'test@example.com', name: 'Test User' },
      user: { id: '123', role: 'student' }
    });

    try {
      const complianceResult = await complianceChecker.checkCompliance(gdprReq);
      tests.push({
        testName: 'GDPR Data Processing',
        passed: complianceResult.overallCompliant,
        details: complianceResult.overallCompliant ? 'GDPR compliant' : 'GDPR violations detected',
        severity: 'high'
      });
    } catch (error) {
      tests.push({
        testName: 'GDPR Data Processing',
        passed: false,
        details: 'Compliance check failed',
        severity: 'high'
      });
    }

    const passedTests = tests.filter(t => t.passed).length;
    const overallScore = (passedTests / tests.length) * 100;

    return {
      name: 'Regulatory Compliance',
      tests,
      overallScore,
      recommendations: this.generateComplianceRecommendations(tests)
    };
  }

  private async runAnomalyDetectionTests(): Promise<SecurityTestSuite> {
    const tests: SecurityTestResult[] = [];

    // Test high frequency requests
    const highFreqReq = this.createMockRequest({
      path: '/api/test',
      ip: '192.168.1.100'
    });

    try {
      const analysis = await anomalyDetection.analyzeRequest(highFreqReq);
      tests.push({
        testName: 'Anomaly Detection System',
        passed: analysis.score >= 0, // System is working if it returns a score
        details: `Anomaly detection working, risk level: ${analysis.riskLevel}`,
        severity: 'medium'
      });
    } catch (error) {
      tests.push({
        testName: 'Anomaly Detection System',
        passed: false,
        details: 'Anomaly detection system failed',
        severity: 'medium'
      });
    }

    const passedTests = tests.filter(t => t.passed).length;
    const overallScore = (passedTests / tests.length) * 100;

    return {
      name: 'Anomaly Detection',
      tests,
      overallScore,
      recommendations: this.generateAnomalyDetectionRecommendations(tests)
    };
  }

  private createMockRequest(options: {
    path?: string;
    method?: string;
    body?: any;
    query?: any;
    headers?: any;
    user?: any;
    ip?: string;
  }): Request {
    return {
      path: options.path || '/api/test',
      method: options.method || 'GET',
      body: options.body || {},
      query: options.query || {},
      headers: options.headers || {},
      user: options.user,
      ip: options.ip || '127.0.0.1',
      url: options.path || '/api/test',
      get: (header: string) => options.headers?.[header.toLowerCase()],
      connection: { remoteAddress: options.ip || '127.0.0.1' }
    } as any;
  }

  private generateWAFRecommendations(tests: SecurityTestResult[]): string[] {
    const recommendations: string[] = [];
    const failedTests = tests.filter(t => !t.passed);

    if (failedTests.some(t => t.testName.includes('SQL Injection'))) {
      recommendations.push('Strengthen SQL injection protection rules');
      recommendations.push('Implement parameterized queries in all database operations');
    }

    if (failedTests.some(t => t.testName.includes('XSS'))) {
      recommendations.push('Enhance XSS protection filters');
      recommendations.push('Implement Content Security Policy (CSP) headers');
    }

    if (failedTests.some(t => t.testName.includes('Command Injection'))) {
      recommendations.push('Add command injection protection rules');
      recommendations.push('Avoid system command execution in application code');
    }

    return recommendations;
  }

  private generateInputValidationRecommendations(tests: SecurityTestResult[]): string[] {
    const recommendations: string[] = [];
    const failedTests = tests.filter(t => !t.passed);

    if (failedTests.some(t => t.testName.includes('Email'))) {
      recommendations.push('Implement robust email validation');
      recommendations.push('Use email verification for account creation');
    }

    if (failedTests.some(t => t.testName.includes('Password'))) {
      recommendations.push('Enforce strong password policies');
      recommendations.push('Implement password complexity requirements');
    }

    return recommendations;
  }

  private generateAuthRecommendations(tests: SecurityTestResult[]): string[] {
    const recommendations: string[] = [];
    const failedTests = tests.filter(t => !t.passed);

    if (failedTests.some(t => t.testName.includes('JWT'))) {
      recommendations.push('Configure strong JWT secret');
      recommendations.push('Implement JWT token rotation');
    }

    if (failedTests.some(t => t.testName.includes('HTTPS'))) {
      recommendations.push('Enforce HTTPS in production');
      recommendations.push('Implement HSTS headers');
    }

    return recommendations;
  }

  private generateComplianceRecommendations(tests: SecurityTestResult[]): string[] {
    const recommendations: string[] = [];
    const failedTests = tests.filter(t => !t.passed);

    if (failedTests.some(t => t.testName.includes('FERPA'))) {
      recommendations.push('Implement FERPA-compliant access controls');
      recommendations.push('Add educational record access logging');
    }

    if (failedTests.some(t => t.testName.includes('GDPR'))) {
      recommendations.push('Implement GDPR consent management');
      recommendations.push('Add data minimization practices');
    }

    return recommendations;
  }

  private generateAnomalyDetectionRecommendations(tests: SecurityTestResult[]): string[] {
    const recommendations: string[] = [];
    const failedTests = tests.filter(t => !t.passed);

    if (failedTests.length > 0) {
      recommendations.push('Fix anomaly detection system configuration');
      recommendations.push('Ensure Redis connection for anomaly detection');
    }

    return recommendations;
  }

  async generateSecurityReport(): Promise<{
    overallScore: number;
    testSuites: SecurityTestSuite[];
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    recommendations: string[];
  }> {
    const testSuites = await this.runAllTests();
    
    const allTests = testSuites.flatMap(suite => suite.tests);
    const failedTests = allTests.filter(t => !t.passed);
    
    const criticalIssues = failedTests.filter(t => t.severity === 'critical').length;
    const highIssues = failedTests.filter(t => t.severity === 'high').length;
    const mediumIssues = failedTests.filter(t => t.severity === 'medium').length;
    const lowIssues = failedTests.filter(t => t.severity === 'low').length;
    
    const overallScore = testSuites.reduce((sum, suite) => sum + suite.overallScore, 0) / testSuites.length;
    const allRecommendations = testSuites.flatMap(suite => suite.recommendations);
    
    return {
      overallScore,
      testSuites,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      recommendations: [...new Set(allRecommendations)]
    };
  }
}

export const securityTester = new SecurityTester();