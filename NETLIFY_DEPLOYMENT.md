# StellarRec Netlify Deployment Guide

## 🚀 Backend Deployed to Netlify Functions

Your StellarRec backend is now configured to run on Netlify Functions! Here's what was set up:

### ✅ Files Created:
- `netlify/functions/recommendations.js` - Main API endpoint for sending recommendation emails
- `netlify/functions/health.js` - Health check endpoint for testing
- `netlify/functions/package.json` - Dependencies for functions
- Updated `netlify.toml` - Configuration for functions and API routing

### ✅ Frontend Updated:
- Dashboard now points to Netlify Functions URL
- API calls route to `/.netlify/functions/recommendations`

## 🔧 Environment Variables Needed

In your Netlify dashboard, go to **Site settings > Environment variables** and add:

```bash
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM=StellarRec <no-reply@stellarrec.com>
FRONTEND_BASE=https://stellarrec.netlify.app/dashboard
SIGNING_SECRET=your_strong_random_secret_here
```

## 📧 Get Resend API Key

1. Go to [resend.com](https://resend.com)
2. Sign up for free account (100 emails/day free)
3. Create API key
4. Add to Netlify environment variables

## 🧪 Test Your Deployment

### 1. Health Check
Visit: `https://stellarrec.netlify.app/.netlify/functions/health`

Should return:
```json
{
  "status": "ok",
  "message": "StellarRec backend is running on Netlify Functions",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Test Recommendation Flow
1. Go to `https://stellarrec.netlify.app/dashboard#send`
2. Fill out the recommendation request form
3. Submit the form
4. Check for success message

## 🔄 How It Works

### API Endpoints:
- **Health Check**: `/.netlify/functions/health`
- **Send Recommendation**: `/.netlify/functions/recommendations`

### Email Flow:
1. Student submits form on dashboard
2. Frontend sends POST to `/.netlify/functions/recommendations`
3. Netlify Function validates data and generates secure link
4. Function sends email via Resend API
5. Recommender receives email with link to dashboard
6. Recommender clicks link and accesses pre-filled portal

### Security Features:
- CORS headers for cross-origin requests
- Input validation and sanitization
- HMAC signatures for secure links
- Environment variables for secrets

## 🚨 Troubleshooting

### Function Not Working?
1. Check Netlify Functions logs in dashboard
2. Verify environment variables are set
3. Test health endpoint first

### Email Not Sending?
1. Verify `RESEND_API_KEY` is correct
2. Check Resend dashboard for delivery status
3. Ensure `EMAIL_FROM` uses verified domain

### CORS Issues?
- Functions include proper CORS headers
- Should work from `stellarrec.netlify.app` domain

## 📊 Monitoring

### Netlify Dashboard:
- View function invocations
- Check error logs
- Monitor performance

### Resend Dashboard:
- Track email delivery
- View bounce/spam rates
- Monitor API usage

## 🎉 You're Live!

Your StellarRec platform now has a fully functional backend running on Netlify Functions! 

**Backend URL**: `https://stellarrec.netlify.app/.netlify/functions/`
**API Endpoint**: `https://stellarrec.netlify.app/.netlify/functions/recommendations`

The email flow is ready to work once you add your Resend API key to the environment variables!