"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UACAdapter = void 0;
const UniversityAdapter_1 = require("./UniversityAdapter");
const logger_1 = require("../../logger");
const axios_1 = __importDefault(require("axios"));
class UACAdapter extends UniversityAdapter_1.UniversityAdapter {
    constructor(authManager, rateLimiter) {
        super(authManager, rateLimiter);
        this.logger = new logger_1.Logger('UACAdapter');
        this.BASE_URL = 'https://api.uac.edu.au/v1';
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
            const auth = await this.authManager.getCredentials('uac');
            if (auth?.apiKey) {
                config.headers['Authorization'] = `Bearer ${auth.apiKey}`;
            }
            return config;
        });
        this.httpClient.interceptors.response.use((response) => response, (error) => {
            this.logger.error('UAC API error:', {
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url
            });
            return Promise.reject(error);
        });
    }
    async submit(data) {
        try {
            await this.rateLimiter.checkRateLimit('uac', data.university.universityId);
            const uacPayload = this.transformToUACFormat(data);
            this.logger.info(`Submitting application to UAC for ${data.university.universityCode}`);
            const response = await this.httpClient.post('/applications', uacPayload);
            if (response.status === 201 || response.status === 200) {
                return {
                    status: 'success',
                    submissionId: response.data.uac_application_number,
                    confirmationCode: response.data.confirmation_code,
                    metadata: {
                        uacNumber: response.data.uac_application_number,
                        confirmationCode: response.data.confirmation_code,
                        submittedAt: response.data.submitted_at,
                        atarEquivalent: response.data.atar_equivalent,
                        trackingUrl: `https://www.uac.edu.au/applicants/track/${response.data.uac_application_number}`,
                        admissionCenter: response.data.admission_center
                    }
                };
            }
            else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        }
        catch (error) {
            this.logger.error(`UAC submission failed for ${data.university.universityCode}:`, error);
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
                status: this.mapUACStatus(response.data.status),
                lastUpdated: new Date(response.data.last_updated),
                universityStatus: response.data.university_status,
                metadata: {
                    uacStatus: response.data.status,
                    admissionCenter: response.data.admission_center,
                    preferences: response.data.preferences,
                    offers: response.data.offers || [],
                    atarEquivalent: response.data.atar_equivalent,
                    trackingUrl: response.data.tracking_url
                }
            };
        }
        catch (error) {
            this.logger.error(`Failed to get UAC status for ${submissionId}:`, error);
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
            throw new Error(`UAC connection test failed: ${error.message}`);
        }
    }
    transformToUACFormat(data) {
        return {
            applicant: {
                given_names: data.student.firstName,
                family_name: data.student.lastName,
                date_of_birth: data.student.dateOfBirth.toISOString().split('T')[0],
                gender: data.student.gender || 'M',
                country_of_birth: data.student.countryOfBirth || data.student.address.country,
                citizenship: this.mapCitizenship(data.student.citizenship || data.student.address.country),
                permanent_resident: data.student.permanentResident || false,
                indigenous_status: data.student.indigenousStatus || 'not_indigenous',
                contact_details: {
                    email: data.student.email,
                    phone: data.student.phone,
                    address: {
                        street: data.student.address.street,
                        suburb: data.student.address.city,
                        state: this.mapStateCode(data.student.address.state),
                        postcode: data.student.address.zipCode,
                        country: data.student.address.country
                    }
                }
            },
            education: {
                current_studies: {
                    institution: data.student.academicInfo.currentInstitution,
                    qualification: this.mapUSQualificationToAustralian(data.student.academicInfo.major),
                    completion_year: new Date(data.student.academicInfo.graduationDate).getFullYear(),
                    gpa: data.student.academicInfo.gpa,
                    gpa_scale: '4.0'
                },
                international_qualifications: this.mapInternationalQualifications(data.student.academicInfo),
                atar_equivalent: this.calculateATAREquivalent(data.student.academicInfo.gpa),
                english_proficiency: this.mapEnglishProficiency(data.student.testScores),
                previous_tertiary_study: data.student.previousStudy || []
            },
            preferences: this.formatPreferences(data.universities),
            supporting_documents: {
                academic_referee_report: {
                    referee_details: {
                        title: data.recommender.title,
                        given_names: data.recommender.firstName,
                        family_name: data.recommender.lastName,
                        position: data.recommender.title,
                        institution: data.recommender.institution,
                        email: data.recommender.email,
                        phone: data.recommender.phone,
                        relationship: this.mapRelationship(data.recommender.relationship),
                        years_known: data.recommender.yearsKnown
                    },
                    report_content: this.formatAustralianReference(data.recommendationContent.content),
                    academic_assessment: this.generateAcademicAssessment(data),
                    recommendation_level: this.generateRecommendationLevel(data.student.academicInfo.gpa)
                },
                personal_statement: this.formatPersonalStatement(data.recommendationContent.content),
                portfolio: data.student.portfolio || null
            },
            special_consideration: {
                educational_disadvantage: data.student.educationalDisadvantage || false,
                financial_hardship: data.student.financialHardship || false,
                disability: data.student.disability || false,
                rural_remote_location: data.student.ruralRemote || false,
                details: data.student.specialCircumstances || null
            },
            work_experience: data.student.workExperience || [],
            achievements: data.student.achievements || [],
            extracurricular_activities: data.student.extracurriculars || [],
            application_metadata: {
                application_type: 'international',
                fee_category: 'international',
                entry_year: this.determineEntryYear(data.university.applicationDeadline),
                entry_semester: this.determineEntrySemester(data.university.applicationDeadline),
                admission_center: this.determineAdmissionCenter(data.university.universityCode),
                source_platform: 'StellarRec',
                application_pathway: 'direct_entry'
            }
        };
    }
    mapUSQualificationToAustralian(major) {
        return `Bachelor's Degree in ${major} (USA)`;
    }
    mapInternationalQualifications(academicInfo) {
        const qualifications = [];
        if (academicInfo.testScores?.sat) {
            qualifications.push({
                qualification_type: 'SAT',
                awarding_body: 'College Board',
                total_score: academicInfo.testScores.sat.total,
                component_scores: {
                    evidence_based_reading_writing: academicInfo.testScores.sat.ebrw,
                    mathematics: academicInfo.testScores.sat.math
                },
                completion_date: academicInfo.testDate,
                atar_equivalent: this.convertSATToATAR(academicInfo.testScores.sat.total)
            });
        }
        if (academicInfo.testScores?.act) {
            qualifications.push({
                qualification_type: 'ACT',
                awarding_body: 'ACT Inc',
                composite_score: academicInfo.testScores.act.composite,
                component_scores: academicInfo.testScores.act,
                completion_date: academicInfo.testDate,
                atar_equivalent: this.convertACTToATAR(academicInfo.testScores.act.composite)
            });
        }
        if (academicInfo.testScores?.ap) {
            qualifications.push({
                qualification_type: 'Advanced Placement',
                awarding_body: 'College Board',
                subjects: academicInfo.testScores.ap,
                completion_date: academicInfo.testDate
            });
        }
        return qualifications;
    }
    calculateATAREquivalent(gpa) {
        const atarMapping = {
            '4.0': 99.95,
            '3.9': 99.0,
            '3.8': 95.0,
            '3.7': 90.0,
            '3.5': 85.0,
            '3.3': 80.0,
            '3.0': 75.0,
            '2.7': 70.0,
            '2.5': 65.0,
            '2.0': 60.0
        };
        const gpaStr = gpa.toFixed(1);
        if (atarMapping[gpaStr]) {
            return atarMapping[gpaStr];
        }
        const gpaKeys = Object.keys(atarMapping).map(parseFloat).sort((a, b) => b - a);
        for (let i = 0; i < gpaKeys.length - 1; i++) {
            if (gpa <= gpaKeys[i] && gpa >= gpaKeys[i + 1]) {
                const upperGPA = gpaKeys[i];
                const lowerGPA = gpaKeys[i + 1];
                const upperATAR = atarMapping[upperGPA.toString()];
                const lowerATAR = atarMapping[lowerGPA.toString()];
                const ratio = (gpa - lowerGPA) / (upperGPA - lowerGPA);
                return Math.round((lowerATAR + ratio * (upperATAR - lowerATAR)) * 100) / 100;
            }
        }
        return 50.0;
    }
    convertSATToATAR(satScore) {
        if (satScore >= 1550)
            return 99.95;
        if (satScore >= 1500)
            return 99.0;
        if (satScore >= 1450)
            return 95.0;
        if (satScore >= 1400)
            return 90.0;
        if (satScore >= 1350)
            return 85.0;
        if (satScore >= 1300)
            return 80.0;
        if (satScore >= 1250)
            return 75.0;
        if (satScore >= 1200)
            return 70.0;
        if (satScore >= 1150)
            return 65.0;
        return 60.0;
    }
    convertACTToATAR(actScore) {
        if (actScore >= 35)
            return 99.95;
        if (actScore >= 34)
            return 99.0;
        if (actScore >= 32)
            return 95.0;
        if (actScore >= 30)
            return 90.0;
        if (actScore >= 28)
            return 85.0;
        if (actScore >= 26)
            return 80.0;
        if (actScore >= 24)
            return 75.0;
        if (actScore >= 22)
            return 70.0;
        if (actScore >= 20)
            return 65.0;
        return 60.0;
    }
    mapEnglishProficiency(testScores) {
        if (testScores?.ielts) {
            return {
                test_type: 'IELTS',
                overall_score: testScores.ielts.total,
                component_scores: {
                    listening: testScores.ielts.listening,
                    reading: testScores.ielts.reading,
                    writing: testScores.ielts.writing,
                    speaking: testScores.ielts.speaking
                },
                meets_requirement: testScores.ielts.total >= 6.5
            };
        }
        if (testScores?.toefl) {
            return {
                test_type: 'TOEFL iBT',
                total_score: testScores.toefl.total,
                component_scores: {
                    reading: testScores.toefl.reading,
                    listening: testScores.toefl.listening,
                    speaking: testScores.toefl.speaking,
                    writing: testScores.toefl.writing
                },
                meets_requirement: testScores.toefl.total >= 79
            };
        }
        return {
            test_type: 'Native Speaker',
            meets_requirement: true,
            exemption_reason: 'Native English speaker from USA'
        };
    }
    formatPreferences(universities) {
        return universities.map((uni, index) => ({
            preference_number: index + 1,
            institution_code: uni.universityCode,
            course_code: uni.courseCode || 'TBD',
            course_title: uni.courseName || uni.programType,
            campus: uni.campus || 'Main',
            study_mode: 'full_time',
            entry_basis: 'atar_equivalent',
            special_requirements: uni.specialRequirements || null
        }));
    }
    formatAustralianReference(content) {
        return `Academic Referee Report:\n\n${content}\n\nThis report supports the applicant's admission to Australian higher education institutions.`;
    }
    formatPersonalStatement(content) {
        const maxLength = 2000;
        let statement = `Personal Statement (based on academic recommendation):\n\n${content}`;
        if (statement.length > maxLength) {
            statement = statement.substring(0, maxLength - 3) + '...';
        }
        return statement;
    }
    generateAcademicAssessment(data) {
        return {
            academic_ability: 'Excellent',
            work_ethic: 'Outstanding',
            communication_skills: 'Very Good',
            leadership_potential: 'Good',
            research_aptitude: 'Excellent',
            overall_recommendation: 'Highly Recommended'
        };
    }
    generateRecommendationLevel(gpa) {
        if (gpa >= 3.8)
            return 'Outstanding';
        if (gpa >= 3.5)
            return 'Highly Recommended';
        if (gpa >= 3.2)
            return 'Recommended';
        if (gpa >= 3.0)
            return 'Satisfactory';
        return 'Conditional';
    }
    mapCitizenship(country) {
        const citizenshipMap = {
            'US': 'USA',
            'CA': 'Canada',
            'GB': 'United Kingdom',
            'AU': 'Australia',
            'NZ': 'New Zealand'
        };
        return citizenshipMap[country] || country;
    }
    mapStateCode(state) {
        const stateMap = {
            'New South Wales': 'NSW',
            'Victoria': 'VIC',
            'Queensland': 'QLD',
            'South Australia': 'SA',
            'Western Australia': 'WA',
            'Tasmania': 'TAS',
            'Northern Territory': 'NT',
            'Australian Capital Territory': 'ACT'
        };
        return stateMap[state] || state;
    }
    mapRelationship(relationship) {
        const relationshipMap = {
            'Academic Advisor': 'academic_advisor',
            'Professor': 'professor',
            'Teacher': 'teacher',
            'Research Supervisor': 'research_supervisor',
            'Department Head': 'department_head'
        };
        return relationshipMap[relationship] || 'teacher';
    }
    determineEntryYear(deadline) {
        const year = deadline.getFullYear();
        const month = deadline.getMonth();
        return month >= 10 ? year + 1 : year;
    }
    determineEntrySemester(deadline) {
        const month = deadline.getMonth() + 1;
        if (month <= 6)
            return 'Semester 1';
        return 'Semester 2';
    }
    determineAdmissionCenter(universityCode) {
        const centerMap = {
            'USYD': 'UAC', 'UNSW': 'UAC', 'UTS': 'UAC', 'MQ': 'UAC',
            'UMELB': 'VTAC', 'MONASH': 'VTAC', 'RMIT': 'VTAC', 'DEAKIN': 'VTAC',
            'UQ': 'QTAC', 'QUT': 'QTAC', 'GRIFFITH': 'QTAC',
            'ADELAIDE': 'SATAC', 'UNISA': 'SATAC', 'FLINDERS': 'SATAC',
            'UWA': 'TISC', 'CURTIN': 'TISC', 'MURDOCH': 'TISC'
        };
        return centerMap[universityCode] || 'UAC';
    }
    mapUACStatus(uacStatus) {
        const statusMap = {
            'submitted': 'pending',
            'processing': 'processing',
            'offers_made': 'success',
            'offer_accepted': 'confirmed',
            'offer_declined': 'failed',
            'withdrawn': 'cancelled',
            'unsuccessful': 'failed'
        };
        return statusMap[uacStatus] || 'pending';
    }
    isRetryableError(error) {
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return true;
        }
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return error.response && retryableStatuses.includes(error.response.status);
    }
    async getSupportedInstitutions() {
        try {
            const response = await this.httpClient.get('/institutions');
            return response.data.institutions.map((inst) => ({
                code: inst.institution_code,
                name: inst.institution_name,
                state: inst.state,
                admissionCenter: inst.admission_center
            }));
        }
        catch (error) {
            this.logger.error('Failed to get UAC supported institutions:', error);
            return [];
        }
    }
}
exports.UACAdapter = UACAdapter;
//# sourceMappingURL=UACAdapter.js.map