-- International Expansion Database Schema
-- Extends StellarRec to support global university integrations

-- =====================================================
-- INTERNATIONAL EXTENSIONS TO EXISTING TABLES
-- =====================================================

-- Extend universities table for international support
ALTER TABLE universities ADD COLUMN IF NOT EXISTS region VARCHAR(20) CHECK (region IN (
    'NORTH_AMERICA', 'EUROPE', 'UK', 'OCEANIA', 'ASIA', 'SOUTH_AMERICA', 'AFRICA'
));
ALTER TABLE universities ADD COLUMN IF NOT EXISTS language VARCHAR(10); -- ISO 639-1
ALTER TABLE universities ADD COLUMN IF NOT EXISTS currency VARCHAR(3); -- ISO 4217
ALTER TABLE universities ADD COLUMN IF NOT EXISTS time_zone VARCHAR(50);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS academic_year_start DATE;
ALTER TABLE universities ADD COLUMN IF NOT EXISTS application_system VARCHAR(50);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS grading_system VARCHAR(50);
ALTER TABLE universities ADD COLUMN IF NOT EXISTS entry_requirements JSONB DEFAULT '{}';
ALTER TABLE universities ADD COLUMN IF NOT EXISTS international_fees JSONB DEFAULT '{}';
ALTER TABLE universities ADD COLUMN IF NOT EXISTS visa_requirements JSONB DEFAULT '{}';

-- Update integration types for international systems
ALTER TABLE university_integrations DROP CONSTRAINT IF EXISTS university_integrations_integration_type_check;
ALTER TABLE university_integrations ADD CONSTRAINT university_integrations_integration_type_check 
CHECK (integration_type IN (
    -- North American systems
    'commonapp', 'coalition', 'uc_system', 'csu_system', 'suny_system', 'applytexas', 'ouac', 'education_planner_bc',
    -- UK systems
    'ucas', 'ucas_postgraduate', 'direct_uk',
    -- European systems
    'parcoursup', 'uni_assist', 'studielink', 'universitaly', 'aneca', 'anvur', 'aeres',
    -- Australian/NZ systems
    'uac', 'vtac', 'qtac', 'satac', 'tisc', 'nz_direct',
    -- Generic systems
    'state_system', 'direct_api', 'email', 'manual'
));

-- =====================================================
-- INTERNATIONAL CONFIGURATION TABLES
-- =====================================================

-- Country configurations and metadata
CREATE TABLE IF NOT EXISTS countries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_code VARCHAR(2) NOT NULL UNIQUE, -- ISO 3166-1 alpha-2
    country_name VARCHAR(100) NOT NULL,
    region VARCHAR(20) NOT NULL,
    currency VARCHAR(3) NOT NULL, -- ISO 4217
    languages JSONB NOT NULL DEFAULT '[]', -- Array of supported languages
    time_zones JSONB NOT NULL DEFAULT '[]', -- Array of time zones
    application_systems JSONB NOT NULL DEFAULT '[]', -- Available application systems
    grading_systems JSONB NOT NULL DEFAULT '[]', -- Educational grading systems
    visa_requirements JSONB DEFAULT '{}',
    education_system JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Language support and localization
CREATE TABLE IF NOT EXISTS supported_languages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    language_code VARCHAR(10) NOT NULL UNIQUE, -- ISO 639-1
    language_name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    is_rtl BOOLEAN DEFAULT FALSE, -- Right-to-left languages
    translation_coverage DECIMAL(5,2) DEFAULT 0.00, -- Percentage of UI translated
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- International requirements and qualifications
CREATE TABLE IF NOT EXISTS international_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    country_code VARCHAR(2) NOT NULL,
    requirement_type VARCHAR(50) NOT NULL CHECK (requirement_type IN (
        'academic_qualification', 'language_proficiency', 'standardized_test', 
        'personal_statement', 'recommendation_letter', 'portfolio', 'interview',
        'visa_document', 'financial_proof', 'health_certificate'
    )),
    requirement_details JSONB NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    minimum_score DECIMAL(10,2),
    maximum_score DECIMAL(10,2),
    valid_from DATE,
    valid_until DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Grade conversion and equivalency tables
CREATE TABLE IF NOT EXISTS grade_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_country VARCHAR(2) NOT NULL,
    to_country VARCHAR(2) NOT NULL,
    from_system VARCHAR(50) NOT NULL,
    to_system VARCHAR(50) NOT NULL,
    conversion_table JSONB NOT NULL, -- Grade mapping rules
    conversion_formula TEXT, -- Mathematical conversion formula
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(from_country, to_country, from_system, to_system)
);

-- =====================================================
-- INTERNATIONAL SUBMISSION EXTENSIONS
-- =====================================================

-- Extended submission data for international requirements
CREATE TABLE IF NOT EXISTS international_submission_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES integration_submissions(id) ON DELETE CASCADE,
    country_code VARCHAR(2) NOT NULL,
    language_code VARCHAR(10),
    localized_content JSONB DEFAULT '{}', -- Translated/localized content
    grade_conversions JSONB DEFAULT '{}', -- Applied grade conversions
    visa_information JSONB DEFAULT '{}', -- Visa-related data
    cultural_adaptations JSONB DEFAULT '{}', -- Country-specific adaptations
    additional_documents JSONB DEFAULT '[]', -- Extra required documents
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- International fee structures and pricing
CREATE TABLE IF NOT EXISTS international_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_code VARCHAR(2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    service_type VARCHAR(50) NOT NULL CHECK (service_type IN (
        'single_submission', 'bulk_submission', 'premium_service', 'consultation', 'translation'
    )),
    base_price DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,2) DEFAULT 0.00,
    discount_tiers JSONB DEFAULT '[]', -- Volume discounts
    valid_from DATE NOT NULL,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- UK-SPECIFIC TABLES (UCAS INTEGRATION)
-- =====================================================

-- UCAS-specific university data
CREATE TABLE IF NOT EXISTS ucas_universities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
    ucas_code VARCHAR(10) NOT NULL UNIQUE,
    ucas_name VARCHAR(255) NOT NULL,
    institution_type VARCHAR(50) CHECK (institution_type IN (
        'university', 'college', 'conservatoire', 'specialist_institution'
    )),
    russell_group BOOLEAN DEFAULT FALSE,
    red_brick BOOLEAN DEFAULT FALSE,
    ancient_university BOOLEAN DEFAULT FALSE,
    tariff_points_range JSONB DEFAULT '{}', -- Min/max UCAS points
    entry_requirements JSONB DEFAULT '{}',
    international_fees JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- UCAS courses and programs
CREATE TABLE IF NOT EXISTS ucas_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ucas_university_id UUID NOT NULL REFERENCES ucas_universities(id) ON DELETE CASCADE,
    course_code VARCHAR(10) NOT NULL,
    course_title VARCHAR(255) NOT NULL,
    qualification VARCHAR(50), -- BA, BSc, MEng, etc.
    duration_years INTEGER,
    entry_requirements JSONB DEFAULT '{}',
    tariff_points INTEGER,
    subject_requirements JSONB DEFAULT '[]',
    application_deadline DATE,
    course_fees JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(ucas_university_id, course_code)
);

-- =====================================================
-- EUROPEAN INTEGRATION TABLES
-- =====================================================

-- European university systems and integrations
CREATE TABLE IF NOT EXISTS european_university_systems (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_code VARCHAR(2) NOT NULL,
    system_name VARCHAR(100) NOT NULL,
    system_code VARCHAR(20) NOT NULL,
    api_endpoint VARCHAR(500),
    authentication_type VARCHAR(50),
    supported_languages JSONB DEFAULT '[]',
    application_deadlines JSONB DEFAULT '{}',
    fee_structure JSONB DEFAULT '{}',
    is_centralized BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(country_code, system_code)
);

-- Bologna Process and ECTS integration
CREATE TABLE IF NOT EXISTS ects_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_country VARCHAR(2) NOT NULL,
    to_country VARCHAR(2) NOT NULL,
    from_grade VARCHAR(10) NOT NULL,
    ects_grade VARCHAR(2) NOT NULL, -- A, B, C, D, E, F
    ects_points DECIMAL(4,1),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(from_country, to_country, from_grade)
);

-- =====================================================
-- AUSTRALIAN/NZ INTEGRATION TABLES
-- =====================================================

-- Australian university admission centers
CREATE TABLE IF NOT EXISTS australian_admission_centers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_code VARCHAR(10) NOT NULL UNIQUE, -- UAC, VTAC, QTAC, etc.
    center_name VARCHAR(100) NOT NULL,
    state_territory VARCHAR(50) NOT NULL,
    api_endpoint VARCHAR(500),
    supported_qualifications JSONB DEFAULT '[]',
    atar_requirements JSONB DEFAULT '{}',
    international_pathways JSONB DEFAULT '{}',
    application_periods JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ATAR and qualification conversions
CREATE TABLE IF NOT EXISTS atar_conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_qualification VARCHAR(100) NOT NULL,
    from_country VARCHAR(2) NOT NULL,
    atar_equivalent DECIMAL(5,2), -- 0.00 to 99.95
    conversion_notes TEXT,
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- LOCALIZATION AND TRANSLATION TABLES
-- =====================================================

-- Content translations
CREATE TABLE IF NOT EXISTS content_translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_key VARCHAR(255) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    translated_text TEXT NOT NULL,
    context VARCHAR(100), -- UI, email, document, etc.
    is_approved BOOLEAN DEFAULT FALSE,
    translator_id UUID,
    reviewed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(content_key, language_code)
);

-- Document templates for different countries
CREATE TABLE IF NOT EXISTS international_document_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_name VARCHAR(100) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'recommendation_letter', 'personal_statement', 'motivation_letter', 
        'cover_letter', 'academic_transcript', 'certificate'
    )),
    template_content TEXT NOT NULL,
    required_fields JSONB DEFAULT '[]',
    formatting_rules JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- INDEXES FOR INTERNATIONAL TABLES
-- =====================================================

-- Countries indexes
CREATE INDEX IF NOT EXISTS idx_countries_region ON countries(region);
CREATE INDEX IF NOT EXISTS idx_countries_active ON countries(is_active);

-- Languages indexes
CREATE INDEX IF NOT EXISTS idx_languages_active ON supported_languages(is_active);
CREATE INDEX IF NOT EXISTS idx_languages_coverage ON supported_languages(translation_coverage);

-- International requirements indexes
CREATE INDEX IF NOT EXISTS idx_intl_requirements_university ON international_requirements(university_id);
CREATE INDEX IF NOT EXISTS idx_intl_requirements_country ON international_requirements(country_code);
CREATE INDEX IF NOT EXISTS idx_intl_requirements_type ON international_requirements(requirement_type);

-- Grade conversions indexes
CREATE INDEX IF NOT EXISTS idx_grade_conversions_from ON grade_conversions(from_country, from_system);
CREATE INDEX IF NOT EXISTS idx_grade_conversions_to ON grade_conversions(to_country, to_system);

-- UCAS indexes
CREATE INDEX IF NOT EXISTS idx_ucas_universities_code ON ucas_universities(ucas_code);
CREATE INDEX IF NOT EXISTS idx_ucas_courses_university ON ucas_courses(ucas_university_id);
CREATE INDEX IF NOT EXISTS idx_ucas_courses_code ON ucas_courses(course_code);

-- European systems indexes
CREATE INDEX IF NOT EXISTS idx_european_systems_country ON european_university_systems(country_code);
CREATE INDEX IF NOT EXISTS idx_european_systems_active ON european_university_systems(is_active);

-- Australian centers indexes
CREATE INDEX IF NOT EXISTS idx_australian_centers_code ON australian_admission_centers(center_code);
CREATE INDEX IF NOT EXISTS idx_australian_centers_state ON australian_admission_centers(state_territory);

-- Translation indexes
CREATE INDEX IF NOT EXISTS idx_translations_key_lang ON content_translations(content_key, language_code);
CREATE INDEX IF NOT EXISTS idx_translations_approved ON content_translations(is_approved);

-- Document templates indexes
CREATE INDEX IF NOT EXISTS idx_doc_templates_country_lang ON international_document_templates(country_code, language_code);
CREATE INDEX IF NOT EXISTS idx_doc_templates_type ON international_document_templates(document_type);

-- =====================================================
-- TRIGGERS FOR INTERNATIONAL TABLES
-- =====================================================

-- Update timestamp triggers
CREATE TRIGGER update_countries_updated_at BEFORE UPDATE ON countries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_intl_requirements_updated_at BEFORE UPDATE ON international_requirements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grade_conversions_updated_at BEFORE UPDATE ON grade_conversions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_intl_submission_data_updated_at BEFORE UPDATE ON international_submission_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_translations_updated_at BEFORE UPDATE ON content_translations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_doc_templates_updated_at BEFORE UPDATE ON international_document_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR INTERNATIONAL QUERIES
-- =====================================================

-- Global university summary view
CREATE OR REPLACE VIEW global_university_summary AS
SELECT 
    u.id,
    u.name,
    u.code,
    u.country,
    u.region,
    u.language,
    u.currency,
    u.application_system,
    ui.integration_type,
    ui.is_active as integration_active,
    c.country_name,
    c.region as country_region,
    COUNT(DISTINCT ir.id) as international_requirements_count,
    COUNT(DISTINCT is_sub.id) as total_submissions
FROM universities u
LEFT JOIN university_integrations ui ON u.id = ui.university_id
LEFT JOIN countries c ON u.country = c.country_code
LEFT JOIN international_requirements ir ON u.id = ir.university_id
LEFT JOIN integration_submissions is_sub ON u.id = is_sub.university_id
WHERE u.is_active = true
GROUP BY u.id, u.name, u.code, u.country, u.region, u.language, u.currency, 
         u.application_system, ui.integration_type, ui.is_active, c.country_name, c.country_region;

-- Regional statistics view
CREATE OR REPLACE VIEW regional_statistics AS
SELECT 
    region,
    COUNT(*) as university_count,
    COUNT(DISTINCT country) as country_count,
    COUNT(DISTINCT language) as language_count,
    COUNT(DISTINCT currency) as currency_count,
    COUNT(CASE WHEN ui.is_active THEN 1 END) as active_integrations
FROM universities u
LEFT JOIN university_integrations ui ON u.id = ui.university_id
WHERE u.is_active = true
GROUP BY region
ORDER BY university_count DESC;

-- Language coverage view
CREATE OR REPLACE VIEW language_coverage AS
SELECT 
    sl.language_code,
    sl.language_name,
    sl.native_name,
    sl.translation_coverage,
    COUNT(DISTINCT u.id) as universities_count,
    COUNT(DISTINCT u.country) as countries_count
FROM supported_languages sl
LEFT JOIN universities u ON sl.language_code = u.language
WHERE sl.is_active = true
GROUP BY sl.language_code, sl.language_name, sl.native_name, sl.translation_coverage
ORDER BY universities_count DESC;

-- =====================================================
-- FUNCTIONS FOR INTERNATIONAL OPERATIONS
-- =====================================================

-- Function to get university requirements by country
CREATE OR REPLACE FUNCTION get_university_requirements(
    p_university_id UUID,
    p_student_country VARCHAR(2) DEFAULT NULL
)
RETURNS TABLE (
    requirement_type VARCHAR(50),
    requirement_details JSONB,
    is_mandatory BOOLEAN,
    minimum_score DECIMAL(10,2),
    maximum_score DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ir.requirement_type,
        ir.requirement_details,
        ir.is_mandatory,
        ir.minimum_score,
        ir.maximum_score
    FROM international_requirements ir
    WHERE ir.university_id = p_university_id
      AND (p_student_country IS NULL OR ir.country_code = p_student_country OR ir.country_code = 'ALL')
    ORDER BY ir.is_mandatory DESC, ir.requirement_type;
END;
$$ LANGUAGE plpgsql;

-- Function to convert grades between systems
CREATE OR REPLACE FUNCTION convert_grade(
    p_from_country VARCHAR(2),
    p_to_country VARCHAR(2),
    p_from_system VARCHAR(50),
    p_to_system VARCHAR(50),
    p_grade VARCHAR(10)
)
RETURNS VARCHAR(10) AS $$
DECLARE
    converted_grade VARCHAR(10);
    conversion_data JSONB;
BEGIN
    SELECT conversion_table INTO conversion_data
    FROM grade_conversions
    WHERE from_country = p_from_country
      AND to_country = p_to_country
      AND from_system = p_from_system
      AND to_system = p_to_system
      AND is_active = true;
    
    IF conversion_data IS NOT NULL THEN
        converted_grade := conversion_data->>p_grade;
    END IF;
    
    RETURN COALESCE(converted_grade, p_grade);
END;
$$ LANGUAGE plpgsql;

-- Function to get localized content
CREATE OR REPLACE FUNCTION get_localized_content(
    p_content_key VARCHAR(255),
    p_language_code VARCHAR(10),
    p_fallback_language VARCHAR(10) DEFAULT 'en'
)
RETURNS TEXT AS $$
DECLARE
    translated_text TEXT;
BEGIN
    -- Try to get translation in requested language
    SELECT ct.translated_text INTO translated_text
    FROM content_translations ct
    WHERE ct.content_key = p_content_key
      AND ct.language_code = p_language_code
      AND ct.is_approved = true;
    
    -- Fallback to default language if not found
    IF translated_text IS NULL THEN
        SELECT ct.translated_text INTO translated_text
        FROM content_translations ct
        WHERE ct.content_key = p_content_key
          AND ct.language_code = p_fallback_language
          AND ct.is_approved = true;
    END IF;
    
    RETURN COALESCE(translated_text, p_content_key);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- INITIAL DATA SETUP
-- =====================================================

-- Insert supported languages
INSERT INTO supported_languages (language_code, language_name, native_name, translation_coverage, is_active) VALUES
('en', 'English', 'English', 100.00, true),
('fr', 'French', 'Français', 0.00, true),
('de', 'German', 'Deutsch', 0.00, true),
('es', 'Spanish', 'Español', 0.00, true),
('it', 'Italian', 'Italiano', 0.00, true),
('nl', 'Dutch', 'Nederlands', 0.00, true),
('pt', 'Portuguese', 'Português', 0.00, true),
('sv', 'Swedish', 'Svenska', 0.00, true),
('da', 'Danish', 'Dansk', 0.00, true),
('no', 'Norwegian', 'Norsk', 0.00, true),
('fi', 'Finnish', 'Suomi', 0.00, true),
('pl', 'Polish', 'Polski', 0.00, true),
('cs', 'Czech', 'Čeština', 0.00, true),
('hu', 'Hungarian', 'Magyar', 0.00, true),
('ro', 'Romanian', 'Română', 0.00, true),
('bg', 'Bulgarian', 'Български', 0.00, true),
('hr', 'Croatian', 'Hrvatski', 0.00, true),
('sk', 'Slovak', 'Slovenčina', 0.00, true),
('sl', 'Slovenian', 'Slovenščina', 0.00, true),
('et', 'Estonian', 'Eesti', 0.00, true),
('lv', 'Latvian', 'Latviešu', 0.00, true),
('lt', 'Lithuanian', 'Lietuvių', 0.00, true),
('mt', 'Maltese', 'Malti', 0.00, true),
('ga', 'Irish', 'Gaeilge', 0.00, true)
ON CONFLICT (language_code) DO NOTHING;

COMMENT ON TABLE countries IS 'Country configurations and metadata for international expansion';
COMMENT ON TABLE supported_languages IS 'Languages supported by the platform with translation coverage';
COMMENT ON TABLE international_requirements IS 'University-specific requirements for international students';
COMMENT ON TABLE grade_conversions IS 'Grade conversion tables between different educational systems';
COMMENT ON TABLE international_submission_data IS 'Extended submission data for international requirements';
COMMENT ON TABLE ucas_universities IS 'UK universities with UCAS-specific data and codes';
COMMENT ON TABLE european_university_systems IS 'European university application systems and integrations';
COMMENT ON TABLE australian_admission_centers IS 'Australian state-based admission centers (UAC, VTAC, etc.)';
COMMENT ON TABLE content_translations IS 'Localized content translations for multi-language support';
COMMENT ON TABLE international_document_templates IS 'Country-specific document templates and formatting rules';