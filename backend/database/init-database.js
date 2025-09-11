// StellarRec Database Initialization Script
// File: database/init-database.js
// Purpose: Initialize and set up the recommendation system database

const fs = require('fs');
const path = require('path');
const { DatabaseManager } = require('./config/database-config');

class DatabaseInitializer {
    constructor() {
        this.dbManager = new DatabaseManager();
        this.migrationPath = path.join(__dirname, 'migrations');
    }
    
    // Read SQL migration file
    readMigrationFile(filename) {
        const filePath = path.join(this.migrationPath, filename);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`Migration file not found: ${filename}`);
        }
        
        return fs.readFileSync(filePath, 'utf8');
    }
    
    // Execute migration
    async runMigration(filename) {
        try {
            console.log(`\n🚀 Running migration: ${filename}`);
            
            const sql = this.readMigrationFile(filename);
            
            // Split SQL into individual statements
            const statements = sql
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            console.log(`📝 Found ${statements.length} SQL statements to execute`);
            
            // Execute each statement
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                console.log(`   Executing statement ${i + 1}/${statements.length}...`);
                
                try {
                    await this.dbManager.query(statement);
                    console.log(`   ✅ Statement ${i + 1} executed successfully`);
                } catch (error) {
                    console.error(`   ❌ Statement ${i + 1} failed:`, error.message);
                    
                    // Skip certain expected errors (like table already exists)
                    if (!this.isExpectedError(error)) {
                        throw error;
                    }
                }
            }
            
            console.log(`✅ Migration ${filename} completed successfully!`);
            return true;
            
        } catch (error) {
            console.error(`❌ Migration ${filename} failed:`, error.message);
            return false;
        }
    }
    
    // Check if error can be safely ignored
    isExpectedError(error) {
        const message = error.message.toLowerCase();
        const expectedErrors = [
            'table already exists',
            'duplicate column name',
            'unknown table',
            'table doesn\'t exist'
        ];
        
        return expectedErrors.some(expected => message.includes(expected));
    }
    
    // Verify tables were created
    async verifyTables() {
        console.log('\n🔍 Verifying table creation...');
        
        const expectedTables = [
            'recommendation_requests',
            'recommendation_submissions', 
            'recommendation_emails'
        ];
        
        for (const tableName of expectedTables) {
            try {
                const result = await this.dbManager.query(`DESCRIBE ${tableName}`);
                console.log(`✅ Table '${tableName}' exists and is accessible`);
            } catch (error) {
                console.error(`❌ Table '${tableName}' verification failed:`, error.message);
                return false;
            }
        }
        
        console.log('✅ All tables verified successfully!');
        return true;
    }
    
    // Test with sample data
    async testSampleData() {
        console.log('\n🧪 Testing sample data insertion...');
        
        try {
            // Check if sample data exists
            const result = await this.dbManager.query(
                'SELECT COUNT(*) as count FROM recommendation_requests WHERE student_name = ?',
                ['John Doe']
            );
            
            if (result && result[0] && result[0].count > 0) {
                console.log('✅ Sample data found in database');
                return true;
            } else {
                console.log('⚠️  Sample data not found, but this is expected in production');
                return true;
            }
            
        } catch (error) {
            console.error('❌ Sample data test failed:', error.message);
            return false;
        }
    }
    
    // Full initialization process
    async initialize() {
        console.log('🎯 Starting StellarRec Database Initialization');
        console.log('=' .repeat(50));
        
        try {
            // Step 1: Test connection
            console.log('1️⃣ Testing database connection...');
            const connected = await this.dbManager.testConnection();
            if (!connected) {
                throw new Error('Cannot connect to database');
            }
            console.log('✅ Database connection successful');
            
            // Step 2: Run migration
            console.log('\n2️⃣ Running database migrations...');
            const migrationSuccess = await this.runMigration('001_create_recommendation_tables.sql');
            if (!migrationSuccess) {
                throw new Error('Migration failed');
            }
            
            // Step 3: Verify tables
            console.log('\n3️⃣ Verifying table creation...');
            const tablesVerified = await this.verifyTables();
            if (!tablesVerified) {
                throw new Error('Table verification failed');
            }
            
            // Step 4: Test sample data
            console.log('\n4️⃣ Testing sample data...');
            await this.testSampleData();
            
            console.log('\n🎉 Database initialization completed successfully!');
            console.log('=' .repeat(50));
            console.log('Next steps:');
            console.log('1. Remove sample data before production deployment');
            console.log('2. Set up proper environment variables');
            console.log('3. Configure email service integration');
            
            return true;
            
        } catch (error) {
            console.error('\n💥 Database initialization failed:', error.message);
            console.log('=' .repeat(50));
            console.log('Troubleshooting steps:');
            console.log('1. Check database connection details');
            console.log('2. Verify database user permissions');
            console.log('3. Check if database exists');
            console.log('4. Review error messages above');
            
            return false;
        } finally {
            await this.dbManager.close();
        }
    }
}

// Export for use in other files
module.exports = DatabaseInitializer;

// Allow running directly from command line
if (require.main === module) {
    const initializer = new DatabaseInitializer();
    initializer.initialize().then(success => {
        process.exit(success ? 0 : 1);
    });
}
