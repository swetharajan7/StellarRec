# StellarRec ↔ Mock University Integration Complete

## 🎯 **Integration Overview**

The StellarRec platform now sends real-time webhooks to Mock University at two key moments in the recommendation workflow:

1. **Request Phase**: When student sends recommendation request → Status: `sent` (shows as "PENDING" on Mock University)
2. **Completion Phase**: When recommender completes and sends letter → Status: `completed` (shows as "COMPLETED" with download link)

## 🔧 **Implementation Details**

### **1. Webhook Helper Added**
```javascript
window.SR_MOCK = {
  HOOK_URL: 'https://mockuniversity.netlify.app/.netlify/functions/reco-hook',
  async notify(payload) {
    try {
      await fetch(this.HOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch(e) { console.warn('[SR] mock webhook failed', e); }
  }
};
```

### **2. Student Request Phase Integration**
**Location**: Student form submission handler in `public/dashboard.html`

**When**: Right after successful backend API call

**Payload**:
```javascript
{
  external_id: 'sr_1234567890_abc123',  // Stable ID for tracking
  student_name: 'Jane Doe',
  student_email: 'jane@email.com',
  recommender_name: 'Prof. Smith',
  recommender_email: 'smith@uni.edu',
  universities: [
    { unitid: 'MOCK-0000', name: 'Mock University' },
    { unitid: '166027', name: 'Harvard University' }
  ],
  status: 'sent',  // Shows "PENDING" on Mock University
  ts: 1640995200000
}
```

### **3. Completion Phase Integration**
**Location**: `startProgressSend()` function - before progress animation starts

**When**: Recommender clicks "Send now" in confirmation modal

**Payload**:
```javascript
{
  external_id: 'sr_1234567890_abc123',  // Same ID from request phase
  student_name: 'Jane Doe',
  student_email: 'jane@email.com',
  recommender_name: 'Prof. Smith',
  recommender_email: 'smith@uni.edu',
  universities: [
    { unitid: 'MOCK-0000', name: 'Mock University' }
  ],
  status: 'completed',
  artifact_url: 'https://stellarrec.netlify.app/assets/mock/reco-demo.pdf',
  ts: 1640995800000
}
```

### **4. Mock University Redirect Button**
**Added**: "View Mock University Status" button in success section

**Functionality**: 
- Opens Mock University apply page with `external_id` parameter
- URL: `https://mockuniversity.netlify.app/apply.html?external_id=sr_1234567890_abc123`
- Mock University can use this ID to show real-time status updates

### **5. Data Helper Functions**
**Added**: `getStudentDataFromURL()` function that intelligently retrieves student/recommender data from:
1. URL parameters (from email links)
2. Local storage (from previous sessions)
3. Form fields (current session)
4. Fallback defaults

## 🔄 **Complete Workflow**

### **Phase 1: Student Sends Request**
1. Student fills form on StellarRec
2. Clicks "Send Request"
3. StellarRec calls backend API
4. **NEW**: StellarRec sends webhook to Mock University with `status: 'sent'`
5. Mock University shows: `Manas | Pending | Waiting for response`

### **Phase 2: Recommender Completes Letter**
1. Recommender receives email, clicks link
2. Writes recommendation letter
3. Clicks "Send to Selected Universities"
4. **NEW**: StellarRec sends webhook to Mock University with `status: 'completed'`
5. Mock University shows: `Manas | Completed | Download PDF`

### **Phase 3: Real-time Updates**
- Mock University polls for status updates using `external_id`
- No page refresh needed
- Status changes automatically from "Pending" → "Completed"
- Download link appears when ready

## 🎯 **Key Features**

✅ **Stable Tracking**: Uses persistent `external_id` across both phases
✅ **Safe Failure**: Webhook failures don't break StellarRec functionality  
✅ **Real-time**: Mock University updates without page refresh
✅ **Complete Data**: Sends all necessary student/recommender/university info
✅ **File Access**: Provides artifact URL for recommendation download
✅ **User-Friendly**: "View Mock University Status" button for easy access

## 🧪 **Testing Instructions**

### **Test Request Phase**:
1. Go to StellarRec student portal
2. Fill out recommendation request form
3. Click "Send Request"
4. Check Mock University apply page - should show "PENDING"

### **Test Completion Phase**:
1. Go to StellarRec recommender portal  
2. Write recommendation letter
3. Click "Send to Selected Universities" → "Send now"
4. Check Mock University apply page - should show "COMPLETED" with download link

### **Test Real-time Updates**:
1. Open Mock University apply page with `external_id` parameter
2. Complete the workflow on StellarRec
3. Watch Mock University page update automatically (no refresh needed)

## 🔗 **Integration Endpoints**

- **StellarRec**: `https://stellarrec.netlify.app/dashboard#recommender`
- **Mock University**: `https://mockuniversity.netlify.app/apply.html`
- **Webhook Endpoint**: `https://mockuniversity.netlify.app/.netlify/functions/reco-hook`

## ✅ **Status: COMPLETE**

The integration is now fully functional and deployed. StellarRec and Mock University communicate seamlessly in real-time without any user intervention required.