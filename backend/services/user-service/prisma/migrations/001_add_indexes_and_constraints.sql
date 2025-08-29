-- Performance optimization indexes
-- User-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_login ON users(last_login);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Profile indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_profiles_graduation_year ON student_profiles(graduation_year);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_profiles_gpa ON student_profiles(gpa);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_profiles_academic_interests ON student_profiles USING GIN(academic_interests);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommender_profiles_institution ON recommender_profiles(institution);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommender_profiles_expertise ON recommender_profiles USING GIN(expertise_areas);

-- Application-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_student_id ON applications(student_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_university_id ON applications(university_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_deadline ON applications(deadline);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_created_at ON applications(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_student_status ON applications(student_id, status);

-- Application components indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_components_application_id ON application_components(application_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_components_type_status ON application_components(component_type, status);

-- Timeline events indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timeline_events_application_id ON timeline_events(application_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timeline_events_due_date ON timeline_events(due_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timeline_events_status ON timeline_events(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_timeline_events_priority ON timeline_events(priority);

-- Letter-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_student_id ON recommendation_letters(student_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_recommender_id ON recommendation_letters(recommender_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_status ON recommendation_letters(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_created_at ON recommendation_letters(created_at);

-- Letter delivery indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letter_deliveries_letter_id ON letter_deliveries(letter_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letter_deliveries_university_id ON letter_deliveries(university_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letter_deliveries_status ON letter_deliveries(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letter_deliveries_delivered_at ON letter_deliveries(delivered_at);

-- University and program indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_name ON universities(name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_is_active ON universities(is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_universities_location ON universities USING GIN(location);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_programs_university_id ON programs(university_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_programs_degree ON programs(degree);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_programs_department ON programs(department);

-- University matches indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_university_matches_student_id ON university_matches(student_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_university_matches_university_id ON university_matches(university_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_university_matches_percentage ON university_matches(match_percentage);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_university_matches_category ON university_matches(category);

-- Essay analysis indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_essay_analyses_user_id ON essay_analyses(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_essay_analyses_created_at ON essay_analyses(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_essay_analyses_topics ON essay_analyses USING GIN(key_topics);

-- Notification indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Audit log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Composite indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_student_deadline ON applications(student_id, deadline);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_letters_student_recommender ON recommendation_letters(student_id, recommender_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = false;