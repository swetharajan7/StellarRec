// Mock University - StellarRec Integration Webhook
// This function receives notifications from StellarRec and updates application status

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
    const notification = JSON.parse(event.body || '{}');
    const signature = event.headers['x-stellarrec-signature'] || '';
    
    console.log('🎓 Mock University received StellarRec notification:', {
      type: notification.type,
      student: notification.student?.name,
      recommender: notification.recommender?.name,
      status: notification.status,
      timestamp: notification.timestamp,
      request_id: notification.request_id
    });

    // Validate required fields
    if (!notification.type || !notification.student || !notification.recommender) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Invalid notification format' })
      };
    }

    // Process the notification based on type
    let applicationUpdate = {};
    
    if (notification.type === 'request_sent') {
      // Student sent recommendation request
      applicationUpdate = {
        status: 'recommendation_requested',
        recommender_name: notification.recommender.name,
        recommender_email: notification.recommender.email,
        request_date: notification.timestamp,
        request_id: notification.request_id,
        message: `Recommendation requested from ${notification.recommender.name}`
      };
      
      console.log(`📝 Mock University: Recommendation requested for ${notification.student.name}`);
      console.log(`   Recommender: ${notification.recommender.name} (${notification.recommender.email})`);
      console.log(`   Status: Waiting for recommendation letter`);
      
    } else if (notification.type === 'letter_completed') {
      // Recommender completed the letter
      applicationUpdate = {
        status: 'recommendation_received',
        recommender_name: notification.recommender.name,
        recommender_email: notification.recommender.email,
        completion_date: notification.timestamp,
        request_id: notification.request_id,
        message: `Recommendation received from ${notification.recommender.name}`,
        letter_status: notification.letter_content || 'provided'
      };
      
      console.log(`✅ Mock University: Recommendation completed for ${notification.student.name}`);
      console.log(`   Recommender: ${notification.recommender.name}`);
      console.log(`   Status: Ready for admissions review`);
    }

    // In a real implementation, this would update a database
    // For demo purposes, we'll store in a simple JSON structure
    const applicationData = {
      student: {
        name: notification.student.name,
        email: notification.student.email
      },
      recommendation: applicationUpdate,
      last_updated: new Date().toISOString(),
      university: 'Mock University'
    };

    // Store the update (in production, this would be a database)
    // For now, we'll just log it and return success
    console.log('📊 Mock University application updated:', applicationData);

    // Return success response with the update details
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Mock University application updated successfully',
        student: notification.student.name,
        status: applicationUpdate.status,
        timestamp: new Date().toISOString(),
        request_id: notification.request_id,
        update: applicationUpdate
      })
    };

  } catch (error) {
    console.error('❌ Mock University webhook error:', error);
    
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