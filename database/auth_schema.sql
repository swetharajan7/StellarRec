-- StellarRec Authentication Database Schema
-- This schema supports user management, authentication, and authorization

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table - Core user information
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'counselor', 'admin')),
    profile_complete BOOLEAN DEFAULT FALSE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}',
    
    -- Indexes for performance
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_email_verified ON users(email_verified) WHERE deleted_at IS NULL;

-- Refresh tokens table - For JWT refresh token management
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure token is unique and not expired
    CONSTRAINT refresh_tokens_valid CHECK (expires_at > created_at)
);

-- Create indexes for refresh tokens
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token) WHERE revoked_at IS NULL;
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- Password reset tokens table
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure token expires after creation
    CONSTRAINT password_reset_tokens_valid CHECK (expires_at > created_at)
);

-- Create indexes for password reset tokens
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token) WHERE used_at IS NULL;
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);

-- Email verification tokens table
CREATE TABLE email_verification_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure token expires after creation
    CONSTRAINT email_verification_tokens_valid CHECK (expires_at > created_at)
);

-- Create indexes for email verification tokens
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_token ON email_verification_tokens(token) WHERE used_at IS NULL;
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- User sessions table - Track active user sessions
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for user sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token) WHERE ended_at IS NULL;
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity_at);

-- Authentication logs table - Security audit trail
CREATE TABLE auth_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- login, logout, register, password_reset, etc.
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for auth logs
CREATE INDEX idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX idx_auth_logs_event_type ON auth_logs(event_type);
CREATE INDEX idx_auth_logs_created_at ON auth_logs(created_at);
CREATE INDEX idx_auth_logs_success ON auth_logs(success);

-- Schools table - For school code validation
CREATE TABLE schools (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- high_school, college, university
    country VARCHAR(2) NOT NULL, -- ISO country code
    state_province VARCHAR(100),
    city VARCHAR(100),
    website VARCHAR(255),
    contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for schools
CREATE INDEX idx_schools_code ON schools(code) WHERE is_active = TRUE;
CREATE INDEX idx_schools_country ON schools(country) WHERE is_active = TRUE;
CREATE INDEX idx_schools_type ON schools(type) WHERE is_active = TRUE;

-- Invite codes table - For invitation-based registration
CREATE TABLE invite_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}', -- Can store role restrictions, school associations, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure current uses doesn't exceed max uses
    CONSTRAINT invite_codes_usage_check CHECK (current_uses <= max_uses)
);

-- Create indexes for invite codes
CREATE INDEX idx_invite_codes_code ON invite_codes(code) WHERE is_active = TRUE;
CREATE INDEX idx_invite_codes_created_by ON invite_codes(created_by);
CREATE INDEX idx_invite_codes_expires_at ON invite_codes(expires_at);

-- User profiles table - Extended profile information for students
CREATE TABLE student_profiles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Academic Information
    current_school_id INTEGER REFERENCES schools(id),
    graduation_year INTEGER,
    gpa DECIMAL(3,2),
    gpa_scale DECIMAL(3,1) DEFAULT 4.0,
    class_rank INTEGER,
    class_size INTEGER,
    
    -- Test Scores (stored as JSONB for flexibility)
    test_scores JSONB DEFAULT '{}',
    
    -- Course Information
    course_rigor JSONB DEFAULT '{}',
    
    -- Personal Information
    date_of_birth DATE,
    phone_number VARCHAR(20),
    address JSONB DEFAULT '{}',
    
    -- Background Information
    demographics JSONB DEFAULT '{}',
    socioeconomic JSONB DEFAULT '{}',
    
    -- Activities and Achievements
    extracurriculars JSONB DEFAULT '[]',
    work_experience JSONB DEFAULT '[]',
    volunteering JSONB DEFAULT '[]',
    achievements JSONB DEFAULT '[]',
    
    -- Goals and Preferences
    intended_major VARCHAR(100),
    career_interests JSONB DEFAULT '[]',
    university_preferences JSONB DEFAULT '{}',
    
    -- Application Timeline
    application_timeline JSONB DEFAULT '{}',
    
    -- Profile Completion Tracking
    completion_percentage INTEGER DEFAULT 0,
    last_updated_section VARCHAR(50),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for student profiles
CREATE INDEX idx_student_profiles_user_id ON student_profiles(user_id);
CREATE INDEX idx_student_profiles_school_id ON student_profiles(current_school_id);
CREATE INDEX idx_student_profiles_graduation_year ON student_profiles(graduation_year);
CREATE INDEX idx_student_profiles_intended_major ON student_profiles(intended_major);

-- Counselor profiles table - Extended profile information for counselors
CREATE TABLE counselor_profiles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Professional Information
    school_id INTEGER REFERENCES schools(id),
    title VARCHAR(100),
    department VARCHAR(100),
    years_experience INTEGER,
    
    -- Certifications and Qualifications
    certifications JSONB DEFAULT '[]',
    education JSONB DEFAULT '[]',
    
    -- Specializations
    specializations JSONB DEFAULT '[]', -- college prep, career counseling, etc.
    grade_levels JSONB DEFAULT '[]', -- 9-12, undergraduate, etc.
    
    -- Contact Information
    office_phone VARCHAR(20),
    office_location VARCHAR(100),
    office_hours JSONB DEFAULT '{}',
    
    -- Settings
    max_students INTEGER DEFAULT 100,
    auto_assign_students BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for counselor profiles
CREATE INDEX idx_counselor_profiles_user_id ON counselor_profiles(user_id);
CREATE INDEX idx_counselor_profiles_school_id ON counselor_profiles(school_id);

-- Student-Counselor relationships
CREATE TABLE student_counselor_assignments (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    counselor_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    
    -- Ensure unique active assignment per student
    UNIQUE(student_id, is_active) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for student-counselor assignments
CREATE INDEX idx_student_counselor_student_id ON student_counselor_assignments(student_id);
CREATE INDEX idx_student_counselor_counselor_id ON student_counselor_assignments(counselor_id);
CREATE INDEX idx_student_counselor_active ON student_counselor_assignments(is_active);

-- Functions and Triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schools_updated_at BEFORE UPDATE ON schools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_profiles_updated_at BEFORE UPDATE ON student_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_counselor_profiles_updated_at BEFORE UPDATE ON counselor_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    -- Delete expired refresh tokens
    DELETE FROM refresh_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Delete expired password reset tokens
    DELETE FROM password_reset_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Delete expired email verification tokens
    DELETE FROM email_verification_tokens 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Delete expired user sessions
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Delete old auth logs (keep for 90 days)
    DELETE FROM auth_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create a function to get user's full profile
CREATE OR REPLACE FUNCTION get_user_full_profile(user_id_param VARCHAR(255))
RETURNS TABLE (
    user_data JSONB,
    profile_data JSONB,
    school_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        to_jsonb(u.*) - 'password_hash' as user_data,
        CASE 
            WHEN u.role = 'student' THEN to_jsonb(sp.*)
            WHEN u.role = 'counselor' THEN to_jsonb(cp.*)
            ELSE '{}'::jsonb
        END as profile_data,
        COALESCE(to_jsonb(s.*), '{}'::jsonb) as school_data
    FROM users u
    LEFT JOIN student_profiles sp ON u.id = sp.user_id AND u.role = 'student'
    LEFT JOIN counselor_profiles cp ON u.id = cp.user_id AND u.role = 'counselor'
    LEFT JOIN schools s ON (sp.current_school_id = s.id OR cp.school_id = s.id)
    WHERE u.id = user_id_param AND u.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Insert default admin user (password: Admin123!)
-- Note: In production, this should be done securely with proper password hashing
INSERT INTO users (
    id, email, password_hash, first_name, last_name, role, 
    profile_complete, email_verified, preferences
) VALUES (
    'admin_001',
    'admin@stellarrec.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3bp.Txjx/W', -- Admin123!
    'System',
    'Administrator',
    'admin',
    true,
    true,
    '{
        "theme": "light",
        "notifications": {
            "email": true,
            "push": true,
            "deadlineReminders": true,
            "aiInsights": true,
            "universityUpdates": true
        },
        "privacy": {
            "profileVisibility": "private",
            "dataSharing": false,
            "analyticsOptOut": false
        },
        "language": "en",
        "timezone": "UTC"
    }'::jsonb
);

-- Insert sample schools
INSERT INTO schools (code, name, type, country, state_province, city, website, contact_email) VALUES
('LINCOLN_HS', 'Lincoln High School', 'high_school', 'US', 'CA', 'San Francisco', 'https://lincoln.sfusd.edu', 'info@lincoln.sfusd.edu'),
('HARVARD_WESTLAKE', 'Harvard-Westlake School', 'high_school', 'US', 'CA', 'Los Angeles', 'https://hw.com', 'admission@hw.com'),
('PHILLIPS_EXETER', 'Phillips Exeter Academy', 'high_school', 'US', 'NH', 'Exeter', 'https://exeter.edu', 'admission@exeter.edu'),
('STUYVESANT_HS', 'Stuyvesant High School', 'high_school', 'US', 'NY', 'New York', 'https://stuy.enschool.org', 'info@stuy.edu'),
('THOMAS_JEFFERSON', 'Thomas Jefferson High School for Science and Technology', 'high_school', 'US', 'VA', 'Alexandria', 'https://tjhsst.fcps.edu', 'info@tjhsst.edu');

-- Create sample invite codes
INSERT INTO invite_codes (code, max_uses, metadata) VALUES
('BETA2024', 100, '{"role": "student", "description": "Beta testing program 2024"}'),
('COUNSELOR2024', 50, '{"role": "counselor", "description": "Counselor early access program"}'),
('SCHOOL_PILOT', 25, '{"role": "student", "school_required": true, "description": "School pilot program"}')