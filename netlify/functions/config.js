// Configuration file for StellarRec backend
// Update these values with your actual credentials

export const config = {
  // Get your free API key from https://resend.com
  RESEND_API_KEY: 'your_resend_api_key_here',
  
  // Email settings
  EMAIL_FROM: 'StellarRec <no-reply@stellarrec.com>',
  
  // Frontend URL
  FRONTEND_BASE: 'https://stellarrec.netlify.app/dashboard',
  
  // Security secret - use a strong random string
  SIGNING_SECRET: 'stellarrec_production_secret_change_me_to_random_string',
  
  // Development mode (set to false for production)
  DEV_MODE: false
};

// Instructions:
// 1. Sign up at https://resend.com (free - 100 emails/day)
// 2. Create API key
// 3. Replace 'your_resend_api_key_here' with your actual key
// 4. Replace the SIGNING_SECRET with a strong random string
// 5. Commit and push changes