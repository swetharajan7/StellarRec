import { PrismaClient } from '@prisma/client';
import { PartitionConfig, PartitionInfo } from '../types';
import * as cron from 'node-cron';

export class PartitionManager {
  private client: PrismaClient;
  private config: PartitionConfig;
  private maintenanceTask?: cron.ScheduledTask;

  constructor(config: PartitionConfig) {
    this.config = config;
    this.client = new PrismaClient();
  }

  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('📊 Table partitioning is disabled');
      return;
    }

    console.log('🔧 Initializing table partitioning...');
    
    for (const [tableName, partitionConfig] of Object.entries(this.config.tables)) {
      await this.createPartitionedTable(tableName, partitionConfig);
    }
    
    console.log('✅ Table partitioning initialized');
  }

  private async createPartitionedTable(
    tableName: string, 
    config: { type: 'range' | 'hash'; column: string; interval?: string; partitions?: number }
  ): Promise<void> {
    try {
      // Check if table is already partitioned
      const isPartitioned = await this.isTablePartitioned(tableName);
      
      if (isPartitioned) {
        console.log(`📊 Table ${tableName} is already partitioned`);
        return;
      }

      console.log(`🔧 Creating partitioned table: ${tableName}`);

      if (config.type === 'range') {
        await this.createRangePartitionedTable(tableName, config.column, config.interval!);
      } else if (config.type === 'hash') {
        await this.createHashPartitionedTable(tableName, config.column, config.partitions!);
      }

      console.log(`✅ Partitioned table created: ${tableName}`);
    } catch (error) {
      console.error(`❌ Failed to create partitioned table ${tableName}:`, error);
    }
  }

  private async createRangePartitionedTable(
    tableName: string, 
    column: string, 
    interval: string
  ): Promise<void> {
    // This is a simplified example - in practice, you'd need to:
    // 1. Create a new partitioned table
    // 2. Migrate data from the existing table
    // 3. Drop the old table and rename the new one
    
    const partitionedTableName = `${tableName}_partitioned`;
    
    // Create the partitioned table structure
    await this.client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${partitionedTableName} (
        LIKE ${tableName} INCLUDING ALL
      ) PARTITION BY RANGE (${column});
    `);

    // Create initial partitions
    const now = new Date();
    const partitions = this.generateRangePartitions(now, interval, 12); // Create 12 partitions

    for (const partition of partitions) {
      await this.createRangePartition(partitionedTableName, partition);
    }

    // Create a function to automatically create new partitions
    await this.createPartitionMaintenanceFunction(partitionedTableName, column, interval);
  }

  private async createHashPartitionedTable(
    tableName: string, 
    column: string, 
    partitionCount: number
  ): Promise<void> {
    const partitionedTableName = `${tableName}_partitioned`;
    
    // Create the partitioned table structure
    await this.client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${partitionedTableName} (
        LIKE ${tableName} INCLUDING ALL
      ) PARTITION BY HASH (${column});
    `);

    // Create hash partitions
    for (let i = 0; i < partitionCount; i++) {
      const partitionName = `${partitionedTableName}_${i}`;
      await this.client.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${partitionName} 
        PARTITION OF ${partitionedTableName}
        FOR VALUES WITH (MODULUS ${partitionCount}, REMAINDER ${i});
      `);
    }
  }

  private generateRangePartitions(startDate: Date, interval: string, count: number) {
    const partitions = [];
    let currentDate = new Date(startDate);
    
    // Move to the beginning of the current period
    if (interval.includes('month')) {
      currentDate.setDate(1);
      currentDate.setHours(0, 0, 0, 0);
    } else if (interval.includes('day')) {
      currentDate.setHours(0, 0, 0, 0);
    }

    for (let i = 0; i < count; i++) {
      const nextDate = new Date(currentDate);
      
      if (interval.includes('month')) {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (interval.includes('day')) {
        nextDate.setDate(nextDate.getDate() + 1);
      } else if (interval.includes('week')) {
        nextDate.setDate(nextDate.getDate() + 7);
      }

      partitions.push({
        name: `partition_${currentDate.getFullYear()}_${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
        startDate: new Date(currentDate),
        endDate: new Date(nextDate)
      });

      currentDate = nextDate;
    }

    return partitions;
  }

  private async createRangePartition(
    tableName: string, 
    partition: { name: string; startDate: Date; endDate: Date }
  ): Promise<void> {
    const partitionName = `${tableName}_${partition.name}`;
    
    await this.client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${partitionName}
      PARTITION OF ${tableName}
      FOR VALUES FROM ('${partition.startDate.toISOString()}') TO ('${partition.endDate.toISOString()}');
    `);

    // Create indexes on the partition
    await this.client.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS ${partitionName}_created_at_idx ON ${partitionName} (created_at);
    `);
  }

  private async createPartitionMaintenanceFunction(
    tableName: string, 
    column: string, 
    interval: string
  ): Promise<void> {
    const functionName = `maintain_${tableName}_partitions`;
    
    await this.client.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION ${functionName}()
      RETURNS void AS $$
      DECLARE
        start_date date;
        end_date date;
        partition_name text;
      BEGIN
        -- Calculate next partition dates
        start_date := date_trunc('${interval.split(' ')[1]}', CURRENT_DATE + INTERVAL '${interval}');
        end_date := start_date + INTERVAL '${interval}';
        partition_name := '${tableName}_' || to_char(start_date, 'YYYY_MM');
        
        -- Create partition if it doesn't exist
        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF ${tableName} FOR VALUES FROM (%L) TO (%L)',
                      partition_name, start_date, end_date);
        
        -- Create index on the new partition
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (${column})',
                      partition_name || '_${column}_idx', partition_name);
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  async createPartition(tableName: string, partitionName: string, bounds: string): Promise<void> {
    try {
      await this.client.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF ${tableName}
        FOR VALUES ${bounds};
      `);
      
      console.log(`✅ Created partition: ${partitionName}`);
    } catch (error) {
      console.error(`❌ Failed to create partition ${partitionName}:`, error);
      throw error;
    }
  }

  async dropPartition(partitionName: string): Promise<void> {
    try {
      await this.client.$executeRawUnsafe(`DROP TABLE IF EXISTS ${partitionName};`);
      console.log(`🗑️  Dropped partition: ${partitionName}`);
    } catch (error) {
      console.error(`❌ Failed to drop partition ${partitionName}:`, error);
      throw error;
    }
  }

  async getPartitionInfo(tableName: string): Promise<PartitionInfo[]> {
    try {
      const result = await this.client.$queryRawUnsafe<Array<{
        schemaname: string;
        tablename: string;
        partitionname: string;
        partitiontype: string;
        partitionbounds: string;
        row_count: number;
        size_bytes: number;
        created_at: Date;
      }>>(`
        SELECT 
          schemaname,
          tablename,
          schemaname || '.' || tablename as partitionname,
          'range' as partitiontype,
          pg_get_expr(c.relpartbound, c.oid) as partitionbounds,
          COALESCE(n_tup_ins + n_tup_upd, 0) as row_count,
          pg_total_relation_size(c.oid) as size_bytes,
          CURRENT_TIMESTAMP as created_at
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE c.relispartition = true
        AND c.relname LIKE '${tableName}%'
        ORDER BY c.relname;
      `);

      return result.map(row => ({
        tableName,
        partitionName: row.partitionname,
        partitionType: row.partitiontype as 'range' | 'hash',
        bounds: row.partitionbounds || '',
        rowCount: row.row_count,
        size: row.size_bytes,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error(`Error getting partition info for ${tableName}:`, error);
      return [];
    }
  }

  async cleanupOldPartitions(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    console.log('🧹 Starting partition cleanup...');

    for (const tableName of Object.keys(this.config.tables)) {
      await this.cleanupTablePartitions(tableName);
    }

    console.log('✅ Partition cleanup completed');
  }

  private async cleanupTablePartitions(tableName: string): Promise<void> {
    try {
      const partitions = await this.getPartitionInfo(tableName);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - 6); // Keep 6 months of data

      for (const partition of partitions) {
        // Parse partition bounds to determine if it's old
        if (this.isPartitionOld(partition, cutoffDate)) {
          console.log(`🗑️  Dropping old partition: ${partition.partitionName}`);
          await this.dropPartition(partition.partitionName);
        }
      }
    } catch (error) {
      console.error(`Error cleaning up partitions for ${tableName}:`, error);
    }
  }

  private isPartitionOld(partition: PartitionInfo, cutoffDate: Date): boolean {
    // This is a simplified check - in practice, you'd parse the bounds properly
    const partitionDate = this.extractDateFromPartitionName(partition.partitionName);
    return partitionDate && partitionDate < cutoffDate;
  }

  private extractDateFromPartitionName(partitionName: string): Date | null {
    // Extract date from partition name like "table_2023_01"
    const match = partitionName.match(/(\d{4})_(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // JavaScript months are 0-based
      return new Date(year, month, 1);
    }
    return null;
  }

  private async isTablePartitioned(tableName: string): Promise<boolean> {
    try {
      const result = await this.client.$queryRawUnsafe<Array<{ count: number }>>(`
        SELECT COUNT(*) as count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = '${tableName}'
        AND c.relkind = 'p';
      `);

      return result[0]?.count > 0;
    } catch (error) {
      console.error(`Error checking if table ${tableName} is partitioned:`, error);
      return false;
    }
  }

  startMaintenance(): void {
    if (!this.config.enabled || !this.config.maintenanceSchedule) {
      return;
    }

    console.log(`⏰ Starting partition maintenance with schedule: ${this.config.maintenanceSchedule}`);

    this.maintenanceTask = cron.schedule(this.config.maintenanceSchedule, async () => {
      console.log('🔧 Running scheduled partition maintenance...');
      
      try {
        await this.runMaintenance();
        console.log('✅ Scheduled partition maintenance completed');
      } catch (error) {
        console.error('❌ Scheduled partition maintenance failed:', error);
      }
    });
  }

  stopMaintenance(): void {
    if (this.maintenanceTask) {
      this.maintenanceTask.stop();
      console.log('⏹️  Partition maintenance stopped');
    }
  }

  async runMaintenance(): Promise<void> {
    console.log('🔧 Running partition maintenance...');

    // Create new partitions for upcoming periods
    await this.createUpcomingPartitions();

    // Clean up old partitions
    await this.cleanupOldPartitions();

    // Analyze partition performance
    await this.analyzePartitionPerformance();

    console.log('✅ Partition maintenance completed');
  }

  private async createUpcomingPartitions(): Promise<void> {
    for (const [tableName, config] of Object.entries(this.config.tables)) {
      if (config.type === 'range' && config.interval) {
        await this.createUpcomingRangePartitions(tableName, config.column, config.interval);
      }
    }
  }

  private async createUpcomingRangePartitions(
    tableName: string, 
    column: string, 
    interval: string
  ): Promise<void> {
    try {
      // Call the maintenance function we created earlier
      const functionName = `maintain_${tableName}_partitions`;
      await this.client.$executeRawUnsafe(`SELECT ${functionName}();`);
    } catch (error) {
      console.error(`Error creating upcoming partitions for ${tableName}:`, error);
    }
  }

  private async analyzePartitionPerformance(): Promise<void> {
    console.log('📊 Analyzing partition performance...');

    for (const tableName of Object.keys(this.config.tables)) {
      const partitions = await this.getPartitionInfo(tableName);
      
      console.log(`Table ${tableName}:`);
      console.log(`  - Total partitions: ${partitions.length}`);
      console.log(`  - Total rows: ${partitions.reduce((sum, p) => sum + p.rowCount, 0)}`);
      console.log(`  - Total size: ${this.formatBytes(partitions.reduce((sum, p) => sum + p.size, 0))}`);

      // Identify partitions that might need attention
      const largePartitions = partitions.filter(p => p.size > 1024 * 1024 * 1024); // > 1GB
      if (largePartitions.length > 0) {
        console.log(`  - Large partitions (>1GB): ${largePartitions.length}`);
      }
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  async getPartitionStats(): Promise<any> {
    const stats: any = {};

    for (const tableName of Object.keys(this.config.tables)) {
      const partitions = await this.getPartitionInfo(tableName);
      
      stats[tableName] = {
        totalPartitions: partitions.length,
        totalRows: partitions.reduce((sum, p) => sum + p.rowCount, 0),
        totalSize: partitions.reduce((sum, p) => sum + p.size, 0),
        partitions: partitions.map(p => ({
          name: p.partitionName,
          rows: p.rowCount,
          size: p.size,
          bounds: p.bounds
        }))
      };
    }

    return stats;
  }
}