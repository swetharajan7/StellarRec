// University notification system for StellarRec
// Notifies universities when recommendation requests are sent

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
      student_name,
      student_email,
      recommender_name,
      recommender_email,
      universities = [],
      request_id,
      action = 'request_sent' // 'request_sent' or 'letter_completed'
    } = body;

    console.log('University notification:', {
      action,
      student_name,
      universities: universities.length,
      request_id
    });

    // Process each university
    const notifications = [];
    
    for (const university of universities) {
      // Check if this is Mock University
      if (university === 'MOCK' || university === 'Mock University' || university.includes('Mock')) {
        
        // Notify Mock University
        const mockUniversityData = {
          type: action,
          timestamp: new Date().toISOString(),
          request_id,
          student: {
            name: student_name,
            email: student_email
          },
          recommender: {
            name: recommender_name,
            email: recommender_email
          },
          university: 'Mock University',
          status: action === 'request_sent' ? 'pending' : 'completed'
        };

        try {
          // Send notification to Mock University webhook
          const mockResponse = await fetch('https://mockuniversity.netlify.app/.netlify/functions/stellarrec-webhook', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-StellarRec-Signature': generateSignature(mockUniversityData)
            },
            body: JSON.stringify(mockUniversityData)
          });

          if (mockResponse.ok) {
            notifications.push({
              university: 'Mock University',
              status: 'notified',
              action: action
            });
            console.log('✅ Mock University notified successfully');
          } else {
            console.log('⚠️ Mock University notification failed:', mockResponse.status);
            notifications.push({
              university: 'Mock University',
              status: 'failed',
              error: `HTTP ${mockResponse.status}`
            });
          }
        } catch (error) {
          console.error('Mock University notification error:', error);
          notifications.push({
            university: 'Mock University',
            status: 'error',
            error: error.message
          });
        }
      } else {
        // For other universities, just log (could integrate with their systems later)
        console.log(`📝 Would notify ${university} (not implemented)`);
        notifications.push({
          university: university,
          status: 'logged',
          action: action
        });
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        action: action,
        notifications: notifications,
        message: `Universities notified about ${action}`
      })
    };

  } catch (error) {
    console.error('University notification error:', error);
    
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

// Generate signature for webhook security
function generateSignature(data) {
  // Simple signature for demo - in production use proper HMAC
  return Buffer.from(JSON.stringify(data)).toString('base64').slice(0, 32);
}