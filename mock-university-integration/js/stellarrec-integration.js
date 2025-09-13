// Mock University - StellarRec Integration Frontend
// This script automatically updates recommendation status on the Mock University application page

(function() {
  'use strict';
  
  console.log('🎓 Mock University - StellarRec Integration loaded');
  
  // Configuration
  const CONFIG = {
    POLL_INTERVAL: 30000, // Check for updates every 30 seconds
    API_BASE: 'https://mockuniversity.netlify.app/.netlify/functions',
    STUDENT_EMAIL: 'swetha.rajan103@gmail.com', // Demo student
    STUDENT_NAME: 'Swetha Rajan'
  };
  
  // State management
  let currentStatus = null;
  let pollTimer = null;
  
  // Initialize the integration
  function init() {
    console.log('🚀 Initializing StellarRec integration...');
    
    // Find the recommendations section
    const recommendationsSection = findRecommendationsSection();
    if (!recommendationsSection) {
      console.warn('⚠️ Recommendations section not found');
      return;
    }
    
    // Add integration indicator
    addIntegrationIndicator(recommendationsSection);
    
    // Start polling for status updates
    startStatusPolling();
    
    // Initial status check
    checkRecommendationStatus();
  }
  
  // Find the recommendations section in the DOM
  function findRecommendationsSection() {
    // Look for the recommendations section by various selectors
    const selectors = [
      'h2:contains("Recommendations")',
      '[data-section="recommendations"]',
      '.recommendations-section',
      'h2'
    ];
    
    for (const selector of selectors) {
      if (selector.includes('contains')) {
        // Handle text-based search
        const elements = document.querySelectorAll('h2');
        for (const el of elements) {
          if (el.textContent.includes('Recommendations')) {
            return el.closest('section') || el.parentElement;
          }
        }
      } else {
        const element = document.querySelector(selector);
        if (element) return element;
      }
    }
    
    return null;
  }
  
  // Add integration status indicator
  function addIntegrationIndicator(section) {
    const indicator = document.createElement('div');
    indicator.id = 'stellarrec-integration-status';
    indicator.style.cssText = `
      background: #e3f2fd;
      border: 1px solid #2196f3;
      border-radius: 8px;
      padding: 12px;
      margin: 10px 0;
      font-size: 14px;
      color: #1565c0;
    `;
    indicator.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">🔗</span>
        <span><strong>StellarRec Integration:</strong> <span id="integration-message">Checking for updates...</span></span>
      </div>
    `;
    
    // Insert after the recommendations header
    const header = section.querySelector('h2') || section.querySelector('h3');
    if (header) {
      header.insertAdjacentElement('afterend', indicator);
    } else {
      section.insertBefore(indicator, section.firstChild);
    }
  }
  
  // Start polling for status updates
  function startStatusPolling() {
    if (pollTimer) clearInterval(pollTimer);
    
    pollTimer = setInterval(() => {
      checkRecommendationStatus();
    }, CONFIG.POLL_INTERVAL);
    
    console.log(`📡 Started polling for updates every ${CONFIG.POLL_INTERVAL/1000} seconds`);
  }
  
  // Check recommendation status
  async function checkRecommendationStatus() {
    try {
      updateIntegrationMessage('Checking for updates...', 'info');
      
      // Get external_id from URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const externalId = urlParams.get('external_id');
      
      if (!externalId) {
        updateIntegrationMessage('No recommendation ID found', 'info');
        return;
      }
      
      const response = await fetch(`${CONFIG.API_BASE}/get-recommendation-data?external_id=${encodeURIComponent(externalId)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && data.recommendation) {
        updateRecommendationDisplay(data.recommendation);
        updateIntegrationMessage('Connected to StellarRec', 'success');
        
        // Display the letter content in the text box
        displayLetterContent(data.recommendation);
      } else {
        updateIntegrationMessage('No recommendation data found', 'info');
      }
      
    } catch (error) {
      console.error('❌ Failed to check recommendation status:', error);
      updateIntegrationMessage('Connection error - retrying...', 'error');
    }
  }
  
  // Display letter content in the recommendation text box
  function displayLetterContent(recommendation) {
    // Find the recommendation letter text area/box
    const letterBox = findLetterContentBox();
    
    if (letterBox && recommendation.letter_content) {
      console.log('📄 Displaying letter content in Mock University');
      
      // Update the text content
      if (letterBox.tagName === 'TEXTAREA' || letterBox.tagName === 'INPUT') {
        letterBox.value = recommendation.letter_content;
      } else {
        letterBox.textContent = recommendation.letter_content;
      }
      
      // Add some styling to indicate it's from StellarRec
      letterBox.style.border = '2px solid #4caf50';
      letterBox.style.backgroundColor = '#f8fff8';
      
      // Add a label if it doesn't exist
      addLetterLabel(letterBox, recommendation);
      
      // Make it read-only since it's from StellarRec
      if (letterBox.tagName === 'TEXTAREA' || letterBox.tagName === 'INPUT') {
        letterBox.readOnly = true;
      }
      
      console.log('✅ Letter content displayed successfully');
    } else {
      console.warn('⚠️ Could not find letter content box or no letter content available');
    }
  }
  
  // Find the letter content box in the DOM
  function findLetterContentBox() {
    // Look for various possible selectors for the letter content area
    const selectors = [
      'textarea[placeholder*="recommendation"]',
      'textarea[placeholder*="letter"]',
      '.recommendation-letter textarea',
      '.letter-content textarea',
      'textarea',
      '.recommendation-content',
      '.letter-text',
      '[contenteditable="true"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`📍 Found letter content box with selector: ${selector}`);
        return element;
      }
    }
    
    // If no specific element found, look for any text area in the recommendations section
    const recommendationsSection = findRecommendationsSection();
    if (recommendationsSection) {
      const textArea = recommendationsSection.querySelector('textarea');
      if (textArea) {
        console.log('📍 Found textarea in recommendations section');
        return textArea;
      }
    }
    
    return null;
  }
  
  // Add a label to indicate the letter is from StellarRec
  function addLetterLabel(letterBox, recommendation) {
    // Check if label already exists
    if (letterBox.previousElementSibling && letterBox.previousElementSibling.classList.contains('stellarrec-letter-label')) {
      return;
    }
    
    const label = document.createElement('div');
    label.className = 'stellarrec-letter-label';
    label.style.cssText = `
      background: #e8f5e8;
      border: 1px solid #4caf50;
      border-radius: 4px 4px 0 0;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      color: #2e7d32;
      margin-bottom: -1px;
    `;
    label.innerHTML = `
      <span style="margin-right: 6px;">✅</span>
      Recommendation Letter from ${recommendation.recommender_name} via StellarRec
      <span style="float: right; font-weight: normal;">${new Date(recommendation.submission_date).toLocaleDateString()}</span>
    `;
    
    letterBox.parentNode.insertBefore(label, letterBox);
  }
  
  // Update the recommendation display
  function updateRecommendationDisplay(recommendation) {
    // Check if status has changed
    if (currentStatus && currentStatus.status === recommendation.status) {
      return; // No change
    }
    
    console.log('📊 Updating recommendation display:', recommendation);
    currentStatus = recommendation;
    
    // Find the status elements to update
    updateStatusElements(recommendation);
    
    // Show notification if status changed
    if (recommendation.status !== 'no_recommendations') {
      showStatusNotification(recommendation);
    }
  }
  
  // Update status elements in the DOM
  function updateStatusElements(recommendation) {
    // Update the main status display
    const statusElements = document.querySelectorAll('[data-status], .status, .recommendation-status');
    statusElements.forEach(el => {
      if (recommendation.status === 'recommendation_requested') {
        el.textContent = 'Requested';
        el.style.color = '#ff9800';
      } else if (recommendation.status === 'recommendation_received') {
        el.textContent = 'Received';
        el.style.color = '#4caf50';
      } else {
        el.textContent = 'Pending';
        el.style.color = '#666';
      }
    });
    
    // Update the recommender name/message
    const messageElements = document.querySelectorAll('.recommendation-message, .recommender-info');
    messageElements.forEach(el => {
      el.textContent = recommendation.message;
    });
    
    // Update the table if it exists
    updateRecommendationTable(recommendation);
  }
  
  // Update recommendation table
  function updateRecommendationTable(recommendation) {
    // Look for the recommendations table
    const table = document.querySelector('table');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    // Clear existing rows (except header)
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => row.remove());
    
    // Add recommender rows
    if (recommendation.recommenders && recommendation.recommenders.length > 0) {
      recommendation.recommenders.forEach(recommender => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${recommender.name}</td>
          <td>
            <span style="color: ${getStatusColor(recommender.status)}; font-weight: 500;">
              ${getStatusText(recommender.status)}
            </span>
            ${recommender.source ? `<br><small style="color: #666;">via ${recommender.source}</small>` : ''}
          </td>
        `;
        tbody.appendChild(row);
      });
    } else {
      // Show "no recommenders" row
      const row = document.createElement('tr');
      row.innerHTML = `
        <td colspan="2" style="text-align: center; color: #666; font-style: italic;">
          No recommenders yet
        </td>
      `;
      tbody.appendChild(row);
    }
  }
  
  // Get status color
  function getStatusColor(status) {
    switch (status) {
      case 'requested': return '#ff9800';
      case 'completed': return '#4caf50';
      case 'received': return '#4caf50';
      default: return '#666';
    }
  }
  
  // Get status text
  function getStatusText(status) {
    switch (status) {
      case 'requested': return 'Requested';
      case 'completed': return 'Completed';
      case 'received': return 'Received';
      default: return 'Pending';
    }
  }
  
  // Update integration message
  function updateIntegrationMessage(message, type = 'info') {
    const messageEl = document.getElementById('integration-message');
    if (!messageEl) return;
    
    messageEl.textContent = message;
    
    const indicator = document.getElementById('stellarrec-integration-status');
    if (indicator) {
      const colors = {
        info: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
        success: { bg: '#e8f5e8', border: '#4caf50', text: '#2e7d32' },
        error: { bg: '#ffebee', border: '#f44336', text: '#c62828' }
      };
      
      const color = colors[type] || colors.info;
      indicator.style.background = color.bg;
      indicator.style.borderColor = color.border;
      indicator.style.color = color.text;
    }
  }
  
  // Show status notification
  function showStatusNotification(recommendation) {
    // Create a temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4caf50;
      color: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-weight: 500;
      max-width: 300px;
    `;
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">✅</span>
        <div>
          <div><strong>Status Updated</strong></div>
          <div style="font-size: 14px; opacity: 0.9;">${recommendation.message}</div>
        </div>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
  });
  
})();