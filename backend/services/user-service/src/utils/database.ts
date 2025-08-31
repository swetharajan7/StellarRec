import { PrismaClient } from '@prisma/client';
import { OptimizedDatabaseClient } from '@stellarrec/database';
import { createDatabaseConfig, validateDatabaseConfig } from '@stellarrec/database';

// Extend PrismaClient with soft delete functionality
export class DatabaseClient extends PrismaClient {
  constructor() {
    super();
    
    // Add soft delete middleware
    this.$use(async (params, next) => {
      // Handle soft delete for DELETE operations
      if (params.action === 'delete') {
        params.action = 'update';
        params.args['data'] = { deleted_at: new Date() };
      }
      
      // Handle soft delete for deleteMany operations
      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (params.args.data !== undefined) {
          params.args.data['deleted_at'] = new Date();
        } else {
          params.args['data'] = { deleted_at: new Date() };
        }
      }
      
      // Exclude soft deleted records from find operations
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.args.where = {
          ...params.args.where,
          deleted_at: null,
        };
      }
      
      if (params.action === 'findMany') {
        if (params.args.where) {
          if (params.args.where.deleted_at === undefined) {
            params.args.where['deleted_at'] = null;
          }
        } else {
          params.args['where'] = { deleted_at: null };
        }
      }
      
      // Exclude soft deleted records from update operations
      if (params.action === 'update') {
        params.args.where = {
          ...params.args.where,
          deleted_at: null,
        };
      }
      
      if (params.action === 'updateMany') {
        if (params.args.where !== undefined) {
          params.args.where['deleted_at'] = null;
        } else {
          params.args['where'] = { deleted_at: null };
        }
      }
      
      return next(params);
    });
  }

  // Method to find records including soft deleted ones
  async findWithDeleted(model: string, args: any) {
    return (this as any)[model].findMany({
      ...args,
      where: {
        ...args.where,
        // Don't filter by deleted_at
      },
    });
  }

  // Method to find only soft deleted records
  async findDeleted(model: string, args: any) {
    return (this as any)[model].findMany({
      ...args,
      where: {
        ...args.where,
        deleted_at: { not: null },
      },
    });
  }

  // Method to restore soft deleted records
  async restore(model: string, where: any) {
    return (this as any)[model].updateMany({
      where: {
        ...where,
        deleted_at: { not: null },
      },
      data: {
        deleted_at: null,
      },
    });
  }

  // Method to permanently delete records
  async forceDelete(model: string, where: any) {
    // Temporarily disable middleware for this operation
    return this.$transaction(async (tx) => {
      return (tx as any)[model].deleteMany({ where });
    });
  }

  // Method to set audit context
  async setAuditContext(userId?: string, ipAddress?: string, userAgent?: string) {
    if (userId) {
      await this.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    }
    if (ipAddress) {
      await this.$executeRaw`SELECT set_config('app.client_ip', ${ipAddress}, true)`;
    }
    if (userAgent) {
      await this.$executeRaw`SELECT set_config('app.user_agent', ${userAgent}, true)`;
    }
  }

  // Method to clear audit context
  async clearAuditContext() {
    await this.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;
    await this.$executeRaw`SELECT set_config('app.client_ip', '', true)`;
    await this.$executeRaw`SELECT set_config('app.user_agent', '', true)`;
  }

  // Method to get database statistics
  async getDatabaseStats() {
    const stats = await this.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_tuples,
        n_dead_tup as dead_tuples
      FROM pg_stat_user_tables 
      ORDER BY n_live_tup DESC;
    `;
    
    return stats;
  }

  // Method to analyze query performance
  async analyzeQuery(query: string) {
    const result = await this.$queryRawUnsafe(`EXPLAIN ANALYZE ${query}`);
    return result;
  }

  // Method to get table sizes
  async getTableSizes() {
    const sizes = await this.$queryRaw`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    `;
    
    return sizes;
  }

  // Method to vacuum and analyze tables
  async maintenanceTasks() {
    await this.$executeRaw`VACUUM ANALYZE;`;
    console.log('Database maintenance completed: VACUUM ANALYZE');
  }

  // Method to check database health
  async healthCheck() {
    try {
      await this.$queryRaw`SELECT 1`;
      
      const stats = await this.$queryRaw`
        SELECT 
          (SELECT count(*) FROM users WHERE deleted_at IS NULL) as active_users,
          (SELECT count(*) FROM applications WHERE deleted_at IS NULL) as active_applications,
          (SELECT count(*) FROM recommendation_letters WHERE deleted_at IS NULL) as active_letters,
          (SELECT count(*) FROM universities WHERE is_active = true) as active_universities
      `;
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        stats: stats[0]
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }
}

// Create optimized database instance
const config = createDatabaseConfig();
validateDatabaseConfig(config);

export const optimizedDb = new OptimizedDatabaseClient(config);

// Create singleton instance (legacy support)
export const db = new DatabaseClient();

// Connection management
export async function connectDatabase() {
  try {
    // Connect both legacy and optimized clients
    await db.$connect();
    await optimizedDb.connect();
    
    console.log('✅ Database connected successfully');
    
    // Run health check on optimized client
    const health = await optimizedDb.getDatabaseHealth();
    console.log('📊 Database health:', health);
    
    // Run initial performance analysis
    await optimizedDb.analyzePerformance();
    
    return { db, optimizedDb };
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export async function disconnectDatabase() {
  try {
    await db.$disconnect();
    await optimizedDb.disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
    throw error;
  }
}

// Export types for use in other files
export type { 
  User, 
  StudentProfile, 
  RecommenderProfile,
  Application,
  RecommendationLetter,
  University,
  Program,
  UserRole,
  ApplicationStatus,
  LetterStatus
} from '@prisma/client';