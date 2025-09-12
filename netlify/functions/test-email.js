// Simple test function to debug email issues
export const handler = async (event, context) => {
  // Handle CORS
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

  try {
    const RESEND_API_KEY = 're_2FU7PXNf_8PjSC2zz9TYAdweY7xmkZnKr';
    const EMAIL_FROM = 'onboarding@resend.dev';
    const EMAIL_TO = 'swetha.rajan103@gmail.com';

    console.log('Testing email with:', {
      apiKey: RESEND_API_KEY ? 'Present' : 'Missing',
      from: EMAIL_FROM,
      to: EMAIL_TO
    });

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: EMAIL_TO,
        subject: 'StellarRec Test Email',
        html: '<h1>Test Email</h1><p>This is a test email from StellarRec.</p>'
      })
    });

    const responseText = await emailResponse.text();
    console.log('Email response:', {
      status: emailResponse.status,
      statusText: emailResponse.statusText,
      body: responseText
    });

    if (!emailResponse.ok) {
      throw new Error(`Email failed: ${emailResponse.status} - ${responseText}`);
    }

    const emailResult = JSON.parse(responseText);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        emailId: emailResult.id,
        message: 'Test email sent successfully'
      })
    };

  } catch (error) {
    console.error('Test email error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Test email failed',
        message: error.message,
        stack: error.stack
      })
    };
  }
};