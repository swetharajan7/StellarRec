import crypto from 'crypto';
import { config } from './config.js';

// Netlify serverless function for handling recommendation requests
export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const {
      student_name, student_email, student_first, student_last,
      recommender_name, recommender_email,
      unitids = [], waive = 1, title = ''
    } = body;

    // Validate required fields
    if (!student_name || !student_email || !recommender_name || !recommender_email) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Get configuration
    const {
      RESEND_API_KEY,
      EMAIL_FROM,
      FRONTEND_BASE,
      SIGNING_SECRET,
      DEV_MODE
    } = config;

    // Create unique ID and signature
    const id = 'sr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    
    // Sign the payload for security
    const h = crypto.createHmac('sha256', SIGNING_SECRET);
    h.update(JSON.stringify({ id, student_email, recommender_email, unitids }));
    const sig = h.digest('hex');

    // Build recommender URL with parameters
    const params = new URLSearchParams({
      sf: student_first || '',
      sl: student_last || '',
      se: student_email || '',
      waive: String(waive || 0),
      unis: unitids.join(','),
      rname: recommender_name,
      remail: recommender_email,
      rid: id,
      sig,
    });

    if (title) params.set('title', title);

    const recommenderURL = `${FRONTEND_BASE}#recommender?${params.toString()}`;

    // Email HTML template
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1976d2 0%, #7c4dff 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">
            ⭐ StellarRec
          </h1>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <p style="font-size: 16px; margin-bottom: 20px;">Hi ${recommender_name},</p>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            <strong>${student_name}</strong> has requested a recommendation letter via <strong>StellarRec</strong>.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            Click the button below to open the Recommender portal with the student's details and selected universities preloaded:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${recommenderURL}" 
               style="background: linear-gradient(135deg, #1976d2, #7c4dff); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      font-weight: bold; 
                      display: inline-block;">
              Open Recommender Portal
            </a>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${recommenderURL}" style="color: #1976d2; word-break: break-all;">${recommenderURL}</a>
          </p>
        </div>
        
        <div style="background: #e9ecef; padding: 20px; text-align: center; font-size: 14px; color: #666;">
          <p style="margin: 0;">Thanks,<br><strong>StellarRec Team</strong></p>
        </div>
      </div>
    `;

    // Send email using Resend API
    console.log('Attempting to send email:', {
      apiKey: RESEND_API_KEY ? 'Present' : 'Missing',
      from: EMAIL_FROM,
      to: recommender_email,
      hasHtml: !!html
    });
    
    // Check if we're in testing mode (Resend free tier limitation)
    const isTestingMode = RESEND_API_KEY === 're_2FU7PXNf_8PjSC2zz9TYAdweY7xmkZnKr';
    const verifiedTestEmail = 'swetha.rajan103@gmail.com';
    
    if (RESEND_API_KEY && RESEND_API_KEY !== 'your_resend_api_key_here') {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: isTestingMode ? verifiedTestEmail : recommender_email,
          subject: `Recommendation request for ${student_name}`,
          html: isTestingMode ? 
            `<div style="background: #fff3cd; padding: 15px; margin-bottom: 20px; border: 1px solid #ffeaa7; border-radius: 5px;">
              <strong>🧪 TESTING MODE:</strong> This email was intended for <strong>${recommender_email}</strong> but sent to your verified email for testing.
            </div>` + html : html
        })
      });

      if (!emailResponse.ok) {
        const errorData = await emailResponse.text();
        console.error('Resend API error:', {
          status: emailResponse.status,
          statusText: emailResponse.statusText,
          error: errorData,
          apiKey: RESEND_API_KEY ? 'Present' : 'Missing',
          emailFrom: EMAIL_FROM
        });
        throw new Error(`Email service error: ${emailResponse.status} - ${errorData}`);
      }

      const emailResult = await emailResponse.json();
      console.log('Email sent successfully:', emailResult.id);
    } else {
      // Development mode - log email instead of sending
      console.log('[DEV EMAIL]', {
        to: recommender_email,
        subject: `Recommendation request for ${student_name}`,
        url: recommenderURL
      });
    }

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: id,
        status: 'ok',
        message: 'Recommendation request sent successfully'
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};