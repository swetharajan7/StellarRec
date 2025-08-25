"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UCASAdapter = void 0;
const UniversityAdapter_1 = require("./UniversityAdapter");
const logger_1 = require("../../logger");
const axios_1 = __importDefault(require("axios"));
class UCASAdapter extends UniversityAdapter_1.UniversityAdapter {
    constructor(authManager, rateLimiter) {
        super(authManager, rateLimiter);
        this.logger = new logger_1.Logger('UCASAdapter');
        this.BASE_URL = 'https://api.ucas.com/v1';
        this.httpClient = axios_1.default.create({
            baseURL: this.BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'StellarRec/1.0',
                'Accept': 'application/json'
            }
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.httpClient.interceptors.request.use(async (config) => {
            const auth = await this.authManager.getCredentials('ucas');
            if (auth?.apiKey) {
                config.headers['Authorization'] = `Bearer ${auth.apiKey}`;
            }
            return config;
        });
        this.httpClient.interceptors.response.use((response) => response, (error) => {
            this.logger.error('UCAS API error:', {
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url
            });
            return Promise.reject(error);
        });
    }
    async submit(data) {
        try {
            await this.rateLimiter.checkRateLimit('ucas', data.university.universityId);
            const ucasPayload = this.transformToUCASFormat(data);
            this.logger.info(`Submitting application to UCAS for ${data.university.universityCode}`);
            const response = await this.httpClient.post('/applications', ucasPayload);
            if (response.status === 201 || response.status === 200) {
                return {
                    status: 'success',
                    submissionId: response.data.application_id,
                    confirmationCode: response.data.ucas_reference,
                    metadata: {
                        ucasId: response.data.application_id,
                        ucasReference: response.data.ucas_reference,
                        submittedAt: response.data.submitted_at,
                        trackingUrl: `https://track.ucas.com/${response.data.application_id}`,
                        applicationCycle: response.data.application_cycle,
                        courseChoices: response.data.course_choices
                    }
                };
            }
            else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        }
        catch (error) {
            this.logger.error(`UCAS submission failed for ${data.university.universityCode}:`, error);
            const isRetryable = this.isRetryableError(error);
            return {
                status: isRetryable ? 'retry' : 'failed',
                errorMessage: error.message,
                metadata: {
                    errorCode: error.response?.status,
                    errorDetails: error.response?.data,
                    isRetryable
                }
            };
        }
    }
    async getSubmissionStatus(submissionId) {
        try {
            const response = await this.httpClient.get(`/applications/${submissionId}/status`);
            return {
                status: this.mapUCASStatus(response.data.status),
                lastUpdated: new Date(response.data.last_updated),
                universityStatus: response.data.university_status,
                metadata: {
                    ucasStatus: response.data.status,
                    applicationCycle: response.data.application_cycle,
                    courseChoices: response.data.course_choices,
                    offers: response.data.offers || [],
                    trackingUrl: response.data.tracking_url
                }
            };
        }
        catch (error) {
            this.logger.error(`Failed to get UCAS status for ${submissionId}:`, error);
            throw error;
        }
    }
    async testConnection(config) {
        try {
            const response = await this.httpClient.get('/health');
            if (response.status !== 200) {
                throw new Error(`Health check failed with status ${response.status}`);
            }
        }
        catch (error) {
            throw new Error(`UCAS connection test failed: ${error.message}`);
        }
    }
    transformToUCASFormat(data) {
        return {
            personal_details: {
                title: this.extractTitle(data.student.firstName),
                first_name: data.student.firstName,
                surname: data.student.lastName,
                date_of_birth: data.student.dateOfBirth.toISOString().split('T')[0],
                nationality: data.student.nationality || 'US',
                country_of_birth: data.student.countryOfBirth || 'US',
                gender: data.student.gender,
                email: data.student.email,
                phone: data.student.phone,
                address: {
                    line1: data.student.address.street,
                    city: data.student.address.city,
                    postcode: data.student.address.zipCode,
                    country: data.student.address.country
                }
            },
            education: {
                qualifications: this.convertToUKQualifications(data.student.academicInfo),
                predicted_grades: this.generatePredictedGrades(data.student.academicInfo),
                english_language_qualification: this.mapEnglishProficiency(data.student.testScores),
                previous_study: {
                    institution: data.student.academicInfo.currentInstitution,
                    qualification: this.mapUSQualificationToUK(data.student.academicInfo.major),
                    grade: this.convertGPAToUKGrade(data.student.academicInfo.gpa)
                }
            },
            personal_statement: this.formatPersonalStatement(data.recommendationContent.content),
            reference: {
                referee_details: {
                    title: data.recommender.title,
                    first_name: data.recommender.firstName,
                    surname: data.recommender.lastName,
                    position: data.recommender.title,
                    institution: data.recommender.institution,
                    email: data.recommender.email,
                    phone: data.recommender.phone,
                    relationship: data.recommender.relationship,
                    years_known: data.recommender.yearsKnown
                },
                reference_text: this.formatUKReference(data.recommendationContent.content),
                academic_assessment: this.generateAcademicAssessment(data),
                predicted_performance: this.generatePredictedPerformance(data)
            },
            course_choices: this.formatCourseChoices(data.universities),
            additional_information: {
                work_experience: data.student.workExperience || [],
                extracurricular_activities: data.student.extracurriculars || [],
                achievements: data.student.achievements || [],
                special_circumstances: data.student.specialCircumstances
            },
            application_metadata: {
                application_route: 'international',
                fee_status: 'international',
                entry_year: this.determineEntryYear(data.university.applicationDeadline),
                application_cycle: this.determineApplicationCycle(data.university.applicationDeadline),
                source_platform: 'StellarRec'
            }
        };
    }
    convertToUKQualifications(academicInfo) {
        const qualifications = [];
        if (academicInfo.gpa) {
            const aLevelGrades = this.convertGPAToALevels(academicInfo.gpa);
            qualifications.push({
                qualification_type: 'A Level',
                awarding_body: 'International Equivalent',
                subjects: aLevelGrades,
                completion_date: academicInfo.graduationDate
            });
        }
        if (academicInfo.testScores?.sat) {
            qualifications.push({
                qualification_type: 'SAT',
                awarding_body: 'College Board',
                total_score: academicInfo.testScores.sat.total,
                breakdown: academicInfo.testScores.sat,
                completion_date: academicInfo.testDate
            });
        }
        if (academicInfo.testScores?.act) {
            qualifications.push({
                qualification_type: 'ACT',
                awarding_body: 'ACT Inc',
                composite_score: academicInfo.testScores.act.composite,
                breakdown: academicInfo.testScores.act,
                completion_date: academicInfo.testDate
            });
        }
        return qualifications;
    }
    convertGPAToALevels(gpa) {
        const gradeMapping = {
            4.0: 'A*', 3.7: 'A', 3.3: 'B', 3.0: 'C', 2.7: 'D', 2.0: 'E'
        };
        const grade = Object.entries(gradeMapping)
            .find(([minGpa]) => gpa >= parseFloat(minGpa))?.[1] || 'U';
        return [
            { subject: 'Mathematics', grade, level: 'A2' },
            { subject: 'English Literature', grade, level: 'A2' },
            { subject: this.mapMajorToALevelSubject(gpa), grade, level: 'A2' }
        ];
    }
    mapMajorToALevelSubject(major) {
        const majorMapping = {
            'Computer Science': 'Computer Science',
            'Engineering': 'Physics',
            'Business': 'Economics',
            'Biology': 'Biology',
            'Chemistry': 'Chemistry',
            'Physics': 'Physics',
            'Mathematics': 'Further Mathematics',
            'Psychology': 'Psychology',
            'History': 'History',
            'English': 'English Literature'
        };
        return majorMapping[major] || 'General Studies';
    }
    formatPersonalStatement(content) {
        const maxLength = 4000;
        let personalStatement = `Based on the recommendation provided:\n\n${content}`;
        if (personalStatement.length > maxLength) {
            personalStatement = personalStatement.substring(0, maxLength - 3) + '...';
        }
        return personalStatement;
    }
    formatUKReference(content) {
        return `Academic Reference:\n\n${content}\n\nThis reference supports the student's application to UK higher education institutions.`;
    }
    generateAcademicAssessment(data) {
        return {
            academic_ability: 'Excellent',
            motivation: 'High',
            communication_skills: 'Very Good',
            independent_learning: 'Excellent',
            time_management: 'Good',
            overall_recommendation: 'Strongly Recommended'
        };
    }
    generatePredictedPerformance(data) {
        const gpa = data.student.academicInfo.gpa;
        const predictedGrade = this.convertGPAToUKGrade(gpa);
        return {
            predicted_degree_classification: predictedGrade,
            confidence_level: 'High',
            basis_for_prediction: 'Based on current academic performance and standardized test scores'
        };
    }
    convertGPAToUKGrade(gpa) {
        if (gpa >= 3.7)
            return 'First Class Honours';
        if (gpa >= 3.3)
            return 'Upper Second Class Honours';
        if (gpa >= 3.0)
            return 'Lower Second Class Honours';
        if (gpa >= 2.7)
            return 'Third Class Honours';
        return 'Pass';
    }
    formatCourseChoices(universities) {
        return universities.map((uni, index) => ({
            choice_number: index + 1,
            institution_code: uni.universityCode,
            course_code: uni.courseCode || 'TBD',
            course_title: uni.courseTitle || uni.programType,
            campus_code: uni.campusCode || 'MAIN',
            entry_year: this.determineEntryYear(uni.applicationDeadline),
            application_deadline: uni.applicationDeadline
        }));
    }
    determineEntryYear(deadline) {
        const year = deadline.getFullYear();
        const month = deadline.getMonth();
        return month >= 9 ? year + 1 : year;
    }
    determineApplicationCycle(deadline) {
        const year = this.determineEntryYear(deadline);
        return `${year - 1}/${year}`;
    }
    generatePredictedGrades(academicInfo) {
        const gpa = academicInfo.gpa;
        const grade = this.convertGPAToALevels(gpa)[0].grade;
        return [
            { subject: 'Mathematics', predicted_grade: grade },
            { subject: 'English', predicted_grade: grade },
            { subject: this.mapMajorToALevelSubject(academicInfo.major), predicted_grade: grade }
        ];
    }
    mapEnglishProficiency(testScores) {
        if (testScores?.toefl) {
            return {
                qualification_type: 'TOEFL',
                score: testScores.toefl.total,
                meets_requirement: testScores.toefl.total >= 90
            };
        }
        if (testScores?.ielts) {
            return {
                qualification_type: 'IELTS',
                score: testScores.ielts.total,
                meets_requirement: testScores.ielts.total >= 6.5
            };
        }
        return {
            qualification_type: 'Native Speaker',
            meets_requirement: true
        };
    }
    extractTitle(firstName) {
        const titles = ['Mr', 'Ms', 'Mrs', 'Miss', 'Dr', 'Prof'];
        for (const title of titles) {
            if (firstName.toLowerCase().startsWith(title.toLowerCase())) {
                return title;
            }
        }
        return 'Mr';
    }
    mapUSQualificationToUK(major) {
        return `Bachelor's Degree in ${major}`;
    }
    mapUCASStatus(ucasStatus) {
        const statusMap = {
            'submitted': 'pending',
            'processing': 'processing',
            'sent_to_universities': 'submitted',
            'offers_received': 'success',
            'confirmed': 'confirmed',
            'declined': 'failed',
            'withdrawn': 'cancelled'
        };
        return statusMap[ucasStatus] || 'pending';
    }
    isRetryableError(error) {
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return true;
        }
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return error.response && retryableStatuses.includes(error.response.status);
    }
    async getSupportedUniversities() {
        try {
            const response = await this.httpClient.get('/institutions');
            return response.data.institutions.map((uni) => ({
                code: uni.institution_code,
                name: uni.institution_name,
                country: 'GB',
                programTypes: uni.available_courses || ['undergraduate']
            }));
        }
        catch (error) {
            this.logger.error('Failed to get UCAS supported universities:', error);
            return [];
        }
    }
    async validateUniversitySupport(universityCode, programType) {
        try {
            const response = await this.httpClient.get(`/institutions/${universityCode}/requirements`);
            const supportsProgram = response.data.available_programs.includes(programType);
            return {
                supported: supportsProgram,
                requirements: response.data.entry_requirements,
                deadlines: response.data.application_deadlines
            };
        }
        catch (error) {
            this.logger.error(`Failed to validate UCAS support for ${universityCode}:`, error);
            return { supported: false };
        }
    }
}
exports.UCASAdapter = UCASAdapter;
//# sourceMappingURL=UCASAdapter.js.map