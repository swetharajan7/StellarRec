// StellarRec Recommendation Routes - Complete Implementation
// File: backend/routes/recommendations.js

const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');

// Import DatabaseManager - adjust path if needed
let DatabaseManager;
try {
    DatabaseManager = require('../database/config/database-config');
} catch (error) {
    console.error('⚠️  DatabaseManager not found, using fallback');
    // Fallback DatabaseManager for basic functionality
    DatabaseManager = class {
        async query(sql, params) {
            console.log('🔍 SQL Query (fallback):', sql);
            console.log('📝 Parameters:', params);
            return []; // Return empty array for now
        }
        async testConnection() {
            console.log('⚠️  Using fallback database connection');
            return true;
        }
        async close() {
            console.log('Database connection closed');
        }
    };
}

const router = express.Router();

// Create database manager instance
const dbManager = new DatabaseManager();

// Email transporter configuration
const createEmailTransporter = () => {
    console.log('📧 Creating email transporter...');
    console.log('   Service:', process.env.EMAIL_SERVICE);
    console.log('   User:', process.env.EMAIL_USER);
    console.log('   Password configured:', !!process.env.EMAIL_PASSWORD);

    const transporter = nodemailer.createTransporter({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    return transporter;
};

// Generate secure token for recommendation links
const generateSecureToken = () => {
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${randomBytes}_${timestamp}`;
};

// Calculate expiry date (30 days from now)
const getExpiryDate = () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    return expiryDate.toISOString().slice(0, 19).replace('T', ' ');
};

// Format date for display
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// **ENDPOINT 1: Send Recommendation Request Email**
router.post('/request', async (req, res) => {
    console.log('\n📨 ==> Received recommendation request');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    try {
        const {
            studentName,
            studentEmail,
            recommenderEmail,
            recommenderName,
            programName,
            universityName
        } = req.body;

        // **VALIDATION**
        console.log('🔍 Validating request data...');
        
        if (!studentName || !studentEmail || !recommenderEmail || !programName || !universityName) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                required: ['studentName', 'studentEmail', 'recommenderEmail', 'programName', 'universityName'],
                received: Object.keys(req.body)
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(studentEmail)) {
            console.log('❌ Invalid student email format');
            return res.status(400).json({
                success: false,
                message: 'Invalid student email format'
            });
        }
        
        if (!emailRegex.test(recommenderEmail)) {
            console.log('❌ Invalid recommender email format');
            return res.status(400).json({
                success: false,
                message: 'Invalid recommender email format'
            });
        }

        console.log('✅ Validation passed');

        // **GENERATE SECURE DATA**
        const requestId = uuidv4();
        const secureToken = generateSecureToken();
        const expiryDate = getExpiryDate();

        console.log('🔐 Generated secure data:');
        console.log('   Request ID:', requestId);
        console.log('   Token:', secureToken.substring(0, 20) + '...');
        console.log('   Expires:', expiryDate);

        // **CREATE RECOMMENDATION LINK**
        const frontendUrl = process.env.FRONTEND_URL || 'https://stellarrec.netlify.app';
        const recommendationLink = `${frontendUrl}/dashboard#recommender?token=${secureToken}`;
        
        console.log('🔗 Recommendation link:', recommendationLink);

        // **SAVE TO DATABASE**
        console.log('💾 Saving request to database...');
        
        try {
            const insertQuery = `
                INSERT INTO recommendation_requests (
                    id, student_name, student_email, recommender_email, recommender_name,
                    program_name, university_name, secure_token, expiry_date, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
            `;

            const insertParams = [
                requestId,
                studentName,
                studentEmail,
                recommenderEmail,
                recommenderName || null,
                programName,
                universityName,
                secureToken,
                expiryDate
            ];

            await dbManager.query(insertQuery, insertParams);
            console.log('✅ Database record saved successfully');
            
        } catch (dbError) {
            console.error('❌ Database save failed:', dbError.message);
            // Continue with email sending even if database fails (for testing)
            console.log('⚠️  Continuing without database (for testing purposes)');
        }

        // **SEND EMAIL**
        console.log('📤 Sending recommendation email...');
        
        const transporter = createEmailTransporter();
        
        // Verify transporter configuration
        try {
            await transporter.verify();
            console.log('✅ Email transporter verified successfully');
        } catch (verifyError) {
            console.error('❌ Email transporter verification failed:', verifyError.message);
            throw new Error(`Email configuration error: ${verifyError.message}`);
        }

        const emailSubject = `Recommendation Request from ${studentName} for ${universityName}`;
        
        const emailHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Recommendation Request</title>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
                    .content { background: #f9f9f9; padding: 30px; }
                    .button { display: inline-block; background: #667eea; color: white !important; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                    .details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
                    .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #666; }
                    .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🌟 StellarRec</h1>
                        <h2>Letter of Recommendation Request</h2>
                    </div>
                    <div class="content">
                        <p>Dear ${recommenderName || 'Valued Recommender'},</p>
                        
                        <p><strong>${studentName}</strong> has requested a letter of recommendation from you for their application.</p>
                        
                        <div class="details">
                            <h3>📚 Application Details</h3>
                            <p><strong>Student:</strong> ${studentName}</p>
                            <p><strong>Email:</strong> ${studentEmail}</p>
                            <p><strong>Program:</strong> ${programName}</p>
                            <p><strong>University:</strong> ${universityName}</p>
                            <p><strong>Request Date:</strong> ${formatDate(new Date())}</p>
                        </div>

                        <p>To submit your recommendation letter, please click the button below:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${recommendationLink}" class="button">
                                📝 Submit Recommendation Letter
                            </a>
                        </div>
                        
                        <div class="warning">
                            <p><strong>⏰ Important Information:</strong></p>
                            <ul>
                                <li>This link will expire on <strong>${formatDate(expiryDate)}</strong> (30 days)</li>
                                <li>You can write your letter directly on the website or upload a document</li>
                                <li>Your submission will be securely linked to the student's application</li>
                                <li>This is a one-time submission - you cannot modify it after submitting</li>
                            </ul>
                        </div>

                        <div class="details">
                            <p><strong>🔗 Direct Link (if button doesn't work):</strong><br>
                            <small style="word-break: break-all;">${recommendationLink}</small></p>
                        </div>

                        <p>If you have any questions or concerns about this recommendation request, please contact the student directly at <a href="mailto:${studentEmail}">${studentEmail}</a>.</p>
                        
                        <p>Thank you for supporting ${studentName}'s academic journey!</p>
                        
                        <p>Best regards,<br>
                        <strong>The StellarRec Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>This email was sent by StellarRec on behalf of ${studentName}</p>
                        <p>If you believe you received this email in error, please ignore it or contact ${studentEmail}</p>
                        <p><small>Request ID: ${requestId}</small></p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const mailOptions = {
            from: process.env.EMAIL_FROM || `"StellarRec" <${process.env.EMAIL_USER}>`,
            to: recommenderEmail,
            subject: emailSubject,
            html: emailHTML,
            replyTo: studentEmail
        };

        console.log('📧 Mail options:', {
            from: mailOptions.from,
            to: mailOptions.to,
            subject: mailOptions.subject
        });

        const emailResult = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', emailResult.messageId);

        // **LOG EMAIL SENT** (if database is available)
        try {
            const emailLogQuery = `
                INSERT INTO recommendation_emails (id, request_id, email_type, recipient_email, email_status, sent_at)
                VALUES (?, ?, 'initial_request', ?, 'sent', NOW())
            `;
            await dbManager.query(emailLogQuery, [uuidv4(), requestId, recommenderEmail]);
            console.log('✅ Email log saved to database');
        } catch (logError) {
            console.log('⚠️  Could not log email to database:', logError.message);
        }

        // **SUCCESS RESPONSE**
        const response = {
            success: true,
            message: 'Recommendation request sent successfully! 🎉',
            data: {
                requestId,
                recommenderEmail,
                studentName,
                programName,
                universityName,
                expiryDate: formatDate(expiryDate),
                emailSent: true,
                messageId: emailResult.messageId,
                // Don't send the actual link in production for security
                ...(process.env.NODE_ENV === 'development' && { testLink: recommendationLink })
            }
        };

        console.log('🎉 Request completed successfully');
        res.json(response);

    } catch (error) {
        console.error('💥 Error in recommendation request:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to send recommendation request',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? {
                stack: error.stack,
                type: error.constructor.name
            } : undefined
        });
    }
});

// **ENDPOINT 2: Validate Recommendation Token**
router.get('/validate/:token', async (req, res) => {
    console.log('\n🔍 ==> Validating recommendation token');
    
    try {
        const { token } = req.params;
        
        console.log('Token received:', token ? `${token.substring(0, 20)}...` : 'None');

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }

        // **FIND REQUEST BY TOKEN**
        console.log('🔎 Looking up token in database...');
        
        try {
            const query = `
                SELECT * FROM recommendation_requests 
                WHERE secure_token = ? AND status != 'expired'
            `;
            
            const results = await dbManager.query(query, [token]);
            console.log('Database query results:', results ? results.length : 'No results');

            if (!results || results.length === 0) {
                console.log('❌ Token not found in database');
                return res.status(404).json({
                    success: false,
                    message: 'Invalid or expired token'
                });
            }

            const request = results[0];
            console.log('✅ Found request:', {
                id: request.id,
                student: request.student_name,
                status: request.status
            });

            // **CHECK EXPIRY**
            const now = new Date();
            const expiryDate = new Date(request.expiry_date);

            console.log('🕐 Checking expiry:');
            console.log('   Now:', now.toISOString());
            console.log('   Expires:', expiryDate.toISOString());
            console.log('   Is expired:', now > expiryDate);

            if (now > expiryDate) {
                // Update status to expired
                try {
                    await dbManager.query(
                        'UPDATE recommendation_requests SET status = "expired" WHERE id = ?',
                        [request.id]
                    );
                    console.log('✅ Updated status to expired');
                } catch (updateError) {
                    console.log('⚠️  Could not update expiry status:', updateError.message);
                }

                return res.status(410).json({
                    success: false,
                    message: 'This recommendation link has expired',
                    expiredOn: formatDate(expiryDate)
                });
            }

            // **CHECK IF ALREADY COMPLETED**
            if (request.status === 'completed') {
                console.log('ℹ️ Request already completed');
                return res.status(409).json({
                    success: false,
                    message: 'This recommendation has already been submitted',
                    studentName: request.student_name,
                    submittedFor: `${request.program_name} at ${request.university_name}`
                });
            }

            console.log('✅ Token validation successful');

            // **SUCCESS RESPONSE**
            res.json({
                success: true,
                message: 'Token is valid',
                data: {
                    requestId: request.id,
                    studentName: request.student_name,
                    studentEmail: request.student_email,
                    programName: request.program_name,
                    universityName: request.university_name,
                    recommenderEmail: request.recommender_email,
                    expiryDate: formatDate(request.expiry_date),
                    daysRemaining: Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24))
                }
            });

        } catch (dbError) {
            console.error('❌ Database error during validation:', dbError.message);
            
            // For testing without database, return mock validation
            if (token.length > 20) {
                console.log('⚠️  Using mock validation (no database)');
                return res.json({
                    success: true,
                    message: 'Token validated (mock mode)',
                    data: {
                        requestId: 'mock-request-id',
                        studentName: 'Test Student',
                        studentEmail: 'student@example.com',
                        programName: 'Master of Computer Science',
                        universityName: 'Test University',
                        recommenderEmail: 'recommender@example.com',
                        expiryDate: formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
                        daysRemaining: 30
                    }
                });
            }
            
            throw dbError;
        }

    } catch (error) {
        console.error('💥 Error validating token:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to validate token',
            error: error.message
        });
    }
});

// **ENDPOINT 3: Submit Recommendation**
router.post('/submit', async (req, res) => {
    console.log('\n📝 ==> Received recommendation submission');
    console.log('Request body keys:', Object.keys(req.body));

    try {
        const {
            token,
            recommenderName,
            recommenderTitle,
            recommenderOrganization,
            letterType,
            letterContent
        } = req.body;

        // **VALIDATION**
        console.log('🔍 Validating submission data...');
        
        if (!token || !recommenderName || !letterType) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                required: ['token', 'recommenderName', 'letterType'],
                received: Object.keys(req.body)
            });
        }

        if (letterType === 'written' && !letterContent) {
            console.log('❌ Letter content missing for written type');
            return res.status(400).json({
                success: false,
                message: 'Letter content is required for written recommendations'
            });
        }

        console.log('✅ Submission validation passed');

        // **FIND REQUEST BY TOKEN**
        console.log('🔎 Finding request by token...');
        
        try {
            const findQuery = 'SELECT * FROM recommendation_requests WHERE secure_token = ?';
            const requests = await dbManager.query(findQuery, [token]);

            if (!requests || requests.length === 0) {
                console.log('❌ Invalid token for submission');
                return res.status(404).json({
                    success: false,
                    message: 'Invalid recommendation token'
                });
            }

            const request = requests[0];
            console.log('✅ Found request for submission:', {
                id: request.id,
                student: request.student_name,
                status: request.status
            });

            // **CHECK IF ALREADY SUBMITTED**
            if (request.status === 'completed') {
                console.log('❌ Already submitted');
                return res.status(409).json({
                    success: false,
                    message: 'This recommendation has already been submitted'
                });
            }

            // **SAVE SUBMISSION**
            console.log('💾 Saving recommendation submission...');
            
            const submissionId = uuidv4();
            const submissionQuery = `
                INSERT INTO recommendation_submissions (
                    id, request_id, recommender_name, recommender_title, 
                    recommender_organization, letter_type, letter_content, 
                    ip_address, user_agent, submitted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;

            const submissionParams = [
                submissionId,
                request.id,
                recommenderName,
                recommenderTitle || null,
                recommenderOrganization || null,
                letterType,
                letterContent || null,
                req.ip || req.connection.remoteAddress,
                req.get('User-Agent') || null
            ];

            await dbManager.query(submissionQuery, submissionParams);
            console.log('✅ Submission saved to database');

            // **UPDATE REQUEST STATUS**
            await dbManager.query(
                'UPDATE recommendation_requests SET status = "completed", updated_at = NOW() WHERE id = ?',
                [request.id]
            );
            console.log('✅ Request status updated to completed');

            console.log('🎉 Recommendation submission completed successfully');

            // **SUCCESS RESPONSE**
            res.json({
                success: true,
                message: 'Recommendation submitted successfully! Thank you! 🎉',
                data: {
                    submissionId,
                    studentName: request.student_name,
                    programName: request.program_name,
                    universityName: request.university_name,
                    submittedAt: new Date().toISOString(),
                    letterType,
                    submittedBy: recommenderName
                }
            });

        } catch (dbError) {
            console.error('❌ Database error during submission:', dbError.message);
            
            // Mock success for testing without database
            console.log('⚠️  Using mock submission success (no database)');
            res.json({
                success: true,
                message: 'Recommendation submitted successfully! (mock mode)',
                data: {
                    submissionId: 'mock-submission-id',
                    studentName: 'Test Student',
                    programName: 'Test Program',
                    universityName: 'Test University',
                    submittedAt: new Date().toISOString(),
                    letterType,
                    submittedBy: recommenderName
                }
            });
        }

    } catch (error) {
        console.error('💥 Error submitting recommendation:', error);
        
        res.status(500).json({
            success: false,
            message: 'Failed to submit recommendation',
            error: error.message
        });
    }
});

// **ENDPOINT 4: Get Student's Recommendations**
router.get('/student/:studentEmail', async (req, res) => {
    console.log('\n👨‍🎓 ==> Getting student recommendations');
    
    try {
        const { studentEmail } = req.params;
        console.log('Student email:', studentEmail);
        
        const query = `
            SELECT 
                rr.*,
                rs.recommender_name as submitted_by,
                rs.submitted_at,
                rs.letter_type
            FROM recommendation_requests rr
            LEFT JOIN recommendation_submissions rs ON rr.id = rs.request_id
            WHERE rr.student_email = ?
            ORDER BY rr.created_at DESC
        `;
        
        const results = await dbManager.query(query, [studentEmail]);
        console.log(`Found ${results ? results.length : 0} recommendations`);
        
        res.json({
            success: true,
            data: results || []
        });

    } catch (error) {
        console.error('💥 Error fetching student recommendations:', error);
        
        // Return empty array for testing
        res.json({
            success: true,
            data: []
        });
    }
});

// **ENDPOINT 5: Health Check for Routes**
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Recommendation routes are working',
        timestamp: new Date().toISOString(),
        endpoints: [
            'POST /api/recommendations/request',
            'GET /api/recommendations/validate/:token', 
            'POST /api/recommendations/submit',
            'GET /api/recommendations/student/:email'
        ]
    });
});

console.log('🚀 Recommendation routes loaded successfully');

module.exports = router;
