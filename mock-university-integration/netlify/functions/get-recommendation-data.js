// Mock University - Get Recommendation Data
// This function retrieves stored recommendation data for display

const { createClient } = require('@netlify/blobs');

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
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
    // Get query parameters
    const { external_id } = event.queryStringParameters || {};
    
    if (!external_id) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'Missing required parameter: external_id' 
        })
      };
    }

    console.log(`🔍 Mock University: Getting recommendation data for external_id: ${external_id}`);
    
    let recommendationData = null;
    
    // Try to get from Netlify Blobs if available
    try {
      if (process.env.NETLIFY_BLOBS_TOKEN) {
        const blobs = createClient({
          token: process.env.NETLIFY_BLOBS_TOKEN,
          siteID: process.env.SITE_ID
        });
        
        const storedData = await blobs.get(`recommendation:${external_id}`);
        if (storedData) {
          recommendationData = JSON.parse(storedData);
          console.log('✅ Retrieved recommendation from storage:', {
            student: recommendationData.student_name,
            recommender: recommendationData.recommender_name,
            status: recommendationData.status,
            letter_length: recommendationData.letter_content ? recommendationData.letter_content.length : 0
          });
        }
      }
    } catch (storageError) {
      console.warn('⚠️ Storage retrieval failed:', storageError.message);
    }
    
    // If no stored data, return a demo response
    if (!recommendationData) {
      console.log('📝 No stored data found, returning demo response');
      recommendationData = {
        external_id: external_id,
        student_name: 'Demo Student',
        student_email: 'demo@example.com',
        recommender_name: 'Demo Recommender',
        recommender_email: 'recommender@example.com',
        status: 'pending',
        letter_title: 'Recommendation Letter',
        letter_content: 'No recommendation letter has been submitted yet. This message will be replaced with the actual letter content when the recommender completes their submission through StellarRec.',
        submission_date: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        recommendation: recommendationData,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('❌ Error getting recommendation data:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to retrieve recommendation data',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};