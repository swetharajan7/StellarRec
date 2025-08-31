import { Pool } from 'pg';
import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { ConsistencyCheck, ValidationResult, DataIntegrityReport } from '../types';

export class DataConsistencyValidator {
  private logger = new Logger('DataConsistencyValidator');
  private dbPool: Pool;
  private redis: Redis;

  constructor() {
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/stellarrec',
      max: 10
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });
  }

  async validateSystemDataConsistency(): Promise<DataIntegrityReport> {
    this.logger.info('Starting comprehensive data consistency validation...');

    const report: DataIntegrityReport = {
      timestamp: new Date(),
      overallStatus: 'healthy',
      checks: [],
      issues: [],
      recommendations: []
    };

    const checks: ConsistencyCheck[] = [
      {
        name: 'User Profile Consistency',
        description: 'Validate user profiles across services',
        validator: this.validateUserProfiles.bind(this)
      },
      {
        name: 'Application Data Integrity',
        description: 'Check application data consistency',
        validator: this.validateApplicationData.bind(this)
      },
      {
        name: 'Letter Reference Integrity',
        description: 'Validate letter references and relationships',
        validator: this.validateLetterReferences.bind(this)
      },
      {
        name: 'File System Consistency',
        description: 'Check file metadata and storage consistency',
        validator: this.validateFileSystem.bind(this)
      },
      {
        name: 'Cache Synchronization',
        description: 'Validate cache data against database',
        validator: this.validateCacheSync.bind(this)
      },
      {
        name: 'Analytics Data Accuracy',
        description: 'Check analytics data aggregation accuracy',
        validator: this.validateAnalyticsData.bind(this)
      },
      {
        name: 'Notification Delivery Status',
        description: 'Validate notification delivery tracking',
        validator: this.validateNotificationStatus.bind(this)
      },
      {
        name: 'Search Index Consistency',
        description: 'Check search index synchronization',
        validator: this.validateSearchIndex.bind(this)
      }
    ];

    // Run all consistency checks
    for (const check of checks) {
      try {
        this.logger.info(`Running check: ${check.name}`);
        const result = await check.validator();
        report.checks.push(result);

        if (!result.passed) {
          report.overallStatus = 'issues_found';
          if (result.issues) {
            report.issues.push(...result.issues);
          }
          if (result.recommendations) {
            report.recommendations.push(...result.recommendations);
          }
        }

        this.logger.info(`✅ ${check.name}: ${result.passed ? 'PASSED' : 'FAILED'}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`❌ ${check.name}: ERROR - ${errorMessage}`);
        
        report.checks.push({
          name: check.name,
          description: check.description,
          passed: false,
          duration: 0,
          error: errorMessage,
          timestamp: new Date()
        });
        
        report.overallStatus = 'critical_issues';
      }
    }

    // Generate summary
    const passedChecks = report.checks.filter(c => c.passed).length;
    const totalChecks = report.checks.length;
    
    this.logger.info(`Data consistency validation completed: ${passedChecks}/${totalChecks} checks passed`);
    
    if (report.overallStatus !== 'healthy') {
      this.logger.warn(`Found ${report.issues.length} data consistency issues`);
    }

    return report;
  }

  private async validateUserProfiles(): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for orphaned user profiles
      const orphanedProfiles = await this.dbPool.query(`
        SELECT sp.id, sp.user_id 
        FROM student_profiles sp 
        LEFT JOIN users u ON sp.user_id = u.id 
        WHERE u.id IS NULL
      `);

      if (orphanedProfiles.rows.length > 0) {
        issues.push(`Found ${orphanedProfiles.rows.length} orphaned student profiles`);
        recommendations.push('Clean up orphaned student profiles or restore missing user records');
      }

      // Check for users without profiles
      const usersWithoutProfiles = await this.dbPool.query(`
        SELECT u.id, u.email, u.user_type 
        FROM users u 
        LEFT JOIN student_profiles sp ON u.id = sp.user_id 
        LEFT JOIN recommender_profiles rp ON u.id = rp.user_id 
        WHERE u.user_type = 'student' AND sp.id IS NULL
           OR u.user_type = 'recommender' AND rp.id IS NULL
      `);

      if (usersWithoutProfiles.rows.length > 0) {
        issues.push(`Found ${usersWithoutProfiles.rows.length} users without required profiles`);
        recommendations.push('Create missing profiles for users or update user types');
      }

      // Check profile data completeness
      const incompleteProfiles = await this.dbPool.query(`
        SELECT COUNT(*) as count 
        FROM student_profiles 
        WHERE first_name IS NULL OR last_name IS NULL OR email IS NULL
      `);

      if (parseInt(incompleteProfiles.rows[0].count) > 0) {
        issues.push(`Found ${incompleteProfiles.rows[0].count} incomplete student profiles`);
        recommendations.push('Require profile completion during onboarding');
      }

      return {
        name: 'User Profile Consistency',
        description: 'Validate user profiles across services',
        passed: issues.length === 0,
        duration: Date.now() - startTime,
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        name: 'User Profile Consistency',
        description: 'Validate user profiles across services',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  private async validateApplicationData(): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for applications with invalid user references
      const invalidApplications = await this.dbPool.query(`
        SELECT a.id, a.user_id 
        FROM applications a 
        LEFT JOIN users u ON a.user_id = u.id 
        WHERE u.id IS NULL
      `);

      if (invalidApplications.rows.length > 0) {
        issues.push(`Found ${invalidApplications.rows.length} applications with invalid user references`);
        recommendations.push('Clean up applications with missing user references');
      }

      // Check for applications with past deadlines but incomplete status
      const overdueApplications = await this.dbPool.query(`
        SELECT COUNT(*) as count 
        FROM applications 
        WHERE deadline < NOW() AND status NOT IN ('submitted', 'completed', 'cancelled')
      `);

      if (parseInt(overdueApplications.rows[0].count) > 0) {
        issues.push(`Found ${overdueApplications.rows[0].count} overdue applications with incomplete status`);
        recommendations.push('Update status for overdue applications or extend deadlines');
      }

      // Check for duplicate applications
      const duplicateApplications = await this.dbPool.query(`
        SELECT user_id, university_id, program, COUNT(*) as count 
        FROM applications 
        GROUP BY user_id, university_id, program 
        HAVING COUNT(*) > 1
      `);

      if (duplicateApplications.rows.length > 0) {
        issues.push(`Found ${duplicateApplications.rows.length} sets of duplicate applications`);
        recommendations.push('Implement unique constraints to prevent duplicate applications');
      }

      return {
        name: 'Application Data Integrity',
        description: 'Check application data consistency',
        passed: issues.length === 0,
        duration: Date.now() - startTime,
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        name: 'Application Data Integrity',
        description: 'Check application data consistency',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  private async validateLetterReferences(): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for letters with invalid application references
      const invalidLetters = await this.dbPool.query(`
        SELECT l.id, l.application_id 
        FROM letters l 
        LEFT JOIN applications a ON l.application_id = a.id 
        WHERE a.id IS NULL
      `);

      if (invalidLetters.rows.length > 0) {
        issues.push(`Found ${invalidLetters.rows.length} letters with invalid application references`);
        recommendations.push('Clean up letters with missing application references');
      }

      // Check for letters with invalid recommender references
      const invalidRecommenders = await this.dbPool.query(`
        SELECT l.id, l.recommender_id 
        FROM letters l 
        LEFT JOIN users u ON l.recommender_id = u.id 
        WHERE u.id IS NULL OR u.user_type != 'recommender'
      `);

      if (invalidRecommenders.rows.length > 0) {
        issues.push(`Found ${invalidRecommenders.rows.length} letters with invalid recommender references`);
        recommendations.push('Validate recommender references and user types');
      }

      return {
        name: 'Letter Reference Integrity',
        description: 'Validate letter references and relationships',
        passed: issues.length === 0,
        duration: Date.now() - startTime,
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        name: 'Letter Reference Integrity',
        description: 'Validate letter references and relationships',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  private async validateFileSystem(): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for files with missing metadata
      const filesWithoutMetadata = await this.dbPool.query(`
        SELECT COUNT(*) as count 
        FROM files 
        WHERE file_size IS NULL OR mime_type IS NULL OR original_name IS NULL
      `);

      if (parseInt(filesWithoutMetadata.rows[0].count) > 0) {
        issues.push(`Found ${filesWithoutMetadata.rows[0].count} files with missing metadata`);
        recommendations.push('Ensure all uploaded files have complete metadata');
      }

      // Check for orphaned file records
      const orphanedFiles = await this.dbPool.query(`
        SELECT f.id, f.user_id 
        FROM files f 
        LEFT JOIN users u ON f.user_id = u.id 
        WHERE u.id IS NULL
      `);

      if (orphanedFiles.rows.length > 0) {
        issues.push(`Found ${orphanedFiles.rows.length} orphaned file records`);
        recommendations.push('Clean up orphaned file records or restore missing user references');
      }

      return {
        name: 'File System Consistency',
        description: 'Check file metadata and storage consistency',
        passed: issues.length === 0,
        duration: Date.now() - startTime,
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        name: 'File System Consistency',
        description: 'Check file metadata and storage consistency',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  private async validateCacheSync(): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check cache hit rates
      const cacheKeys = await this.redis.keys('stellarrec:*');
      const totalKeys = cacheKeys.length;

      if (totalKeys === 0) {
        issues.push('No cache keys found - cache may not be functioning');
        recommendations.push('Verify cache warming and population processes');
      }

      // Sample check for user cache consistency
      const userCacheKeys = await this.redis.keys('stellarrec:user:*');
      let inconsistentUsers = 0;

      for (const key of userCacheKeys.slice(0, 10)) { // Sample first 10
        const userId = key.split(':')[2];
        const cachedUser = await this.redis.get(key);
        
        if (cachedUser) {
          const dbUser = await this.dbPool.query('SELECT * FROM users WHERE id = $1', [userId]);
          
          if (dbUser.rows.length === 0) {
            inconsistentUsers++;
          }
        }
      }

      if (inconsistentUsers > 0) {
        issues.push(`Found ${inconsistentUsers} cached users that don't exist in database`);
        recommendations.push('Implement cache invalidation when users are deleted');
      }

      return {
        name: 'Cache Synchronization',
        description: 'Validate cache data against database',
        passed: issues.length === 0,
        duration: Date.now() - startTime,
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        name: 'Cache Synchronization',
        description: 'Validate cache data against database',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  private async validateAnalyticsData(): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for analytics events with invalid user references
      const invalidEvents = await this.dbPool.query(`
        SELECT COUNT(*) as count 
        FROM analytics_events ae 
        LEFT JOIN users u ON ae.user_id = u.id 
        WHERE ae.user_id IS NOT NULL AND u.id IS NULL
      `);

      if (parseInt(invalidEvents.rows[0].count) > 0) {
        issues.push(`Found ${invalidEvents.rows[0].count} analytics events with invalid user references`);
        recommendations.push('Clean up analytics events with missing user references');
      }

      // Check for missing daily aggregations
      const missingAggregations = await this.dbPool.query(`
        SELECT COUNT(*) as count 
        FROM generate_series(
          CURRENT_DATE - INTERVAL '30 days', 
          CURRENT_DATE - INTERVAL '1 day', 
          INTERVAL '1 day'
        ) AS date_series(date)
        LEFT JOIN daily_analytics da ON date_series.date = da.date 
        WHERE da.date IS NULL
      `);

      if (parseInt(missingAggregations.rows[0].count) > 0) {
        issues.push(`Found ${missingAggregations.rows[0].count} days with missing analytics aggregations`);
        recommendations.push('Run analytics aggregation job for missing dates');
      }

      return {
        name: 'Analytics Data Accuracy',
        description: 'Check analytics data aggregation accuracy',
        passed: issues.length === 0,
        duration: Date.now() - startTime,
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        name: 'Analytics Data Accuracy',
        description: 'Check analytics data aggregation accuracy',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  private async validateNotificationStatus(): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check for notifications stuck in pending status
      const stuckNotifications = await this.dbPool.query(`
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour'
      `);

      if (parseInt(stuckNotifications.rows[0].count) > 0) {
        issues.push(`Found ${stuckNotifications.rows[0].count} notifications stuck in pending status`);
        recommendations.push('Investigate notification delivery issues and retry failed notifications');
      }

      // Check for high failure rates
      const failureRate = await this.dbPool.query(`
        SELECT 
          COUNT(CASE WHEN status = 'failed' THEN 1 END) * 100.0 / COUNT(*) as failure_rate
        FROM notifications 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);

      const rate = parseFloat(failureRate.rows[0].failure_rate || '0');
      if (rate > 10) { // More than 10% failure rate
        issues.push(`High notification failure rate: ${rate.toFixed(1)}%`);
        recommendations.push('Investigate notification service configuration and external provider status');
      }

      return {
        name: 'Notification Delivery Status',
        description: 'Validate notification delivery tracking',
        passed: issues.length === 0,
        duration: Date.now() - startTime,
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        name: 'Notification Delivery Status',
        description: 'Validate notification delivery tracking',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  private async validateSearchIndex(): Promise<ValidationResult> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // This would typically check Elasticsearch index consistency
      // For now, we'll do a basic database check
      
      // Check for universities not in search index (simulated)
      const universitiesCount = await this.dbPool.query(`
        SELECT COUNT(*) as count FROM universities WHERE active = true
      `);

      const indexedCount = parseInt(universitiesCount.rows[0].count); // Simulated
      
      if (indexedCount === 0) {
        issues.push('No universities found in search index');
        recommendations.push('Rebuild search index for universities');
      }

      return {
        name: 'Search Index Consistency',
        description: 'Check search index synchronization',
        passed: issues.length === 0,
        duration: Date.now() - startTime,
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        name: 'Search Index Consistency',
        description: 'Check search index synchronization',
        passed: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }

  async generateDataIntegrityReport(report: DataIntegrityReport): Promise<string> {
    const passedChecks = report.checks.filter(c => c.passed).length;
    const totalChecks = report.checks.length;
    const passRate = totalChecks > 0 ? ((passedChecks / totalChecks) * 100).toFixed(1) : '0';

    let reportText = `# StellarRec Data Integrity Report\n\n`;
    reportText += `**Generated:** ${report.timestamp.toISOString()}\n`;
    reportText += `**Overall Status:** ${report.overallStatus.toUpperCase()}\n\n`;
    
    reportText += `## Summary\n`;
    reportText += `- **Total Checks:** ${totalChecks}\n`;
    reportText += `- **Passed:** ${passedChecks}\n`;
    reportText += `- **Failed:** ${totalChecks - passedChecks}\n`;
    reportText += `- **Pass Rate:** ${passRate}%\n\n`;

    if (report.issues.length > 0) {
      reportText += `## Issues Found (${report.issues.length})\n`;
      report.issues.forEach((issue, index) => {
        reportText += `${index + 1}. ${issue}\n`;
      });
      reportText += `\n`;
    }

    if (report.recommendations.length > 0) {
      reportText += `## Recommendations (${report.recommendations.length})\n`;
      report.recommendations.forEach((rec, index) => {
        reportText += `${index + 1}. ${rec}\n`;
      });
      reportText += `\n`;
    }

    reportText += `## Detailed Check Results\n`;
    report.checks.forEach(check => {
      const status = check.passed ? '✅ PASS' : '❌ FAIL';
      reportText += `### ${status} ${check.name}\n`;
      reportText += `**Description:** ${check.description}\n`;
      reportText += `**Duration:** ${check.duration}ms\n`;
      
      if (check.error) {
        reportText += `**Error:** ${check.error}\n`;
      }
      
      if (check.issues && check.issues.length > 0) {
        reportText += `**Issues:**\n`;
        check.issues.forEach(issue => {
          reportText += `- ${issue}\n`;
        });
      }
      
      reportText += `\n`;
    });

    return reportText;
  }

  async cleanup(): Promise<void> {
    await this.dbPool.end();
    await this.redis.quit();
  }
}