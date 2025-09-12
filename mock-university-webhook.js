// Mock University Webhook Handler
// This would be deployed on Mock University's site to receive StellarRec notifications

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
    const body = JSON.parse(event.body || '{}');
    const signature = event.headers['x-stellarrec-signature'] || '';
    
    console.log('Mock University received StellarRec notification:', {
      type: body.type,
      student: body.student?.name,
      status: body.status,
      timestamp: body.timestamp
    });

    // In a real implementation, you would:
    // 1. Verify the signature
    // 2. Update the university's application system
    // 3. Send confirmation emails
    // 4. Update the application status in the database

    // For demo purposes, we'll just log and return success
    const response = {
      received: true,
      timestamp: new Date().toISOString(),
      message: `Mock University received ${body.type} notification for ${body.student?.name}`,
      status: 'processed'
    };

    // Simulate updating the application system
    if (body.type === 'request_sent') {
      console.log(`📝 Mock University: New recommendation request for ${body.student?.name}`);
      console.log(`   Recommender: ${body.recommender?.name} (${body.recommender?.email})`);
      console.log(`   Status: Pending recommendation letter`);
    } else if (body.type === 'letter_completed') {
      console.log(`✅ Mock University: Recommendation completed for ${body.student?.name}`);
      console.log(`   Recommender: ${body.recommender?.name}`);
      console.log(`   Status: Ready for review`);
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Mock University webhook error:', error);
    
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

// Note: This file should be deployed to Mock University's Netlify site
// at: netlify/functions/stellarrec-webhook.js