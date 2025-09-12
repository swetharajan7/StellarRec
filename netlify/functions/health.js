// Simple health check function for testing
export const handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'ok',
      message: 'StellarRec backend is running on Netlify Functions',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'production'
    })
  };
};