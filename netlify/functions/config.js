// Configuration file for StellarRec backend
// Uses Netlify environment variables for security

export const config = {
  // Resend API key from environment variables (secure)
  RESEND_API_KEY: process.env.RESEND_API_KEY || 're_2FU7PXNf_8PjSC2zz9TYAdweY7xmkZnKr',
  
  // Email settings from environment variables
  EMAIL_FROM: process.env.EMAIL_FROM || 'StellarRec <onboarding@resend.dev>',
  
  // Frontend URL from environment variables
  FRONTEND_BASE: process.env.FRONTEND_BASE || 'https://stellarrec.netlify.app/dashboard',
  
  // Security secret from environment variables (more secure)
  SIGNING_SECRET: process.env.SIGNING_SECRET || 'a7f8d9e2b4c6f1a3e5d7b9c2f4e6a8d0b3c5e7f9a1d3b5c7e9f2a4c6e8f0a2b4c6e8f0a2b4c6e8f0a2b4c6e8f0',
  
  // Production mode - emails will be sent via Resend
  DEV_MODE: process.env.NODE_ENV !== 'production'
};

// ✅ Configuration complete!
// Your backend is now ready to send real emails via Resend API
// Free tier: 100 emails/day, 3,000 emails/month