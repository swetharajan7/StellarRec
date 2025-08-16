import { UniversityAdapter, AdapterSubmissionData, AdapterSubmissionResult } from './UniversityAdapter';
import { AuthenticationManager } from '../AuthenticationManager';
import { RateLimiter } from '../RateLimiter';
import { Logger } from '../../logger';
import axios, { AxiosInstance } from 'axios';

/**
 * Parcoursup Adapter (France)
 * Handles submissions to 300+ French universities through the Parcoursup system
 * 
 * Integration covers:
 * - Grandes Écoles (École Polytechnique, HEC Paris, INSEAD)
 * - Public universities (Sorbonne, Sciences Po, École Normale Supérieure)
 * - Engineering schools (CentraleSupélec, Mines ParisTech)
 * - Business schools and specialized institutions
 */
export class ParcoursupAdapter extends UniversityAdapter {
  private logger = new Logger('ParcoursupAdapter');
  private httpClient: AxiosInstance;
  private readonly BASE_URL = 'https://api.parcoursup.fr/v1';

  constructor(authManager: AuthenticationManager, rateLimiter: RateLimiter) {
    super(authManager, rateLimiter);
    
    this.httpClient = axios.create({
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

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.httpClient.interceptors.request.use(async (config) => {
      const auth = await this.authManager.getCredentials('parcoursup');
      if (auth?.apiKey) {
        config.headers['Authorization'] = `Bearer ${auth.apiKey}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        this.logger.error('Parcoursup API error:', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }

  async submit(data: AdapterSubmissionData): Promise<AdapterSubmissionResult> {
    try {
      // Check rate limits
      await this.rateLimiter.checkRateLimit('parcoursup', data.university.universityId);

      // Transform StellarRec data to Parcoursup format
      const parcoursupPayload = this.transformToParcoursupFormat(data);

      // Submit candidature
      this.logger.info(`Submitting candidature to Parcoursup for ${data.university.universityCode}`);
      
      const response = await this.httpClient.post('/candidatures', parcoursupPayload);

      // Handle response
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
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }

    } catch (error) {
      this.logger.error(`Parcoursup submission failed for ${data.university.universityCode}:`, error);

      // Determine if this is a retryable error
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

  async getSubmissionStatus(submissionId: string): Promise<{
    status: string;
    lastUpdated: Date;
    universityStatus?: string;
    metadata: Record<string, any>;
  }> {
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
    } catch (error) {
      this.logger.error(`Failed to get Parcoursup status for ${submissionId}:`, error);
      throw error;
    }
  }

  async testConnection(config: any): Promise<void> {
    try {
      const response = await this.httpClient.get('/sante');
      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Parcoursup connection test failed: ${error.message}`);
    }
  }

  private transformToParcoursupFormat(data: AdapterSubmissionData): any {
    return {
      // Informations du candidat
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

      // Scolarité et diplômes
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

      // Vœux (course choices)
      voeux: this.formatVoeux(data.universities),

      // Projet de formation motivé (motivation letter)
      projet_formation_motive: this.formatMotivationLetter(data.recommendationContent.content, data.university),

      // Lettre de recommandation
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

      // Activités et centres d'intérêt
      activites_centres_interet: this.formatActivities(data.student),

      // Expérience professionnelle
      experience_professionnelle: data.student.workExperience || [],

      // Compétences linguistiques
      competences_linguistiques: this.mapLanguageSkills(data.student.testScores),

      // Métadonnées de candidature
      metadonnees: {
        plateforme_origine: 'StellarRec',
        type_candidature: 'internationale',
        annee_scolaire: this.determineAcademicYear(data.university.applicationDeadline),
        phase_candidature: this.determineApplicationPhase(data.university.applicationDeadline)
      }
    };
  }

  private convertToBaccalaureat(academicInfo: any): any {
    // Convert US high school diploma to French Baccalauréat equivalent
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

  private convertGPAToFrenchGrade(gpa: number): number {
    // Convert 4.0 GPA scale to French 20-point scale
    return Math.round((gpa / 4.0) * 20 * 100) / 100;
  }

  private convertGPAToFrenchMention(gpa: number): string {
    if (gpa >= 3.8) return 'Très Bien';
    if (gpa >= 3.5) return 'Bien';
    if (gpa >= 3.0) return 'Assez Bien';
    return 'Passable';
  }

  private mapMajorToFrenchSerie(major: string): string {
    const serieMapping: Record<string, string> = {
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

    return serieMapping[major] || 'S'; // Default to Scientific
  }

  private convertGradesToFrenchSystem(academicInfo: any): any {
    return {
      moyenne_generale: this.convertGPAToFrenchGrade(academicInfo.gpa),
      systeme_origine: 'GPA_4.0',
      equivalence_francaise: this.convertGPAToFrenchGrade(academicInfo.gpa),
      rang_classe: academicInfo.classRank || null,
      effectif_classe: academicInfo.classSize || null
    };
  }

  private mapInternationalQualifications(academicInfo: any): any[] {
    const qualifications = [];

    // Add SAT scores
    if (academicInfo.testScores?.sat) {
      qualifications.push({
        type: 'SAT',
        score_total: academicInfo.testScores.sat.total,
        scores_detailles: academicInfo.testScores.sat,
        date_passage: academicInfo.testDate,
        organisme: 'College Board'
      });
    }

    // Add AP scores
    if (academicInfo.testScores?.ap) {
      qualifications.push({
        type: 'Advanced Placement',
        scores: academicInfo.testScores.ap,
        organisme: 'College Board'
      });
    }

    return qualifications;
  }

  private formatVoeux(universities: any[]): any[] {
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

  private formatMotivationLetter(content: string, university: any): string {
    // Format as French "Projet de formation motivé"
    const maxLength = 1500; // Parcoursup limit
    
    let motivationLetter = `Projet de formation motivé pour ${university.universityName || university.universityCode}:\n\n`;
    motivationLetter += `Basé sur la recommandation fournie:\n\n${content}`;
    
    if (motivationLetter.length > maxLength) {
      motivationLetter = motivationLetter.substring(0, maxLength - 3) + '...';
    }

    return motivationLetter;
  }

  private formatFrenchRecommendation(content: string): string {
    return `Lettre de recommandation académique:\n\n${content}\n\nCette recommandation soutient la candidature de l'étudiant(e) dans le système d'enseignement supérieur français.`;
  }

  private generateFrenchEvaluation(data: AdapterSubmissionData): any {
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

  private formatActivities(student: any): any[] {
    const activities = [];

    if (student.extracurriculars) {
      activities.push(...student.extracurriculars.map((activity: any) => ({
        type: 'activite_extra_scolaire',
        intitule: activity.name,
        description: activity.description,
        duree: activity.duration,
        niveau_engagement: activity.level || 'moyen'
      })));
    }

    if (student.volunteering) {
      activities.push(...student.volunteering.map((vol: any) => ({
        type: 'benevolat',
        intitule: vol.organization,
        description: vol.description,
        duree: vol.duration
      })));
    }

    return activities;
  }

  private mapLanguageSkills(testScores: any): any[] {
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

    // Add French if applicable
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

  private mapCountryToNationality(country: string): string {
    const nationalityMap: Record<string, string> = {
      'US': 'américaine',
      'CA': 'canadienne',
      'GB': 'britannique',
      'DE': 'allemande',
      'ES': 'espagnole',
      'IT': 'italienne'
    };

    return nationalityMap[country] || 'étrangère';
  }

  private mapRelationship(relationship: string): string {
    const relationshipMap: Record<string, string> = {
      'Academic Advisor': 'conseiller_pedagogique',
      'Professor': 'professeur',
      'Teacher': 'enseignant',
      'Research Supervisor': 'directeur_recherche',
      'Department Head': 'chef_departement'
    };

    return relationshipMap[relationship] || 'enseignant';
  }

  private determineAcademicYear(deadline: Date): string {
    const year = deadline.getFullYear();
    const month = deadline.getMonth();
    
    // French academic year starts in September
    return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  private determineApplicationPhase(deadline: Date): string {
    const month = deadline.getMonth() + 1;
    
    if (month <= 3) return 'phase_principale';
    if (month <= 7) return 'phase_complementaire';
    return 'phase_exceptionnelle';
  }

  private mapParcoursupStatus(parcoursupStatus: string): string {
    const statusMap: Record<string, string> = {
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

  private isRetryableError(error: any): boolean {
    // Network errors are retryable
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }

    // HTTP status codes that are retryable
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    return error.response && retryableStatuses.includes(error.response.status);
  }

  /**
   * Get list of formations supported by Parcoursup
   */
  async getSupportedFormations(): Promise<Array<{
    code: string;
    name: string;
    etablissement: string;
    type: string;
  }>> {
    try {
      const response = await this.httpClient.get('/formations');
      return response.data.formations.map((formation: any) => ({
        code: formation.code_formation,
        name: formation.intitule,
        etablissement: formation.etablissement.nom,
        type: formation.type_formation
      }));
    } catch (error) {
      this.logger.error('Failed to get Parcoursup supported formations:', error);
      return [];
    }
  }
}