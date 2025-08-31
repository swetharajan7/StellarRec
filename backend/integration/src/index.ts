import { ServiceOrchestrator } from './orchestrator/serviceOrchestrator';
import { IntegrationTesting } from './testing/integrationTesting';
import { DataConsistencyValidator } from './validation/dataConsistency';
import { LoadTesting } from './testing/loadTesting';
import { SecurityTesting } from './testing/securityTesting';
import { Logger } from './utils/logger';
import { ComprehensiveTestReport } from './types';

export class SystemIntegration {
  private logger = new Logger('SystemIntegration');
  private orchestrator: ServiceOrchestrator;
  private integrationTesting: IntegrationTesting;
  private dataValidator: DataConsistencyValidator;
  private loadTesting: LoadTesting;
  private securityTesting: SecurityTesting;

  constructor() {
    this.orchestrator = new ServiceOrchestrator();
    this.integrationTesting = new IntegrationTesting();
    this.dataValidator = new DataConsistencyValidator();
    this.loadTesting = new LoadTesting();
    this.securityTesting = new SecurityTesting();
  }

  async runFullSystemIntegration(): Promise<ComprehensiveTestReport> {
    this.logger.info('🚀 Starting comprehensive system integration and testing...');
    
    const report: ComprehensiveTestReport = {
      timestamp: new Date(),
      summary: {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        passRate: 0
      },
      integrationTests: [],
      loadTests: [],
      securityTests: [],
      dataConsistency: [],
      performanceTests: [],
      recommendations: [],
      overallStatus: 'pass'
    };

    try {
      // Step 1: Start all services
      this.logger.info('📋 Step 1: Starting all microservices...');
      const orchestrationResult = await this.orchestrator.startAllServices();
      
      if (!orchestrationResult.success) {
        this.logger.error('❌ Service orchestration failed. Cannot proceed with testing.');
        report.overallStatus = 'fail';
        report.recommendations.push('Fix service startup issues before running integration tests');
        return report;
      }

      this.logger.info('✅ All services started successfully');

      // Step 2: Wait for services to stabilize
      this.logger.info('⏳ Waiting for services to stabilize...');
      await this.delay(30000); // 30 seconds

      // Step 3: Run data consistency validation
      this.logger.info('📋 Step 2: Validating data consistency...');
      const dataIntegrityReport = await this.dataValidator.validateSystemDataConsistency();
      report.dataConsistency = dataIntegrityReport.checks;
      
      if (dataIntegrityReport.overallStatus !== 'healthy') {
        this.logger.warn('⚠️ Data consistency issues found');
        report.recommendations.push(...dataIntegrityReport.recommendations);
        if (dataIntegrityReport.overallStatus === 'critical_issues') {
          report.overallStatus = 'fail';
        }
      }

      // Step 4: Run integration tests
      this.logger.info('📋 Step 3: Running integration tests...');
      const integrationResults = await this.integrationTesting.runFullIntegrationSuite();
      report.integrationTests = integrationResults;

      const failedIntegrationTests = integrationResults.filter(t => !t.passed).length;
      if (failedIntegrationTests > 0) {
        this.logger.warn(`⚠️ ${failedIntegrationTests} integration tests failed`);
        if (failedIntegrationTests > integrationResults.length * 0.1) { // More than 10% failure
          report.overallStatus = 'fail';
        }
      }

      // Step 5: Run load tests
      this.logger.info('📋 Step 4: Running load tests...');
      const loadResults = await this.loadTesting.runLoadTests();
      report.loadTests = loadResults;

      const failedLoadTests = loadResults.filter(t => t.successRate < 95).length;
      if (failedLoadTests > 0) {
        this.logger.warn(`⚠️ ${failedLoadTests} load tests had low success rates`);
        report.recommendations.push('Investigate performance bottlenecks and optimize slow endpoints');
      }

      // Step 6: Run security tests
      this.logger.info('📋 Step 5: Running security tests...');
      const securityReport = await this.securityTesting.runSecurityTests();
      report.securityTests = securityReport.testResults;

      if (securityReport.overallRisk === 'high' || securityReport.overallRisk === 'critical') {
        this.logger.error('❌ Critical security vulnerabilities found');
        report.overallStatus = 'fail';
        report.recommendations.push(...securityReport.recommendations);
      }

      // Calculate summary statistics
      const allTests = [
        ...report.integrationTests,
        ...report.dataConsistency,
        ...report.securityTests.map(t => ({ passed: t.passed }))
      ];

      report.summary.totalTests = allTests.length;
      report.summary.passedTests = allTests.filter(t => t.passed).length;
      report.summary.failedTests = allTests.filter(t => !t.passed).length;
      report.summary.passRate = report.summary.totalTests > 0 ? 
        (report.summary.passedTests / report.summary.totalTests) * 100 : 0;

      // Generate final recommendations
      this.generateFinalRecommendations(report);

      // Log final results
      this.logger.info('🎉 System integration testing completed!');
      this.logger.info(`📊 Summary: ${report.summary.passedTests}/${report.summary.totalTests} tests passed (${report.summary.passRate.toFixed(1)}%)`);
      this.logger.info(`🏆 Overall Status: ${report.overallStatus.toUpperCase()}`);

      if (report.overallStatus === 'fail') {
        this.logger.error('❌ System integration failed. Review the issues and recommendations.');
      } else if (report.overallStatus === 'warning') {
        this.logger.warn('⚠️ System integration completed with warnings. Review recommendations.');
      } else {
        this.logger.info('✅ System integration successful! All tests passed.');
      }

    } catch (error) {
      this.logger.error('💥 System integration failed with error:', error);
      report.overallStatus = 'fail';
      report.recommendations.push('Fix system integration errors and retry');
    } finally {
      // Cleanup
      await this.dataValidator.cleanup();
    }

    return report;
  }

  private generateFinalRecommendations(report: ComprehensiveTestReport): void {
    // Performance recommendations
    const slowLoadTests = report.loadTests.filter(t => t.avgResponseTime > 1000);
    if (slowLoadTests.length > 0) {
      report.recommendations.push('Optimize slow endpoints with response times > 1000ms');
    }

    // Reliability recommendations
    const lowSuccessRateTests = report.loadTests.filter(t => t.successRate < 99);
    if (lowSuccessRateTests.length > 0) {
      report.recommendations.push('Improve system reliability - some endpoints have success rates below 99%');
    }

    // Data consistency recommendations
    const dataIssues = report.dataConsistency.filter(c => !c.passed);
    if (dataIssues.length > 0) {
      report.recommendations.push('Address data consistency issues to prevent data corruption');
    }

    // Integration recommendations
    const integrationFailures = report.integrationTests.filter(t => !t.passed);
    if (integrationFailures.length > 0) {
      report.recommendations.push('Fix integration test failures to ensure proper service communication');
    }

    // General recommendations
    if (report.summary.passRate < 95) {
      report.recommendations.push('Overall test pass rate is below 95% - investigate and fix failing tests');
    }

    report.recommendations.push('Set up continuous integration to run these tests automatically');
    report.recommendations.push('Implement monitoring and alerting for production systems');
    report.recommendations.push('Schedule regular system integration testing');
  }

  async generateComprehensiveReport(report: ComprehensiveTestReport): Promise<string> {
    let reportText = `# StellarRec System Integration Report\n\n`;
    reportText += `**Generated:** ${report.timestamp.toISOString()}\n`;
    reportText += `**Overall Status:** ${report.overallStatus.toUpperCase()}\n\n`;
    
    reportText += `## Executive Summary\n`;
    reportText += `- **Total Tests:** ${report.summary.totalTests}\n`;
    reportText += `- **Passed:** ${report.summary.passedTests}\n`;
    reportText += `- **Failed:** ${report.summary.failedTests}\n`;
    reportText += `- **Pass Rate:** ${report.summary.passRate.toFixed(1)}%\n\n`;

    // Integration Tests Section
    if (report.integrationTests.length > 0) {
      reportText += `## Integration Tests (${report.integrationTests.length})\n`;
      const passedIntegration = report.integrationTests.filter(t => t.passed).length;
      reportText += `**Status:** ${passedIntegration}/${report.integrationTests.length} passed\n\n`;
      
      const failedIntegration = report.integrationTests.filter(t => !t.passed);
      if (failedIntegration.length > 0) {
        reportText += `### Failed Tests:\n`;
        failedIntegration.forEach(test => {
          reportText += `- **${test.testName}**: ${test.error}\n`;
        });
        reportText += `\n`;
      }
    }

    // Load Tests Section
    if (report.loadTests.length > 0) {
      reportText += `## Load Tests (${report.loadTests.length})\n`;
      const avgSuccessRate = report.loadTests.reduce((sum, t) => sum + t.successRate, 0) / report.loadTests.length;
      reportText += `**Average Success Rate:** ${avgSuccessRate.toFixed(2)}%\n\n`;
      
      report.loadTests.forEach(test => {
        reportText += `### ${test.scenarioName}\n`;
        reportText += `- **Requests:** ${test.totalRequests.toLocaleString()}\n`;
        reportText += `- **Success Rate:** ${test.successRate.toFixed(2)}%\n`;
        reportText += `- **Avg Response Time:** ${test.avgResponseTime.toFixed(2)}ms\n`;
        reportText += `- **P95 Response Time:** ${test.p95ResponseTime.toFixed(2)}ms\n\n`;
      });
    }

    // Security Tests Section
    if (report.securityTests.length > 0) {
      reportText += `## Security Tests (${report.securityTests.length})\n`;
      const passedSecurity = report.securityTests.filter(t => t.passed).length;
      reportText += `**Status:** ${passedSecurity}/${report.securityTests.length} passed\n\n`;
      
      const vulnerabilities = report.securityTests.filter(t => !t.passed && t.vulnerability);
      if (vulnerabilities.length > 0) {
        reportText += `### Vulnerabilities Found:\n`;
        vulnerabilities.forEach(test => {
          if (test.vulnerability) {
            reportText += `- **${test.vulnerability.type}** (${test.vulnerability.severity.toUpperCase()}): ${test.vulnerability.description}\n`;
          }
        });
        reportText += `\n`;
      }
    }

    // Data Consistency Section
    if (report.dataConsistency.length > 0) {
      reportText += `## Data Consistency (${report.dataConsistency.length})\n`;
      const passedConsistency = report.dataConsistency.filter(c => c.passed).length;
      reportText += `**Status:** ${passedConsistency}/${report.dataConsistency.length} passed\n\n`;
      
      const failedConsistency = report.dataConsistency.filter(c => !c.passed);
      if (failedConsistency.length > 0) {
        reportText += `### Issues Found:\n`;
        failedConsistency.forEach(check => {
          reportText += `- **${check.name}**: ${check.error || 'Data consistency issues detected'}\n`;
        });
        reportText += `\n`;
      }
    }

    // Recommendations Section
    if (report.recommendations.length > 0) {
      reportText += `## Recommendations (${report.recommendations.length})\n\n`;
      report.recommendations.forEach((rec, index) => {
        reportText += `${index + 1}. ${rec}\n`;
      });
      reportText += `\n`;
    }

    reportText += `## Next Steps\n\n`;
    if (report.overallStatus === 'pass') {
      reportText += `✅ **System Ready for Production**\n`;
      reportText += `- All critical tests passed\n`;
      reportText += `- System integration is successful\n`;
      reportText += `- Proceed with production deployment\n`;
    } else if (report.overallStatus === 'warning') {
      reportText += `⚠️ **System Ready with Cautions**\n`;
      reportText += `- Most tests passed but some issues found\n`;
      reportText += `- Review and address warnings before production\n`;
      reportText += `- Monitor system closely after deployment\n`;
    } else {
      reportText += `❌ **System Not Ready for Production**\n`;
      reportText += `- Critical issues found that must be resolved\n`;
      reportText += `- Fix all failing tests before deployment\n`;
      reportText += `- Re-run integration testing after fixes\n`;
    }

    return reportText;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export main classes
export {
  ServiceOrchestrator,
  IntegrationTesting,
  DataConsistencyValidator,
  LoadTesting,
  SecurityTesting
};

// Export types
export * from './types';