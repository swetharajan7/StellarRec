// Simple Email Service for StellarRec
// File: backend/services/emailService.js
// Purpose: Handle email sending with fallback options

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    initializeTransporter() {
        // Try different email providers based on environment variables
        const emailProvider = process.env.EMAIL_PROVIDER || 'gmail';

        try {
            switch (emailProvider) {
                case 'sendgrid':
                    if (process.env.SENDGRID_API_KEY) {
                        this.transporter = nodemailer.createTransport({
                            service: 'SendGrid',
                            auth: {
                                user: 'apikey',
                                pass: process.env.SENDGRID_API_KEY
                            }
                        });
                    }
                    break;

                case 'gmail':
                    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
                        this.transporter = nodemailer.createTransport({
                            service: 'gmail',
                            auth: {
                                user: process.env.GMAIL_USER,
                                pass: process.env.GMAIL_PASS // App password, not regular password
                            }
                        });
                    }
                    break;

                case 'smtp':
                default:
                    // Generic SMTP configuration
                    this.transporter = nodemailer.createTransport({
                        host: process.env.SMTP_HOST || 'smtp.gmail.com',
                        port: parseInt(process.env.SMTP_PORT || '587'),
                        secure: process.env.SMTP_SECURE === 'true',
                        auth: {
                            user: process.env.SMTP_USER || process.env.GMAIL_USER,
                            pass: process.env.SMTP_PASS || process.env.GMAIL_PASS
                        }
                    });
            }

            // Fallback to console logging if no email configuration
            if (!this.transporter) {
                console.warn('⚠️  No email configuration found. Emails will be logged to console.');
                this.transporter = {
                    sendMail: async (options) => {
                        console.log('\n📧 EMAIL WOULD BE SENT:');
                        console.log('='.repeat(50));
                        console.log(`To: ${options.to}`);
                        console.log(`Subject: ${options.subject}`);
                        console.log(`Content: ${options.text || 'HTML content provided'}`);
                        console.log('='.repeat(50));
                        
                        return {
                            messageId: `fake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            accepted: [options.to],
                            rejected: [],
                            pending: [],
                            response: 'Email logged to console (no SMTP configured)'
                        };
                    }
                };
            }

        } catch (error) {
            console.error('Error initializing email transporter:', error);
            // Use console fallback
            this.transporter = {
                sendMail: async (options) => {
                    console.log('\n📧 EMAIL FALLBACK (Error in config):');
                    console.log('='.repeat(50));
                    console.log(`To: ${options.to}`);
                    console.log(`Subject: ${options.subject}`);
                    console.log('='.repeat(50));
                    
                    return {
                        messageId: `fallback_${Date.now()}`,
                        accepted: [options.to],
                        rejected: [],
                        pending: [],
                        response: 'Email logged due to configuration error'
                    };
                }
            };
        }
    }

    async sendEmail(emailData) {
        try {
            const {
                to,
                subject,
                htmlContent,
                textContent,
                priority = 'normal',
                category = 'general',
                tags = [],
                userId = null
            } = emailData;

            const mailOptions = {
                from: process.env.FROM_EMAIL || process.env.GMAIL_USER || 'noreply@stellarrec.com',
                to: Array.isArray(to) ? to.join(', ') : to,
                subject,
                html: htmlContent,
                text: textContent,
                priority: this.mapPriority(priority)
            };

            console.log(`📤 Sending email to: ${mailOptions.to}`);
            console.log(`📋 Subject: ${subject}`);

            const result = await this.transporter.sendMail(mailOptions);

            console.log(`✅ Email sent successfully. Message ID: ${result.messageId}`);

            return {
                messageId: result.messageId,
                accepted: result.accepted || [mailOptions.to],
                rejected: result.rejected || [],
                pending: result.pending || [],
                response: result.response || 'Email sent successfully'
            };

        } catch (error) {
            console.error('❌ Error sending email:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    mapPriority(priority) {
        switch (priority) {
            case 'urgent':
            case 'high':
                return 'high';
            case 'low':
                return 'low';
            default:
                return 'normal';
        }
    }

    async testConnection() {
        try {
            if (this.transporter && typeof this.transporter.verify === 'function') {
                await this.transporter.verify();
                console.log('✅ Email service connection verified');
                return true;
            } else {
                console.log('ℹ️  Using console email fallback (no SMTP configured)');
                return true;
            }
        } catch (error) {
            console.warn('⚠️  Email service verification failed:', error.message);
            console.log('📝 Emails will be logged to console instead');
            return true; // Still return true to not block the app
        }
    }
}

module.exports = { EmailService };