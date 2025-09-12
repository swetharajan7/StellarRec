# 🔧 Netlify Environment Variables Setup

## ✅ **FREE Solution - No Purchase Required!**

You don't need to purchase anything! Netlify environment variables are **completely free**. Here's how to set them up:

---

## 🚀 **Step 1: Set Up Netlify Environment Variables (FREE)**

### **Go to Netlify Dashboard:**
1. Visit: https://app.netlify.com/sites/stellarrec/settings/deploys
2. Scroll down to "Environment variables"
3. Click "Add variable"

### **Add These Variables:**

#### **1. RESEND_API_KEY**
```
Key: RESEND_API_KEY
Value: re_2FU7PXNf_8PjSC2zz9TYAdweY7xmkZnKr
```

#### **2. EMAIL_FROM**
```
Key: EMAIL_FROM  
Value: StellarRec <onboarding@resend.dev>
```

#### **3. FRONTEND_BASE**
```
Key: FRONTEND_BASE
Value: https://stellarrec.netlify.app/dashboard
```

#### **4. SIGNING_SECRET**
```
Key: SIGNING_SECRET
Value: a7f8d9e2b4c6f1a3e5d7b9c2f4e6a8d0b3c5e7f9a1d3b5c7e9f2a4c6e8f0a2b4c6e8f0a2b4c6e8f0a2b4c6e8f0
```

#### **5. NODE_ENV**
```
Key: NODE_ENV
Value: production
```

---

## 🎯 **Step 2: Upgrade Resend for Any Email Address**

### **Current Limitation:**
- Free Resend account can only send to `swetha.rajan103@gmail.com`
- To send to ANY email address, you need to upgrade

### **Upgrade Options:**

#### **Option A: Verify Domain (Recommended)**
1. Go to: https://resend.com/domains
2. Add domain: `stellarrec.com` 
3. Add DNS records to your domain
4. Update `EMAIL_FROM` to: `StellarRec <no-reply@stellarrec.com>`

#### **Option B: Upgrade to Paid Plan**
- **Pro Plan**: $20/month
- **50,000 emails/month**
- **Send to any email address**
- **Custom domains included**

---

## 🔧 **Step 3: Test the Updated System**

### **After Setting Environment Variables:**

1. **Redeploy your site** (Netlify will auto-deploy when you push to GitHub)
2. **Test email sending** at: https://stellarrec.netlify.app/dashboard#send
3. **Check console logs** for environment variable usage

### **Expected Behavior:**
- ✅ **With Free Resend**: Emails sent to `swetha.rajan103@gmail.com` (testing mode)
- ✅ **With Upgraded Resend**: Emails sent to actual recommender addresses

---

## 💡 **Benefits of Environment Variables**

### **Security:**
- ✅ API keys not exposed in code
- ✅ Different settings for development/production
- ✅ Easy to update without code changes

### **Flexibility:**
- ✅ Easy to switch between testing/production
- ✅ Different email addresses for different environments
- ✅ Secure credential management

---

## 🧪 **Current Status**

### **✅ What's Working Now:**
- Email system functional with testing limitations
- Professional email templates
- Real-time status tracking
- Secure recommender links

### **🔄 What Changes After Setup:**
- **Environment Variables**: More secure configuration
- **Resend Upgrade**: Send to any email address
- **Production Ready**: No more testing limitations

---

## 📋 **Quick Setup Checklist**

### **Netlify Environment Variables (FREE):**
- [ ] Go to Netlify dashboard → Settings → Environment variables
- [ ] Add RESEND_API_KEY
- [ ] Add EMAIL_FROM  
- [ ] Add FRONTEND_BASE
- [ ] Add SIGNING_SECRET
- [ ] Add NODE_ENV=production
- [ ] Redeploy site

### **Resend Upgrade (Optional - $20/month):**
- [ ] Go to https://resend.com/pricing
- [ ] Upgrade to Pro plan
- [ ] Verify domain OR use upgraded account
- [ ] Update EMAIL_FROM in environment variables
- [ ] Test sending to any email address

---

## 🎉 **Recommendation**

### **For Testing/Demo:**
- ✅ **Use current setup** - works perfectly for demonstrations
- ✅ **Set up environment variables** - better security (free)
- ✅ **Keep testing mode** - emails go to verified address

### **For Production:**
- ✅ **Upgrade Resend** - $20/month for unlimited recipients
- ✅ **Verify stellarrec.com domain** - professional email addresses
- ✅ **Update environment variables** - production configuration

---

## 🚀 **Next Steps**

1. **Set up Netlify environment variables** (free, 5 minutes)
2. **Test the system** with improved security
3. **Consider Resend upgrade** when ready for production users
4. **Verify domain** for professional email addresses

**Your email system will work great with just the free environment variables setup!** 🌟