-- StellarRec Database Initialization Script

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('student', 'recommender', 'institution', 'admin');
CREATE TYPE application_status AS ENUM ('draft', 'in_progress', 'submitted', 'under_review', 'accepted', 'rejected', 'waitlisted');
CREATE TYPE component_status AS ENUM ('pending', 'in_progress', 'completed', 'approved', 'rejected');
CREATE TYPE component_type AS ENUM ('personal_info', 'academic_history', 'test_scores', 'essays', 'recommendations', 'portfolio', 'financial_aid');
CREATE TYPE letter_status AS ENUM ('draft', 'in_review', 'approved', 'delivered', 'expired');
CREATE TYPE delivery_status AS ENUM ('pending', 'in_transit', 'delivered', 'failed', 'expired');
CREATE TYPE delivery_method_type AS ENUM ('api', 'email', 'portal', 'ftp', 'webhook');
CREATE TYPE match_category AS ENUM ('safety', 'target', 'reach');
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE event_status AS ENUM ('pending', 'completed', 'overdue');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Student profiles
CREATE TABLE student_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    phone VARCHAR(20),
    address JSONB,
    gpa DECIMAL(3,2),
    graduation_year INTEGER,
    academic_interests TEXT[],
    target_programs TEXT[],
    test_scores JSONB,
    profile_data JSONB DEFAULT '{}',
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Recommender profiles
CREATE TABLE recommender_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(200),
    institution VARCHAR(200),
    department VARCHAR(200),
    phone VARCHAR(20),
    office_address TEXT,
    expertise_areas TEXT[],
    years_experience INTEGER,
    profile_data JSONB DEFAULT '{}',
    avatar_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Institution profiles
CREATE TABLE institution_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    institution_name VARCHAR(200) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    address JSONB,
    website VARCHAR(500),
    integration_config JSONB DEFAULT '{}',
    profile_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User preferences
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    notifications JSONB DEFAULT '{"email": true, "sms": false, "push": true}',
    privacy JSONB DEFAULT '{"profileVisibility": "private", "dataSharing": false}',
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    theme VARCHAR(20) DEFAULT 'light',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Universities
CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(50),
    location JSONB NOT NULL,
    ranking JSONB DEFAULT '{}',
    admission_requirements JSONB DEFAULT '{}',
    deadlines JSONB DEFAULT '{}',
    integration_config JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Programs
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID REFERENCES universities(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    degree VARCHAR(50) NOT NULL,
    department VARCHAR(100) NOT NULL,
    description TEXT,
    requirements JSONB DEFAULT '{}',
    duration VARCHAR(50),
    tuition JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Applications
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id),
    program_id UUID REFERENCES programs(id),
    status application_status DEFAULT 'draft',
    progress_percentage INTEGER DEFAULT 0,
    deadline DATE NOT NULL,
    submitted_at TIMESTAMP,
    decision_date DATE,
    decision_result VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Application components
CREATE TABLE application_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    component_type component_type NOT NULL,
    status component_status DEFAULT 'pending',
    data JSONB DEFAULT '{}',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Timeline events
CREATE TABLE timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    priority priority_level DEFAULT 'medium',
    status event_status DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Recommendation letters
CREATE TABLE recommendation_letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recommender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    status letter_status DEFAULT 'draft',
    template_id UUID,
    ai_suggestions JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Letter deliveries
CREATE TABLE letter_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    letter_id UUID REFERENCES recommendation_letters(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id),
    delivery_method delivery_method_type NOT NULL,
    status delivery_status DEFAULT 'pending',
    delivered_at TIMESTAMP,
    confirmation_id VARCHAR(100),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Letter collaborators
CREATE TABLE letter_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    letter_id UUID REFERENCES recommendation_letters(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
    permissions TEXT[] DEFAULT '{}',
    invited_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    UNIQUE(letter_id, user_id)
);

-- Letter versions
CREATE TABLE letter_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    letter_id UUID REFERENCES recommendation_letters(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    changes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- University matches
CREATE TABLE university_matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    university_id UUID REFERENCES universities(id),
    match_percentage DECIMAL(5,2) NOT NULL,
    confidence DECIMAL(5,2) NOT NULL,
    reasoning JSONB DEFAULT '{}',
    category match_category NOT NULL,
    factors JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, university_id)
);

-- Essay analyses
CREATE TABLE essay_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    scores JSONB DEFAULT '{}',
    suggestions JSONB DEFAULT '[]',
    word_count INTEGER,
    readability_score DECIMAL(5,2),
    sentiment VARCHAR(20),
    key_topics TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP,
    delivery_method VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_applications_student_id ON applications(student_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_deadline ON applications(deadline);

CREATE INDEX idx_recommendation_letters_student_id ON recommendation_letters(student_id);
CREATE INDEX idx_recommendation_letters_recommender_id ON recommendation_letters(recommender_id);
CREATE INDEX idx_recommendation_letters_status ON recommendation_letters(status);

CREATE INDEX idx_letter_deliveries_letter_id ON letter_deliveries(letter_id);
CREATE INDEX idx_letter_deliveries_status ON letter_deliveries(status);

CREATE INDEX idx_university_matches_student_id ON university_matches(student_id);
CREATE INDEX idx_university_matches_match_percentage ON university_matches(match_percentage);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_student_profiles_updated_at BEFORE UPDATE ON student_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recommender_profiles_updated_at BEFORE UPDATE ON recommender_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_institution_profiles_updated_at BEFORE UPDATE ON institution_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_universities_updated_at BEFORE UPDATE ON universities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_application_components_updated_at BEFORE UPDATE ON application_components FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_timeline_events_updated_at BEFORE UPDATE ON timeline_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recommendation_letters_updated_at BEFORE UPDATE ON recommendation_letters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_letter_deliveries_updated_at BEFORE UPDATE ON letter_deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_university_matches_updated_at BEFORE UPDATE ON university_matches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();