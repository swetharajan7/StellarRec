// Mock University - StellarRec Integration Script
// Add this script to Mock University's apply.html to receive real-time updates from StellarRec

(function() {
  'use strict';
  
  console.log('🎓 Mock University - StellarRec Integration initialized');
  
  // Configuration
  const CONFIG = {
    POLL_INTERVAL: 10000, // Check for updates every 10 seconds
    STORAGE_KEY: 'mock_university_recommendations',
    DEBUG: true
  };
  
  // State management
  let currentRecommendations = [];
  let pollTimer = null;
  
  // Initialize integration when DOM is ready
  function init() {
    if (CONFIG.DEBUG) console.log('🚀 Starting StellarRec integration...');
    
    // Load existing recommendations from localStorage
    loadRecommendations();
    
    // Update the UI with current data
    updateRecommendationsTable();
    
    // Start polling for updates (in a real implementation, this would be WebSocket)
    startPolling();
    
    // Set up webhook simulation (in production, this would be a real webhook endpoint)
    setupWebhookSimulation();
  }
  
  // Load recommendations from localStorage
  function loadRecommendations() {
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (stored) {
        currentRecommendations = JSON.parse(stored);
        if (CONFIG.DEBUG) console.log('📊 Loaded recommendations:', currentRecommendations);
      }
    } catch (error) {
      console.error('❌ Error loading recommendations:', error);
      currentRecommendations = [];
    }
  }
  
  // Save recommendations to localStorage
  function saveRecommendations() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(currentRecommendations));
      if (CONFIG.DEBUG) console.log('💾 Saved recommendations:', currentRecommendations);
    } catch (error) {
      console.error('❌ Error saving recommendations:', error);
    }
  }
  
  // Add or update a recommendation
  function addOrUpdateRecommendation(data) {
    const existingIndex = currentRecommendations.findIndex(
      rec => rec.student.email === data.student.email && rec.recommender.email === data.recommender.email
    );
    
    if (existingIndex >= 0) {
      // Update existing recommendation
      currentRecommendations[existingIndex] = {
        ...currentRecommendations[existingIndex],
        ...data,
        lastUpdated: new Date().toISOString()
      };
      if (CONFIG.DEBUG) console.log('📝 Updated recommendation:', currentRecommendations[existingIndex]);
    } else {
      // Add new recommendation
      const newRec = {
        ...data,
        id: 'rec_' + Date.now(),
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };
      currentRecommendations.push(newRec);
      if (CONFIG.DEBUG) console.log('➕ Added new recommendation:', newRec);
    }
    
    saveRecommendations();
    updateRecommendationsTable();
    showNotification(data);
  }
  
  // Update the recommendations table in the UI
  function updateRecommendationsTable() {
    // Find the table body
    const tableBody = document.querySelector('.table tbody');
    if (!tableBody) {
      if (CONFIG.DEBUG) console.warn('⚠️ Recommendations table not found');
      return;
    }
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (currentRecommendations.length === 0) {
      // Show "no recommenders yet" message
      const row = document.createElement('tr');
      row.innerHTML = `
        <td colspan="2" style="text-align: center; color: #6b7280; font-style: italic; padding: 2rem;">
          No recommenders yet
        </td>
      `;
      tableBody.appendChild(row);
    } else {
      // Show recommendations
      currentRecommendations.forEach(rec => {
        const row = document.createElement('tr');
        const statusColor = getStatusColor(rec.status);
        const statusText = getStatusText(rec.status);
        
        row.innerHTML = `
          <td>
            <div style="font-weight: 600; color: #111827;">${rec.recommender.name}</div>
            <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">
              ${rec.recommender.email}
            </div>
            <div style="font-size: 0.75rem; color: #1976d2; margin-top: 0.25rem;">
              via StellarRec
            </div>
          </td>
          <td>
            <span style="color: ${statusColor}; font-weight: 500; font-size: 0.875rem;">
              ${statusText}
            </span>
            <div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">
              ${formatTimestamp(rec.lastUpdated)}
            </div>
          </td>
        `;
        
        tableBody.appendChild(row);
      });
    }
    
    if (CONFIG.DEBUG) console.log('🔄 Updated recommendations table');
  }
  
  // Get status color based on recommendation status
  function getStatusColor(status) {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'requested': return '#3b82f6';
      case 'completed': return '#10b981';
      case 'received': return '#10b981';
      default: return '#6b7280';
    }
  }
  
  // Get status text based on recommendation status
  function getStatusText(status) {
    switch (status) {
      case 'pending': return 'Pending';
      case 'requested': return 'Requested';
      case 'completed': return 'Completed';
      case 'received': return 'Received';
      default: return 'Unknown';
    }
  }
  
  // Format timestamp for display
  function formatTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (error) {
      return 'Unknown time';
    }
  }
  
  // Show notification when status changes
  function showNotification(data) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.1);
      z-index: 10000;
      font-weight: 500;
      max-width: 350px;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    
    const statusText = data.type === 'letter_completed' ? 'Letter Completed' : 'Request Received';
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="font-size: 24px;">✅</div>
        <div>
          <div style="font-weight: 600; margin-bottom: 4px;">${statusText}</div>
          <div style="font-size: 14px; opacity: 0.9;">
            ${data.recommender.name} • ${data.student.name}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => {
          notification.parentNode.removeChild(notification);
        }, 300);
      }
    }, 5000);
    
    if (CONFIG.DEBUG) console.log('🔔 Showed notification for:', data);
  }
  
  // Start polling for updates (simulates real-time updates)
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    
    pollTimer = setInterval(() => {
      // In a real implementation, this would check for new webhook data
      // For demo purposes, we'll simulate receiving updates
      checkForDemoUpdates();
    }, CONFIG.POLL_INTERVAL);
    
    if (CONFIG.DEBUG) console.log(`📡 Started polling every ${CONFIG.POLL_INTERVAL/1000} seconds`);
  }
  
  // Check for demo updates (simulates webhook data)
  function checkForDemoUpdates() {
    // This simulates receiving webhook data
    // In production, this would be replaced by actual webhook endpoints
    
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Simulate different states based on time for demo purposes
    if (hour >= 9 && minute >= 30 && currentRecommendations.length === 0) {
      // Simulate initial request
      addOrUpdateRecommendation({
        type: 'request_sent',
        student: {
          name: 'Swetha Rajan',
          email: 'swetha.rajan103@gmail.com'
        },
        recommender: {
          name: 'Prof. Manas Mohan Nand',
          email: 'manasmohannand@gmail.com'
        },
        status: 'requested',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Set up webhook simulation (for demo purposes)
  function setupWebhookSimulation() {
    // Expose a global function that can be called to simulate webhook data
    window.mockUniversityReceiveWebhook = function(data) {
      if (CONFIG.DEBUG) console.log('📥 Received webhook data:', data);
      
      // Process the webhook data
      const processedData = {
        type: data.type,
        student: data.student,
        recommender: data.recommender,
        status: data.type === 'letter_completed' ? 'completed' : 'requested',
        timestamp: data.timestamp || new Date().toISOString()
      };
      
      addOrUpdateRecommendation(processedData);
    };
    
    // Also listen for postMessage events (for cross-origin communication)
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type && event.data.type.startsWith('stellarrec_')) {
        const webhookData = {
          type: event.data.type.replace('stellarrec_', ''),
          student: event.data.student,
          recommender: event.data.recommender,
          timestamp: event.data.timestamp
        };
        
        window.mockUniversityReceiveWebhook(webhookData);
      }
    });
    
    if (CONFIG.DEBUG) console.log('🔗 Webhook simulation ready');
  }
  
  // Cleanup function
  function cleanup() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanup);
  
  // Expose public API
  window.MockUniversityStellarRecIntegration = {
    addRecommendation: addOrUpdateRecommendation,
    getRecommendations: () => [...currentRecommendations],
    clearRecommendations: () => {
      currentRecommendations = [];
      saveRecommendations();
      updateRecommendationsTable();
    }
  };
  
})();