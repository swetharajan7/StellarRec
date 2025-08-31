#!/usr/bin/env ts-node

import { SystemIntegration } from '../src/index';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🚀 Starting StellarRec System Integration Testing...\n');

  const integration = new SystemIntegration();
  
  try {
    // Run comprehensive system integration
    const report = await integration.runFullSystemIntegration();
    
    // Generate and save report
    const reportText = await integration.generateComprehensiveReport(report);
    const reportPath = join(__dirname, '..', 'reports', `integration-report-${Date.now()}.md`);
    
    // Ensure reports directory exists
    const reportsDir = join(__dirname, '..', 'reports');
    try {
      require('fs').mkdirSync(reportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    writeFileSync(reportPath, reportText);
    
    console.log(`\n📄 Report saved to: ${reportPath}`);
    
    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('SYSTEM INTEGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Status: ${report.overallStatus.toUpperCase()}`);
    console.log(`Tests: ${report.summary.passedTests}/${report.summary.totalTests} passed (${report.summary.passRate.toFixed(1)}%)`);
    console.log(`Integration Tests: ${report.integrationTests.filter(t => t.passed).length}/${report.integrationTests.length} passed`);
    console.log(`Load Tests: ${report.loadTests.length} scenarios completed`);
    console.log(`Security Tests: ${report.securityTests.filter(t => t.passed).length}/${report.securityTests.length} passed`);
    console.log(`Data Consistency: ${report.dataConsistency.filter(c => c.passed).length}/${report.dataConsistency.length} passed`);
    
    if (report.recommendations.length > 0) {
      console.log(`\n📋 Recommendations: ${report.recommendations.length}`);
      report.recommendations.slice(0, 5).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
      if (report.recommendations.length > 5) {
        console.log(`... and ${report.recommendations.length - 5} more (see full report)`);
      }
    }
    
    console.log('='.repeat(60));
    
    // Exit with appropriate code
    if (report.overallStatus === 'fail') {
      console.log('❌ System integration failed. Review issues and retry.');
      process.exit(1);
    } else if (report.overallStatus === 'warning') {
      console.log('⚠️ System integration completed with warnings.');
      process.exit(0);
    } else {
      console.log('✅ System integration successful!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('💥 System integration failed with error:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the integration
main();