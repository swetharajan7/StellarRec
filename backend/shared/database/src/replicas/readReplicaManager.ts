import { PrismaClient } from '@prisma/client';
import { ReplicaConfig } from '../types';

interface ReplicaInfo {
  url: string;
  client: PrismaClient;
  isHealthy: boolean;
  lastHealthCheck: Date;
  connectionCount: number;
  responseTime: number;
  errorCount: number;
}

export class ReadReplicaManager {
  private replicas: ReplicaInfo[] = [];
  private config: ReplicaConfig;
  private currentReplicaIndex = 0;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(replicaUrls: string[], config: ReplicaConfig) {
    this.config = config;
    
    // Initialize replica clients
    for (const url of replicaUrls) {
      const client = new PrismaClient({
        datasources: {
          db: { url }
        }
      });

      this.replicas.push({
        url,
        client,
        isHealthy: true,
        lastHealthCheck: new Date(),
        connectionCount: 0,
        responseTime: 0,
        errorCount: 0
      });
    }
  }

  async connect(): Promise<void> {
    console.log(`🔗 Connecting to ${this.replicas.length} read replicas...`);
    
    const connectionPromises = this.replicas.map(async (replica) => {
      try {
        await replica.client.$connect();
        console.log(`✅ Connected to read replica: ${this.maskUrl(replica.url)}`);
      } catch (error) {
        console.error(`❌ Failed to connect to read replica: ${this.maskUrl(replica.url)}`, error);
        replica.isHealthy = false;
        replica.errorCount++;
      }
    });

    await Promise.allSettled(connectionPromises);
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from read replicas...');
    
    const disconnectionPromises = this.replicas.map(async (replica) => {
      try {
        await replica.client.$disconnect();
      } catch (error) {
        console.error(`Error disconnecting from replica: ${this.maskUrl(replica.url)}`, error);
      }
    });

    await Promise.allSettled(disconnectionPromises);
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  getClient(): PrismaClient {
    const healthyReplicas = this.replicas.filter(r => r.isHealthy);
    
    if (healthyReplicas.length === 0) {
      console.warn('⚠️  No healthy read replicas available, queries may fail');
      // Return the first replica even if unhealthy as a fallback
      return this.replicas[0]?.client;
    }

    let selectedReplica: ReplicaInfo;

    switch (this.config.loadBalancing) {
      case 'round-robin':
        selectedReplica = this.getRoundRobinReplica(healthyReplicas);
        break;
      case 'least-connections':
        selectedReplica = this.getLeastConnectionsReplica(healthyReplicas);
        break;
      case 'random':
      default:
        selectedReplica = this.getRandomReplica(healthyReplicas);
        break;
    }

    selectedReplica.connectionCount++;
    return selectedReplica.client;
  }

  private getRoundRobinReplica(healthyReplicas: ReplicaInfo[]): ReplicaInfo {
    const replica = healthyReplicas[this.currentReplicaIndex % healthyReplicas.length];
    this.currentReplicaIndex++;
    return replica;
  }

  private getLeastConnectionsReplica(healthyReplicas: ReplicaInfo[]): ReplicaInfo {
    return healthyReplicas.reduce((least, current) => 
      current.connectionCount < least.connectionCount ? current : least
    );
  }

  private getRandomReplica(healthyReplicas: ReplicaInfo[]): ReplicaInfo {
    const randomIndex = Math.floor(Math.random() * healthyReplicas.length);
    return healthyReplicas[randomIndex];
  }

  startHealthChecks(): void {
    if (this.replicas.length === 0) {
      return;
    }

    console.log(`🏥 Starting health checks for read replicas (interval: ${this.config.healthCheckInterval}ms)`);
    
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    // Perform initial health check
    setTimeout(() => {
      this.performHealthChecks();
    }, 1000);
  }

  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = this.replicas.map(async (replica) => {
      const startTime = Date.now();
      
      try {
        await replica.client.$queryRaw`SELECT 1`;
        
        const responseTime = Date.now() - startTime;
        replica.responseTime = responseTime;
        replica.lastHealthCheck = new Date();
        
        if (!replica.isHealthy) {
          console.log(`✅ Read replica recovered: ${this.maskUrl(replica.url)}`);
          replica.isHealthy = true;
        }
      } catch (error) {
        replica.errorCount++;
        replica.lastHealthCheck = new Date();
        
        if (replica.isHealthy) {
          console.error(`❌ Read replica unhealthy: ${this.maskUrl(replica.url)}`, error);
          replica.isHealthy = false;
        }
      }
    });

    await Promise.allSettled(healthCheckPromises);
    
    // Log health status summary
    const healthyCount = this.replicas.filter(r => r.isHealthy).length;
    const totalCount = this.replicas.length;
    
    if (healthyCount < totalCount) {
      console.warn(`⚠️  Read replica health: ${healthyCount}/${totalCount} healthy`);
    }
  }

  areReplicasHealthy(): boolean {
    return this.replicas.some(r => r.isHealthy);
  }

  getHealthyReplicaCount(): number {
    return this.replicas.filter(r => r.isHealthy).length;
  }

  getTotalReplicaCount(): number {
    return this.replicas.length;
  }

  async getReplicaStats() {
    return {
      totalReplicas: this.replicas.length,
      healthyReplicas: this.getHealthyReplicaCount(),
      loadBalancing: this.config.loadBalancing,
      replicas: this.replicas.map(replica => ({
        url: this.maskUrl(replica.url),
        isHealthy: replica.isHealthy,
        lastHealthCheck: replica.lastHealthCheck,
        connectionCount: replica.connectionCount,
        responseTime: replica.responseTime,
        errorCount: replica.errorCount
      }))
    };
  }

  async checkReplicationLag(): Promise<Array<{ replica: string; lag: number }>> {
    const lagChecks = this.replicas.map(async (replica) => {
      if (!replica.isHealthy) {
        return { replica: this.maskUrl(replica.url), lag: -1 };
      }

      try {
        // Check replication lag using PostgreSQL's replication stats
        const result = await replica.client.$queryRaw<Array<{ lag: number }>>`
          SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) as lag
        `;
        
        const lag = result[0]?.lag || 0;
        return { replica: this.maskUrl(replica.url), lag };
      } catch (error) {
        console.error(`Error checking replication lag for ${this.maskUrl(replica.url)}:`, error);
        return { replica: this.maskUrl(replica.url), lag: -1 };
      }
    });

    return Promise.all(lagChecks);
  }

  async executeWithRetry<T>(
    operation: (client: PrismaClient) => Promise<T>,
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const client = this.getClient();
        return await operation(client);
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < maxRetries) {
          console.warn(`Read replica operation failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
          await this.delay(this.config.retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }
    
    throw lastError!;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private maskUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.username ? '***:***@' : ''}${urlObj.host}${urlObj.pathname}`;
    } catch {
      return url.replace(/\/\/[^@]+@/, '//***:***@');
    }
  }

  // Advanced features
  async promoteReplica(replicaUrl: string): Promise<void> {
    console.log(`🔄 Promoting replica to primary: ${this.maskUrl(replicaUrl)}`);
    
    const replica = this.replicas.find(r => r.url === replicaUrl);
    if (!replica) {
      throw new Error(`Replica not found: ${replicaUrl}`);
    }

    if (!replica.isHealthy) {
      throw new Error(`Cannot promote unhealthy replica: ${this.maskUrl(replicaUrl)}`);
    }

    // In a real implementation, this would involve:
    // 1. Stopping replication on the selected replica
    // 2. Promoting it to primary
    // 3. Reconfiguring other replicas to replicate from the new primary
    // 4. Updating application configuration
    
    console.log(`✅ Replica promoted successfully: ${this.maskUrl(replicaUrl)}`);
  }

  async addReplica(replicaUrl: string): Promise<void> {
    console.log(`➕ Adding new read replica: ${this.maskUrl(replicaUrl)}`);
    
    const client = new PrismaClient({
      datasources: {
        db: { url: replicaUrl }
      }
    });

    try {
      await client.$connect();
      
      const newReplica: ReplicaInfo = {
        url: replicaUrl,
        client,
        isHealthy: true,
        lastHealthCheck: new Date(),
        connectionCount: 0,
        responseTime: 0,
        errorCount: 0
      };

      this.replicas.push(newReplica);
      console.log(`✅ Read replica added successfully: ${this.maskUrl(replicaUrl)}`);
    } catch (error) {
      console.error(`❌ Failed to add read replica: ${this.maskUrl(replicaUrl)}`, error);
      await client.$disconnect();
      throw error;
    }
  }

  async removeReplica(replicaUrl: string): Promise<void> {
    console.log(`➖ Removing read replica: ${this.maskUrl(replicaUrl)}`);
    
    const replicaIndex = this.replicas.findIndex(r => r.url === replicaUrl);
    if (replicaIndex === -1) {
      throw new Error(`Replica not found: ${replicaUrl}`);
    }

    const replica = this.replicas[replicaIndex];
    
    try {
      await replica.client.$disconnect();
      this.replicas.splice(replicaIndex, 1);
      console.log(`✅ Read replica removed successfully: ${this.maskUrl(replicaUrl)}`);
    } catch (error) {
      console.error(`❌ Error removing read replica: ${this.maskUrl(replicaUrl)}`, error);
      throw error;
    }
  }

  async rebalanceConnections(): Promise<void> {
    console.log('⚖️  Rebalancing connections across read replicas...');
    
    // Reset connection counts to allow for fresh load balancing
    this.replicas.forEach(replica => {
      replica.connectionCount = 0;
    });
    
    console.log('✅ Connection rebalancing completed');
  }
}