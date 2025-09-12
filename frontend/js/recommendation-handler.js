/**
 * StellarRec Recommendation Handler
 * Handles the recommendation request workflow between students and recommenders
 */

class RecommendationHandler {
    constructor() {
        this.api = window.stellarAPI;
        this.currentView = 'student'; // 'student' or 'recommender'
        this.selectedUniversities = [];
        this.studentData = null;
        this.recommendationToken = null;
        
        this.init();
    }

    init() {
        console.log('🚀 Initializing Recommendation Handler...');
        
        // Check if we're in recommender mode with a token
        this.checkRecommenderToken();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI based on current view
        this.initializeView();
    }

    checkRecommenderToken() {
        // Check URL for recommendation token
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        const token = urlParams.get('token') || hashParams.get('token');
        
        if (token) {
            console.log('🔗 Recommendation token found in URL');
            this.recommendationToken = token;
            this.currentView = 'recommender';
            this.validateAndLoadRecommendationData(token);
        }
    }

    async validateAndLoadRecommendationData(token) {
        try {
            console.log('🔍 Validating recommendation token...');
            
            const response = await this.api.validateRecommendationToken(token);
            
            if (response.success) {
                console.log('✅ Token validated successfully');
                this.studentData = response.data;
                this.switchToRecommenderView();
                this.populateRecommenderForm();
            } else {
                console.error('❌ Token validation failed:', response.message);
                this.showError('Invalid or expired recommendation link');
            }
            
        } catch (error) {
            console.error('❌ Error validating token:', error);
            this.showError('Failed to validate recommendation link: ' + error.message);
        }
    }

    setupEventListeners() {
        // Student view: Send recommendation request
        const sendRequestBtn = document.getElementById('sendRecommendationRequest');
        if (sendRequestBtn) {
            sendRequestBtn.addEventListener('click', () => this.handleSendRecommendationRequest());
        }

        // Recommender view: Parse student link
        const linkParseBtn = document.getElementById('linkParseBtn');
        if (linkParseBtn) {
            linkParseBtn.addEventListener('click', () => this.handleParseStudentLink());
        }

        // Recommender view: Submit recommendation
        const submitRecommendationBtn = document.getElementById('submitRecommendation');
        if (submitRecommendationBtn) {
            submitRecommendationBtn.addEventListener('click', () => this.handleSubmitRecommendation());
        }

        // View switching
        const viewButtons = document.querySelectorAll('[data-view]');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.dataset.view;
                if (view) {
                    this.switchView(view);
                }
            });
        });

        // University selection in student view
        document.addEventListener('click', (e) => {
            if (e.target.matches('.university-card')) {
                this.toggleUniversitySelection(e.target);
            }
        });
    }

    initializeView() {
        if (this.currentView === 'recommender') {
            this.switchToRecommenderView();
        } else {
            this.switchToStudentView();
        }
    }

    switchView(view) {
        this.currentView = view;
        
        if (view === 'student') {
            this.switchToStudentView();
        } else if (view === 'recommender') {
            this.switchToRecommenderView();
        }
    }

    switchToStudentView() {
        console.log('👨‍🎓 Switching to student view');
        
        // Show student panel, hide recommender panel
        const studentPanel = document.getElementById('panel-student');
        const recommenderPanel = document.getElementById('panel-recommender');
        
        if (studentPanel) studentPanel.hidden = false;
        if (recommenderPanel) recommenderPanel.hidden = true;
        
        // Update navigation
        this.updateNavigation('student');
        
        // Load student data
        this.loadStudentRecommendations();
    }

    switchToRecommenderView() {
        console.log('👩‍🏫 Switching to recommender view');
        
        // Show recommender panel, hide student panel
        const studentPanel = document.getElementById('panel-student');
        const recommenderPanel = document.getElementById('panel-recommender');
        
        if (studentPanel) studentPanel.hidden = true;
        if (recommenderPanel) recommenderPanel.hidden = false;
        
        // Update navigation
        this.updateNavigation('recommender');
    }

    updateNavigation(activeView) {
        const navButtons = document.querySelectorAll('[data-view]');
        navButtons.forEach(btn => {
            const isActive = btn.dataset.view === activeView;
            btn.setAttribute('aria-selected', isActive);
            if (isActive) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    async handleSendRecommendationRequest() {
        try {
            console.log('📨 Handling recommendation request...');
            
            // Get form data
            const studentName = document.getElementById('studentName')?.value;
            const studentEmail = document.getElementById('studentEmail')?.value;
            const recommenderName = document.getElementById('recommenderName')?.value;
            const recommenderEmail = document.getElementById('recommenderEmail')?.value;
            const programName = document.getElementById('programName')?.value;
            
            // Validate required fields
            if (!studentName || !studentEmail || !recommenderEmail || !programName) {
                this.showError('Please fill in all required fields');
                return;
            }

            // Get selected universities
            if (this.selectedUniversities.length === 0) {
                this.showError('Please select at least one university');
                return;
            }

            // Send request for each selected university
            const requests = this.selectedUniversities.map(university => 
                this.api.sendRecommendationRequest({
                    studentName,
                    studentEmail,
                    recommenderName,
                    recommenderEmail,
                    programName,
                    universityName: university.name
                })
            );

            this.showLoading('Sending recommendation requests...');

            const results = await Promise.allSettled(requests);
            
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            this.hideLoading();

            if (successful > 0) {
                this.showSuccess(`Successfully sent ${successful} recommendation request(s)!`);
                
                if (failed > 0) {
                    this.showWarning(`${failed} request(s) failed to send`);
                }
                
                // Refresh the recommendations list
                this.loadStudentRecommendations();
                
                // Clear form
                this.clearRecommendationForm();
                
            } else {
                this.showError('Failed to send recommendation requests');
            }

        } catch (error) {
            console.error('❌ Error sending recommendation request:', error);
            this.hideLoading();
            this.showError('Failed to send recommendation request: ' + error.message);
        }
    }

    handleParseStudentLink() {
        const linkInput = document.getElementById('linkInput');
        const linkStatus = document.getElementById('linkStatus');
        const linkSummary = document.getElementById('linkSummary');
        
        if (!linkInput || !linkInput.value.trim()) {
            this.showError('Please paste a student link');
            return;
        }

        try {
            const url = new URL(linkInput.value.trim());
            const params = new URLSearchParams(url.search);
            
            // Extract student information
            const studentInfo = {
                firstName: params.get('sf') || '',
                lastName: params.get('sl') || '',
                email: params.get('se') || '',
                phone: params.get('sp') || '',
                waiver: params.get('waive') === '1',
                recommenderName: params.get('rname') || '',
                recommenderEmail: params.get('remail') || '',
                recommenderPhone: params.get('rphone') || ''
            };

            // Extract universities
            const uniIds = params.get('unis');
            const uniNames = params.get('unames');
            
            let universities = [];
            if (uniIds) {
                universities = uniIds.split(',').map(id => ({ id: id.trim(), name: `University ${id}` }));
            } else if (uniNames) {
                universities = uniNames.split(',').map(name => ({ name: name.trim() }));
            }

            // Update UI with parsed information
            if (linkStatus) {
                linkStatus.innerHTML = `
                    <div class="intake-status ok">
                        ✅ Link parsed successfully! Found information for ${studentInfo.firstName} ${studentInfo.lastName}
                    </div>
                `;
            }

            if (linkSummary) {
                linkSummary.innerHTML = `
                    <div class="ok">👤 Student: ${studentInfo.firstName} ${studentInfo.lastName}</div>
                    <div class="ok">📧 Email: ${studentInfo.email}</div>
                    ${studentInfo.phone ? `<div class="muted">📞 Phone: ${studentInfo.phone}</div>` : ''}
                    <div class="${studentInfo.waiver ? 'ok' : 'warn'}">
                        📋 FERPA Waiver: ${studentInfo.waiver ? 'Signed' : 'Not signed'}
                    </div>
                    <div class="ok">🏫 Universities: ${universities.length} selected</div>
                    ${universities.map(uni => `<div class="muted">  • ${uni.name}</div>`).join('')}
                `;
                linkSummary.hidden = false;
            }

            // Store parsed data for form population
            this.studentData = {
                studentName: `${studentInfo.firstName} ${studentInfo.lastName}`,
                studentEmail: studentInfo.email,
                universities: universities,
                waiver: studentInfo.waiver
            };

            this.showSuccess('Student link parsed successfully!');

        } catch (error) {
            console.error('❌ Error parsing student link:', error);
            
            if (linkStatus) {
                linkStatus.innerHTML = `
                    <div class="intake-status warn">
                        ⚠️ Invalid link format. Please check the link and try again.
                    </div>
                `;
            }
            
            this.showError('Invalid link format');
        }
    }

    async handleSubmitRecommendation() {
        try {
            console.log('📝 Handling recommendation submission...');
            
            // Get form data
            const recommenderName = document.getElementById('recommenderName')?.value;
            const recommenderTitle = document.getElementById('recommenderTitle')?.value;
            const recommenderOrganization = document.getElementById('recommenderOrganization')?.value;
            const letterContent = document.getElementById('letterContent')?.value;
            
            // Validate required fields
            if (!recommenderName || !letterContent) {
                this.showError('Please fill in your name and letter content');
                return;
            }

            if (!this.recommendationToken && !this.studentData) {
                this.showError('No valid recommendation request found');
                return;
            }

            this.showLoading('Submitting recommendation...');

            const submissionData = {
                token: this.recommendationToken,
                recommenderName,
                recommenderTitle,
                recommenderOrganization,
                letterType: 'written',
                letterContent
            };

            const response = await this.api.submitRecommendation(submissionData);

            this.hideLoading();

            if (response.success) {
                this.showSuccess('Recommendation submitted successfully! Thank you!');
                this.showSubmissionSuccess(response.data);
            } else {
                this.showError('Failed to submit recommendation: ' + response.message);
            }

        } catch (error) {
            console.error('❌ Error submitting recommendation:', error);
            this.hideLoading();
            this.showError('Failed to submit recommendation: ' + error.message);
        }
    }

    populateRecommenderForm() {
        if (!this.studentData) return;

        // Populate student information in the form
        const studentNameField = document.getElementById('studentNameDisplay');
        const studentEmailField = document.getElementById('studentEmailDisplay');
        const programField = document.getElementById('programDisplay');
        const universityField = document.getElementById('universityDisplay');

        if (studentNameField) studentNameField.textContent = this.studentData.studentName;
        if (studentEmailField) studentEmailField.textContent = this.studentData.studentEmail;
        if (programField) programField.textContent = this.studentData.programName;
        if (universityField) universityField.textContent = this.studentData.universityName;
    }

    async loadStudentRecommendations() {
        try {
            // Get student email (in a real app, this would come from authentication)
            const studentEmail = 'student@example.com'; // Replace with actual student email
            
            const response = await this.api.getStudentRecommendations(studentEmail);
            
            if (response.success) {
                this.renderStudentRecommendations(response.data);
            }
            
        } catch (error) {
            console.error('❌ Error loading student recommendations:', error);
        }
    }

    renderStudentRecommendations(recommendations) {
        const container = document.getElementById('recommendationsTable');
        if (!container) return;

        if (recommendations.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>No recommendation requests yet.</p>
                    <p>Send your first request using the form above!</p>
                </div>
            `;
            return;
        }

        const tableHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Recommender</th>
                        <th>University</th>
                        <th>Program</th>
                        <th>Status</th>
                        <th>Sent Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${recommendations.map(rec => `
                        <tr>
                            <td>
                                <div>
                                    <strong>${rec.recommender_name || rec.recommender_email}</strong>
                                    <br><small>${rec.recommender_email}</small>
                                </div>
                            </td>
                            <td>${rec.university_name}</td>
                            <td>${rec.program_name}</td>
                            <td>
                                <span class="track-pill ${rec.status}">
                                    ${this.getStatusText(rec.status)}
                                </span>
                            </td>
                            <td>${this.formatDate(rec.created_at)}</td>
                            <td>
                                ${rec.status === 'pending' ? 
                                    '<button class="btn btn-sm" onclick="this.resendRequest(\'' + rec.id + '\')">Resend</button>' : 
                                    '<span class="text-muted">—</span>'
                                }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHTML;
    }

    toggleUniversitySelection(card) {
        const isSelected = card.classList.contains('selected');
        const universityName = card.querySelector('.university-name')?.textContent;
        const universityId = card.dataset.universityId;

        if (isSelected) {
            // Remove from selection
            card.classList.remove('selected');
            this.selectedUniversities = this.selectedUniversities.filter(u => u.id !== universityId);
        } else {
            // Add to selection
            card.classList.add('selected');
            this.selectedUniversities.push({
                id: universityId,
                name: universityName
            });
        }

        this.updateSelectedUniversitiesDisplay();
    }

    updateSelectedUniversitiesDisplay() {
        const countElement = document.getElementById('selectedCount');
        const listElement = document.getElementById('selectedList');

        if (countElement) {
            countElement.textContent = `${this.selectedUniversities.length} universities selected`;
        }

        if (listElement) {
            listElement.innerHTML = this.selectedUniversities.map(uni => `
                <span class="selected-tag">
                    ${uni.name}
                    <span class="remove-tag" onclick="this.removeUniversitySelection('${uni.id}')">×</span>
                </span>
            `).join('');
        }
    }

    removeUniversitySelection(universityId) {
        // Remove from selected list
        this.selectedUniversities = this.selectedUniversities.filter(u => u.id !== universityId);
        
        // Update UI
        const card = document.querySelector(`[data-university-id="${universityId}"]`);
        if (card) {
            card.classList.remove('selected');
        }
        
        this.updateSelectedUniversitiesDisplay();
    }

    clearRecommendationForm() {
        const form = document.getElementById('recommendationForm');
        if (form) {
            form.reset();
        }
        
        // Clear university selections
        this.selectedUniversities = [];
        document.querySelectorAll('.university-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        
        this.updateSelectedUniversitiesDisplay();
    }

    showSubmissionSuccess(data) {
        const successSection = document.getElementById('successSection');
        if (successSection) {
            successSection.innerHTML = `
                <div class="success-section" style="display: block;">
                    <div class="success-icon">✅</div>
                    <h2 class="success-title">Recommendation Submitted!</h2>
                    <p class="success-subtitle">
                        Thank you for submitting your recommendation for ${data.studentName}.
                        Your letter has been securely sent for their ${data.programName} application at ${data.universityName}.
                    </p>
                    <p><small>Submission ID: ${data.submissionId}</small></p>
                </div>
            `;
        }
    }

    // Utility methods
    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending',
            'sent': 'Sent',
            'completed': 'Submitted',
            'expired': 'Expired'
        };
        return statusMap[status] || status;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }

    // UI feedback methods
    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showWarning(message) {
        this.showToast(message, 'warning');
    }

    showLoading(message) {
        // Show loading indicator
        const loadingEl = document.getElementById('loadingIndicator');
        if (loadingEl) {
            loadingEl.textContent = message;
            loadingEl.style.display = 'block';
        }
    }

    hideLoading() {
        const loadingEl = document.getElementById('loadingIndicator');
        if (loadingEl) {
            loadingEl.style.display = 'none';
        }
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="icon material-icons">${this.getToastIcon(type)}</span>
            <span class="msg">${message}</span>
            <button class="x" onclick="this.parentElement.remove()">×</button>
        `;

        // Add to toast container
        let toastContainer = document.querySelector('.toast-wrap');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-wrap';
            document.body.appendChild(toastContainer);
        }

        toastContainer.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            'success': 'check_circle',
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        return icons[type] || 'info';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.recommendationHandler = new RecommendationHandler();
});