// Mock University - StellarRec Recommendation Hook
// This function receives recommendation data from StellarRec and stores it for display

const { createClient } = require('@netlify/blobs');

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-StellarRec-Signature',
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
    const payload = JSON.parse(event.body || '{}');
    
    console.log('🎓 Mock University received recommendation data:', {
      external_id: payload.external_id,
      student_name: payload.student_name,
      recommender_name: payload.recommender_name,
      status: payload.status,
      letter_length: payload.letter_content ? payload.letter_content.length : 0,
      universities: payload.universities?.length || 0
    });

    // Validate required fields
    if (!payload.external_id || !payload.student_name || !payload.recommender_name) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Store the recommendation data
    const recommendationData = {
      external_id: payload.external_id,
      student_name: payload.student_name,
      student_email: payload.student_email || '',
      recommender_name: payload.recommender_name,
      recommender_email: payload.recommender_email || '',
      universities: payload.universities || [],
      status: payload.status,
      letter_title: payload.letter_title || 'Recommendation Letter',
      letter_content: payload.letter_content || '',
      artifact_url: payload.artifact_url || '',
      submission_date: payload.submission_date || new Date().toISOString(),
      timestamp: payload.ts || Date.now(),
      last_updated: new Date().toISOString()
    };

    // Store in Netlify Blobs (if available) or just log for demo
    try {
      if (process.env.NETLIFY_BLOBS_TOKEN) {
        const blobs = createClient({
          token: process.env.NETLIFY_BLOBS_TOKEN,
          siteID: process.env.SITE_ID
        });
        
        await blobs.set(`recommendation:${payload.external_id}`, JSON.stringify(recommendationData));
        console.log(`✅ Stored recommendation data for ${payload.external_id}`);
      } else {
        console.log('📝 Demo mode: Recommendation data logged (no storage)');
      }
    } catch (storageError) {
      console.warn('⚠️ Storage failed, continuing with demo mode:', storageError.message);
    }

    // Log the letter content for debugging
    if (payload.letter_content) {
      console.log('📄 Letter content received:', {
        title: payload.letter_title,
        length: payload.letter_content.length,
        preview: payload.letter_content.substring(0, 200) + '...'
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
        success: true,
        message: 'Recommendation data received successfully',
        external_id: payload.external_id,
        student_name: payload.student_name,
        status: payload.status,
        letter_received: !!payload.letter_content,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('❌ Mock University reco-hook error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};