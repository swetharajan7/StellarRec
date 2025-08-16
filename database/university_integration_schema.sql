-- University Integration System Database Schema
-- Supports comprehensive North American university API integration

-- =====================================================
-- CORE UNIVERSITY INTEGRATION TABLES
-- =====================================================

-- University integrations configuration
CREATE TABLE IF NOT EXISTS university_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL CHECK (integration_type IN (
        'commonapp', 'coalition', 'uc_system', 'csu_system', 'suny_system', 
        'applytexas', 'ouac', 'education_planner_bc', 'state_system', 
        'direct_api', 'email', 'manual'
    )),
    api_endpoint VARCHAR(500),
    auth_config JSONB DEFAULT '{}',
    submission_format VARCHAR(20) NOT NULL DEFAULT 'json' CHECK (submission_format IN ('json', 'xml', 'form_data', 'email')),
    rate_limit_config JSONB NOT NULL DEFAULT '{
        "requestsPerMinute": 10,
        "requestsPerHour": 100,
        "requestsPerDay": 1000,
        "burstLimit": 5
    }',
    features JSONB NOT NULL DEFAULT '{
        "realTimeStatus": false,
        "bulkSubmission": false,
        "documentUpload": false,
        "statusWebhooks": false,
        "customFields": false
    }',
    requirements JSONB NOT NULL DEFAULT '{
        "requiredFields": ["student_name", "recommender_name", "recommendation_content"],
        "optionalFields": [],
        "documentTypes": ["recommendation_letter"],
        "maxRecommendationLength": 5000,
        "supportedPrograms": ["undergraduate", "graduate", "doctoral"],
        "deadlineBuffer": 24
    }',
    is_active BOOLEAN DEFAULT TRUE,
    last_tested TIMESTAMP WITH TIME ZONE,
    test_status VARCHAR(20) DEFAULT 'unknown' CHECK (test_status IN ('success', 'failed', 'unknown')),
    test_error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(university_id)
);

-- Integration credentials (encrypted storage)
CREATE TABLE IF NOT EXISTS integration_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_type VARCHAR(50) NOT NULL,
    credential_name VARCHAR(100) NOT NULL,
    credential_value TEXT NOT NULL, -- Encrypted
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(integration_type, credential_name)
);

-- =====================================================
-- SUBMISSION TRACKING TABLES
-- =====================================================

-- Enhanced submissions table for integration tracking
CREATE TABLE IF NOT EXISTS integration_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    integration_type VARCHAR(50) NOT NULL,
    external_submission_id VARCHAR(255), -- ID from external system
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'submitted', 'processing', 'delivered', 'confirmed', 
        'failed', 'retry', 'cancelled', 'expired'
    )),
    submission_data JSONB NOT NULL,
    response_data JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Submission status history for audit trail
CREATE TABLE IF NOT EXISTS submission_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES integration_submissions(id) ON DELETE CASCADE,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by VARCHAR(50) DEFAULT 'system',
    change_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting tracking
CREATE TABLE IF NOT EXISTS rate_limit_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_type VARCHAR(50) NOT NULL,
    university_id UUID,
    time_window VARCHAR(20) NOT NULL CHECK (time_window IN ('minute', 'hour', 'day')),
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(integration_type, university_id, time_window, window_start)
);

-- =====================================================
-- NORTH AMERICAN UNIVERSITIES DATA
-- =====================================================

-- Extended universities table with integration-specific fields
ALTER TABLE universities ADD COLUMN IF NOT EXISTS country VARCHAR(2) DEFAULT 'US' CHECK (country IN ('US', 'CA'));
ALTER TABLE universities ADD COLUMN IF NOT EXISTS state VARCHAR(50);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS province VARCHAR(50);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS region VARCHAR(50);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS institution_type VARCHAR(50);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS carnegie_classification VARCHAR(100);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS accreditation JSONB DEFAULT '[]';
ALTER TABLE universities ADD COLUMN IF NOT EXISTS website_url VARCHAR(500);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS admissions_email VARCHAR(255);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS address JSONB DEFAULT '{}';
ALTER TABLE universities ADD COLUMN IF NOT EXISTS enrollment_size INTEGER;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS founded_year INTEGER;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS is_public BOOLEAN;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS tuition_range VARCHAR(50);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS application_systems JSONB DEFAULT '[]';

-- University programs and requirements
CREATE TABLE IF NOT EXISTS university_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    program_name VARCHAR(255) NOT NULL,
    program_type VARCHAR(50) NOT NULL CHECK (program_type IN (
        'undergraduate', 'graduate', 'doctoral', 'certificate', 'professional'
    )),
    degree_type VARCHAR(100),
    department VARCHAR(255),
    application_deadline DATE,
    early_deadline DATE,
    rolling_admission BOOLEAN DEFAULT FALSE,
    requirements JSONB DEFAULT '{}',
    test_requirements JSONB DEFAULT '{}',
    recommendation_requirements JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Application system mappings (which universities use which systems)
CREATE TABLE IF NOT EXISTS university_application_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    system_name VARCHAR(50) NOT NULL CHECK (system_name IN (
        'commonapp', 'coalition', 'uc_application', 'csu_application', 
        'suny_application', 'applytexas', 'ouac', 'education_planner_bc',
        'university_specific', 'multiple_systems'
    )),
    system_priority INTEGER DEFAULT 1, -- 1 = primary, 2 = secondary, etc.
    program_types JSONB DEFAULT '["undergraduate"]',
    application_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INTEGRATION MONITORING AND ANALYTICS
-- =====================================================

-- Integration performance metrics
CREATE TABLE IF NOT EXISTS integration_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_type VARCHAR(50) NOT NULL,
    university_id UUID REFERENCES universities(id),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    metric_unit VARCHAR(20),
    time_period VARCHAR(20) NOT NULL CHECK (time_period IN ('hour', 'day', 'week', 'month')),
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Integration health checks
CREATE TABLE IF NOT EXISTS integration_health_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_type VARCHAR(50) NOT NULL,
    university_id UUID REFERENCES universities(id),
    check_type VARCHAR(50) NOT NULL CHECK (check_type IN (
        'connectivity', 'authentication', 'rate_limit', 'response_time', 'error_rate'
    )),
    status VARCHAR(20) NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- University integrations indexes
CREATE INDEX IF NOT EXISTS idx_university_integrations_type ON university_integrations(integration_type);
CREATE INDEX IF NOT EXISTS idx_university_integrations_active ON university_integrations(is_active);
CREATE INDEX IF NOT EXISTS idx_university_integrations_university ON university_integrations(university_id);

-- Submissions indexes
CREATE INDEX IF NOT EXISTS idx_integration_submissions_recommendation ON integration_submissions(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_integration_submissions_university ON integration_submissions(university_id);
CREATE INDEX IF NOT EXISTS idx_integration_submissions_status ON integration_submissions(status);
CREATE INDEX IF NOT EXISTS idx_integration_submissions_type ON integration_submissions(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_submissions_retry ON integration_submissions(next_retry_at) WHERE status = 'retry';
CREATE INDEX IF NOT EXISTS idx_integration_submissions_external_id ON integration_submissions(external_submission_id);

-- Universities indexes
CREATE INDEX IF NOT EXISTS idx_universities_country ON universities(country);
CREATE INDEX IF NOT EXISTS idx_universities_state ON universities(state);
CREATE INDEX IF NOT EXISTS idx_universities_province ON universities(province);
CREATE INDEX IF NOT EXISTS idx_universities_type ON universities(institution_type);
CREATE INDEX IF NOT EXISTS idx_universities_active ON universities(is_active);

-- Rate limiting indexes
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_lookup ON rate_limit_tracking(integration_type, university_id, time_window, window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_cleanup ON rate_limit_tracking(created_at);

-- Programs indexes
CREATE INDEX IF NOT EXISTS idx_university_programs_university ON university_programs(university_id);
CREATE INDEX IF NOT EXISTS idx_university_programs_type ON university_programs(program_type);
CREATE INDEX IF NOT EXISTS idx_university_programs_active ON university_programs(is_active);

-- Application systems indexes
CREATE INDEX IF NOT EXISTS idx_university_app_systems_university ON university_application_systems(university_id);
CREATE INDEX IF NOT EXISTS idx_university_app_systems_system ON university_application_systems(system_name);
CREATE INDEX IF NOT EXISTS idx_university_app_systems_active ON university_application_systems(is_active);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_integration_metrics_type_period ON integration_metrics(integration_type, time_period, period_start);
CREATE INDEX IF NOT EXISTS idx_integration_metrics_university ON integration_metrics(university_id);

-- Health checks indexes
CREATE INDEX IF NOT EXISTS idx_integration_health_type ON integration_health_checks(integration_type);
CREATE INDEX IF NOT EXISTS idx_integration_health_status ON integration_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_integration_health_checked ON integration_health_checks(checked_at);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers
CREATE TRIGGER update_university_integrations_updated_at BEFORE UPDATE ON university_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_credentials_updated_at BEFORE UPDATE ON integration_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_submissions_updated_at BEFORE UPDATE ON integration_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rate_limit_tracking_updated_at BEFORE UPDATE ON rate_limit_tracking FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_university_programs_updated_at BEFORE UPDATE ON university_programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Status change trigger for submissions
CREATE OR REPLACE FUNCTION log_submission_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO submission_status_history (
            submission_id, previous_status, new_status, change_reason, metadata
        ) VALUES (
            NEW.id, OLD.status, NEW.status, 
            COALESCE(NEW.metadata->>'status_change_reason', 'Automatic status update'),
            jsonb_build_object('old_metadata', OLD.metadata, 'new_metadata', NEW.metadata)
        );
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER log_integration_submission_status_change 
    AFTER UPDATE ON integration_submissions 
    FOR EACH ROW EXECUTE FUNCTION log_submission_status_change();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- University integration summary view
CREATE OR REPLACE VIEW university_integration_summary AS
SELECT 
    u.id,
    u.name,
    u.code,
    u.country,
    u.state,
    u.province,
    ui.integration_type,
    ui.is_active as integration_active,
    ui.features,
    ui.last_tested,
    ui.test_status,
    COUNT(DISTINCT is_sub.id) as total_submissions,
    COUNT(DISTINCT CASE WHEN is_sub.status = 'confirmed' THEN is_sub.id END) as successful_submissions,
    COUNT(DISTINCT CASE WHEN is_sub.status = 'failed' THEN is_sub.id END) as failed_submissions
FROM universities u
LEFT JOIN university_integrations ui ON u.id = ui.university_id
LEFT JOIN integration_submissions is_sub ON u.id = is_sub.university_id
WHERE u.is_active = true
GROUP BY u.id, u.name, u.code, u.country, u.state, u.province, ui.integration_type, ui.is_active, ui.features, ui.last_tested, ui.test_status;

-- Active integrations by type
CREATE OR REPLACE VIEW integration_type_summary AS
SELECT 
    integration_type,
    COUNT(*) as university_count,
    COUNT(CASE WHEN is_active THEN 1 END) as active_count,
    COUNT(CASE WHEN test_status = 'success' THEN 1 END) as healthy_count,
    AVG(CASE WHEN last_tested IS NOT NULL THEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_tested))/3600 END) as avg_hours_since_test
FROM university_integrations
GROUP BY integration_type
ORDER BY university_count DESC;

-- Submission success rates by integration type
CREATE OR REPLACE VIEW submission_success_rates AS
SELECT 
    ui.integration_type,
    COUNT(is_sub.id) as total_submissions,
    COUNT(CASE WHEN is_sub.status IN ('confirmed', 'delivered') THEN 1 END) as successful_submissions,
    COUNT(CASE WHEN is_sub.status = 'failed' THEN 1 END) as failed_submissions,
    COUNT(CASE WHEN is_sub.status IN ('pending', 'processing', 'retry') THEN 1 END) as pending_submissions,
    ROUND(
        COUNT(CASE WHEN is_sub.status IN ('confirmed', 'delivered') THEN 1 END) * 100.0 / 
        NULLIF(COUNT(is_sub.id), 0), 2
    ) as success_rate_percent
FROM university_integrations ui
LEFT JOIN integration_submissions is_sub ON ui.university_id = is_sub.university_id
WHERE ui.is_active = true
GROUP BY ui.integration_type
ORDER BY success_rate_percent DESC;

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Insert default integration types configuration
INSERT INTO integration_credentials (integration_type, credential_name, credential_value, is_active) VALUES
('commonapp', 'api_key', 'ENCRYPTED_API_KEY_PLACEHOLDER', true),
('coalition', 'api_key', 'ENCRYPTED_API_KEY_PLACEHOLDER', true),
('uc_system', 'api_key', 'ENCRYPTED_API_KEY_PLACEHOLDER', true),
('ouac', 'api_key', 'ENCRYPTED_API_KEY_PLACEHOLDER', true)
ON CONFLICT (integration_type, credential_name) DO NOTHING;

-- Create function to clean up old rate limiting data
CREATE OR REPLACE FUNCTION cleanup_old_rate_limit_data()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limit_tracking 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    DELETE FROM integration_health_checks 
    WHERE checked_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    DELETE FROM integration_metrics 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (would be called by a cron job or scheduled task)
COMMENT ON FUNCTION cleanup_old_rate_limit_data() IS 'Cleanup function for old rate limiting and monitoring data. Should be called daily via cron job.';