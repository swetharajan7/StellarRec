"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionTracker = void 0;
const logger_1 = require("../logger");
const database_1 = require("../database");
class SubmissionTracker {
    constructor() {
        this.logger = new logger_1.Logger('SubmissionTracker');
        this.db = new database_1.DatabaseService();
    }
    async trackSubmission(data) {
        try {
            const query = `
        INSERT INTO integration_submissions (
          recommendation_id, university_id, external_submission_id, status,
          submission_data, submitted_at, metadata, integration_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
            const universityQuery = `
        SELECT ui.integration_type 
        FROM university_integrations ui 
        WHERE ui.university_id = $1
      `;
            const universityResult = await this.db.query(universityQuery, [data.universityId]);
            const integrationType = universityResult.rows[0]?.integration_type || 'email';
            const result = await this.db.query(query, [
                data.recommendationId,
                data.universityId,
                data.submissionId,
                data.status,
                JSON.stringify({
                    recommendationId: data.recommendationId,
                    universityId: data.universityId,
                    submittedAt: data.submittedAt
                }),
                data.submittedAt,
                JSON.stringify(data.metadata),
                integrationType
            ]);
            const trackingId = result.rows[0].id;
            this.logger.info(`Tracked submission ${trackingId} for recommendation ${data.recommendationId}`);
            return trackingId;
        }
        catch (error) {
            this.logger.error('Failed to track submission:', error);
            throw error;
        }
    }
    async updateSubmissionStatus(submissionId, status, metadata) {
        try {
            const query = `
        UPDATE integration_submissions 
        SET status = $1, 
            response_data = COALESCE(response_data, '{}') || $2,
            metadata = COALESCE(metadata, '{}') || $3,
            updated_at = CURRENT_TIMESTAMP,
            confirmed_at = CASE WHEN $1 IN ('confirmed', 'delivered') THEN CURRENT_TIMESTAMP ELSE confirmed_at END
        WHERE external_submission_id = $4 OR id::text = $4
      `;
            await this.db.query(query, [
                status,
                JSON.stringify(metadata || {}),
                JSON.stringify({ status_change_reason: `Updated to ${status}`, ...metadata }),
                submissionId
            ]);
            this.logger.info(`Updated submission ${submissionId} status to ${status}`);
        }
        catch (error) {
            this.logger.error(`Failed to update submission status for ${submissionId}:`, error);
            throw error;
        }
    }
    async getSubmissionsByRecommendation(recommendationId) {
        try {
            const query = `
        SELECT 
          is_sub.*,
          u.name as university_name,
          u.code as university_code,
          ui.integration_type
        FROM integration_submissions is_sub
        INNER JOIN universities u ON is_sub.university_id = u.id
        LEFT JOIN university_integrations ui ON u.id = ui.university_id
        WHERE is_sub.recommendation_id = $1
        ORDER BY is_sub.created_at DESC
      `;
            const result = await this.db.query(query, [recommendationId]);
            return result.rows.map(row => ({
                id: row.id,
                universityId: row.university_id,
                universityName: row.university_name,
                universityCode: row.university_code,
                integrationType: row.integration_type,
                externalSubmissionId: row.external_submission_id,
                status: row.status,
                submittedAt: row.submitted_at,
                confirmedAt: row.confirmed_at,
                errorMessage: row.error_message,
                retryCount: row.retry_count,
                nextRetryAt: row.next_retry_at,
                metadata: row.metadata
            }));
        }
        catch (error) {
            this.logger.error(`Failed to get submissions for recommendation ${recommendationId}:`, error);
            throw error;
        }
    }
    async getFailedSubmissions(recommendationId) {
        try {
            const query = `
        SELECT 
          is_sub.*,
          u.name as university_name,
          u.code as university_code,
          ui.integration_type
        FROM integration_submissions is_sub
        INNER JOIN universities u ON is_sub.university_id = u.id
        LEFT JOIN university_integrations ui ON u.id = ui.university_id
        WHERE is_sub.recommendation_id = $1 
          AND is_sub.status IN ('failed', 'retry')
          AND is_sub.retry_count < is_sub.max_retries
        ORDER BY is_sub.created_at DESC
      `;
            const result = await this.db.query(query, [recommendationId]);
            return result.rows;
        }
        catch (error) {
            this.logger.error(`Failed to get failed submissions for ${recommendationId}:`, error);
            throw error;
        }
    }
    async storeBulkSubmissionResult(result) {
        try {
            for (const submissionResult of result.results) {
                if (submissionResult.universityId) {
                    await this.trackSubmission({
                        recommendationId: result.recommendationId,
                        universityId: submissionResult.universityId,
                        submissionId: submissionResult.submissionId,
                        status: submissionResult.status,
                        submittedAt: new Date(),
                        metadata: submissionResult.metadata || {}
                    });
                }
            }
            this.logger.info(`Stored bulk submission result for recommendation ${result.recommendationId}`);
        }
        catch (error) {
            this.logger.error('Failed to store bulk submission result:', error);
            throw error;
        }
    }
    async getSubmissionStatistics(filters) {
        try {
            let whereConditions = ['1=1'];
            let params = [];
            let paramIndex = 1;
            if (filters?.dateFrom) {
                whereConditions.push(`is_sub.created_at >= $${paramIndex}`);
                params.push(filters.dateFrom);
                paramIndex++;
            }
            if (filters?.dateTo) {
                whereConditions.push(`is_sub.created_at <= $${paramIndex}`);
                params.push(filters.dateTo);
                paramIndex++;
            }
            if (filters?.integrationType) {
                whereConditions.push(`is_sub.integration_type = $${paramIndex}`);
                params.push(filters.integrationType);
                paramIndex++;
            }
            if (filters?.universityId) {
                whereConditions.push(`is_sub.university_id = $${paramIndex}`);
                params.push(filters.universityId);
                paramIndex++;
            }
            const whereClause = whereConditions.join(' AND ');
            const overallQuery = `
        SELECT 
          COUNT(*) as total_submissions,
          COUNT(CASE WHEN status IN ('confirmed', 'delivered') THEN 1 END) as successful_submissions,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_submissions,
          COUNT(CASE WHEN status IN ('pending', 'processing', 'retry') THEN 1 END) as pending_submissions
        FROM integration_submissions is_sub
        WHERE ${whereClause}
      `;
            const byTypeQuery = `
        SELECT 
          integration_type,
          COUNT(*) as total,
          COUNT(CASE WHEN status IN ('confirmed', 'delivered') THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          ROUND(
            COUNT(CASE WHEN status IN ('confirmed', 'delivered') THEN 1 END) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
          ) as success_rate
        FROM integration_submissions is_sub
        WHERE ${whereClause}
        GROUP BY integration_type
      `;
            const byStatusQuery = `
        SELECT status, COUNT(*) as count
        FROM integration_submissions is_sub
        WHERE ${whereClause}
        GROUP BY status
      `;
            const [overallResult, byTypeResult, byStatusResult] = await Promise.all([
                this.db.query(overallQuery, params),
                this.db.query(byTypeQuery, params),
                this.db.query(byStatusQuery, params)
            ]);
            const overall = overallResult.rows[0];
            const successRate = overall.total_submissions > 0
                ? (overall.successful_submissions / overall.total_submissions) * 100
                : 0;
            return {
                totalSubmissions: parseInt(overall.total_submissions),
                successfulSubmissions: parseInt(overall.successful_submissions),
                failedSubmissions: parseInt(overall.failed_submissions),
                pendingSubmissions: parseInt(overall.pending_submissions),
                successRate: Math.round(successRate * 100) / 100,
                byIntegrationType: byTypeResult.rows.reduce((acc, row) => {
                    acc[row.integration_type] = {
                        total: parseInt(row.total),
                        successful: parseInt(row.successful),
                        failed: parseInt(row.failed),
                        successRate: parseFloat(row.success_rate) || 0
                    };
                    return acc;
                }, {}),
                byStatus: byStatusResult.rows.reduce((acc, row) => {
                    acc[row.status] = parseInt(row.count);
                    return acc;
                }, {})
            };
        }
        catch (error) {
            this.logger.error('Failed to get submission statistics:', error);
            throw error;
        }
    }
    async getSubmissionsForRetry() {
        try {
            const query = `
        SELECT 
          is_sub.*,
          u.name as university_name,
          u.code as university_code
        FROM integration_submissions is_sub
        INNER JOIN universities u ON is_sub.university_id = u.id
        WHERE is_sub.status = 'retry'
          AND is_sub.next_retry_at <= CURRENT_TIMESTAMP
          AND is_sub.retry_count < is_sub.max_retries
        ORDER BY is_sub.next_retry_at ASC
        LIMIT 100
      `;
            const result = await this.db.query(query);
            return result.rows;
        }
        catch (error) {
            this.logger.error('Failed to get submissions for retry:', error);
            throw error;
        }
    }
    async markForRetry(submissionId, retryAfter, errorMessage) {
        try {
            const query = `
        UPDATE integration_submissions 
        SET status = 'retry',
            retry_count = retry_count + 1,
            next_retry_at = $1,
            error_message = COALESCE($2, error_message),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 OR external_submission_id = $3
      `;
            await this.db.query(query, [retryAfter, errorMessage, submissionId]);
            this.logger.info(`Marked submission ${submissionId} for retry at ${retryAfter}`);
        }
        catch (error) {
            this.logger.error(`Failed to mark submission ${submissionId} for retry:`, error);
            throw error;
        }
    }
    async getOriginalRequest(recommendationId) {
        try {
            const query = `
        SELECT 
          r.*,
          s.first_name as student_first_name,
          s.last_name as student_last_name,
          s.email as student_email,
          rec.first_name as recommender_first_name,
          rec.last_name as recommender_last_name,
          rec.email as recommender_email
        FROM recommendations r
        LEFT JOIN students s ON r.student_id = s.id
        LEFT JOIN recommenders rec ON r.recommender_id = rec.id
        WHERE r.id = $1
      `;
            const result = await this.db.query(query, [recommendationId]);
            if (result.rows.length === 0) {
                throw new Error(`Recommendation ${recommendationId} not found`);
            }
            const row = result.rows[0];
            return {
                recommendationId,
                studentData: {
                    id: row.student_id,
                    firstName: row.student_first_name,
                    lastName: row.student_last_name,
                    email: row.student_email,
                    dateOfBirth: new Date('1990-01-01'),
                    address: {
                        street: '',
                        city: '',
                        state: '',
                        zipCode: '',
                        country: 'US'
                    },
                    academicInfo: {
                        currentInstitution: '',
                        gpa: 3.5,
                        graduationDate: new Date(),
                        major: ''
                    }
                },
                recommenderData: {
                    id: row.recommender_id,
                    firstName: row.recommender_first_name,
                    lastName: row.recommender_last_name,
                    email: row.recommender_email,
                    title: '',
                    institution: '',
                    relationship: '',
                    yearsKnown: 1
                },
                recommendationContent: {
                    content: row.content || '',
                    wordCount: row.word_count || 0,
                    programType: row.program_type || 'graduate',
                    customizations: {}
                },
                metadata: {
                    submissionType: 'recommendation',
                    priority: 'normal',
                    deadline: new Date(),
                    source: 'web',
                    version: '1.0'
                }
            };
        }
        catch (error) {
            this.logger.error(`Failed to get original request for ${recommendationId}:`, error);
            throw error;
        }
    }
    async cleanupOldSubmissions(olderThanDays = 90) {
        try {
            const query = `
        DELETE FROM integration_submissions 
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${olderThanDays} days'
          AND status IN ('confirmed', 'delivered', 'failed')
      `;
            const result = await this.db.query(query);
            const deletedCount = result.rowCount || 0;
            this.logger.info(`Cleaned up ${deletedCount} old submissions`);
            return deletedCount;
        }
        catch (error) {
            this.logger.error('Failed to cleanup old submissions:', error);
            throw error;
        }
    }
}
exports.SubmissionTracker = SubmissionTracker;
//# sourceMappingURL=SubmissionTracker.js.map