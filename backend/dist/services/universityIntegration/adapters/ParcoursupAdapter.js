"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParcoursupAdapter = void 0;
const UniversityAdapter_1 = require("./UniversityAdapter");
const logger_1 = require("../../logger");
const axios_1 = __importDefault(require("axios"));
class ParcoursupAdapter extends UniversityAdapter_1.UniversityAdapter {
    constructor(authManager, rateLimiter) {
        super(authManager, rateLimiter);
        this.logger = new logger_1.Logger('ParcoursupAdapter');
        this.BASE_URL = 'https://api.parcoursup.fr/v1';
        this.httpClient = axios_1.default.create({
            baseURL: this.BASE_URL,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'StellarRec/1.0',
                'Accept': 'application/json',
                'Accept-Language': 'fr-FR,en-US'
            }
        });
        this.setupInterceptors();
    }
    setupInterceptors() {
        this.httpClient.interceptors.request.use(async (config) => {
            const auth = await this.authManager.getCredentials('parcoursup');
            if (auth?.apiKey) {
                config.headers['Authorization'] = `Bearer ${auth.apiKey}`;
            }
            return config;
        });
        this.httpClient.interceptors.response.use((response) => response, (error) => {
            this.logger.error('Parcoursup API error:', {
                status: error.response?.status,
                data: error.response?.data,
                url: error.config?.url
            });
            return Promise.reject(error);
        });
    }
    async submit(data) {
        try {
            await this.rateLimiter.checkRateLimit('parcoursup', data.university.universityId);
            const parcoursupPayload = this.transformToParcoursupFormat(data);
            this.logger.info(`Submitting candidature to Parcoursup for ${data.university.universityCode}`);
            const response = await this.httpClient.post('/candidatures', parcoursupPayload);
            if (response.status === 201 || response.status === 200) {
                return {
                    status: 'success',
                    submissionId: response.data.numero_candidature,
                    confirmationCode: response.data.code_confirmation,
                    metadata: {
                        parcoursupId: response.data.numero_candidature,
                        codeConfirmation: response.data.code_confirmation,
                        submittedAt: response.data.date_soumission,
                        phaseAdmission: response.data.phase_admission,
                        trackingUrl: `https://www.parcoursup.fr/candidat/suivi/${response.data.numero_candidature}`
                    }
                };
            }
            else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
        }
        catch (error) {
            this.logger.error(`Parcoursup submission failed for ${data.university.universityCode}:`, error);
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
            const response = await this.httpClient.get(`/candidatures/${submissionId}/statut`);
            return {
                status: this.mapParcoursupStatus(response.data.statut),
                lastUpdated: new Date(response.data.derniere_mise_a_jour),
                universityStatus: response.data.statut_etablissement,
                metadata: {
                    parcoursupStatus: response.data.statut,
                    phaseAdmission: response.data.phase_admission,
                    voeux: response.data.voeux,
                    propositions: response.data.propositions || [],
                    trackingUrl: response.data.url_suivi
                }
            };
        }
        catch (error) {
            this.logger.error(`Failed to get Parcoursup status for ${submissionId}:`, error);
            throw error;
        }
    }
    async testConnection(config) {
        try {
            const response = await this.httpClient.get('/sante');
            if (response.status !== 200) {
                throw new Error(`Health check failed with status ${response.status}`);
            }
        }
        catch (error) {
            throw new Error(`Parcoursup connection test failed: ${error.message}`);
        }
    }
    transformToParcoursupFormat(data) {
        return {
            candidat: {
                nom: data.student.lastName.toUpperCase(),
                prenom: data.student.firstName,
                date_naissance: data.student.dateOfBirth.toISOString().split('T')[0],
                lieu_naissance: data.student.placeOfBirth || data.student.address.city,
                nationalite: this.mapCountryToNationality(data.student.address.country),
                sexe: data.student.gender || 'M',
                adresse: {
                    ligne1: data.student.address.street,
                    ville: data.student.address.city,
                    code_postal: data.student.address.zipCode,
                    pays: data.student.address.country
                },
                contact: {
                    email: data.student.email,
                    telephone: data.student.phone
                }
            },
            scolarite: {
                baccalaureat: this.convertToBaccalaureat(data.student.academicInfo),
                etablissement_origine: {
                    nom: data.student.academicInfo.currentInstitution,
                    pays: data.student.address.country,
                    type: 'etablissement_etranger'
                },
                notes: this.convertGradesToFrenchSystem(data.student.academicInfo),
                diplomes_internationaux: this.mapInternationalQualifications(data.student.academicInfo)
            },
            voeux: this.formatVoeux(data.universities),
            projet_formation_motive: this.formatMotivationLetter(data.recommendationContent.content, data.university),
            lettre_recommandation: {
                auteur: {
                    nom: data.recommender.lastName,
                    prenom: data.recommender.firstName,
                    titre: data.recommender.title,
                    fonction: data.recommender.title,
                    etablissement: data.recommender.institution,
                    email: data.recommender.email,
                    telephone: data.recommender.phone
                },
                relation_candidat: this.mapRelationship(data.recommender.relationship),
                duree_connaissance: data.recommender.yearsKnown,
                contenu: this.formatFrenchRecommendation(data.recommendationContent.content),
                evaluation: this.generateFrenchEvaluation(data)
            },
            activites_centres_interet: this.formatActivities(data.student),
            experience_professionnelle: data.student.workExperience || [],
            competences_linguistiques: this.mapLanguageSkills(data.student.testScores),
            metadonnees: {
                plateforme_origine: 'StellarRec',
                type_candidature: 'internationale',
                annee_scolaire: this.determineAcademicYear(data.university.applicationDeadline),
                phase_candidature: this.determineApplicationPhase(data.university.applicationDeadline)
            }
        };
    }
    convertToBaccalaureat(academicInfo) {
        return {
            type: 'diplome_etranger',
            intitule: 'High School Diploma (USA)',
            annee_obtention: new Date(academicInfo.graduationDate).getFullYear(),
            mention: this.convertGPAToFrenchMention(academicInfo.gpa),
            notes: {
                moyenne_generale: this.convertGPAToFrenchGrade(academicInfo.gpa),
                systeme_notation: 'GPA_4.0'
            },
            equivalence_francaise: {
                type: 'baccalaureat_general',
                serie: this.mapMajorToFrenchSerie(academicInfo.major)
            }
        };
    }
    convertGPAToFrenchGrade(gpa) {
        return Math.round((gpa / 4.0) * 20 * 100) / 100;
    }
    convertGPAToFrenchMention(gpa) {
        if (gpa >= 3.8)
            return 'Très Bien';
        if (gpa >= 3.5)
            return 'Bien';
        if (gpa >= 3.0)
            return 'Assez Bien';
        return 'Passable';
    }
    mapMajorToFrenchSerie(major) {
        const serieMapping = {
            'Mathematics': 'S',
            'Physics': 'S',
            'Chemistry': 'S',
            'Biology': 'S',
            'Computer Science': 'S',
            'Engineering': 'S',
            'Economics': 'ES',
            'Business': 'ES',
            'History': 'L',
            'Literature': 'L',
            'Philosophy': 'L',
            'Languages': 'L'
        };
        return serieMapping[major] || 'S';
    }
    convertGradesToFrenchSystem(academicInfo) {
        return {
            moyenne_generale: this.convertGPAToFrenchGrade(academicInfo.gpa),
            systeme_origine: 'GPA_4.0',
            equivalence_francaise: this.convertGPAToFrenchGrade(academicInfo.gpa),
            rang_classe: academicInfo.classRank || null,
            effectif_classe: academicInfo.classSize || null
        };
    }
    mapInternationalQualifications(academicInfo) {
        const qualifications = [];
        if (academicInfo.testScores?.sat) {
            qualifications.push({
                type: 'SAT',
                score_total: academicInfo.testScores.sat.total,
                scores_detailles: academicInfo.testScores.sat,
                date_passage: academicInfo.testDate,
                organisme: 'College Board'
            });
        }
        if (academicInfo.testScores?.ap) {
            qualifications.push({
                type: 'Advanced Placement',
                scores: academicInfo.testScores.ap,
                organisme: 'College Board'
            });
        }
        return qualifications;
    }
    formatVoeux(universities) {
        return universities.map((uni, index) => ({
            numero_voeu: index + 1,
            code_formation: uni.formationCode || uni.universityCode,
            intitule_formation: uni.programName || uni.programType,
            etablissement: {
                code: uni.universityCode,
                nom: uni.universityName || uni.universityCode
            },
            campus: uni.campus || 'Principal',
            modalite: 'formation_initiale',
            avec_internat: false,
            date_limite_confirmation: uni.applicationDeadline
        }));
    }
    formatMotivationLetter(content, university) {
        const maxLength = 1500;
        let motivationLetter = `Projet de formation motivé pour ${university.universityName || university.universityCode}:\n\n`;
        motivationLetter += `Basé sur la recommandation fournie:\n\n${content}`;
        if (motivationLetter.length > maxLength) {
            motivationLetter = motivationLetter.substring(0, maxLength - 3) + '...';
        }
        return motivationLetter;
    }
    formatFrenchRecommendation(content) {
        return `Lettre de recommandation académique:\n\n${content}\n\nCette recommandation soutient la candidature de l'étudiant(e) dans le système d'enseignement supérieur français.`;
    }
    generateFrenchEvaluation(data) {
        return {
            capacites_academiques: 'Excellent',
            motivation: 'Très élevée',
            autonomie: 'Bonne',
            capacites_communication: 'Très bonnes',
            potentiel_reussite: 'Élevé',
            recommandation_globale: 'Fortement recommandé',
            commentaires_specifiques: 'Étudiant(e) avec un excellent potentiel pour les études supérieures en France'
        };
    }
    formatActivities(student) {
        const activities = [];
        if (student.extracurriculars) {
            activities.push(...student.extracurriculars.map((activity) => ({
                type: 'activite_extra_scolaire',
                intitule: activity.name,
                description: activity.description,
                duree: activity.duration,
                niveau_engagement: activity.level || 'moyen'
            })));
        }
        if (student.volunteering) {
            activities.push(...student.volunteering.map((vol) => ({
                type: 'benevolat',
                intitule: vol.organization,
                description: vol.description,
                duree: vol.duration
            })));
        }
        return activities;
    }
    mapLanguageSkills(testScores) {
        const skills = [
            {
                langue: 'anglais',
                niveau: 'langue_maternelle',
                certifications: []
            }
        ];
        if (testScores?.toefl) {
            skills[0].certifications.push({
                type: 'TOEFL',
                score: testScores.toefl.total,
                date_obtention: testScores.testDate
            });
        }
        if (testScores?.ielts) {
            skills[0].certifications.push({
                type: 'IELTS',
                score: testScores.ielts.total,
                date_obtention: testScores.testDate
            });
        }
        if (testScores?.delf || testScores?.dalf) {
            skills.push({
                langue: 'francais',
                niveau: testScores.delf ? 'B2' : 'C1',
                certifications: [{
                        type: testScores.delf ? 'DELF' : 'DALF',
                        niveau: testScores.delf?.level || testScores.dalf?.level,
                        date_obtention: testScores.testDate
                    }]
            });
        }
        return skills;
    }
    mapCountryToNationality(country) {
        const nationalityMap = {
            'US': 'américaine',
            'CA': 'canadienne',
            'GB': 'britannique',
            'DE': 'allemande',
            'ES': 'espagnole',
            'IT': 'italienne'
        };
        return nationalityMap[country] || 'étrangère';
    }
    mapRelationship(relationship) {
        const relationshipMap = {
            'Academic Advisor': 'conseiller_pedagogique',
            'Professor': 'professeur',
            'Teacher': 'enseignant',
            'Research Supervisor': 'directeur_recherche',
            'Department Head': 'chef_departement'
        };
        return relationshipMap[relationship] || 'enseignant';
    }
    determineAcademicYear(deadline) {
        const year = deadline.getFullYear();
        const month = deadline.getMonth();
        return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    }
    determineApplicationPhase(deadline) {
        const month = deadline.getMonth() + 1;
        if (month <= 3)
            return 'phase_principale';
        if (month <= 7)
            return 'phase_complementaire';
        return 'phase_exceptionnelle';
    }
    mapParcoursupStatus(parcoursupStatus) {
        const statusMap = {
            'soumise': 'pending',
            'en_cours_traitement': 'processing',
            'transmise_etablissements': 'submitted',
            'propositions_recues': 'success',
            'confirmee': 'confirmed',
            'refusee': 'failed',
            'retiree': 'cancelled'
        };
        return statusMap[parcoursupStatus] || 'pending';
    }
    isRetryableError(error) {
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
            return true;
        }
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        return error.response && retryableStatuses.includes(error.response.status);
    }
    async getSupportedFormations() {
        try {
            const response = await this.httpClient.get('/formations');
            return response.data.formations.map((formation) => ({
                code: formation.code_formation,
                name: formation.intitule,
                etablissement: formation.etablissement.nom,
                type: formation.type_formation
            }));
        }
        catch (error) {
            this.logger.error('Failed to get Parcoursup supported formations:', error);
            return [];
        }
    }
}
exports.ParcoursupAdapter = ParcoursupAdapter;
//# sourceMappingURL=ParcoursupAdapter.js.map