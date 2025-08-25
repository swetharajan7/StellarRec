import { PoolClient, QueryResult } from 'pg';
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
export declare class DatabaseService {
    private pool;
    private logger;
    private isConnected;
    constructor(config?: DatabaseConfig);
    query(text: string, params?: any[]): Promise<QueryResult>;
    queryWithClient(client: PoolClient, text: string, params?: any[]): Promise<QueryResult>;
    getClient(): Promise<PoolClient>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    isHealthy(): Promise<boolean>;
    getStats(): Promise<{
        totalConnections: number;
        idleConnections: number;
        waitingCount: number;
    }>;
    close(): Promise<void>;
    batchQuery(queries: Array<{
        text: string;
        params?: any[];
    }>): Promise<QueryResult[]>;
    queryOne<T = any>(text: string, params?: any[]): Promise<T | null>;
    queryMany<T = any>(text: string, params?: any[]): Promise<T[]>;
    tableExists(tableName: string): Promise<boolean>;
    getTableRowCount(tableName: string): Promise<number>;
    executeSQLFile(sqlContent: string): Promise<void>;
    cleanupExpiredData(): Promise<void>;
    private setupEventHandlers;
    private testConnection;
}
declare const _default: DatabaseService;
export default _default;
//# sourceMappingURL=database.d.ts.map