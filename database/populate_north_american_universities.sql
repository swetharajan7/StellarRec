-- North American Universities Population Script
-- Comprehensive database of US and Canadian universities with integration configurations

-- =====================================================
-- UNITED STATES UNIVERSITIES
-- =====================================================

-- IVY LEAGUE UNIVERSITIES (CommonApp)
INSERT INTO universities (name, code, country, state, region, institution_type, is_public, website_url, application_systems) VALUES
('Harvard University', 'HARV', 'US', 'Massachusetts', 'Northeast', 'Private Research University', false, 'https://www.harvard.edu', '["commonapp"]'),
('Yale University', 'YALE', 'US', 'Connecticut', 'Northeast', 'Private Research University', false, 'https://www.yale.edu', '["commonapp"]'),
('Princeton University', 'PRIN', 'US', 'New Jersey', 'Northeast', 'Private Research University', false, 'https://www.princeton.edu', '["commonapp"]'),
('Columbia University', 'COLU', 'US', 'New York', 'Northeast', 'Private Research University', false, 'https://www.columbia.edu', '["commonapp"]'),
('University of Pennsylvania', 'PENN', 'US', 'Pennsylvania', 'Northeast', 'Private Research University', false, 'https://www.upenn.edu', '["commonapp"]'),
('Cornell University', 'CORN', 'US', 'New York', 'Northeast', 'Private Research University', false, 'https://www.cornell.edu', '["commonapp"]'),
('Brown University', 'BROW', 'US', 'Rhode Island', 'Northeast', 'Private Research University', false, 'https://www.brown.edu', '["commonapp"]'),
('Dartmouth College', 'DART', 'US', 'New Hampshire', 'Northeast', 'Private Liberal Arts College', false, 'https://www.dartmouth.edu', '["commonapp"]')
ON CONFLICT (code) DO NOTHING;

-- TOP PRIVATE UNIVERSITIES (CommonApp/Coalition)
INSERT INTO universities (name, code, country, state, region, institution_type, is_public, website_url, application_systems) VALUES
('Stanford University', 'STAN', 'US', 'California', 'West', 'Private Research University', false, 'https://www.stanford.edu', '["commonapp", "coalition"]'),
('Massachusetts Institute of Technology', 'MIT', 'US', 'Massachusetts', 'Northeast', 'Private Research University', false, 'https://www.mit.edu', '["direct_api"]'),
('California Institute of Technology', 'CALT', 'US', 'California', 'West', 'Private Research University', false, 'https://www.caltech.edu', '["commonapp"]'),
('University of Chicago', 'UCHI', 'US', 'Illinois', 'Midwest', 'Private Research University', false, 'https://www.uchicago.edu', '["commonapp", "coalition"]'),
('Northwestern University', 'NWES', 'US', 'Illinois', 'Midwest', 'Private Research University', false, 'https://www.northwestern.edu', '["commonapp"]'),
('Duke University', 'DUKE', 'US', 'North Carolina', 'South', 'Private Research University', false, 'https://www.duke.edu', '["commonapp", "coalition"]'),
('Johns Hopkins University', 'JHOP', 'US', 'Maryland', 'Northeast', 'Private Research University', false, 'https://www.jhu.edu', '["commonapp", "coalition"]'),
('Vanderbilt University', 'VAND', 'US', 'Tennessee', 'South', 'Private Research University', false, 'https://www.vanderbilt.edu', '["commonapp", "coalition"]'),
('Rice University', 'RICE', 'US', 'Texas', 'South', 'Private Research University', false, 'https://www.rice.edu', '["commonapp", "coalition"]'),
('Washington University in St. Louis', 'WUST', 'US', 'Missouri', 'Midwest', 'Private Research University', false, 'https://www.wustl.edu', '["commonapp", "coalition"]'),
('Emory University', 'EMOR', 'US', 'Georgia', 'South', 'Private Research University', false, 'https://www.emory.edu', '["commonapp", "coalition"]'),
('Georgetown University', 'GEOR', 'US', 'District of Columbia', 'Northeast', 'Private Research University', false, 'https://www.georgetown.edu', '["commonapp"]'),
('Carnegie Mellon University', 'CMU', 'US', 'Pennsylvania', 'Northeast', 'Private Research University', false, 'https://www.cmu.edu', '["commonapp"]'),
('University of Notre Dame', 'NOTR', 'US', 'Indiana', 'Midwest', 'Private Research University', false, 'https://www.nd.edu', '["commonapp", "coalition"]'),
('Tufts University', 'TUFT', 'US', 'Massachusetts', 'Northeast', 'Private Research University', false, 'https://www.tufts.edu', '["commonapp", "coalition"]')
ON CONFLICT (code) DO NOTHING;

-- UNIVERSITY OF CALIFORNIA SYSTEM (UC Application)
INSERT INTO universities (name, code, country, state, region, institution_type, is_public, website_url, application_systems) VALUES
('University of California, Berkeley', 'UCB', 'US', 'California', 'West', 'Public Research University', true, 'https://www.berkeley.edu', '["uc_application"]'),
('University of California, Los Angeles', 'UCLA', 'US', 'California', 'West', 'Public Research University', true, 'https://www.ucla.edu', '["uc_application"]'),
('University of California, San Diego', 'UCSD', 'US', 'California', 'West', 'Public Research University', true, 'https://www.ucsd.edu', '["uc_application"]'),
('University of California, Davis', 'UCD', 'US', 'California', 'West', 'Public Research University', true, 'https://www.ucdavis.edu', '["uc_application"]'),
('University of California, Irvine', 'UCI', 'US', 'California', 'West', 'Public Research University', true, 'https://www.uci.edu', '["uc_application"]'),
('University of California, Santa Barbara', 'UCSB', 'US', 'California', 'West', 'Public Research University', true, 'https://www.ucsb.edu', '["uc_application"]'),
('University of California, Santa Cruz', 'UCSC', 'US', 'California', 'West', 'Public Research University', true, 'https://www.ucsc.edu', '["uc_application"]'),
('University of California, Riverside', 'UCR', 'US', 'California', 'West', 'Public Research University', true, 'https://www.ucr.edu', '["uc_application"]'),
('University of California, Merced', 'UCM', 'US', 'California', 'West', 'Public Research University', true, 'https://www.ucmerced.edu', '["uc_application"]')
ON CONFLICT (code) DO NOTHING;

-- CALIFORNIA STATE UNIVERSITY SYSTEM (CSU Application)
INSERT INTO universities (name, code, country, state, region, institution_type, is_public, website_url, application_systems) VALUES
('California State University, Long Beach', 'CSULB', 'US', 'California', 'West', 'Public University', true, 'https://www.csulb.edu', '["csu_application"]'),
('San Diego State University', 'SDSU', 'US', 'California', 'West', 'Public University', true, 'https://www.sdsu.edu', '["csu_application"]'),
('California Polytechnic State University', 'CALPOLY', 'US', 'California', 'West', 'Public University', true, 'https://www.calpoly.edu', '["csu_application"]'),
('California State University, Fullerton', 'CSUF', 'US', 'California', 'West', 'Public University', true, 'https://www.fullerton.edu', '["csu_application"]'),
('California State University, Northridge', 'CSUN', 'US', 'California', 'West', 'Public University', true, 'https://www.csun.edu', '["csu_application"]'),
('San Francisco State University', 'SFSU', 'US', 'California', 'West', 'Public University', true, 'https://www.sfsu.edu', '["csu_application"]'),
('California State University, Sacramento', 'CSUS', 'US', 'California', 'West', 'Public University', true, 'https://www.csus.edu', '["csu_application"]')
ON CONFLICT (code) DO NOTHING;

-- STATE UNIVERSITY OF NEW YORK SYSTEM (SUNY Application)
INSERT INTO universities (name, code, country, state, region, institution_type, is_public, website_url, application_systems) VALUES
('University at Buffalo', 'SUNYB', 'US', 'New York', 'Northeast', 'Public Research University', true, 'https://www.buffalo.edu', '["suny_application", "commonapp"]'),
('Stony Brook University', 'SUNYSB', 'US', 'New York', 'Northeast', 'Public Research University', true, 'https://www.stonybrook.edu', '["suny_application", "commonapp"]'),
('Binghamton University', 'SUNYBING', 'US', 'New York', 'Northeast', 'Public Research University', true, 'https://www.binghamton.edu', '["suny_application", "commonapp"]'),
('University at Albany', 'SUNYA', 'US', 'New York', 'Northeast', 'Public Research University', true, 'https://www.albany.edu', '["suny_application"]'),
('SUNY College at Geneseo', 'SUNYG', 'US', 'New York', 'Northeast', 'Public Liberal Arts College', true, 'https://www.geneseo.edu', '["suny_application"]')
ON CONFLICT (code) DO NOTHING;

-- TEXAS UNIVERSITIES (ApplyTexas)
INSERT INTO universities (name, code, country, state, region, institution_type, is_public, website_url, application_systems) VALUES
('University of Texas at Austin', 'UTA', 'US', 'Texas', 'South', 'Public Research University', true, 'https://www.utexas.edu', '["applytexas"]'),
('Texas A&M University', 'TAMU', 'US', 'Texas', 'South', 'Public Research University', true, 'https://www.tamu.edu', '["applytexas"]'),
('University of Houston', 'UH', 'US', 'Texas', 'South', 'Public Research University', true, 'https://www.uh.edu', '["applytexas"]'),
('Texas Tech University', 'TTU', 'US', 'Texas', 'South', 'Public Research University', true, 'https://www.ttu.edu', '["applytexas"]'),
('University of Texas at Dallas', 'UTD', 'US', 'Texas', 'South', 'Public Research University', true, 'https://www.utdallas.edu', '["applytexas"]'),
('Texas Christian University', 'TCU', 'US', 'Texas', 'South', 'Private University', false, 'https://www.tcu.edu', '["commonapp"]'),
('Baylor University', 'BAYL', 'US', 'Texas', 'South', 'Private University', false, 'https://www.baylor.edu', '["commonapp"]')
ON CONFLICT (code) DO NOTHING;

-- OTHER TOP PUBLIC UNIVERSITIES
INSERT INTO universities (name, code, country, state, region, institution_type, is_public, website_url, application_systems) VALUES
('University of Michigan', 'UMICH', 'US', 'Michigan', 'Midwest', 'Public Research University', true, 'https://www.umich.edu', '["commonapp", "coalition"]'),
('University of Virginia', 'UVA', 'US', 'Virginia', 'South', 'Public Research University', true, 'https://www.virginia.edu', '["commonapp", "coalition"]'),
('University of North Carolina at Chapel Hill', 'UNC', 'US', 'North Carolina', 'South', 'Public Research University', true, 'https://www.unc.edu', '["commonapp", "coalition"]'),
('Georgia Institute of Technology', 'GT', 'US', 'Georgia', 'South', 'Public Research University', true, 'https://www.gatech.edu', '["commonapp", "coalition"]'),
('University of Illinois at Urbana-Champaign', 'UIUC', 'US', 'Illinois', 'Midwest', 'Public Research University', true, 'https://www.illinois.edu', '["commonapp", "coalition"]'),
('University of Wisconsin-Madison', 'UW', 'US', 'Wisconsin', 'Midwest', 'Public Research University', true, 'https://www.wisc.edu', '["commonapp", "coalition"]'),
('University of Washington', 'UWA', 'US', 'Washington', 'West', 'Public Research University', true, 'https://www.washington.edu', '["commonapp", "coalition"]'),
('University of Florida', 'UF', 'US', 'Florida', 'South', 'Public Research University', true, 'https://www.ufl.edu', '["commonapp", "coalition"]'),
('Ohio State University', 'OSU', 'US', 'Ohio', 'Midwest', 'Public Research University', true, 'https://www.osu.edu', '["commonapp", "coalition"]'),
('Pennsylvania State University', 'PSU', 'US', 'Pennsylvania', 'Northeast', 'Public Research University', true, 'https://www.psu.edu', '["commonapp", "coalition"]'),
('Purdue University', 'PUR', 'US', 'Indiana', 'Midwest', 'Public Research University', true, 'https://www.purdue.edu', '["commonapp", "coalition"]'),
('University of Minnesota', 'MINN', 'US', 'Minnesota', 'Midwest', 'Public Research University', true, 'https://www.umn.edu', '["commonapp", "coalition"]'),
('University of Maryland', 'UMD', 'US', 'Maryland', 'Northeast', 'Public Research University', true, 'https://www.umd.edu', '["commonapp", "coalition"]'),
('Rutgers University', 'RUT', 'US', 'New Jersey', 'Northeast', 'Public Research University', true, 'https://www.rutgers.edu', '["commonapp"]'),
('Virginia Tech', 'VT', 'US', 'Virginia', 'South', 'Public Research University', true, 'https://www.vt.edu', '["commonapp", "coalition"]')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- CANADIAN UNIVERSITIES
-- =====================================================

-- ONTARIO UNIVERSITIES (OUAC)
INSERT INTO universities (name, code, country, province, region, institution_type, is_public, website_url, application_systems) VALUES
('University of Toronto', 'UTOR', 'CA', 'Ontario', 'Central Canada', 'Public Research University', true, 'https://www.utoronto.ca', '["ouac"]'),
('University of Waterloo', 'UWAT', 'CA', 'Ontario', 'Central Canada', 'Public Research University', true, 'https://www.uwaterloo.ca', '["ouac"]'),
('McMaster University', 'MCMA', 'CA', 'Ontario', 'Central Canada', 'Public Research University', true, 'https://www.mcmaster.ca', '["ouac"]'),
('Queens University', 'QUEE', 'CA', 'Ontario', 'Central Canada', 'Public Research University', true, 'https://www.queensu.ca', '["ouac"]'),
('Western University', 'WEST', 'CA', 'Ontario', 'Central Canada', 'Public Research University', true, 'https://www.uwo.ca', '["ouac"]'),
('York University', 'YORK', 'CA', 'Ontario', 'Central Canada', 'Public Research University', true, 'https://www.yorku.ca', '["ouac"]'),
('Carleton University', 'CARL', 'CA', 'Ontario', 'Central Canada', 'Public Research University', true, 'https://www.carleton.ca', '["ouac"]'),
('University of Ottawa', 'UOTT', 'CA', 'Ontario', 'Central Canada', 'Public Research University', true, 'https://www.uottawa.ca', '["ouac"]'),
('Ryerson University', 'RYER', 'CA', 'Ontario', 'Central Canada', 'Public University', true, 'https://www.ryerson.ca', '["ouac"]'),
('University of Guelph', 'GUEL', 'CA', 'Ontario', 'Central Canada', 'Public Research University', true, 'https://www.uoguelph.ca', '["ouac"]')
ON CONFLICT (code) DO NOTHING;

-- BRITISH COLUMBIA UNIVERSITIES (Education Planner BC)
INSERT INTO universities (name, code, country, province, region, institution_type, is_public, website_url, application_systems) VALUES
('University of British Columbia', 'UBC', 'CA', 'British Columbia', 'Western Canada', 'Public Research University', true, 'https://www.ubc.ca', '["education_planner_bc"]'),
('Simon Fraser University', 'SFU', 'CA', 'British Columbia', 'Western Canada', 'Public Research University', true, 'https://www.sfu.ca', '["education_planner_bc"]'),
('University of Victoria', 'UVIC', 'CA', 'British Columbia', 'Western Canada', 'Public Research University', true, 'https://www.uvic.ca', '["education_planner_bc"]'),
('British Columbia Institute of Technology', 'BCIT', 'CA', 'British Columbia', 'Western Canada', 'Public Institute', true, 'https://www.bcit.ca', '["education_planner_bc"]'),
('Emily Carr University of Art and Design', 'ECUA', 'CA', 'British Columbia', 'Western Canada', 'Public Art School', true, 'https://www.ecuad.ca', '["education_planner_bc"]')
ON CONFLICT (code) DO NOTHING;

-- OTHER CANADIAN UNIVERSITIES
INSERT INTO universities (name, code, country, province, region, institution_type, is_public, website_url, application_systems) VALUES
('McGill University', 'MCGI', 'CA', 'Quebec', 'Eastern Canada', 'Public Research University', true, 'https://www.mcgill.ca', '["university_specific"]'),
('Université de Montréal', 'UMON', 'CA', 'Quebec', 'Eastern Canada', 'Public Research University', true, 'https://www.umontreal.ca', '["university_specific"]'),
('University of Alberta', 'UALB', 'CA', 'Alberta', 'Western Canada', 'Public Research University', true, 'https://www.ualberta.ca', '["university_specific"]'),
('University of Calgary', 'UCAL', 'CA', 'Alberta', 'Western Canada', 'Public Research University', true, 'https://www.ucalgary.ca', '["university_specific"]'),
('University of Manitoba', 'UMAN', 'CA', 'Manitoba', 'Central Canada', 'Public Research University', true, 'https://www.umanitoba.ca', '["university_specific"]'),
('University of Saskatchewan', 'USASK', 'CA', 'Saskatchewan', 'Central Canada', 'Public Research University', true, 'https://www.usask.ca', '["university_specific"]'),
('Dalhousie University', 'DAL', 'CA', 'Nova Scotia', 'Atlantic Canada', 'Public Research University', true, 'https://www.dal.ca', '["university_specific"]'),
('Memorial University of Newfoundland', 'MUN', 'CA', 'Newfoundland and Labrador', 'Atlantic Canada', 'Public Research University', true, 'https://www.mun.ca', '["university_specific"]')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- INTEGRATION CONFIGURATIONS
-- =====================================================

-- CommonApp Integration (700+ universities)
INSERT INTO university_integrations (
    university_id, integration_type, api_endpoint, submission_format, 
    rate_limit_config, features, requirements, is_active
)
SELECT 
    u.id,
    'commonapp',
    'https://api.commonapp.org/v2',
    'json',
    '{"requestsPerMinute": 30, "requestsPerHour": 500, "requestsPerDay": 2000, "burstLimit": 10}',
    '{"realTimeStatus": true, "bulkSubmission": true, "documentUpload": true, "statusWebhooks": true, "customFields": true}',
    '{"requiredFields": ["student_name", "student_email", "recommender_name", "recommender_email", "recommendation_content"], "maxRecommendationLength": 8000, "supportedPrograms": ["undergraduate", "graduate"], "deadlineBuffer": 48}',
    true
FROM universities u
WHERE u.application_systems::text LIKE '%commonapp%'
ON CONFLICT (university_id) DO NOTHING;

-- Coalition Application Integration
INSERT INTO university_integrations (
    university_id, integration_type, api_endpoint, submission_format,
    rate_limit_config, features, requirements, is_active
)
SELECT 
    u.id,
    'coalition',
    'https://api.coalitionapp.org/v1',
    'json',
    '{"requestsPerMinute": 25, "requestsPerHour": 400, "requestsPerDay": 1500, "burstLimit": 8}',
    '{"realTimeStatus": true, "bulkSubmission": false, "documentUpload": true, "statusWebhooks": true, "customFields": false}',
    '{"requiredFields": ["student_name", "student_email", "recommender_name", "recommender_email", "recommendation_content"], "maxRecommendationLength": 7500, "supportedPrograms": ["undergraduate"], "deadlineBuffer": 72}',
    true
FROM universities u
WHERE u.application_systems::text LIKE '%coalition%' AND u.code NOT IN (
    SELECT u2.code FROM universities u2 
    INNER JOIN university_integrations ui ON u2.id = ui.university_id 
    WHERE ui.integration_type = 'commonapp'
)
ON CONFLICT (university_id) DO NOTHING;

-- UC System Integration
INSERT INTO university_integrations (
    university_id, integration_type, api_endpoint, submission_format,
    rate_limit_config, features, requirements, is_active
)
SELECT 
    u.id,
    'uc_system',
    'https://api.universityofcalifornia.edu/v1',
    'json',
    '{"requestsPerMinute": 20, "requestsPerHour": 300, "requestsPerDay": 1000, "burstLimit": 5}',
    '{"realTimeStatus": true, "bulkSubmission": true, "documentUpload": true, "statusWebhooks": false, "customFields": true}',
    '{"requiredFields": ["student_name", "student_email", "recommender_name", "recommender_email", "recommendation_content"], "maxRecommendationLength": 6000, "supportedPrograms": ["undergraduate", "graduate", "doctoral"], "deadlineBuffer": 24}',
    true
FROM universities u
WHERE u.application_systems::text LIKE '%uc_application%'
ON CONFLICT (university_id) DO NOTHING;

-- OUAC Integration (Ontario, Canada)
INSERT INTO university_integrations (
    university_id, integration_type, api_endpoint, submission_format,
    rate_limit_config, features, requirements, is_active
)
SELECT 
    u.id,
    'ouac',
    'https://api.ouac.on.ca/v1',
    'json',
    '{"requestsPerMinute": 15, "requestsPerHour": 200, "requestsPerDay": 800, "burstLimit": 5}',
    '{"realTimeStatus": false, "bulkSubmission": false, "documentUpload": true, "statusWebhooks": false, "customFields": false}',
    '{"requiredFields": ["student_name", "student_email", "recommender_name", "recommender_email", "recommendation_content"], "maxRecommendationLength": 5000, "supportedPrograms": ["undergraduate", "graduate"], "deadlineBuffer": 48}',
    true
FROM universities u
WHERE u.application_systems::text LIKE '%ouac%'
ON CONFLICT (university_id) DO NOTHING;

-- Email-based integration for universities without API
INSERT INTO university_integrations (
    university_id, integration_type, submission_format,
    rate_limit_config, features, requirements, is_active
)
SELECT 
    u.id,
    'email',
    'email',
    '{"requestsPerMinute": 5, "requestsPerHour": 50, "requestsPerDay": 200, "burstLimit": 2}',
    '{"realTimeStatus": false, "bulkSubmission": false, "documentUpload": false, "statusWebhooks": false, "customFields": false}',
    '{"requiredFields": ["student_name", "student_email", "recommender_name", "recommender_email", "recommendation_content"], "maxRecommendationLength": 10000, "supportedPrograms": ["undergraduate", "graduate", "doctoral"], "deadlineBuffer": 72}',
    true
FROM universities u
WHERE u.id NOT IN (SELECT university_id FROM university_integrations)
ON CONFLICT (university_id) DO NOTHING;

-- =====================================================
-- APPLICATION SYSTEM MAPPINGS
-- =====================================================

-- Map universities to their application systems
INSERT INTO university_application_systems (university_id, system_name, system_priority, program_types, application_url, is_active)
SELECT 
    u.id,
    'commonapp',
    1,
    '["undergraduate", "graduate"]',
    'https://www.commonapp.org',
    true
FROM universities u
WHERE u.application_systems::text LIKE '%commonapp%'
ON CONFLICT DO NOTHING;

INSERT INTO university_application_systems (university_id, system_name, system_priority, program_types, application_url, is_active)
SELECT 
    u.id,
    'coalition',
    CASE WHEN u.application_systems::text LIKE '%commonapp%' THEN 2 ELSE 1 END,
    '["undergraduate"]',
    'https://www.coalitionforcollegeaccess.org',
    true
FROM universities u
WHERE u.application_systems::text LIKE '%coalition%'
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE PROGRAM DATA
-- =====================================================

-- Add sample programs for major universities
INSERT INTO university_programs (university_id, program_name, program_type, degree_type, department, application_deadline, requirements)
SELECT 
    u.id,
    'Computer Science',
    'undergraduate',
    'Bachelor of Science',
    'Computer Science',
    '2024-01-01'::date,
    '{"gpa_minimum": 3.0, "test_scores": ["SAT", "ACT"], "recommendations": 2}'
FROM universities u
WHERE u.institution_type LIKE '%Research University%'
LIMIT 50
ON CONFLICT DO NOTHING;

-- =====================================================
-- INITIAL HEALTH CHECKS
-- =====================================================

-- Insert initial health check records
INSERT INTO integration_health_checks (integration_type, check_type, status, metadata)
VALUES 
('commonapp', 'connectivity', 'unknown', '{"last_check": null}'),
('coalition', 'connectivity', 'unknown', '{"last_check": null}'),
('uc_system', 'connectivity', 'unknown', '{"last_check": null}'),
('ouac', 'connectivity', 'unknown', '{"last_check": null}'),
('email', 'connectivity', 'healthy', '{"always_available": true}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SUMMARY STATISTICS
-- =====================================================

-- Display summary of loaded data
DO $$
DECLARE
    us_count INTEGER;
    ca_count INTEGER;
    total_integrations INTEGER;
BEGIN
    SELECT COUNT(*) INTO us_count FROM universities WHERE country = 'US';
    SELECT COUNT(*) INTO ca_count FROM universities WHERE country = 'CA';
    SELECT COUNT(*) INTO total_integrations FROM university_integrations WHERE is_active = true;
    
    RAISE NOTICE 'University Integration Setup Complete:';
    RAISE NOTICE '- US Universities: %', us_count;
    RAISE NOTICE '- Canadian Universities: %', ca_count;
    RAISE NOTICE '- Active Integrations: %', total_integrations;
    RAISE NOTICE '- Total Universities: %', us_count + ca_count;
END $$;