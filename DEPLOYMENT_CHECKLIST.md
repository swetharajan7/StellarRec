# StellarRec Backend Deployment Checklist

## ✅ Step 1: Frontend Integration (COMPLETED)
- [x] Added backend integration script to `public/dashboard.html`
- [x] Form validation and error handling implemented
- [x] Toast notifications for user feedback
- [x] Tracking table integration
- [x] University selection integration

## ✅ Step 2: Backend Server (COMPLETED)
- [x] Created `backend/server.js` with Express.js
- [x] Added `/api/recommendations` endpoint
- [x] Resend email service integration
- [x] CORS configuration for frontend
- [x] Input validation and error handling
- [x] Secure link generation with HMAC signatures

## ✅ Step 3: Dependencies (COMPLETED)
- [x] Added `express`, `cors`, `resend` to package.json
- [x] Configured ES modules support
- [x] Added development dependencies
- [x] Created startup and test scripts

## ✅ Step 4: Environment Configuration (COMPLETED)
- [x] Updated `.env` and `.env.example`
- [x] Added Resend API key configuration
- [x] Set frontend base URL
- [x] Configured signing secret for security

## 🚀 Step 5: Deployment (READY TO DEPLOY)

### 5.1 Install Dependencies
```bash
cd backend
npm install
```

### 5.2 Configure Environment Variables
Set these in your hosting provider (Railway, Heroku, Vercel, etc.):

```bash
# Required
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM=StellarRec <no-reply@yourdomain.com>
FRONTEND_BASE=https://stellarrec.netlify.app/dashboard
SIGNING_SECRET=your_strong_random_secret_here

# Optional
NODE_ENV=production
PORT=3000
```

### 5.3 Deploy Backend
Choose your hosting platform:

#### Option A: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Option B: Heroku
```bash
# Install Heroku CLI and deploy
heroku create stellarrec-backend
git subtree push --prefix backend heroku main
```

#### Option C: Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from backend directory
cd backend
vercel
```

### 5.4 Update Frontend Configuration
Once backend is deployed, update the frontend:

1. **Get your backend URL** (e.g., `https://stellarrec-backend.railway.app`)

2. **Update dashboard.html**:
   ```javascript
   // Change this line in the backend integration script
   window.SR_BACKEND_BASE = 'https://your-backend-url.com';
   ```

### 5.5 Test the Integration
```bash
# Test the deployed backend
curl -X POST https://your-backend-url.com/api/recommendations \
  -H "Content-Type: application/json" \
  -d '{
    "student_name": "Test Student",
    "student_email": "test@example.com",
    "student_first": "Test",
    "student_last": "Student", 
    "recommender_name": "Test Professor",
    "recommender_email": "prof@university.edu",
    "unitids": ["MOCK-1"],
    "waive": 1,
    "title": "Test Recommendation"
  }'
```

Expected response:
```json
{
  "id": "sr_1703123456789_abc123",
  "status": "ok"
}
```

## 📧 Email Service Setup

### Get Resend API Key
1. Go to [resend.com](https://resend.com)
2. Sign up for free account
3. Create API key
4. Add to environment variables

### Configure Domain (Optional)
1. Add your domain to Resend
2. Verify DNS records
3. Update `EMAIL_FROM` to use your domain

## 🔧 Local Development

### Start Backend Locally
```bash
cd backend
npm install
npm run dev
```

### Test Locally
```bash
# Test the local server
npm run test:server
```

### Update Frontend for Local Testing
```javascript
// For local development, use:
window.SR_BACKEND_BASE = 'http://localhost:3000';
```

## 🛡️ Security Checklist

- [x] CORS configured for your frontend domain
- [x] Input validation on all endpoints
- [x] HMAC signatures for secure links
- [x] Environment variables for secrets
- [ ] Rate limiting (recommended for production)
- [ ] HTTPS enforcement (handled by hosting platform)

## 📊 Monitoring (Optional)

### Basic Monitoring
- Check hosting platform logs
- Monitor email delivery in Resend dashboard
- Track API response times

### Advanced Monitoring
- Add application performance monitoring (APM)
- Set up error tracking (Sentry)
- Configure uptime monitoring

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `CORS_ORIGIN` includes your frontend domain
   - Check browser developer tools for specific errors

2. **Email Not Sending**
   - Verify `RESEND_API_KEY` is correct
   - Check Resend dashboard for delivery status
   - Ensure `EMAIL_FROM` uses verified domain

3. **Backend Not Responding**
   - Check hosting platform logs
   - Verify environment variables are set
   - Test with curl or Postman

4. **Frontend Integration Issues**
   - Verify `window.SR_BACKEND_BASE` points to correct URL
   - Check browser network tab for API calls
   - Ensure form fields have correct IDs

## ✅ Final Verification

Before going live:

1. [ ] Backend deployed and accessible
2. [ ] Environment variables configured
3. [ ] Email service working (test with real email)
4. [ ] Frontend updated with backend URL
5. [ ] End-to-end test completed
6. [ ] Error handling tested
7. [ ] CORS working from frontend domain

## 🎉 You're Ready!

Once all items are checked, your StellarRec recommendation system is fully operational:

- Students can submit recommendation requests
- Emails are sent to recommenders automatically  
- Recommenders receive secure links to the dashboard
- The system handles errors gracefully
- All data is validated and secure

Your platform is now ready for users! 🚀