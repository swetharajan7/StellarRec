-- International Universities Population Script
-- Comprehensive database of UK, European, and Australian universities

-- =====================================================
-- COUNTRY CONFIGURATIONS
-- =====================================================

-- Insert country data
INSERT INTO countries (country_code, country_name, region, currency, languages, time_zones, application_systems, grading_systems) VALUES
-- United Kingdom
('GB', 'United Kingdom', 'UK', 'GBP', 
 '["en"]', 
 '["Europe/London"]',
 '["ucas", "ucas_postgraduate", "direct_uk"]',
 '["uk_degree_classification", "a_levels", "gcse"]'),

-- Major European Countries
('DE', 'Germany', 'EUROPE', 'EUR',
 '["de", "en"]',
 '["Europe/Berlin"]', 
 '["uni_assist", "direct_api"]',
 '["german_grades", "abitur"]'),

('FR', 'France', 'EUROPE', 'EUR',
 '["fr", "en"]',
 '["Europe/Paris"]',
 '["parcoursup", "direct_api"]',
 '["french_grades", "baccalaureat"]'),

('NL', 'Netherlands', 'EUROPE', 'EUR',
 '["nl", "en"]',
 '["Europe/Amsterdam"]',
 '["studielink", "direct_api"]',
 '["dutch_grades", "vwo"]'),

-- Australia and New Zealand
('AU', 'Australia', 'OCEANIA', 'AUD',
 '["en"]',
 '["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth", "Australia/Adelaide"]',
 '["uac", "vtac", "qtac", "satac", "tisc"]',
 '["atar", "australian_grades"]'),

('NZ', 'New Zealand', 'OCEANIA', 'NZD',
 '["en"]',
 '["Pacific/Auckland"]',
 '["nz_direct"]',
 '["ncea", "nz_grades"]')
ON CONFLICT (country_code) DO NOTHING;

-- =====================================================
-- UNITED KINGDOM UNIVERSITIES
-- =====================================================