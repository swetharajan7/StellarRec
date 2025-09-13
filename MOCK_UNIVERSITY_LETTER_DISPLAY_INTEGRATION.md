# Mock University Letter Display Integration

## 🎯 **Problem Solved**

This integration ensures that the actual recommendation letter text written by the recommender in StellarRec appears in the Mock University application page text box, exactly as shown in your screenshot.

## 📋 **Files to Deploy to Mock University**

### **1. Netlify Functions** (Upload to Mock University repo)

**File**: `netlify/functions/reco-hook.js`
- **Purpose**: Receives letter content from StellarRec
- **Action**: Upload this file to Mock University's `netlify/functions/` folder

**File**: `netlify/functions/get-recommendation-data.js`  
- **Purpose**: Retrieves stored letter content for display
- **Action**: Upload this file to Mock University's `netlify/functions/` folder

### **2. Frontend Integration** (Update Mock University's apply.html)

**File**: `js/stellarrec-integration.js`
- **Purpose**: Displays letter content in the text box
- **Action**: Replace the existing integration script with the updated version

## 🔧 **Step-by-Step Deployment**

### **Step 1: Upload Netlify Functions**
```bash
# In Mock University repository
mkdir -p netlify/functions
# Copy the two function files to netlify/functions/
```

### **Step 2: Update Integration Script**
Replace the content of `public/js/stellarrec-integration.js` in Mock University with the updated version that includes letter display functionality.

### **Step 3: Add Script to apply.html**
Ensure this line is in Mock University's `apply.html`:
```html
<script src="js/stellarrec-integration.js"></script>
```

### **Step 4: Set Environment Variables** (Optional)
In Mock University's Netlify dashboard:
```
NETLIFY_BLOBS_TOKEN=your_token_here
SITE_ID=your_site_id_here
```

## 🔄 **How It Works**

### **Phase 1: Letter Submission**
1. Recommender writes letter in StellarRec
2. Clicks "Send to Selected Universities"
3. StellarRec sends webhook to `reco-hook` with letter content
4. Mock University stores the letter data

### **Phase 2: Letter Display**
1. User opens Mock University with `external_id` parameter
2. Integration script calls `get-recommendation-data`
3. Script finds the recommendation text box
4. Script displays the actual letter content
5. Text box shows the exact letter from StellarRec

## 📄 **Letter Display Features**

### **Automatic Detection**
The script automatically finds the letter text box using these selectors:
- `textarea[placeholder*="recommendation"]`
- `textarea[placeholder*="letter"]`
- `.recommendation-letter textarea`
- Any `textarea` in the recommendations section

### **Visual Indicators**
- ✅ Green border around text box
- 📝 Label showing "Recommendation Letter from [Name] via StellarRec"
- 📅 Submission date display
- 🔒 Read-only mode (prevents editing)

### **Content Formatting**
- Preserves original letter formatting
- Shows recommender name and date
- Handles both short and long letters
- Graceful fallback if no letter content

## 🧪 **Testing Instructions**

### **Test the Complete Flow:**

1. **Write Letter in StellarRec**
   - Go to StellarRec recommender portal
   - Write a recommendation letter in the text editor
   - Select Mock University

2. **Send Letter**
   - Click "Send to Selected Universities" → "Send now"
   - Wait for success message
   - Click "View Mock University Status"

3. **Verify Display**
   - Mock University page should open
   - The recommendation text box should contain the exact letter
   - Green border and StellarRec label should appear
   - Letter should be read-only

### **Debug Mode:**
Open browser console on Mock University page to see:
- `📍 Found letter content box with selector: [selector]`
- `📄 Displaying letter content in Mock University`
- `✅ Letter content displayed successfully`

## 🎯 **Expected Result**

After deployment, when a recommender completes a letter in StellarRec:

1. **Mock University Status**: Changes from "Pending" to "Completed"
2. **Letter Text Box**: Shows the exact recommendation letter text
3. **Visual Confirmation**: Green styling and StellarRec label
4. **Automatic Updates**: No page refresh needed

## 🔗 **API Endpoints**

- **Webhook**: `https://mockuniversity.netlify.app/.netlify/functions/reco-hook`
- **Data Retrieval**: `https://mockuniversity.netlify.app/.netlify/functions/get-recommendation-data?external_id=XXX`

## ✅ **Deployment Checklist**

- [ ] Upload `reco-hook.js` to Mock University's `netlify/functions/`
- [ ] Upload `get-recommendation-data.js` to Mock University's `netlify/functions/`
- [ ] Update `stellarrec-integration.js` with letter display functionality
- [ ] Ensure script is included in `apply.html`
- [ ] Test the complete workflow
- [ ] Verify letter content appears in text box

## 🚀 **Ready to Deploy**

All files are ready for deployment to Mock University. The integration will automatically detect and display recommendation letters from StellarRec in the exact text box shown in your screenshot.