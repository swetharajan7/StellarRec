import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';

describe('End-to-End User Workflows', () => {
  let browser: Browser;
  let page: Page;
  const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.CI === 'true',
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    await page.goto(baseUrl);
  });

  describe('Student Registration and Onboarding', () => {
    it('should complete full student registration flow', async () => {
      // Navigate to registration page
      await page.click('[data-testid="register-button"]');
      await page.waitForSelector('[data-testid="registration-form"]');

      // Fill registration form
      await page.type('[data-testid="email-input"]', 'e2e-student@test.com');
      await page.type('[data-testid="password-input"]', 'SecurePassword123!');
      await page.type('[data-testid="confirm-password-input"]', 'SecurePassword123!');
      await page.type('[data-testid="first-name-input"]', 'E2E');
      await page.type('[data-testid="last-name-input"]', 'Student');
      await page.select('[data-testid="role-select"]', 'student');

      // Submit registration
      await page.click('[data-testid="register-submit"]');
      
      // Wait for success message
      await page.waitForSelector('[data-testid="registration-success"]', { timeout: 10000 });
      
      // Verify redirect to profile setup
      await page.waitForSelector('[data-testid="profile-setup-form"]');
      
      // Complete profile setup
      await page.type('[data-testid="gpa-input"]', '3.8');
      await page.select('[data-testid="major-select"]', 'Computer Science');
      await page.type('[data-testid="graduation-year-input"]', '2025');
      
      // Add interests
      await page.click('[data-testid="add-interest-button"]');
      await page.type('[data-testid="interest-input-0"]', 'Artificial Intelligence');
      await page.click('[data-testid="add-interest-button"]');
      await page.type('[data-testid="interest-input-1"]', 'Web Development');

      // Submit profile
      await page.click('[data-testid="profile-submit"]');
      
      // Verify redirect to dashboard
      await page.waitForSelector('[data-testid="student-dashboard"]', { timeout: 10000 });
      
      // Verify welcome message
      const welcomeText = await page.textContent('[data-testid="welcome-message"]');
      expect(welcomeText).toContain('Welcome, E2E Student');
    });

    it('should handle registration validation errors', async () => {
      await page.click('[data-testid="register-button"]');
      await page.waitForSelector('[data-testid="registration-form"]');

      // Try to submit empty form
      await page.click('[data-testid="register-submit"]');
      
      // Check for validation errors
      await page.waitForSelector('[data-testid="email-error"]');
      await page.waitForSelector('[data-testid="password-error"]');
      
      const emailError = await page.textContent('[data-testid="email-error"]');
      expect(emailError).toContain('Email is required');
    });

    it('should prevent duplicate email registration', async () => {
      await page.click('[data-testid="register-button"]');
      await page.waitForSelector('[data-testid="registration-form"]');

      // Use existing email
      await page.type('[data-testid="email-input"]', 'e2e-student@test.com');
      await page.type('[data-testid="password-input"]', 'SecurePassword123!');
      await page.type('[data-testid="confirm-password-input"]', 'SecurePassword123!');
      await page.type('[data-testid="first-name-input"]', 'Duplicate');
      await page.type('[data-testid="last-name-input"]', 'User');
      await page.select('[data-testid="role-select"]', 'student');

      await page.click('[data-testid="register-submit"]');
      
      // Check for duplicate email error
      await page.waitForSelector('[data-testid="registration-error"]');
      const errorText = await page.textContent('[data-testid="registration-error"]');
      expect(errorText).toContain('Email already exists');
    });
  });

  describe('Student Login and Dashboard', () => {
    beforeEach(async () => {
      // Login as existing student
      await page.click('[data-testid="login-button"]');
      await page.waitForSelector('[data-testid="login-form"]');
      await page.type('[data-testid="login-email"]', 'e2e-student@test.com');
      await page.type('[data-testid="login-password"]', 'SecurePassword123!');
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="student-dashboard"]');
    });

    it('should display dashboard with user information', async () => {
      // Check dashboard elements
      await page.waitForSelector('[data-testid="dashboard-header"]');
      await page.waitForSelector('[data-testid="applications-section"]');
      await page.waitForSelector('[data-testid="recommendations-section"]');
      
      // Verify user name in header
      const headerText = await page.textContent('[data-testid="user-name"]');
      expect(headerText).toContain('E2E Student');
    });

    it('should navigate to university search', async () => {
      await page.click('[data-testid="find-universities-button"]');
      await page.waitForSelector('[data-testid="university-search"]');
      
      // Verify search functionality
      await page.type('[data-testid="search-input"]', 'Stanford');
      await page.click('[data-testid="search-button"]');
      
      await page.waitForSelector('[data-testid="search-results"]');
      const results = await page.$$('[data-testid="university-card"]');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Application Creation Workflow', () => {
    beforeEach(async () => {
      // Login and navigate to applications
      await page.goto(`${baseUrl}/login`);
      await page.type('[data-testid="login-email"]', 'e2e-student@test.com');
      await page.type('[data-testid="login-password"]', 'SecurePassword123!');
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="student-dashboard"]');
    });

    it('should create new application', async () => {
      // Navigate to create application
      await page.click('[data-testid="create-application-button"]');
      await page.waitForSelector('[data-testid="application-form"]');

      // Fill application form
      await page.type('[data-testid="university-search"]', 'Stanford University');
      await page.waitForSelector('[data-testid="university-suggestions"]');
      await page.click('[data-testid="university-option-0"]');
      
      await page.select('[data-testid="program-select"]', 'Computer Science');
      await page.type('[data-testid="deadline-input"]', '2024-12-01');
      
      // Submit application
      await page.click('[data-testid="create-application-submit"]');
      
      // Verify success and redirect
      await page.waitForSelector('[data-testid="application-created-success"]');
      await page.waitForSelector('[data-testid="application-details"]');
      
      // Verify application details
      const universityName = await page.textContent('[data-testid="application-university"]');
      expect(universityName).toContain('Stanford University');
    });

    it('should track application progress', async () => {
      // Assume application exists, navigate to it
      await page.click('[data-testid="applications-tab"]');
      await page.waitForSelector('[data-testid="applications-list"]');
      await page.click('[data-testid="application-item-0"]');
      
      await page.waitForSelector('[data-testid="progress-tracker"]');
      
      // Check progress elements
      const progressBar = await page.$('[data-testid="progress-bar"]');
      expect(progressBar).toBeTruthy();
      
      const progressSteps = await page.$$('[data-testid="progress-step"]');
      expect(progressSteps.length).toBeGreaterThan(0);
    });

    it('should update application status', async () => {
      await page.click('[data-testid="applications-tab"]');
      await page.waitForSelector('[data-testid="applications-list"]');
      await page.click('[data-testid="application-item-0"]');
      
      // Update status
      await page.click('[data-testid="status-dropdown"]');
      await page.click('[data-testid="status-in-progress"]');
      
      // Verify status update
      await page.waitForSelector('[data-testid="status-updated-message"]');
      const statusText = await page.textContent('[data-testid="current-status"]');
      expect(statusText).toContain('In Progress');
    });
  });

  describe('Essay Writing and Analysis', () => {
    beforeEach(async () => {
      await page.goto(`${baseUrl}/login`);
      await page.type('[data-testid="login-email"]', 'e2e-student@test.com');
      await page.type('[data-testid="login-password"]', 'SecurePassword123!');
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="student-dashboard"]');
    });

    it('should write and analyze essay', async () => {
      // Navigate to essay writer
      await page.click('[data-testid="essay-writer-button"]');
      await page.waitForSelector('[data-testid="essay-editor"]');

      // Write essay content
      const essayContent = `
        My passion for computer science began in high school when I first discovered programming.
        The ability to create solutions to complex problems through code fascinated me.
        Through various projects and internships, I have developed both technical skills and
        a deep appreciation for the field's potential to make a positive impact on society.
      `;

      await page.type('[data-testid="essay-textarea"]', essayContent);
      
      // Analyze essay
      await page.click('[data-testid="analyze-essay-button"]');
      await page.waitForSelector('[data-testid="analysis-results"]', { timeout: 15000 });
      
      // Check analysis results
      const grammarScore = await page.textContent('[data-testid="grammar-score"]');
      const styleScore = await page.textContent('[data-testid="style-score"]');
      const clarityScore = await page.textContent('[data-testid="clarity-score"]');
      
      expect(parseInt(grammarScore)).toBeGreaterThan(0);
      expect(parseInt(styleScore)).toBeGreaterThan(0);
      expect(parseInt(clarityScore)).toBeGreaterThan(0);
      
      // Check suggestions
      const suggestions = await page.$$('[data-testid="suggestion-item"]');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should save essay draft', async () => {
      await page.click('[data-testid="essay-writer-button"]');
      await page.waitForSelector('[data-testid="essay-editor"]');

      await page.type('[data-testid="essay-title"]', 'My Personal Statement');
      await page.type('[data-testid="essay-textarea"]', 'This is my draft essay content...');
      
      // Save draft
      await page.click('[data-testid="save-draft-button"]');
      await page.waitForSelector('[data-testid="draft-saved-message"]');
      
      // Navigate away and back
      await page.click('[data-testid="dashboard-link"]');
      await page.waitForSelector('[data-testid="student-dashboard"]');
      await page.click('[data-testid="essay-writer-button"]');
      
      // Verify draft was saved
      const titleValue = await page.inputValue('[data-testid="essay-title"]');
      const contentValue = await page.inputValue('[data-testid="essay-textarea"]');
      
      expect(titleValue).toBe('My Personal Statement');
      expect(contentValue).toContain('This is my draft essay content');
    });
  });

  describe('University Matching and Recommendations', () => {
    beforeEach(async () => {
      await page.goto(`${baseUrl}/login`);
      await page.type('[data-testid="login-email"]', 'e2e-student@test.com');
      await page.type('[data-testid="login-password"]', 'SecurePassword123!');
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="student-dashboard"]');
    });

    it('should get personalized university recommendations', async () => {
      await page.click('[data-testid="recommendations-tab"]');
      await page.waitForSelector('[data-testid="recommendations-list"]');
      
      // Check for recommendation cards
      const recommendations = await page.$$('[data-testid="recommendation-card"]');
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Check first recommendation details
      const firstRec = recommendations[0];
      const universityName = await firstRec.$eval('[data-testid="university-name"]', el => el.textContent);
      const matchScore = await firstRec.$eval('[data-testid="match-score"]', el => el.textContent);
      
      expect(universityName).toBeTruthy();
      expect(matchScore).toMatch(/\d+%/);
    });

    it('should view detailed university information', async () => {
      await page.click('[data-testid="recommendations-tab"]');
      await page.waitForSelector('[data-testid="recommendations-list"]');
      
      // Click on first recommendation
      await page.click('[data-testid="recommendation-card"]:first-child');
      await page.waitForSelector('[data-testid="university-details"]');
      
      // Check university details
      await page.waitForSelector('[data-testid="university-overview"]');
      await page.waitForSelector('[data-testid="admission-requirements"]');
      await page.waitForSelector('[data-testid="programs-list"]');
      
      const overview = await page.textContent('[data-testid="university-overview"]');
      expect(overview.length).toBeGreaterThan(50);
    });

    it('should filter recommendations by criteria', async () => {
      await page.click('[data-testid="recommendations-tab"]');
      await page.waitForSelector('[data-testid="recommendations-list"]');
      
      // Apply filters
      await page.click('[data-testid="filters-button"]');
      await page.waitForSelector('[data-testid="filters-panel"]');
      
      await page.type('[data-testid="max-tuition-input"]', '40000');
      await page.select('[data-testid="location-filter"]', 'California');
      await page.click('[data-testid="apply-filters-button"]');
      
      // Wait for filtered results
      await page.waitForSelector('[data-testid="recommendations-list"]');
      
      // Verify filtering worked
      const recommendations = await page.$$('[data-testid="recommendation-card"]');
      for (const rec of recommendations) {
        const tuition = await rec.$eval('[data-testid="tuition-amount"]', el => 
          parseInt(el.textContent.replace(/[^0-9]/g, ''))
        );
        expect(tuition).toBeLessThanOrEqual(40000);
      }
    });
  });

  describe('Notification and Communication', () => {
    beforeEach(async () => {
      await page.goto(`${baseUrl}/login`);
      await page.type('[data-testid="login-email"]', 'e2e-student@test.com');
      await page.type('[data-testid="login-password"]', 'SecurePassword123!');
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="student-dashboard"]');
    });

    it('should display notifications', async () => {
      await page.click('[data-testid="notifications-button"]');
      await page.waitForSelector('[data-testid="notifications-panel"]');
      
      const notifications = await page.$$('[data-testid="notification-item"]');
      expect(notifications.length).toBeGreaterThanOrEqual(0);
      
      if (notifications.length > 0) {
        const firstNotification = notifications[0];
        const title = await firstNotification.$eval('[data-testid="notification-title"]', el => el.textContent);
        const time = await firstNotification.$eval('[data-testid="notification-time"]', el => el.textContent);
        
        expect(title).toBeTruthy();
        expect(time).toBeTruthy();
      }
    });

    it('should manage notification preferences', async () => {
      await page.click('[data-testid="profile-menu"]');
      await page.click('[data-testid="settings-link"]');
      await page.waitForSelector('[data-testid="settings-page"]');
      
      await page.click('[data-testid="notifications-tab"]');
      await page.waitForSelector('[data-testid="notification-preferences"]');
      
      // Toggle email notifications
      const emailToggle = await page.$('[data-testid="email-notifications-toggle"]');
      const isChecked = await emailToggle.evaluate(el => el.checked);
      
      await page.click('[data-testid="email-notifications-toggle"]');
      await page.click('[data-testid="save-preferences-button"]');
      
      await page.waitForSelector('[data-testid="preferences-saved-message"]');
      
      // Verify toggle state changed
      const newState = await emailToggle.evaluate(el => el.checked);
      expect(newState).toBe(!isChecked);
    });
  });

  describe('Mobile Responsiveness', () => {
    beforeEach(async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone SE size
    });

    afterEach(async () => {
      await page.setViewport({ width: 1280, height: 720 }); // Reset to desktop
    });

    it('should display mobile navigation', async () => {
      await page.goto(baseUrl);
      
      // Check for mobile menu button
      await page.waitForSelector('[data-testid="mobile-menu-button"]');
      
      // Open mobile menu
      await page.click('[data-testid="mobile-menu-button"]');
      await page.waitForSelector('[data-testid="mobile-menu"]');
      
      // Check menu items
      const menuItems = await page.$$('[data-testid="mobile-menu-item"]');
      expect(menuItems.length).toBeGreaterThan(0);
    });

    it('should work on mobile after login', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.type('[data-testid="login-email"]', 'e2e-student@test.com');
      await page.type('[data-testid="login-password"]', 'SecurePassword123!');
      await page.click('[data-testid="login-submit"]');
      
      await page.waitForSelector('[data-testid="student-dashboard"]');
      
      // Check mobile dashboard layout
      const dashboard = await page.$('[data-testid="student-dashboard"]');
      const boundingBox = await dashboard.boundingBox();
      
      expect(boundingBox.width).toBeLessThanOrEqual(375);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network errors gracefully', async () => {
      // Simulate network failure
      await page.setOfflineMode(true);
      
      await page.goto(baseUrl);
      
      // Check for offline message
      await page.waitForSelector('[data-testid="offline-message"]', { timeout: 10000 });
      
      const offlineText = await page.textContent('[data-testid="offline-message"]');
      expect(offlineText).toContain('offline');
      
      // Restore network
      await page.setOfflineMode(false);
    });

    it('should handle session expiration', async () => {
      // Login first
      await page.goto(`${baseUrl}/login`);
      await page.type('[data-testid="login-email"]', 'e2e-student@test.com');
      await page.type('[data-testid="login-password"]', 'SecurePassword123!');
      await page.click('[data-testid="login-submit"]');
      await page.waitForSelector('[data-testid="student-dashboard"]');
      
      // Clear session storage to simulate expiration
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      
      // Try to access protected route
      await page.goto(`${baseUrl}/applications`);
      
      // Should redirect to login
      await page.waitForSelector('[data-testid="login-form"]');
      
      const currentUrl = page.url();
      expect(currentUrl).toContain('/login');
    });
  });
});