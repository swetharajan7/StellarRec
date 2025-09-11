-- StellarRec Recommendation System Database Schema
-- File: database/migrations/001_create_recommendation_tables.sql
-- Purpose: Create tables for storing recommendation requests and submissions

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS recommendation_submissions;
DROP TABLE IF EXISTS recommendation_requests;

-- Table 1: Store all recommendation requests from students
CREATE TABLE recommendation_requests (
    -- Primary identifier for each request
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Student Information
    student_id VARCHAR(36) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255) NOT NULL,
    
    -- Recommender Information
    recommender_email VARCHAR(255) NOT NULL,
    recommender_name VARCHAR(255) DEFAULT NULL,
    
    -- Application Information
    program_name VARCHAR(255) NOT NULL,
    university_name VARCHAR(255) NOT NULL,
    
    -- Security and Tracking
    secure_token VARCHAR(255) UNIQUE NOT NULL,
    status ENUM('pending', 'completed', 'expired', 'reminded') DEFAULT 'pending',
    
    -- Expiry Management
    expiry_date DATETIME NOT NULL,
    reminder_sent BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes for better performance
    INDEX idx_student_id (student_id),
    INDEX idx_recommender_email (recommender_email),
    INDEX idx_secure_token (secure_token),
    INDEX idx_status (status),
    INDEX idx_expiry_date (expiry_date)
);

-- Table 2: Store actual recommendation submissions
CREATE TABLE recommendation_submissions (
    -- Primary identifier for each submission
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    
    -- Link to the original request
    request_id VARCHAR(36) NOT NULL,
    
    -- Recommender Details (filled when submitting)
    recommender_name VARCHAR(255) NOT NULL,
    recommender_title VARCHAR(255) DEFAULT NULL,
    recommender_organization VARCHAR(255) DEFAULT NULL,
    recommender_phone VARCHAR(20) DEFAULT NULL,
    recommender_relationship VARCHAR(255) DEFAULT NULL,
    
    -- Recommendation Content
    letter_type ENUM('written', 'uploaded') NOT NULL,
    letter_content LONGTEXT DEFAULT NULL,
    
    -- File Information (for uploaded letters)
    file_path VARCHAR(500) DEFAULT NULL,
    file_name VARCHAR(255) DEFAULT NULL,
    file_size INT DEFAULT NULL,
    file_type VARCHAR(50) DEFAULT NULL,
    
    -- Rating/Assessment (optional)
    overall_rating ENUM('excellent', 'very_good', 'good', 'average', 'below_average') DEFAULT NULL,
    
    -- Metadata
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent TEXT DEFAULT NULL,
    
    -- Timestamps
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    FOREIGN KEY (request_id) REFERENCES recommendation_requests(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_request_id (request_id),
    INDEX idx_letter_type (letter_type),
    INDEX idx_submitted_at (submitted_at)
);

-- Table 3: Track email notifications (for monitoring)
CREATE TABLE recommendation_emails (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    request_id VARCHAR(36) NOT NULL,
    email_type ENUM('initial_request', 'reminder', 'thank_you') NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    email_status ENUM('sent', 'failed', 'bounced') DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT DEFAULT NULL,
    
    -- Foreign key constraint
    FOREIGN KEY (request_id) REFERENCES recommendation_requests(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_request_id (request_id),
    INDEX idx_email_type (email_type),
    INDEX idx_email_status (email_status)
);

-- Insert some sample data for testing (REMOVE IN PRODUCTION)
INSERT INTO recommendation_requests (
    student_id, 
    student_name, 
    student_email, 
    recommender_email, 
    recommender_name,
    program_name, 
    university_name, 
    secure_token, 
    expiry_date
) VALUES (
    'student_001',
    'John Doe',
    'john.doe@student.edu',
    'professor.smith@university.edu',
    'Dr. Sarah Smith',
    'Master of Computer Science',
    'Stanford University',
    'test_token_12345_' || UNIX_TIMESTAMP(),
    DATE_ADD(NOW(), INTERVAL 30 DAY)
);

-- Display table structures for verification
SHOW CREATE TABLE recommendation_requests;
SHOW CREATE TABLE recommendation_submissions;
SHOW CREATE TABLE recommendation_emails;
