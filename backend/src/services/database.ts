import { Pool, PoolClient, QueryResult } from 'pg';
import { Logger } from './logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseService {
  private pool: Pool;
  private logger = new Logger('DatabaseService');
  private isConnected = false;

  constructor(config?: DatabaseConfig) {
    const dbConfig: DatabaseConfig = config || {
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

    this.pool = new Pool({
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

  /**
   * Execute a SQL query
   */
  async query(text: string, params?: any[]): Promise<QueryResult> {
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
    } catch (error) {
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

  /**
   * Execute a query with a specific client (for transactions)
   */
  async queryWithClient(client: PoolClient, text: string, params?: any[]): Promise<QueryResult> {
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
    } catch (error) {
      const duration = Date.now() - start;
      
      this.logger.error('Query with client failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      this.logger.debug('Database client acquired');
      return client;
    } catch (error) {
      this.logger.error('Failed to acquire database client:', error);
      throw error;
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      this.logger.debug('Transaction started');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      this.logger.debug('Transaction committed');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
      this.logger.debug('Database client released');
    }
  }

  /**
   * Check if database is connected
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health_check');
      return result.rows.length === 1 && result.rows[0].health_check === 1;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalConnections: number;
    idleConnections: number;
    waitingCount: number;
  }> {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Close all database connections
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      this.logger.info('Database connections closed');
    } catch (error) {
      this.logger.error('Error closing database connections:', error);
      throw error;
    }
  }

  /**
   * Execute multiple queries in a single transaction
   */
  async batchQuery(queries: Array<{ text: string; params?: any[] }>): Promise<QueryResult[]> {
    return this.transaction(async (client) => {
      const results: QueryResult[] = [];
      
      for (const query of queries) {
        const result = await this.queryWithClient(client, query.text, query.params);
        results.push(result);
      }
      
      return results;
    });
  }

  /**
   * Execute a query and return the first row
   */
  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const result = await this.query(text, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryMany<T = any>(text: string, params?: any[]): Promise<T[]> {
    const result = await this.query(text, params);
    return result.rows;
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    const result = await this.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      [tableName]
    );
    
    return result.rows[0].exists;
  }

  /**
   * Get table row count
   */
  async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    return parseInt(result.rows[0].count);
  }

  /**
   * Execute database migrations or setup scripts
   */
  async executeSQLFile(sqlContent: string): Promise<void> {
    try {
      // Split SQL content by semicolons and execute each statement
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
    } catch (error) {
      this.logger.error('Failed to execute SQL file:', error);
      throw error;
    }
  }

  /**
   * Clean up expired tokens and old data
   */
  async cleanupExpiredData(): Promise<void> {
    try {
      await this.query('SELECT cleanup_expired_tokens()');
      this.logger.info('Expired data cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup expired data:', error);
      throw error;
    }
  }

  // Private methods

  private setupEventHandlers(): void {
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

    // Graceful shutdown
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

  private async testConnection(): Promise<void> {
    try {
      const result = await this.query('SELECT NOW() as current_time, version() as db_version');
      const { current_time, db_version } = result.rows[0];
      
      this.isConnected = true;
      this.logger.info('Database connected successfully', {
        currentTime: current_time,
        version: db_version.split(' ')[0] + ' ' + db_version.split(' ')[1]
      });
    } catch (error) {
      this.isConnected = false;
      this.logger.error('Database connection failed:', error);
      
      // Don't throw error on startup - let the application start and retry connections
      setTimeout(() => {
        this.testConnection();
      }, 5000);
    }
  }
}

// Export a singleton instance
export default new DatabaseService();