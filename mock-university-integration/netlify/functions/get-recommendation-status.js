// Mock University - Get Recommendation Status
// This function retrieves the current recommendation status for display

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
    const { student_email, student_name } = event.queryStringParameters || {};
    
    // In a real implementation, this would query a database
    // For demo purposes, we'll simulate different states
    
    // Check if we have any stored recommendation data
    // This is a simplified demo - in production you'd use a proper database
    
    // Default state - no recommendations yet
    let recommendationStatus = {
      status: 'no_recommendations',
      message: 'No recommenders yet',
      display_status: 'Pending',
      recommenders: []
    };

    // Simulate checking for recent StellarRec notifications
    // In production, this would query your database for the student's application
    
    // For demo purposes, we'll return a dynamic status based on current time
    // This simulates the status changing when StellarRec sends notifications
    const now = new Date();
    const hour = now.getHours();
    
    // Simulate different states throughout the day for demo
    if (hour >= 9 && hour < 12) {
      // Morning: Recommendation requested
      recommendationStatus = {
        status: 'recommendation_requested',
        message: 'Recommendation requested from Prof. Manas Mohan Nand',
        display_status: 'Requested',
        recommenders: [{
          name: 'Prof. Manas Mohan Nand',
          email: 'manasmohannand@gmail.com',
          status: 'requested',
          request_date: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          source: 'StellarRec'
        }],
        last_updated: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
      };
    } else if (hour >= 12) {
      // Afternoon: Recommendation completed
      recommendationStatus = {
        status: 'recommendation_received',
        message: 'Recommendation received from Prof. Manas Mohan Nand',
        display_status: 'Received',
        recommenders: [{
          name: 'Prof. Manas Mohan Nand',
          email: 'manasmohannand@gmail.com',
          status: 'completed',
          request_date: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
          completion_date: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
          source: 'StellarRec'
        }],
        last_updated: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString()
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
        student: {
          name: student_name || 'Demo Student',
          email: student_email || 'demo@example.com'
        },
        recommendation: recommendationStatus,
        university: 'Mock University',
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Get recommendation status error:', error);
    
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