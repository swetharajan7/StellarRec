import { OptimizedDatabaseClient } from '../optimizedDatabase';
import { createDatabaseConfig } from '../config/databaseConfig';
import { performance } from 'perf_hooks';

interface PerformanceTestResult {
  testName: string;
  duration: number;
  queriesPerSecond: number;
  cacheHitRate?: number;
  success: boolean;
  error?: string;
}

export class DatabasePerformanceTester {
  private db: OptimizedDatabaseClient;
  private results: PerformanceTestResult[] = [];

  constructor() {
    const config = createDatabaseConfig();
    this.db = new OptimizedDatabaseClient(config);
  }

  async runAllTests(): Promise<PerformanceTestResult[]> {
    console.log('🚀 Starting database performance tests...');

    await this.db.connect();

    try {
      // Basic query performance tests
      await this.testBasicQueries();
      await this.testComplexQueries();
      await this.testConcurrentQueries();
      
      // Cache performance tests
      await this.testCachePerformance();
      
      // Connection pool tests
      await this.testConnectionPooling();
      
      // Index effectiveness tests
      await this.testIndexEffectiveness();
      
      // Load testing
      await this.testHighLoad();

      console.log('✅ All performance tests completed');
      this.printResults();
      
      return this.results;
    } finally {
      await this.db.disconnect();
    }
  }

  private async testBasicQueries(): Promise<void> {
    console.log('📊 Testing basic query performance...');

    const testQueries = [
      { name: 'User lookup by email', query: () => this.db.primary.users.findUnique({ where: { email: 'test@example.com' } }) },
      { name: 'Active users list', query: () => this.db.primary.users.findMany({ where: { is_active: true }, take: 100 }) },
      { name: 'Applications by status', query: () => this.db.primary.applications.findMany({ where: { status: 'in_progress' }, take: 50 }) },
      { name: 'Universities list', query: () => this.db.primary.universities.findMany({ where: { is_active: true }, take: 100 }) }
    ];

    for (const test of testQueries) {
      await this.runSingleTest(test.name, test.query, 10);
    }
  }

  private async testComplexQueries(): Promise<void> {
    console.log('📊 Testing complex query performance...');

    const complexQueries = [
      {
        name: 'Student applications with universities',
        query: () => this.db.primary.applications.findMany({
          include: {
            university: true,
            program: true,
            student: {
              include: {
                student_profiles: true
              }
            }
          },
          take: 20
        })
      },
      {
        name: 'University matches with reasoning',
        query: () => this.db.primary.university_matches.findMany({
          include: {
            university: true,
            student: {
              include: {
                student_profiles: true
              }
            }
          },
          where: {
            match_percentage: { gte: 70 }
          },
          take: 50
        })
      },
      {
        name: 'Recommendation letters with collaborators',
        query: () => this.db.primary.recommendation_letters.findMany({
          include: {
            student: true,
            recommender: true,
            letter_collaborators: true,
            letter_deliveries: true
          },
          take: 20
        })
      }
    ];

    for (const test of complexQueries) {
      await this.runSingleTest(test.name, test.query, 5);
    }
  }

  private async testConcurrentQueries(): Promise<void> {
    console.log('📊 Testing concurrent query performance...');

    const concurrentTest = async () => {
      const promises = Array.from({ length: 20 }, (_, i) => 
        this.db.primary.users.findMany({
          where: { is_active: true },
          skip: i * 10,
          take: 10
        })
      );
      
      return Promise.all(promises);
    };

    await this.runSingleTest('Concurrent user queries', concurrentTest, 3);
  }

  private async testCachePerformance(): Promise<void> {
    console.log('📊 Testing cache performance...');

    // Test cache miss (first query)
    const cacheMissTest = async () => {
      await this.db.cached.universities.findMany({
        where: { is_active: true },
        take: 100
      });
    };

    await this.runSingleTest('Cache miss - Universities', cacheMissTest, 1);

    // Test cache hit (subsequent queries)
    const cacheHitTest = async () => {
      await this.db.cached.universities.findMany({
        where: { is_active: true },
        take: 100
      });
    };

    await this.runSingleTest('Cache hit - Universities', cacheHitTest, 10);

    // Get cache statistics
    const cacheStats = await this.db.getCacheStats();
    console.log('📈 Cache Statistics:', {
      hitRate: `${cacheStats.hitRate}%`,
      keyCount: cacheStats.keyCount,
      memoryUsage: `${Math.round(cacheStats.memoryUsage / 1024 / 1024)}MB`
    });
  }

  private async testConnectionPooling(): Promise<void> {
    console.log('📊 Testing connection pool performance...');

    const poolTest = async () => {
      const promises = Array.from({ length: 50 }, () => 
        this.db.primary.users.count()
      );
      
      return Promise.all(promises);
    };

    await this.runSingleTest('Connection pool stress test', poolTest, 3);

    const poolStatus = await this.db.getPoolStatus();
    console.log('🏊 Pool Status:', {
      usage: `${poolStatus.usage}%`,
      active: poolStatus.active,
      idle: poolStatus.idle,
      health: poolStatus.health
    });
  }

  private async testIndexEffectiveness(): Promise<void> {
    console.log('📊 Testing index effectiveness...');

    const indexTests = [
      {
        name: 'Email index lookup',
        query: () => this.db.primary.users.findUnique({ where: { email: 'test@example.com' } })
      },
      {
        name: 'Status index scan',
        query: () => this.db.primary.applications.findMany({ where: { status: 'submitted' } })
      },
      {
        name: 'Date range index scan',
        query: () => this.db.primary.applications.findMany({
          where: {
            deadline: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-12-31')
            }
          }
        })
      },
      {
        name: 'Composite index lookup',
        query: () => this.db.primary.applications.findMany({
          where: {
            student_id: 'test-student-id',
            status: 'in_progress'
          }
        })
      }
    ];

    for (const test of indexTests) {
      await this.runSingleTest(test.name, test.query, 20);
    }
  }

  private async testHighLoad(): Promise<void> {
    console.log('📊 Testing high load performance...');

    const highLoadTest = async () => {
      const batchSize = 100;
      const batches = 10;
      
      const promises = Array.from({ length: batches }, (_, batchIndex) => 
        Promise.all(
          Array.from({ length: batchSize }, (_, queryIndex) => {
            const queries = [
              () => this.db.primary.users.count(),
              () => this.db.primary.applications.count(),
              () => this.db.primary.universities.count(),
              () => this.db.primary.recommendation_letters.count()
            ];
            
            const randomQuery = queries[queryIndex % queries.length];
            return randomQuery();
          })
        )
      );
      
      return Promise.all(promises);
    };

    await this.runSingleTest('High load test (1000 queries)', highLoadTest, 1);
  }

  private async runSingleTest(
    testName: string, 
    testFunction: () => Promise<any>, 
    iterations: number = 1
  ): Promise<void> {
    try {
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await testFunction();
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      const queriesPerSecond = (iterations / duration) * 1000;

      const result: PerformanceTestResult = {
        testName,
        duration: Math.round(duration * 100) / 100,
        queriesPerSecond: Math.round(queriesPerSecond * 100) / 100,
        success: true
      };

      this.results.push(result);
      
      console.log(`✅ ${testName}: ${result.duration}ms (${result.queriesPerSecond} QPS)`);
    } catch (error) {
      const result: PerformanceTestResult = {
        testName,
        duration: 0,
        queriesPerSecond: 0,
        success: false,
        error: error.message
      };

      this.results.push(result);
      console.error(`❌ ${testName}: ${error.message}`);
    }
  }

  private printResults(): void {
    console.log('\n📊 Performance Test Results Summary:');
    console.log('=' .repeat(80));
    
    const successfulTests = this.results.filter(r => r.success);
    const failedTests = this.results.filter(r => !r.success);
    
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Successful: ${successfulTests.length}`);
    console.log(`Failed: ${failedTests.length}`);
    
    if (successfulTests.length > 0) {
      console.log('\n🏆 Top Performing Tests:');
      successfulTests
        .sort((a, b) => b.queriesPerSecond - a.queriesPerSecond)
        .slice(0, 5)
        .forEach((result, index) => {
          console.log(`${index + 1}. ${result.testName}: ${result.queriesPerSecond} QPS`);
        });

      console.log('\n🐌 Slowest Tests:');
      successfulTests
        .sort((a, b) => a.queriesPerSecond - b.queriesPerSecond)
        .slice(0, 5)
        .forEach((result, index) => {
          console.log(`${index + 1}. ${result.testName}: ${result.queriesPerSecond} QPS`);
        });

      const avgQPS = successfulTests.reduce((sum, r) => sum + r.queriesPerSecond, 0) / successfulTests.length;
      const avgDuration = successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length;
      
      console.log('\n📈 Overall Performance:');
      console.log(`Average QPS: ${Math.round(avgQPS * 100) / 100}`);
      console.log(`Average Duration: ${Math.round(avgDuration * 100) / 100}ms`);
    }

    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(result => {
        console.log(`- ${result.testName}: ${result.error}`);
      });
    }
    
    console.log('=' .repeat(80));
  }

  async generateReport(): Promise<string> {
    let report = '# Database Performance Test Report\n\n';
    
    report += `**Test Date:** ${new Date().toISOString()}\n`;
    report += `**Total Tests:** ${this.results.length}\n`;
    report += `**Successful Tests:** ${this.results.filter(r => r.success).length}\n`;
    report += `**Failed Tests:** ${this.results.filter(r => !r.success).length}\n\n`;

    // Performance metrics
    const metrics = await this.db.getPerformanceMetrics();
    report += '## System Metrics\n\n';
    report += `- **Connection Pool Usage:** ${metrics.connections.poolUsage}%\n`;
    report += `- **Average Query Time:** ${metrics.queries.avgTime}ms\n`;
    report += `- **Query Error Rate:** ${metrics.queries.errorRate}%\n`;
    report += `- **Database Size:** ${this.formatBytes(metrics.database.size)}\n\n`;

    // Cache statistics
    const cacheStats = await this.db.getCacheStats();
    report += '## Cache Performance\n\n';
    report += `- **Hit Rate:** ${cacheStats.hitRate}%\n`;
    report += `- **Key Count:** ${cacheStats.keyCount}\n`;
    report += `- **Memory Usage:** ${this.formatBytes(cacheStats.memoryUsage)}\n\n`;

    // Test results
    report += '## Test Results\n\n';
    report += '| Test Name | Duration (ms) | QPS | Status |\n';
    report += '|-----------|---------------|-----|--------|\n';
    
    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      report += `| ${result.testName} | ${result.duration} | ${result.queriesPerSecond} | ${status} |\n`;
    });

    // Recommendations
    report += '\n## Recommendations\n\n';
    
    const slowTests = this.results
      .filter(r => r.success && r.queriesPerSecond < 10)
      .map(r => r.testName);
    
    if (slowTests.length > 0) {
      report += '### Performance Improvements Needed\n\n';
      slowTests.forEach(testName => {
        report += `- **${testName}**: Consider adding indexes or optimizing query structure\n`;
      });
    }

    if (cacheStats.hitRate < 70) {
      report += '- **Cache Hit Rate**: Consider increasing cache TTL or improving cache warming strategies\n';
    }

    if (metrics.connections.poolUsage > 80) {
      report += '- **Connection Pool**: Consider increasing pool size or optimizing connection usage\n';
    }

    return report;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// CLI runner for performance tests
if (require.main === module) {
  const tester = new DatabasePerformanceTester();
  
  tester.runAllTests()
    .then(async (results) => {
      console.log('\n📄 Generating performance report...');
      const report = await tester.generateReport();
      
      // Save report to file
      const fs = require('fs');
      const reportPath = `performance-report-${Date.now()}.md`;
      fs.writeFileSync(reportPath, report);
      
      console.log(`✅ Performance report saved to: ${reportPath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Performance tests failed:', error);
      process.exit(1);
    });
}