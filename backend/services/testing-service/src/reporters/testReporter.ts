import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  suite: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  duration: number;
  passed: number;
  failed: number;
  skipped: number;
}

interface TestReport {
  timestamp: string;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  coverage?: CoverageReport;
  suites: TestSuite[];
}

interface CoverageReport {
  lines: { total: number; covered: number; percentage: number };
  functions: { total: number; covered: number; percentage: number };
  branches: { total: number; covered: number; percentage: number };
  statements: { total: number; covered: number; percentage: number };
}

export class TestReporter {
  private results: TestResult[] = [];
  private suites: Map<string, TestSuite> = new Map();
  private startTime: number = Date.now();

  addTestResult(result: TestResult): void {
    this.results.push(result);
    
    if (!this.suites.has(result.suite)) {
      this.suites.set(result.suite, {
        name: result.suite,
        tests: [],
        duration: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      });
    }

    const suite = this.suites.get(result.suite)!;
    suite.tests.push(result);
    suite.duration += result.duration;
    
    switch (result.status) {
      case 'passed':
        suite.passed++;
        break;
      case 'failed':
        suite.failed++;
        break;
      case 'skipped':
        suite.skipped++;
        break;
    }
  }

  generateReport(): TestReport {
    const totalDuration = Date.now() - this.startTime;
    const totalPassed = this.results.filter(r => r.status === 'passed').length;
    const totalFailed = this.results.filter(r => r.status === 'failed').length;
    const totalSkipped = this.results.filter(r => r.status === 'skipped').length;

    return {
      timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      totalTests: this.results.length,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalDuration,
      coverage: this.loadCoverageReport(),
      suites: Array.from(this.suites.values())
    };
  }

  generateHTMLReport(report: TestReport): string {
    const passRate = report.totalTests > 0 ? (report.totalPassed / report.totalTests * 100).toFixed(2) : '0';
    const coverageRate = report.coverage ? report.coverage.lines.percentage.toFixed(2) : 'N/A';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>StellarRec Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }
        .metric {
            text-align: center;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .coverage { color: #17a2b8; }
        .suites {
            padding: 30px;
        }
        .suite {
            margin-bottom: 30px;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            overflow: hidden;
        }
        .suite-header {
            background: #f8f9fa;
            padding: 15px 20px;
            border-bottom: 1px solid #e9ecef;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .suite-name {
            font-weight: 600;
            font-size: 1.1em;
        }
        .suite-stats {
            font-size: 0.9em;
            color: #666;
        }
        .test-list {
            padding: 0;
            margin: 0;
            list-style: none;
        }
        .test-item {
            padding: 12px 20px;
            border-bottom: 1px solid #f1f3f4;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test-item:last-child {
            border-bottom: none;
        }
        .test-name {
            flex: 1;
        }
        .test-duration {
            color: #666;
            font-size: 0.9em;
            margin-right: 10px;
        }
        .test-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 500;
            text-transform: uppercase;
        }
        .status-passed {
            background: #d4edda;
            color: #155724;
        }
        .status-failed {
            background: #f8d7da;
            color: #721c24;
        }
        .status-skipped {
            background: #fff3cd;
            color: #856404;
        }
        .error-details {
            background: #f8f9fa;
            padding: 15px 20px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 0.9em;
            color: #dc3545;
            white-space: pre-wrap;
        }
        .coverage-section {
            margin-top: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .coverage-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .coverage-item {
            text-align: center;
            padding: 15px;
            background: white;
            border-radius: 6px;
        }
        .coverage-percentage {
            font-size: 1.5em;
            font-weight: bold;
            color: #17a2b8;
        }
        .coverage-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>StellarRec Test Report</h1>
            <p>Generated on ${report.timestamp}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value">${report.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value passed">${report.totalPassed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value failed">${report.totalFailed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value skipped">${report.totalSkipped}</div>
                <div class="metric-label">Skipped</div>
            </div>
            <div class="metric">
                <div class="metric-value">${passRate}%</div>
                <div class="metric-label">Pass Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value coverage">${coverageRate}%</div>
                <div class="metric-label">Coverage</div>
            </div>
        </div>

        ${report.coverage ? this.generateCoverageHTML(report.coverage) : ''}

        <div class="suites">
            <h2>Test Suites</h2>
            ${report.suites.map(suite => this.generateSuiteHTML(suite)).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  private generateCoverageHTML(coverage: CoverageReport): string {
    return `
        <div class="coverage-section">
            <h3>Code Coverage</h3>
            <div class="coverage-grid">
                <div class="coverage-item">
                    <div class="coverage-percentage">${coverage.lines.percentage.toFixed(1)}%</div>
                    <div class="coverage-label">Lines (${coverage.lines.covered}/${coverage.lines.total})</div>
                </div>
                <div class="coverage-item">
                    <div class="coverage-percentage">${coverage.functions.percentage.toFixed(1)}%</div>
                    <div class="coverage-label">Functions (${coverage.functions.covered}/${coverage.functions.total})</div>
                </div>
                <div class="coverage-item">
                    <div class="coverage-percentage">${coverage.branches.percentage.toFixed(1)}%</div>
                    <div class="coverage-label">Branches (${coverage.branches.covered}/${coverage.branches.total})</div>
                </div>
                <div class="coverage-item">
                    <div class="coverage-percentage">${coverage.statements.percentage.toFixed(1)}%</div>
                    <div class="coverage-label">Statements (${coverage.statements.covered}/${coverage.statements.total})</div>
                </div>
            </div>
        </div>`;
  }

  private generateSuiteHTML(suite: TestSuite): string {
    return `
        <div class="suite">
            <div class="suite-header">
                <div class="suite-name">${suite.name}</div>
                <div class="suite-stats">
                    ${suite.passed} passed, ${suite.failed} failed, ${suite.skipped} skipped
                    (${(suite.duration / 1000).toFixed(2)}s)
                </div>
            </div>
            <ul class="test-list">
                ${suite.tests.map(test => this.generateTestHTML(test)).join('')}
            </ul>
        </div>`;
  }

  private generateTestHTML(test: TestResult): string {
    const statusClass = `status-${test.status}`;
    const errorSection = test.error ? `<div class="error-details">${test.error}</div>` : '';
    
    return `
        <li class="test-item">
            <div class="test-name">${test.name}</div>
            <div class="test-duration">${test.duration}ms</div>
            <div class="test-status ${statusClass}">${test.status}</div>
        </li>
        ${errorSection}`;
  }

  saveReport(report: TestReport, outputDir: string = './test-reports'): void {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save JSON report
    const jsonPath = path.join(outputDir, 'test-report.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    // Save HTML report
    const htmlPath = path.join(outputDir, 'test-report.html');
    const htmlContent = this.generateHTMLReport(report);
    fs.writeFileSync(htmlPath, htmlContent);

    // Save JUnit XML report for CI/CD integration
    const xmlPath = path.join(outputDir, 'junit.xml');
    const xmlContent = this.generateJUnitXML(report);
    fs.writeFileSync(xmlPath, xmlContent);

    console.log(`Test reports saved to ${outputDir}`);
    console.log(`- JSON: ${jsonPath}`);
    console.log(`- HTML: ${htmlPath}`);
    console.log(`- JUnit XML: ${xmlPath}`);
  }

  private generateJUnitXML(report: TestReport): string {
    const escapeXML = (str: string) => 
      str.replace(/&/g, '&amp;')
         .replace(/</g, '&lt;')
         .replace(/>/g, '&gt;')
         .replace(/"/g, '&quot;')
         .replace(/'/g, '&apos;');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="StellarRec Test Suite" 
            tests="${report.totalTests}" 
            failures="${report.totalFailed}" 
            skipped="${report.totalSkipped}" 
            time="${(report.totalDuration / 1000).toFixed(3)}">
`;

    for (const suite of report.suites) {
      xml += `  <testsuite name="${escapeXML(suite.name)}" 
                   tests="${suite.tests.length}" 
                   failures="${suite.failed}" 
                   skipped="${suite.skipped}" 
                   time="${(suite.duration / 1000).toFixed(3)}">
`;

      for (const test of suite.tests) {
        xml += `    <testcase name="${escapeXML(test.name)}" 
                        classname="${escapeXML(suite.name)}" 
                        time="${(test.duration / 1000).toFixed(3)}">
`;

        if (test.status === 'failed' && test.error) {
          xml += `      <failure message="Test failed">${escapeXML(test.error)}</failure>
`;
        } else if (test.status === 'skipped') {
          xml += `      <skipped/>
`;
        }

        xml += `    </testcase>
`;
      }

      xml += `  </testsuite>
`;
    }

    xml += `</testsuites>`;
    return xml;
  }

  private loadCoverageReport(): CoverageReport | undefined {
    try {
      const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        const total = coverageData.total;
        
        return {
          lines: {
            total: total.lines.total,
            covered: total.lines.covered,
            percentage: total.lines.pct
          },
          functions: {
            total: total.functions.total,
            covered: total.functions.covered,
            percentage: total.functions.pct
          },
          branches: {
            total: total.branches.total,
            covered: total.branches.covered,
            percentage: total.branches.pct
          },
          statements: {
            total: total.statements.total,
            covered: total.statements.covered,
            percentage: total.statements.pct
          }
        };
      }
    } catch (error) {
      console.warn('Could not load coverage report:', error.message);
    }
    
    return undefined;
  }

  printSummary(report: TestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('                    TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`✅ Passed: ${report.totalPassed}`);
    console.log(`❌ Failed: ${report.totalFailed}`);
    console.log(`⏭️  Skipped: ${report.totalSkipped}`);
    console.log(`⏱️  Duration: ${(report.totalDuration / 1000).toFixed(2)}s`);
    
    if (report.coverage) {
      console.log(`📊 Coverage: ${report.coverage.lines.percentage.toFixed(2)}%`);
    }
    
    const passRate = report.totalTests > 0 ? (report.totalPassed / report.totalTests * 100) : 0;
    console.log(`📈 Pass Rate: ${passRate.toFixed(2)}%`);
    
    console.log('='.repeat(60));
    
    if (report.totalFailed > 0) {
      console.log('\n❌ FAILED TESTS:');
      for (const suite of report.suites) {
        const failedTests = suite.tests.filter(t => t.status === 'failed');
        if (failedTests.length > 0) {
          console.log(`\n  ${suite.name}:`);
          for (const test of failedTests) {
            console.log(`    • ${test.name}`);
            if (test.error) {
              console.log(`      ${test.error.split('\n')[0]}`);
            }
          }
        }
      }
    }
    
    console.log('\n');
  }
}

// CLI usage
if (require.main === module) {
  const reporter = new TestReporter();
  
  // Mock some test results for demonstration
  const mockResults: TestResult[] = [
    { name: 'should create user', status: 'passed', duration: 150, suite: 'User Service' },
    { name: 'should authenticate user', status: 'passed', duration: 200, suite: 'User Service' },
    { name: 'should reject invalid email', status: 'failed', duration: 100, suite: 'User Service', error: 'Expected validation error' },
    { name: 'should match universities', status: 'passed', duration: 300, suite: 'AI Service' },
    { name: 'should analyze essay', status: 'passed', duration: 1200, suite: 'AI Service' }
  ];
  
  mockResults.forEach(result => reporter.addTestResult(result));
  
  const report = reporter.generateReport();
  reporter.printSummary(report);
  reporter.saveReport(report);
}