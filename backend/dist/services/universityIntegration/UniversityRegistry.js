"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversityRegistry = void 0;
const logger_1 = require("../logger");
const database_1 = require("../database");
class UniversityRegistry {
    constructor() {
        this.logger = new logger_1.Logger('UniversityRegistry');
        this.cache = new Map();
        this.cacheExpiry = new Map();
        this.CACHE_TTL = 5 * 60 * 1000;
        this.db = new database_1.DatabaseService();
    }
    async getUniversityConfig(universityId) {
        if (this.cache.has(universityId)) {
            const expiry = this.cacheExpiry.get(universityId);
            if (expiry && expiry > new Date()) {
                return this.cache.get(universityId);
            }
        }
        try {
            const query = `
        SELECT 
          u.*,
          ui.integration_type,
          ui.api_endpoint,
          ui.auth_config,
          ui.submission_format,
          ui.rate_limit_config,
          ui.features,
          ui.requirements,
          ui.is_active as integration_active,
          ui.last_updated as integration_updated,
          ui.metadata as integration_metadata
        FROM universities u
        LEFT JOIN university_integrations ui ON u.id = ui.university_id
        WHERE u.id = $1
      `;
            const result = await this.db.query(query, [universityId]);
            if (result.rows.length === 0) {
                return null;
            }
            const row = result.rows[0];
            const config = this.mapRowToConfig(row);
            this.cache.set(universityId, config);
            this.cacheExpiry.set(universityId, new Date(Date.now() + this.CACHE_TTL));
            return config;
        }
        catch (error) {
            this.logger.error(`Failed to get university config for ${universityId}:`, error);
            return null;
        }
    }
    async getUniversitiesByIntegrationType(integrationType) {
        try {
            const query = `
        SELECT 
          u.*,
          ui.integration_type,
          ui.api_endpoint,
          ui.auth_config,
          ui.submission_format,
          ui.rate_limit_config,
          ui.features,
          ui.requirements,
          ui.is_active as integration_active,
          ui.last_updated as integration_updated,
          ui.metadata as integration_metadata
        FROM universities u
        INNER JOIN university_integrations ui ON u.id = ui.university_id
        WHERE ui.integration_type = $1 AND ui.is_active = true
        ORDER BY u.name
      `;
            const result = await this.db.query(query, [integrationType]);
            return result.rows.map(row => this.mapRowToConfig(row));
        }
        catch (error) {
            this.logger.error(`Failed to get universities by integration type ${integrationType}:`, error);
            return [];
        }
    }
    async getUniversitiesByLocation(country, state, province) {
        try {
            let query = `
        SELECT 
          u.*,
          ui.integration_type,
          ui.api_endpoint,
          ui.auth_config,
          ui.submission_format,
          ui.rate_limit_config,
          ui.features,
          ui.requirements,
          ui.is_active as integration_active,
          ui.last_updated as integration_updated,
          ui.metadata as integration_metadata
        FROM universities u
        LEFT JOIN university_integrations ui ON u.id = ui.university_id
        WHERE u.country = $1
      `;
            const params = [country];
            if (country === 'US' && state) {
                query += ' AND u.state = $2';
                params.push(state);
            }
            else if (country === 'CA' && province) {
                query += ' AND u.province = $2';
                params.push(province);
            }
            query += ' ORDER BY u.name';
            const result = await this.db.query(query, params);
            return result.rows.map(row => this.mapRowToConfig(row));
        }
        catch (error) {
            this.logger.error(`Failed to get universities by location:`, error);
            return [];
        }
    }
    async upsertUniversityIntegration(universityId, config) {
        try {
            const query = `
        INSERT INTO university_integrations (
          university_id, integration_type, api_endpoint, auth_config,
          submission_format, rate_limit_config, features, requirements,
          is_active, metadata, last_updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
        ON CONFLICT (university_id) 
        DO UPDATE SET
          integration_type = EXCLUDED.integration_type,
          api_endpoint = EXCLUDED.api_endpoint,
          auth_config = EXCLUDED.auth_config,
          submission_format = EXCLUDED.submission_format,
          rate_limit_config = EXCLUDED.rate_limit_config,
          features = EXCLUDED.features,
          requirements = EXCLUDED.requirements,
          is_active = EXCLUDED.is_active,
          metadata = EXCLUDED.metadata,
          last_updated = CURRENT_TIMESTAMP
      `;
            await this.db.query(query, [
                universityId,
                config.integrationType,
                config.apiEndpoint,
                JSON.stringify(config.authConfig),
                config.submissionFormat,
                JSON.stringify(config.rateLimit),
                JSON.stringify(config.features),
                JSON.stringify(config.requirements),
                config.isActive ?? true,
                JSON.stringify(config.metadata || {})
            ]);
            this.cache.delete(universityId);
            this.cacheExpiry.delete(universityId);
            this.logger.info(`Updated integration config for university ${universityId}`);
        }
        catch (error) {
            this.logger.error(`Failed to upsert university integration:`, error);
            throw error;
        }
    }
    async getIntegrationStatistics() {
        try {
            const queries = [
                'SELECT COUNT(*) as total FROM universities WHERE is_active = true',
                `SELECT ui.integration_type, COUNT(*) as count 
         FROM university_integrations ui 
         INNER JOIN universities u ON ui.university_id = u.id 
         WHERE ui.is_active = true AND u.is_active = true 
         GROUP BY ui.integration_type`,
                `SELECT country, COUNT(*) as count 
         FROM universities 
         WHERE is_active = true 
         GROUP BY country`,
                `SELECT state, COUNT(*) as count 
         FROM universities 
         WHERE is_active = true AND country = 'US' AND state IS NOT NULL 
         GROUP BY state`
            ];
            const [totalResult, typeResult, countryResult, stateResult] = await Promise.all(queries.map(query => this.db.query(query)));
            return {
                totalUniversities: parseInt(totalResult.rows[0].total),
                byIntegrationType: typeResult.rows.reduce((acc, row) => {
                    acc[row.integration_type] = parseInt(row.count);
                    return acc;
                }, {}),
                byCountry: countryResult.rows.reduce((acc, row) => {
                    acc[row.country] = parseInt(row.count);
                    return acc;
                }, {}),
                byState: stateResult.rows.reduce((acc, row) => {
                    acc[row.state] = parseInt(row.count);
                    return acc;
                }, {})
            };
        }
        catch (error) {
            this.logger.error('Failed to get integration statistics:', error);
            throw error;
        }
    }
    async searchUniversities(filters) {
        try {
            let whereConditions = [];
            let params = [];
            let paramIndex = 1;
            if (filters.search) {
                whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.code ILIKE $${paramIndex})`);
                params.push(`%${filters.search}%`);
                paramIndex++;
            }
            if (filters.country) {
                whereConditions.push(`u.country = $${paramIndex}`);
                params.push(filters.country);
                paramIndex++;
            }
            if (filters.state) {
                whereConditions.push(`u.state = $${paramIndex}`);
                params.push(filters.state);
                paramIndex++;
            }
            if (filters.province) {
                whereConditions.push(`u.province = $${paramIndex}`);
                params.push(filters.province);
                paramIndex++;
            }
            if (filters.integrationType) {
                whereConditions.push(`ui.integration_type = $${paramIndex}`);
                params.push(filters.integrationType);
                paramIndex++;
            }
            if (filters.programType) {
                whereConditions.push(`ui.requirements->>'supportedPrograms' LIKE $${paramIndex}`);
                params.push(`%${filters.programType}%`);
                paramIndex++;
            }
            if (filters.isActive !== undefined) {
                whereConditions.push(`u.is_active = $${paramIndex}`);
                params.push(filters.isActive);
                paramIndex++;
            }
            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
            const countQuery = `
        SELECT COUNT(*) as total
        FROM universities u
        LEFT JOIN university_integrations ui ON u.id = ui.university_id
        ${whereClause}
      `;
            const dataQuery = `
        SELECT 
          u.*,
          ui.integration_type,
          ui.api_endpoint,
          ui.auth_config,
          ui.submission_format,
          ui.rate_limit_config,
          ui.features,
          ui.requirements,
          ui.is_active as integration_active,
          ui.last_updated as integration_updated,
          ui.metadata as integration_metadata
        FROM universities u
        LEFT JOIN university_integrations ui ON u.id = ui.university_id
        ${whereClause}
        ORDER BY u.name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
            params.push(filters.limit || 50);
            params.push(filters.offset || 0);
            const [countResult, dataResult] = await Promise.all([
                this.db.query(countQuery, params.slice(0, -2)),
                this.db.query(dataQuery, params)
            ]);
            return {
                universities: dataResult.rows.map(row => this.mapRowToConfig(row)),
                total: parseInt(countResult.rows[0].total)
            };
        }
        catch (error) {
            this.logger.error('Failed to search universities:', error);
            throw error;
        }
    }
    async bulkLoadUniversities(universities) {
        let success = 0;
        let failed = 0;
        const errors = [];
        for (const university of universities) {
            try {
                await this.upsertUniversityIntegration(university.id, university);
                success++;
            }
            catch (error) {
                failed++;
                errors.push(`${university.name}: ${error.message}`);
            }
        }
        this.logger.info(`Bulk load completed: ${success} success, ${failed} failed`);
        return { success, failed, errors };
    }
    mapRowToConfig(row) {
        return {
            id: row.id,
            code: row.code,
            name: row.name,
            country: row.country,
            state: row.state,
            province: row.province,
            integrationType: row.integration_type || 'email',
            apiEndpoint: row.api_endpoint,
            authConfig: row.auth_config ? JSON.parse(row.auth_config) : undefined,
            submissionFormat: row.submission_format || 'email',
            rateLimit: row.rate_limit_config ? JSON.parse(row.rate_limit_config) : {
                requestsPerMinute: 10,
                requestsPerHour: 100,
                requestsPerDay: 1000,
                burstLimit: 5
            },
            features: row.features ? JSON.parse(row.features) : {
                realTimeStatus: false,
                bulkSubmission: false,
                documentUpload: false,
                statusWebhooks: false,
                customFields: false
            },
            requirements: row.requirements ? JSON.parse(row.requirements) : {
                requiredFields: ['student_name', 'recommender_name', 'recommendation_content'],
                optionalFields: [],
                documentTypes: ['recommendation_letter'],
                maxRecommendationLength: 5000,
                supportedPrograms: ['undergraduate', 'graduate', 'doctoral'],
                deadlineBuffer: 24
            },
            isActive: row.integration_active ?? row.is_active ?? true,
            lastUpdated: new Date(row.integration_updated || row.updated_at),
            metadata: row.integration_metadata ? JSON.parse(row.integration_metadata) : {}
        };
    }
    clearCache() {
        this.cache.clear();
        this.cacheExpiry.clear();
        this.logger.info('University registry cache cleared');
    }
}
exports.UniversityRegistry = UniversityRegistry;
//# sourceMappingURL=UniversityRegistry.js.map