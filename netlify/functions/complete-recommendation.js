// Handle recommendation letter completion
// Called when recommender submits their letter

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
      request_id,
      student_name,
      student_email,
      recommender_name,
      recommender_email,
      universities = [],
      letter_content,
      submission_date
    } = body;

    // Validate required fields
    if (!request_id || !student_name || !recommender_name) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    console.log('Recommendation completed:', {
      request_id,
      student_name,
      recommender_name,
      universities: universities.length
    });

    // Notify universities that the recommendation letter is complete
    try {
      const universityNotification = await fetch(`${process.env.NETLIFY_FUNCTIONS_URL || 'https://stellarrec.netlify.app/.netlify/functions'}/notify-university`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          student_name,
          student_email,
          recommender_name,
          recommender_email,
          universities,
          request_id,
          action: 'letter_completed',
          letter_content: letter_content ? 'provided' : 'not_provided',
          submission_date: submission_date || new Date().toISOString()
        })
      });

      const notificationResult = await universityNotification.json();
      console.log('University notification result:', notificationResult);

    } catch (notifyError) {
      console.error('University notification error:', notifyError);
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
        request_id,
        message: 'Recommendation completed and universities notified',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Complete recommendation error:', error);
    
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