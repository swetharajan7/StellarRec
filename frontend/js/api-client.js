/**
 * StellarRec API Client - Frontend Integration
 * Connects to backend services including recommendation system
 */

class StellarRecAPI {
    constructor() {
        // Use local backend for development, production API for deployment
        this.baseURL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
            ? 'http://localhost:3003' 
            : 'https://api.stellarrec.com';
        this.token = localStorage.getItem('stellarrec_token');
        this.userId = localStorage.getItem('stellarrec_user_id');
        this.userType = localStorage.getItem('stellarrec_user_type') || 'student';
        
        // Service endpoints mapping to backend tasks
        this.endpoints = {
            // Core API endpoints
            auth: '/auth',
            users: '/users',
            profiles: '/profiles',
            
            // Recommendation system endpoints
            recommendations: '/api/recommendations',
            
            // AI/ML Services
            ai: '/ai',
            matching: '/ai/matching',
            essayAnalysis: '/ai/essay-analysis',
            predictions: '/ai/predictions',
            
            // Application Management
            applications: '/applications',
            timelines: '/timelines',
            deadlines: '/deadlines',
            
            // Letter Management & Collaboration
            letters: '/letters',
            collaboration: '/collaboration',
            aiWriting: '/ai-writing',
            
            // File Management
            files: '/files',
            documents: '/documents',
            
            // Search & Discovery
            search: '/search',
            discovery: '/discovery',
            
            // Analytics & Insights
            analytics: '/analytics',
            predictive: '/predictive-analytics',
            
            // Notifications
            notifications: '/notifications',
            reminders: '/reminders',
            
            // System Health
            health: '/health',
            metrics: '/metrics'
        };
    }

    // ===== RECOMMENDATION SYSTEM METHODS =====
    
    /**
     * Send a recommendation request email to a recommender
     */
    async sendRecommendationRequest(requestData) {
        try {
            console.log('📨 Sending recommendation request:', requestData);
            
            const response = await this.request('POST', this.endpoints.recommendations + '/request', {
                studentName: requestData.studentName,
                studentEmail: requestData.studentEmail,
                recommenderEmail: requestData.recommenderEmail,
                recommenderName: requestData.recommenderName,
                programName: requestData.programName,
                universityName: requestData.universityName
            });
            
            console.log('✅ Recommendation request sent successfully:', response);
            return response;
            
        } catch (error) {
            console.error('❌ Failed to send recommendation request:', error);
            throw error;
        }
    }

    /**
     * Validate a recommendation token (for recommenders)
     */
    async validateRecommendationToken(token) {
        try {
            console.log('🔍 Validating recommendation token...');
            
            const response = await this.request('GET', `${this.endpoints.recommendations}/validate/${token}`);
            
            console.log('✅ Token validation successful:', response);
            return response;
            
        } catch (error) {
            console.error('❌ Token validation failed:', error);
            throw error;
        }
    }

    /**
     * Submit a recommendation letter (for recommenders)
     */
    async submitRecommendation(submissionData) {
        try {
            console.log('📝 Submitting recommendation:', submissionData);
            
            const response = await this.request('POST', this.endpoints.recommendations + '/submit', {
                token: submissionData.token,
                recommenderName: submissionData.recommenderName,
                recommenderTitle: submissionData.recommenderTitle,
                recommenderOrganization: submissionData.recommenderOrganization,
                letterType: submissionData.letterType,
                letterContent: submissionData.letterContent
            });
            
            console.log('✅ Recommendation submitted successfully:', response);
            return response;
            
        } catch (error) {
            console.error('❌ Failed to submit recommendation:', error);
            throw error;
        }
    }

    /**
     * Get student's recommendation requests and submissions
     */
    async getStudentRecommendations(studentEmail) {
        try {
            console.log('👨‍🎓 Getting student recommendations for:', studentEmail);
            
            const response = await this.request('GET', `${this.endpoints.recommendations}/student/${encodeURIComponent(studentEmail)}`);
            
            console.log('✅ Student recommendations loaded:', response);
            return response;
            
        } catch (error) {
            console.error('❌ Failed to load student recommendations:', error);
            throw error;
        }
    }

    // ===== AUTHENTICATION METHODS =====
    
    async login(email, password) {
        try {
            const response = await this.request('POST', this.endpoints.auth + '/login', {
                email,
                password
            });
            
            if (response.token) {
                this.token = response.token;
                this.userId = response.user.id;
                this.userType = response.user.type;
                
                localStorage.setItem('stellarrec_token', this.token);
                localStorage.setItem('stellarrec_user_id', this.userId);
                localStorage.setItem('stellarrec_user_type', this.userType);
            }
            
            return response;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    async logout() {
        try {
            await this.request('POST', this.endpoints.auth + '/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.token = null;
            this.userId = null;
            this.userType = null;
            localStorage.removeItem('stellarrec_token');
            localStorage.removeItem('stellarrec_user_id');
            localStorage.removeItem('stellarrec_user_type');
        }
    }

    // ===== USER MANAGEMENT =====
    
    async getUserProfile() {
        return this.request('GET', `${this.endpoints.users}/${this.userId}`);
    }

    async updateProfile(profileData) {
        return this.request('PUT', `${this.endpoints.profiles}/${this.userId}`, profileData);
    }

    // ===== AI SERVICES =====
    
    async getUniversityMatches(preferences) {
        return this.request('POST', this.endpoints.matching, preferences);
    }

    async analyzeEssay(essayText) {
        return this.request('POST', this.endpoints.essayAnalysis, { text: essayText });
    }

    async getAdmissionPredictions(applicationData) {
        return this.request('POST', this.endpoints.predictions, applicationData);
    }

    // ===== APPLICATION MANAGEMENT =====
    
    async getApplications() {
        return this.request('GET', this.endpoints.applications);
    }

    async createApplication(applicationData) {
        return this.request('POST', this.endpoints.applications, applicationData);
    }

    async updateApplication(applicationId, updates) {
        return this.request('PUT', `${this.endpoints.applications}/${applicationId}`, updates);
    }

    async getTimeline(applicationId) {
        return this.request('GET', `${this.endpoints.timelines}/${applicationId}`);
    }

    async getDeadlines() {
        return this.request('GET', this.endpoints.deadlines);
    }

    // ===== LETTER MANAGEMENT =====
    
    async getLetters() {
        return this.request('GET', this.endpoints.letters);
    }

    async createLetter(letterData) {
        return this.request('POST', this.endpoints.letters, letterData);
    }

    async updateLetter(letterId, updates) {
        return this.request('PUT', `${this.endpoints.letters}/${letterId}`, updates);
    }

    async getCollaborationSession(letterId) {
        return this.request('GET', `${this.endpoints.collaboration}/${letterId}`);
    }

    async getWritingSuggestions(text) {
        return this.request('POST', this.endpoints.aiWriting + '/suggestions', { text });
    }

    // ===== FILE MANAGEMENT =====
    
    async uploadFile(file, metadata = {}) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify(metadata));
        
        return this.request('POST', this.endpoints.files + '/upload', formData, {
            'Content-Type': 'multipart/form-data'
        });
    }

    async getFiles() {
        return this.request('GET', this.endpoints.files);
    }

    async processDocument(fileId) {
        return this.request('POST', `${this.endpoints.documents}/${fileId}/process`);
    }

    // ===== SEARCH & DISCOVERY =====
    
    async search(query, filters = {}) {
        const params = new URLSearchParams({ q: query, ...filters });
        return this.request('GET', `${this.endpoints.search}?${params}`);
    }

    async getRecommendations(type = 'universities') {
        return this.request('GET', `${this.endpoints.discovery}/recommendations/${type}`);
    }

    async getTrendingContent() {
        return this.request('GET', this.endpoints.discovery + '/trending');
    }

    // ===== ANALYTICS & INSIGHTS =====
    
    async getAnalytics(timeframe = '30d') {
        return this.request('GET', `${this.endpoints.analytics}?timeframe=${timeframe}`);
    }

    async getPredictiveInsights() {
        return this.request('GET', this.endpoints.predictive + '/insights');
    }

    async getSuccessFactors() {
        return this.request('GET', this.endpoints.predictive + '/success-factors');
    }

    // ===== NOTIFICATIONS =====
    
    async getNotifications() {
        return this.request('GET', this.endpoints.notifications);
    }

    async markNotificationRead(notificationId) {
        return this.request('PUT', `${this.endpoints.notifications}/${notificationId}/read`);
    }

    async getReminders() {
        return this.request('GET', this.endpoints.reminders);
    }

    async createReminder(reminderData) {
        return this.request('POST', this.endpoints.reminders, reminderData);
    }

    // ===== SYSTEM HEALTH =====
    
    async getSystemHealth() {
        return this.request('GET', this.endpoints.health);
    }

    async getMetrics() {
        return this.request('GET', this.endpoints.metrics);
    }

    // ===== WEBSOCKET CONNECTIONS =====
    
    connectWebSocket(endpoint, onMessage) {
        const wsUrl = this.baseURL.replace('https://', 'wss://').replace('http://', 'ws://');
        const ws = new WebSocket(`${wsUrl}${endpoint}?token=${this.token}`);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        return ws;
    }

    // ===== GENERIC REQUEST METHOD =====
    
    async request(method, endpoint, data = null, customHeaders = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            ...customHeaders
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const config = {
            method,
            headers
        };
        
        if (data && method !== 'GET') {
            if (data instanceof FormData) {
                delete headers['Content-Type']; // Let browser set it for FormData
                config.body = data;
            } else {
                config.body = JSON.stringify(data);
            }
        }
        
        try {
            console.log(`🌐 API Request: ${method} ${url}`);
            
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error(`❌ API request failed: ${method} ${endpoint}`, error);
            throw error;
        }
    }

    // ===== UTILITY METHODS =====
    
    isAuthenticated() {
        return !!this.token;
    }

    getUserType() {
        return this.userType;
    }

    getUserId() {
        return this.userId;
    }
}

// Export for use in other modules
window.StellarRecAPI = StellarRecAPI;

// Create global instance
window.stellarAPI = new StellarRecAPI();