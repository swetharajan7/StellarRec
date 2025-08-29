-- Data validation constraints and triggers

-- Email validation constraint
ALTER TABLE users ADD CONSTRAINT check_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- GPA validation constraint
ALTER TABLE student_profiles ADD CONSTRAINT check_gpa_range 
CHECK (gpa IS NULL OR (gpa >= 0.0 AND gpa <= 4.0));

-- Graduation year validation
ALTER TABLE student_profiles ADD CONSTRAINT check_graduation_year 
CHECK (graduation_year IS NULL OR (graduation_year >= 1900 AND graduation_year <= 2050));

-- Application progress validation
ALTER TABLE applications ADD CONSTRAINT check_progress_percentage 
CHECK (progress_percentage >= 0 AND progress_percentage <= 100);

-- Match percentage validation
ALTER TABLE university_matches ADD CONSTRAINT check_match_percentage 
CHECK (match_percentage >= 0.0 AND match_percentage <= 100.0);

-- Confidence validation
ALTER TABLE university_matches ADD CONSTRAINT check_confidence 
CHECK (confidence >= 0.0 AND confidence <= 100.0);

-- Readability score validation
ALTER TABLE essay_analyses ADD CONSTRAINT check_readability_score 
CHECK (readability_score IS NULL OR (readability_score >= 0.0 AND readability_score <= 100.0));

-- Retry count validation
ALTER TABLE letter_deliveries ADD CONSTRAINT check_retry_count 
CHECK (retry_count >= 0 AND retry_count <= 10);

-- Years experience validation
ALTER TABLE recommender_profiles ADD CONSTRAINT check_years_experience 
CHECK (years_experience IS NULL OR years_experience >= 0);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_profiles_updated_at BEFORE UPDATE ON student_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recommender_profiles_updated_at BEFORE UPDATE ON recommender_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_institution_profiles_updated_at BEFORE UPDATE ON institution_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_universities_updated_at BEFORE UPDATE ON universities 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON programs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_application_components_updated_at BEFORE UPDATE ON application_components 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_timeline_events_updated_at BEFORE UPDATE ON timeline_events 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recommendation_letters_updated_at BEFORE UPDATE ON recommendation_letters 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_letter_deliveries_updated_at BEFORE UPDATE ON letter_deliveries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_university_matches_updated_at BEFORE UPDATE ON university_matches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, ip_address, user_agent)
        VALUES (
            COALESCE(current_setting('app.current_user_id', true)::uuid, NULL),
            'DELETE',
            TG_TABLE_NAME,
            OLD.id::text,
            row_to_json(OLD),
            current_setting('app.client_ip', true),
            current_setting('app.user_agent', true)
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
        VALUES (
            COALESCE(current_setting('app.current_user_id', true)::uuid, NULL),
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id::text,
            row_to_json(OLD),
            row_to_json(NEW),
            current_setting('app.client_ip', true),
            current_setting('app.user_agent', true)
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values, ip_address, user_agent)
        VALUES (
            COALESCE(current_setting('app.current_user_id', true)::uuid, NULL),
            'INSERT',
            TG_TABLE_NAME,
            NEW.id::text,
            row_to_json(NEW),
            current_setting('app.client_ip', true),
            current_setting('app.user_agent', true)
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Audit triggers for sensitive tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users 
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_student_profiles AFTER INSERT OR UPDATE OR DELETE ON student_profiles 
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_recommender_profiles AFTER INSERT OR UPDATE OR DELETE ON recommender_profiles 
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_applications AFTER INSERT OR UPDATE OR DELETE ON applications 
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

CREATE TRIGGER audit_recommendation_letters AFTER INSERT OR UPDATE OR DELETE ON recommendation_letters 
    FOR EACH ROW EXECUTE FUNCTION create_audit_log();

-- Function to automatically update application progress
CREATE OR REPLACE FUNCTION update_application_progress()
RETURNS TRIGGER AS $$
DECLARE
    total_components INTEGER;
    completed_components INTEGER;
    new_progress INTEGER;
BEGIN
    -- Count total and completed components for the application
    SELECT COUNT(*) INTO total_components
    FROM application_components 
    WHERE application_id = NEW.application_id;
    
    SELECT COUNT(*) INTO completed_components
    FROM application_components 
    WHERE application_id = NEW.application_id AND status = 'completed';
    
    -- Calculate progress percentage
    IF total_components > 0 THEN
        new_progress := ROUND((completed_components::DECIMAL / total_components::DECIMAL) * 100);
    ELSE
        new_progress := 0;
    END IF;
    
    -- Update application progress
    UPDATE applications 
    SET progress_percentage = new_progress,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.application_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update application progress when components change
CREATE TRIGGER update_app_progress_on_component_change 
    AFTER INSERT OR UPDATE OR DELETE ON application_components
    FOR EACH ROW EXECUTE FUNCTION update_application_progress();

-- Function to prevent deletion of submitted applications
CREATE OR REPLACE FUNCTION prevent_submitted_application_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('submitted', 'under_review', 'accepted', 'rejected', 'waitlisted') THEN
        RAISE EXCEPTION 'Cannot delete application with status: %', OLD.status;
    END IF;
    RETURN OLD;
END;
$$ language 'plpgsql';

-- Trigger to prevent deletion of submitted applications
CREATE TRIGGER prevent_submitted_app_deletion 
    BEFORE DELETE ON applications
    FOR EACH ROW EXECUTE FUNCTION prevent_submitted_application_deletion();

-- Function to validate deadline constraints
CREATE OR REPLACE FUNCTION validate_application_deadline()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent setting deadline in the past for new applications
    IF TG_OP = 'INSERT' AND NEW.deadline < CURRENT_DATE THEN
        RAISE EXCEPTION 'Application deadline cannot be in the past';
    END IF;
    
    -- Prevent moving deadline earlier for existing applications
    IF TG_OP = 'UPDATE' AND NEW.deadline < OLD.deadline AND OLD.status != 'draft' THEN
        RAISE EXCEPTION 'Cannot move deadline earlier for non-draft applications';
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for deadline validation
CREATE TRIGGER validate_app_deadline 
    BEFORE INSERT OR UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION validate_application_deadline();

-- Function to automatically set letter delivery status
CREATE OR REPLACE FUNCTION update_letter_status_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
    -- If letter is successfully delivered, update letter status
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        UPDATE recommendation_letters 
        SET status = 'delivered', updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.letter_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update letter status when delivery is successful
CREATE TRIGGER update_letter_on_delivery 
    AFTER UPDATE ON letter_deliveries
    FOR EACH ROW EXECUTE FUNCTION update_letter_status_on_delivery();