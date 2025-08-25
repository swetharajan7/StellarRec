"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const pg_1 = require("pg");
const logger_1 = require("./logger");
class DatabaseService {
    constructor(config) {
        this.logger = new logger_1.Logger('DatabaseService');
        this.isConnected = false;
        const dbConfig = config || {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'stellarrec',
            user: process.env.DB_USER || 'stellarrec_user',
            password: process.env.DB_PASSWORD || 'stellarrec_password',
            ssl: process.env.DB_SSL === 'true',
            maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
            idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
            connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
        };
        this.pool = new pg_1.Pool({
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password,
            ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false,
            max: dbConfig.maxConnections,
            idleTimeoutMillis: dbConfig.idleTimeoutMillis,
            connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
        });
        this.setupEventHandlers();
        this.testConnection();
    }
    async query(text, params) {
        const start = Date.now();
        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;
            this.logger.debug('Query executed', {
                query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                duration: `${duration}ms`,
                rows: result.rowCount
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.logger.error('Query failed', {
                query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                duration: `${duration}ms`,
                error: error instanceof Error ? error.message : 'Unknown error',
                params: params ? JSON.stringify(params).substring(0, 200) : undefined
            });
            throw error;
        }
    }
    async queryWithClient(client, text, params) {
        const start = Date.now();
        try {
            const result = await client.query(text, params);
            const duration = Date.now() - start;
            this.logger.debug('Query executed with client', {
                query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                duration: `${duration}ms`,
                rows: result.rowCount
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.logger.error('Query with client failed', {
                query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                duration: `${duration}ms`,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async getClient() {
        try {
            const client = await this.pool.connect();
            this.logger.debug('Database client acquired');
            return client;
        }
        catch (error) {
            this.logger.error('Failed to acquire database client:', error);
            throw error;
        }
    }
    async transaction(callback) {
        const client = await this.getClient();
        try {
            await client.query('BEGIN');
            this.logger.debug('Transaction started');
            const result = await callback(client);
            await client.query('COMMIT');
            this.logger.debug('Transaction committed');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            this.logger.error('Transaction rolled back:', error);
            throw error;
        }
        finally {
            client.release();
            this.logger.debug('Database client released');
        }
    }
    async isHealthy() {
        try {
            const result = await this.query('SELECT 1 as health_check');
            return result.rows.length === 1 && result.rows[0].health_check === 1;
        }
        catch (error) {
            this.logger.error('Database health check failed:', error);
            return false;
        }
    }
    async getStats() {
        return {
            totalConnections: this.pool.totalCount,
            idleConnections: this.pool.idleCount,
            waitingCount: this.pool.waitingCount,
        };
    }
    async close() {
        try {
            await this.pool.end();
            this.isConnected = false;
            this.logger.info('Database connections closed');
        }
        catch (error) {
            this.logger.error('Error closing database connections:', error);
            throw error;
        }
    }
    async batchQuery(queries) {
        return this.transaction(async (client) => {
            const results = [];
            for (const query of queries) {
                const result = await this.queryWithClient(client, query.text, query.params);
                results.push(result);
            }
            return results;
        });
    }
    async queryOne(text, params) {
        const result = await this.query(text, params);
        return result.rows.length > 0 ? result.rows[0] : null;
    }
    async queryMany(text, params) {
        const result = await this.query(text, params);
        return result.rows;
    }
    async tableExists(tableName) {
        const result = await this.query(`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`, [tableName]);
        return result.rows[0].exists;
    }
    async getTableRowCount(tableName) {
        const result = await this.query(`SELECT COUNT(*) as count FROM ${tableName}`);
        return parseInt(result.rows[0].count);
    }
    async executeSQLFile(sqlContent) {
        try {
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            for (const statement of statements) {
                if (statement.trim()) {
                    await this.query(statement);
                }
            }
            this.logger.info('SQL file executed successfully');
        }
        catch (error) {
            this.logger.error('Failed to execute SQL file:', error);
            throw error;
        }
    }
    async cleanupExpiredData() {
        try {
            await this.query('SELECT cleanup_expired_tokens()');
            this.logger.info('Expired data cleanup completed');
        }
        catch (error) {
            this.logger.error('Failed to cleanup expired data:', error);
            throw error;
        }
    }
    setupEventHandlers() {
        this.pool.on('connect', (client) => {
            this.isConnected = true;
            this.logger.debug('New database client connected');
        });
        this.pool.on('acquire', (client) => {
            this.logger.debug('Database client acquired from pool');
        });
        this.pool.on('remove', (client) => {
            this.logger.debug('Database client removed from pool');
        });
        this.pool.on('error', (err, client) => {
            this.logger.error('Database pool error:', err);
            this.isConnected = false;
        });
        process.on('SIGINT', () => {
            this.logger.info('Received SIGINT, closing database connections...');
            this.close().then(() => {
                process.exit(0);
            });
        });
        process.on('SIGTERM', () => {
            this.logger.info('Received SIGTERM, closing database connections...');
            this.close().then(() => {
                process.exit(0);
            });
        });
    }
    async testConnection() {
        try {
            const result = await this.query('SELECT NOW() as current_time, version() as db_version');
            const { current_time, db_version } = result.rows[0];
            this.isConnected = true;
            this.logger.info('Database connected successfully', {
                currentTime: current_time,
                version: db_version.split(' ')[0] + ' ' + db_version.split(' ')[1]
            });
        }
        catch (error) {
            this.isConnected = false;
            this.logger.error('Database connection failed:', error);
            setTimeout(() => {
                this.testConnection();
            }, 5000);
        }
    }
}
exports.DatabaseService = DatabaseService;
exports.default = new DatabaseService();
//# sourceMappingURL=database.js.map