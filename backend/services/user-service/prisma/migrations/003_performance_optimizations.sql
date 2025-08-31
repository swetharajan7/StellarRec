-- Advanced performance optimizations for StellarRec database

-- Enable pg_stat_statements extension for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Enable auto_explain for automatic query plan logging
LOAD 'auto_explain';
SET auto_explain.log_min_duration = 1000; -- Log queries taking more than 1 second
SET auto_explain.log_analyze = true;
SET auto_explain.log_buffers = true;

-- Connection pooling optimizations
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Query optimization settings
ALTER SYSTEM SET random_page_cost = 1.1; -- For SSD storage
ALTER SYSTEM SET effective_io_concurrency = 200; -- For SSD storage
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Advanced indexing for performance
-- Partial indexes for common filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_email 
ON users(email) WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_active_status 
ON applications(status, deadline) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_pending_delivery 
ON recommendation_letters(created_at) WHERE status IN ('draft', 'in_review', 'approved');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread 
ON notifications(user_id, created_at) WHERE read = false;

-- Expression indexes for computed values
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_progress_high 
ON applications((progress_percentage)) WHERE progress_percentage > 80;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_university_matches_high_score 
ON university_matches((match_percentage)) WHERE match_percentage > 70.0;

-- Covering indexes to avoid table lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_profile_lookup 
ON users(id) INCLUDE (email, role, is_active, created_at) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_summary 
ON applications(student_id) INCLUDE (university_id, status, progress_percentage, deadline) 
WHERE deleted_at IS NULL;

-- Hash indexes for equality lookups (PostgreSQL 10+)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_hash 
ON users USING HASH(email) WHERE deleted_at IS NULL;

-- BRIN indexes for large time-series tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_brin 
ON audit_logs USING BRIN(created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_brin 
ON notifications USING BRIN(created_at);

-- Optimize JSON/JSONB queries with GIN indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_profiles_interests_gin 
ON student_profiles USING GIN(academic_interests);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommender_profiles_expertise_gin 
ON recommender_profiles USING GIN(expertise_areas);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_location_gin 
ON universities USING GIN(location);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_programs_requirements_gin 
ON programs USING GIN(requirements);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_essay_analyses_topics_gin 
ON essay_analyses USING GIN(key_topics);

-- Optimize JSONB path queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_profiles_gpa_path 
ON student_profiles USING GIN((profile_data->'academic'->'gpa'));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_ranking_path 
ON universities USING GIN((ranking->'overall'));

-- Function-based indexes for common calculations
CREATE OR REPLACE FUNCTION days_until_deadline(deadline_date timestamp)
RETURNS integer AS $$
BEGIN
    RETURN EXTRACT(days FROM (deadline_date - CURRENT_TIMESTAMP));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_days_until_deadline 
ON applications(days_until_deadline(deadline)) WHERE deleted_at IS NULL;

-- Optimize text search with full-text search indexes
ALTER TABLE universities ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE universities SET search_vector = 
    to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(short_name, ''));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_search_vector 
ON universities USING GIN(search_vector);

-- Trigger to maintain search vector
CREATE OR REPLACE FUNCTION update_university_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.short_name, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_university_search_vector_trigger
    BEFORE INSERT OR UPDATE ON universities
    FOR EACH ROW EXECUTE FUNCTION update_university_search_vector();

-- Similar for programs
ALTER TABLE programs ADD COLUMN IF NOT EXISTS search_vector tsvector;

UPDATE programs SET search_vector = 
    to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_programs_search_vector 
ON programs USING GIN(search_vector);

CREATE OR REPLACE FUNCTION update_program_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english', 
        COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_program_search_vector_trigger
    BEFORE INSERT OR UPDATE ON programs
    FOR EACH ROW EXECUTE FUNCTION update_program_search_vector();

-- Materialized views for expensive aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_statistics AS
SELECT 
    role,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE is_active = true) as active_users,
    COUNT(*) FILTER (WHERE last_login > CURRENT_DATE - INTERVAL '30 days') as recent_users,
    AVG(EXTRACT(days FROM (CURRENT_TIMESTAMP - created_at))) as avg_account_age_days
FROM users 
WHERE deleted_at IS NULL
GROUP BY role;

CREATE UNIQUE INDEX ON mv_user_statistics(role);

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_user_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_statistics;
END;
$$ LANGUAGE plpgsql;

-- Application statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_application_statistics AS
SELECT 
    status,
    COUNT(*) as total_applications,
    AVG(progress_percentage) as avg_progress,
    COUNT(*) FILTER (WHERE deadline < CURRENT_DATE) as overdue_count,
    COUNT(*) FILTER (WHERE deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') as due_soon_count
FROM applications 
WHERE deleted_at IS NULL
GROUP BY status;

CREATE UNIQUE INDEX ON mv_application_statistics(status);

-- University match statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_university_match_statistics AS
SELECT 
    university_id,
    u.name as university_name,
    COUNT(*) as total_matches,
    AVG(match_percentage) as avg_match_percentage,
    COUNT(*) FILTER (WHERE category = 'safety') as safety_matches,
    COUNT(*) FILTER (WHERE category = 'target') as target_matches,
    COUNT(*) FILTER (WHERE category = 'reach') as reach_matches
FROM university_matches um
JOIN universities u ON u.id = um.university_id
GROUP BY university_id, u.name;

CREATE UNIQUE INDEX ON mv_university_match_statistics(university_id);

-- Performance monitoring functions
CREATE OR REPLACE FUNCTION get_slow_queries(threshold_ms integer DEFAULT 1000)
RETURNS TABLE(
    query text,
    calls bigint,
    total_time double precision,
    mean_time double precision,
    stddev_time double precision
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pss.query,
        pss.calls,
        pss.total_time,
        pss.mean_time,
        pss.stddev_time
    FROM pg_stat_statements pss
    WHERE pss.mean_time > threshold_ms
    ORDER BY pss.mean_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE(
    schemaname name,
    tablename name,
    indexname name,
    idx_tup_read bigint,
    idx_tup_fetch bigint,
    usage_ratio numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        psi.schemaname,
        psi.tablename,
        psi.indexname,
        psi.idx_tup_read,
        psi.idx_tup_fetch,
        CASE 
            WHEN psi.idx_tup_read > 0 
            THEN ROUND((psi.idx_tup_fetch::numeric / psi.idx_tup_read::numeric) * 100, 2)
            ELSE 0
        END as usage_ratio
    FROM pg_stat_user_indexes psi
    ORDER BY psi.idx_tup_read DESC;
END;
$$ LANGUAGE plpgsql;

-- Table bloat analysis function
CREATE OR REPLACE FUNCTION get_table_bloat_stats()
RETURNS TABLE(
    schemaname name,
    tablename name,
    live_tuples bigint,
    dead_tuples bigint,
    bloat_ratio numeric,
    table_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        psut.schemaname,
        psut.tablename,
        psut.n_live_tup,
        psut.n_dead_tup,
        CASE 
            WHEN psut.n_live_tup > 0 
            THEN ROUND((psut.n_dead_tup::numeric / psut.n_live_tup::numeric) * 100, 2)
            ELSE 0
        END as bloat_ratio,
        pg_size_pretty(pg_total_relation_size(psut.schemaname||'.'||psut.tablename)) as table_size
    FROM pg_stat_user_tables psut
    WHERE psut.n_live_tup > 0
    ORDER BY (psut.n_dead_tup::numeric / psut.n_live_tup::numeric) DESC;
END;
$$ LANGUAGE plpgsql;

-- Connection monitoring function
CREATE OR REPLACE FUNCTION get_connection_stats()
RETURNS TABLE(
    total_connections bigint,
    active_connections bigint,
    idle_connections bigint,
    idle_in_transaction bigint,
    max_connections integer,
    usage_percentage numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT count(*) FROM pg_stat_activity) as total_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction') as idle_in_transaction,
        (SELECT setting::integer FROM pg_settings WHERE name = 'max_connections') as max_connections,
        ROUND(
            ((SELECT count(*) FROM pg_stat_activity)::numeric / 
             (SELECT setting::integer FROM pg_settings WHERE name = 'max_connections')::numeric) * 100, 
            2
        ) as usage_percentage;
END;
$$ LANGUAGE plpgsql;

-- Automated maintenance procedures
CREATE OR REPLACE FUNCTION run_maintenance_tasks()
RETURNS void AS $$
BEGIN
    -- Refresh materialized views
    PERFORM refresh_user_statistics();
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_application_statistics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_university_match_statistics;
    
    -- Update table statistics
    ANALYZE;
    
    -- Log maintenance completion
    INSERT INTO audit_logs (action, resource_type, new_values, created_at)
    VALUES ('MAINTENANCE', 'system', '{"task": "automated_maintenance"}', CURRENT_TIMESTAMP);
    
    RAISE NOTICE 'Maintenance tasks completed at %', CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Schedule maintenance tasks (requires pg_cron extension)
-- SELECT cron.schedule('maintenance-tasks', '0 2 * * *', 'SELECT run_maintenance_tasks();');

-- Performance monitoring alerts
CREATE OR REPLACE FUNCTION check_performance_alerts()
RETURNS void AS $$
DECLARE
    conn_usage numeric;
    slow_query_count integer;
    bloated_table_count integer;
BEGIN
    -- Check connection usage
    SELECT usage_percentage INTO conn_usage FROM get_connection_stats();
    
    IF conn_usage > 80 THEN
        RAISE WARNING 'High connection usage: %% of max connections', conn_usage;
    END IF;
    
    -- Check for slow queries
    SELECT count(*) INTO slow_query_count FROM get_slow_queries(2000);
    
    IF slow_query_count > 10 THEN
        RAISE WARNING 'High number of slow queries detected: %', slow_query_count;
    END IF;
    
    -- Check for bloated tables
    SELECT count(*) INTO bloated_table_count 
    FROM get_table_bloat_stats() 
    WHERE bloat_ratio > 20;
    
    IF bloated_table_count > 0 THEN
        RAISE WARNING 'Tables with high bloat detected: %', bloated_table_count;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy performance monitoring
CREATE OR REPLACE VIEW v_performance_dashboard AS
SELECT 
    'connections' as metric_type,
    jsonb_build_object(
        'total', total_connections,
        'active', active_connections,
        'idle', idle_connections,
        'usage_percentage', usage_percentage
    ) as metric_data
FROM get_connection_stats()
UNION ALL
SELECT 
    'slow_queries' as metric_type,
    jsonb_agg(
        jsonb_build_object(
            'query', left(query, 100),
            'calls', calls,
            'mean_time', mean_time
        )
    ) as metric_data
FROM (SELECT * FROM get_slow_queries(1000) LIMIT 5) sq
UNION ALL
SELECT 
    'table_bloat' as metric_type,
    jsonb_agg(
        jsonb_build_object(
            'table', schemaname || '.' || tablename,
            'bloat_ratio', bloat_ratio,
            'size', table_size
        )
    ) as metric_data
FROM (SELECT * FROM get_table_bloat_stats() WHERE bloat_ratio > 10 LIMIT 5) tb;

-- Final optimization: Update table statistics
ANALYZE;

-- Log completion
INSERT INTO audit_logs (action, resource_type, new_values, created_at)
VALUES ('OPTIMIZATION', 'database', '{"migration": "003_performance_optimizations"}', CURRENT_TIMESTAMP);

COMMIT;