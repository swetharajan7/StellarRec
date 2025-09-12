# Free Backend Deployment Options (No Paywall)

Since Netlify requires payment for environment variables, here are completely free alternatives:

## 🚀 Option 1: Railway (Recommended - Completely Free)

Railway offers free hosting with environment variables support.

### Deploy to Railway:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Set Environment Variables (Free):
```bash
railway variables set RESEND_API_KEY=your_key_here
railway variables set EMAIL_FROM="StellarRec <no-reply@stellarrec.com>"
railway variables set FRONTEND_BASE=https://stellarrec.netlify.app/dashboard
railway variables set SIGNING_SECRET=your_strong_secret_here
```

### Update Frontend:
Once deployed, update `public/dashboard.html`:
```javascript
window.SR_BACKEND_BASE = 'https://your-app-name.railway.app';
```

---

## 🚀 Option 2: Render (Free Tier)

Render offers free hosting with environment variables.

### Deploy to Render:
1. Go to [render.com](https://render.com)
2. Connect your GitHub repo
3. Create new "Web Service"
4. Set:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Root Directory**: Leave empty

### Set Environment Variables (Free):
In Render dashboard, add:
- `RESEND_API_KEY`: your_key_here
- `EMAIL_FROM`: StellarRec <no-reply@stellarrec.com>
- `FRONTEND_BASE`: https://stellarrec.netlify.app/dashboard
- `SIGNING_SECRET`: your_strong_secret_here

---

## 🚀 Option 3: Hardcoded Netlify (Quick Fix)

If you want to stick with Netlify, I've updated the function to use hardcoded config.

### Steps:
1. Get your Resend API key from [resend.com](https://resend.com)
2. Edit `netlify/functions/recommendations.js`
3. Replace `'your_resend_api_key_here'` with your actual API key
4. Replace `'stellarrec_production_secret_change_me'` with a strong random string
5. Commit and push changes

### Security Note:
- API key will be visible in your code
- Use a separate "public" API key if possible
- Consider this for testing only

---

## 🚀 Option 4: Vercel (Free Tier)

Vercel offers free hosting with environment variables.

### Deploy to Vercel:
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from backend directory
cd backend
vercel
```

### Set Environment Variables (Free):
```bash
vercel env add RESEND_API_KEY
vercel env add EMAIL_FROM
vercel env add FRONTEND_BASE
vercel env add SIGNING_SECRET
```

---

## 📧 Get Free Resend API Key

1. Visit [resend.com](https://resend.com)
2. Sign up (completely free)
3. Free tier includes:
   - 100 emails/day
   - 3,000 emails/month
   - All features included

---

## 🎯 Recommended Approach

**For Production**: Use Railway or Render (both completely free with env vars)
**For Testing**: Use hardcoded Netlify option

Railway is the easiest - just run:
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

Then set your environment variables in the Railway dashboard (free forever).

---

## 🔄 Update Frontend After Deployment

Once you choose a platform and deploy, update the backend URL in `public/dashboard.html`:

```javascript
// Replace this line:
window.SR_BACKEND_BASE = 'https://stellarrec.netlify.app/.netlify/functions';

// With your new backend URL:
window.SR_BACKEND_BASE = 'https://your-backend-url.com';
```

All these options are completely free and will give you a working email flow! 🚀