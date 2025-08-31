import { PrismaClient } from '@prisma/client';

interface QueryAnalysis {
  query: string;
  executionPlan: any;
  cost: number;
  duration: number;
  suggestions: string[];
}

interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'gin' | 'gist' | 'hash';
  reason: string;
  estimatedImprovement: number;
}

export class QueryOptimizer {
  private client: PrismaClient;
  private analyzedQueries: Map<string, QueryAnalysis> = new Map();

  constructor() {
    this.client = new PrismaClient();
  }

  async analyzeQuery(query: string, parameters?: any[]): Promise<QueryAnalysis> {
    try {
      // Get execution plan
      const explainResult = await this.client.$queryRawUnsafe(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
        ...(parameters || [])
      );

      const plan = explainResult[0]['QUERY PLAN'][0];
      const cost = plan['Total Cost'] || 0;
      const duration = plan['Actual Total Time'] || 0;

      // Generate optimization suggestions
      const suggestions = this.generateSuggestions(plan, query);

      const analysis: QueryAnalysis = {
        query,
        executionPlan: plan,
        cost,
        duration,
        suggestions
      };

      // Cache the analysis
      this.analyzedQueries.set(query, analysis);

      return analysis;
    } catch (error) {
      console.error('Error analyzing query:', error);
      return {
        query,
        executionPlan: null,
        cost: 0,
        duration: 0,
        suggestions: ['Unable to analyze query due to error']
      };
    }
  }

  private generateSuggestions(plan: any, query: string): string[] {
    const suggestions: string[] = [];

    // Analyze the execution plan for optimization opportunities
    this.analyzePlanNode(plan, suggestions, query);

    return suggestions;
  }

  private analyzePlanNode(node: any, suggestions: string[], query: string): void {
    if (!node) return;

    const nodeType = node['Node Type'];
    const cost = node['Total Cost'] || 0;
    const rows = node['Actual Rows'] || 0;

    // Check for sequential scans on large tables
    if (nodeType === 'Seq Scan' && rows > 1000) {
      const relation = node['Relation Name'];
      suggestions.push(`Consider adding an index on table '${relation}' to avoid sequential scan`);
    }

    // Check for nested loops with high cost
    if (nodeType === 'Nested Loop' && cost > 1000) {
      suggestions.push('High-cost nested loop detected. Consider optimizing join conditions or adding indexes');
    }

    // Check for sorts that could benefit from indexes
    if (nodeType === 'Sort' && cost > 100) {
      const sortKey = node['Sort Key'];
      if (sortKey) {
        suggestions.push(`Consider adding an index on sort columns: ${sortKey.join(', ')}`);
      }
    }

    // Check for hash joins that might indicate missing indexes
    if (nodeType === 'Hash Join' && cost > 500) {
      suggestions.push('High-cost hash join detected. Verify that join columns are properly indexed');
    }

    // Check for bitmap heap scans
    if (nodeType === 'Bitmap Heap Scan') {
      suggestions.push('Bitmap heap scan detected. Query might benefit from a more selective index');
    }

    // Recursively analyze child nodes
    if (node['Plans']) {
      for (const childNode of node['Plans']) {
        this.analyzePlanNode(childNode, suggestions, query);
      }
    }
  }

  async suggestIndexes(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];

    try {
      // Analyze missing indexes based on query patterns
      const missingIndexes = await this.client.$queryRaw<Array<{
        schemaname: string;
        tablename: string;
        attname: string;
        n_distinct: number;
        correlation: number;
      }>>(`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        AND n_distinct > 100
        AND correlation < 0.1
        ORDER BY n_distinct DESC;
      `);

      for (const stat of missingIndexes) {
        // Check if index already exists
        const existingIndex = await this.checkIndexExists(stat.tablename, [stat.attname]);
        
        if (!existingIndex) {
          suggestions.push({
            table: stat.tablename,
            columns: [stat.attname],
            type: 'btree',
            reason: `High cardinality column (${stat.n_distinct} distinct values) without index`,
            estimatedImprovement: this.estimateIndexImprovement(stat.n_distinct)
          });
        }
      }

      // Suggest composite indexes based on common query patterns
      const compositeIndexSuggestions = await this.suggestCompositeIndexes();
      suggestions.push(...compositeIndexSuggestions);

      // Suggest GIN indexes for array/JSON columns
      const ginIndexSuggestions = await this.suggestGinIndexes();
      suggestions.push(...ginIndexSuggestions);

    } catch (error) {
      console.error('Error suggesting indexes:', error);
    }

    return suggestions.slice(0, 10); // Return top 10 suggestions
  }

  private async checkIndexExists(tableName: string, columns: string[]): Promise<boolean> {
    try {
      const result = await this.client.$queryRaw<Array<{ count: number }>>(`
        SELECT COUNT(*) as count
        FROM pg_indexes 
        WHERE tablename = '${tableName}'
        AND indexdef LIKE '%${columns.join('%')}%';
      `);

      return result[0]?.count > 0;
    } catch (error) {
      return false;
    }
  }

  private estimateIndexImprovement(distinctValues: number): number {
    // Simple heuristic: more distinct values = higher improvement potential
    if (distinctValues > 10000) return 90;
    if (distinctValues > 1000) return 70;
    if (distinctValues > 100) return 50;
    return 30;
  }

  private async suggestCompositeIndexes(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];

    // Common composite index patterns
    const compositePatterns = [
      { table: 'applications', columns: ['student_id', 'status'], reason: 'Common filter combination' },
      { table: 'applications', columns: ['student_id', 'deadline'], reason: 'Student applications by deadline' },
      { table: 'recommendation_letters', columns: ['student_id', 'recommender_id'], reason: 'Letter lookup by student and recommender' },
      { table: 'university_matches', columns: ['student_id', 'match_percentage'], reason: 'Student matches ordered by percentage' },
      { table: 'notifications', columns: ['user_id', 'read'], reason: 'User notifications by read status' },
      { table: 'audit_logs', columns: ['user_id', 'created_at'], reason: 'User activity timeline' }
    ];

    for (const pattern of compositePatterns) {
      const exists = await this.checkIndexExists(pattern.table, pattern.columns);
      if (!exists) {
        suggestions.push({
          table: pattern.table,
          columns: pattern.columns,
          type: 'btree',
          reason: pattern.reason,
          estimatedImprovement: 60
        });
      }
    }

    return suggestions;
  }

  private async suggestGinIndexes(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];

    try {
      // Find array and JSON columns that might benefit from GIN indexes
      const arrayColumns = await this.client.$queryRaw<Array<{
        table_name: string;
        column_name: string;
        data_type: string;
      }>>(`
        SELECT 
          table_name,
          column_name,
          data_type
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND (data_type LIKE '%[]' OR data_type = 'json' OR data_type = 'jsonb')
        AND table_name NOT LIKE 'pg_%';
      `);

      for (const column of arrayColumns) {
        const exists = await this.checkIndexExists(column.table_name, [column.column_name]);
        if (!exists) {
          suggestions.push({
            table: column.table_name,
            columns: [column.column_name],
            type: 'gin',
            reason: `${column.data_type} column for efficient array/JSON searches`,
            estimatedImprovement: 80
          });
        }
      }
    } catch (error) {
      console.error('Error suggesting GIN indexes:', error);
    }

    return suggestions;
  }

  async createIndex(suggestion: IndexSuggestion): Promise<void> {
    try {
      const indexName = `idx_${suggestion.table}_${suggestion.columns.join('_')}`;
      const columnsStr = suggestion.columns.join(', ');
      
      let createIndexSQL: string;
      
      if (suggestion.type === 'gin') {
        createIndexSQL = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${suggestion.table} USING GIN (${columnsStr});`;
      } else {
        createIndexSQL = `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${indexName} ON ${suggestion.table} (${columnsStr});`;
      }

      console.log(`🔧 Creating index: ${indexName}`);
      await this.client.$executeRawUnsafe(createIndexSQL);
      console.log(`✅ Index created successfully: ${indexName}`);
    } catch (error) {
      console.error(`❌ Failed to create index for ${suggestion.table}:`, error);
      throw error;
    }
  }

  async optimizeSlowQueries(): Promise<void> {
    console.log('🔧 Optimizing slow queries...');

    try {
      // Get slow queries from pg_stat_statements if available
      const slowQueries = await this.getSlowQueriesFromStats();
      
      for (const query of slowQueries.slice(0, 5)) { // Optimize top 5 slow queries
        console.log(`🐌 Analyzing slow query: ${query.query.substring(0, 100)}...`);
        
        const analysis = await this.analyzeQuery(query.query);
        
        if (analysis.suggestions.length > 0) {
          console.log(`💡 Suggestions for optimization:`);
          analysis.suggestions.forEach((suggestion, index) => {
            console.log(`   ${index + 1}. ${suggestion}`);
          });
        }
      }

      // Suggest and create beneficial indexes
      const indexSuggestions = await this.suggestIndexes();
      
      if (indexSuggestions.length > 0) {
        console.log(`💡 Index suggestions:`);
        indexSuggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. ${suggestion.table}(${suggestion.columns.join(', ')}) - ${suggestion.reason}`);
        });

        // Auto-create high-impact indexes
        const highImpactIndexes = indexSuggestions.filter(s => s.estimatedImprovement > 70);
        for (const suggestion of highImpactIndexes.slice(0, 3)) {
          try {
            await this.createIndex(suggestion);
          } catch (error) {
            console.error(`Failed to create index for ${suggestion.table}:`, error);
          }
        }
      }

    } catch (error) {
      console.error('Error optimizing slow queries:', error);
    }

    console.log('✅ Slow query optimization completed');
  }

  private async getSlowQueriesFromStats(): Promise<Array<{ query: string; calls: number; mean_time: number }>> {
    try {
      // Try to get data from pg_stat_statements extension
      const result = await this.client.$queryRaw<Array<{
        query: string;
        calls: number;
        mean_time: number;
      }>>(`
        SELECT 
          query,
          calls,
          mean_time
        FROM pg_stat_statements 
        WHERE mean_time > 100
        ORDER BY mean_time DESC 
        LIMIT 10;
      `);

      return result;
    } catch (error) {
      // pg_stat_statements might not be available
      console.log('pg_stat_statements not available, using alternative method');
      return [];
    }
  }

  async analyzeTableStatistics(): Promise<void> {
    console.log('📊 Analyzing table statistics...');

    try {
      const tableStats = await this.client.$queryRaw<Array<{
        schemaname: string;
        tablename: string;
        n_live_tup: number;
        n_dead_tup: number;
        last_vacuum: Date;
        last_analyze: Date;
      }>>(`
        SELECT 
          schemaname,
          tablename,
          n_live_tup,
          n_dead_tup,
          last_vacuum,
          last_analyze
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
      `);

      for (const stat of tableStats) {
        const deadTupleRatio = stat.n_live_tup > 0 
          ? (stat.n_dead_tup / stat.n_live_tup) * 100 
          : 0;

        if (deadTupleRatio > 20) {
          console.log(`⚠️  Table ${stat.tablename} has high dead tuple ratio: ${deadTupleRatio.toFixed(1)}%`);
          console.log(`   Suggestion: Run VACUUM ANALYZE on ${stat.tablename}`);
        }

        const daysSinceAnalyze = stat.last_analyze 
          ? Math.floor((Date.now() - stat.last_analyze.getTime()) / (1000 * 60 * 60 * 24))
          : Infinity;

        if (daysSinceAnalyze > 7) {
          console.log(`⚠️  Table ${stat.tablename} statistics are outdated (${daysSinceAnalyze} days)`);
          console.log(`   Suggestion: Run ANALYZE on ${stat.tablename}`);
        }
      }

    } catch (error) {
      console.error('Error analyzing table statistics:', error);
    }

    console.log('✅ Table statistics analysis completed');
  }

  async optimizeQueries(queries: string[]): Promise<Map<string, QueryAnalysis>> {
    const results = new Map<string, QueryAnalysis>();

    for (const query of queries) {
      try {
        const analysis = await this.analyzeQuery(query);
        results.set(query, analysis);
      } catch (error) {
        console.error(`Error analyzing query: ${query}`, error);
      }
    }

    return results;
  }

  async generateOptimizationReport(): Promise<string> {
    let report = '# Database Optimization Report\n\n';

    // Index suggestions
    const indexSuggestions = await this.suggestIndexes();
    if (indexSuggestions.length > 0) {
      report += '## Index Suggestions\n\n';
      indexSuggestions.forEach((suggestion, index) => {
        report += `${index + 1}. **${suggestion.table}** (${suggestion.columns.join(', ')})\n`;
        report += `   - Type: ${suggestion.type.toUpperCase()}\n`;
        report += `   - Reason: ${suggestion.reason}\n`;
        report += `   - Estimated Improvement: ${suggestion.estimatedImprovement}%\n\n`;
      });
    }

    // Query analysis summary
    if (this.analyzedQueries.size > 0) {
      report += '## Query Analysis Summary\n\n';
      const sortedQueries = Array.from(this.analyzedQueries.values())
        .sort((a, b) => b.cost - a.cost);

      sortedQueries.slice(0, 5).forEach((analysis, index) => {
        report += `${index + 1}. **Query Cost: ${analysis.cost}**\n`;
        report += `   - Duration: ${analysis.duration}ms\n`;
        report += `   - Query: ${analysis.query.substring(0, 100)}...\n`;
        if (analysis.suggestions.length > 0) {
          report += `   - Suggestions:\n`;
          analysis.suggestions.forEach(suggestion => {
            report += `     - ${suggestion}\n`;
          });
        }
        report += '\n';
      });
    }

    return report;
  }
}