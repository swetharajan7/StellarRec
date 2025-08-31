import request from 'supertest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import axios from 'axios';

describe('Service Integration Tests', () => {
  let postgresContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;
  
  beforeAll(async () => {
    // Start test containers
    postgresContainer = await new GenericContainer('postgres:15')
      .withEnvironment({
        POSTGRES_DB: 'stellarrec_test',
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test'
      })
      .withExposedPorts(5432)
      .start();

    redisContainer = await new GenericContainer('redis:7')
      .withExposedPorts(6379)
      .start();

    // Set environment variables for tests
    process.env.DATABASE_URL = `postgresql://test:test@localhost:${postgresContainer.getMappedPort(5432)}/stellarrec_test`;
    process.env.REDIS_URL = `redis://localhost:${redisContainer.getMappedPort(6379)}`;
  }, 60000);

  afterAll(async () => {
    await postgresContainer.stop();
    await redisContainer.stop();
  });

  describe('User Service Integration', () => {
    const userServiceUrl = 'http://localhost:3001';

    it('should create user and retrieve profile', async () => {
      const userData = {
        email: 'integration@test.com',
        password: 'password123',
        firstName: 'Integration',
        lastName: 'Test',
        role: 'student'
      };

      // Create user
      const createResponse = await axios.post(`${userServiceUrl}/api/v1/users`, userData);
      expect(createResponse.status).toBe(201);
      expect(createResponse.data.success).toBe(true);
      
      const userId = createResponse.data.data.id;
      expect(userId).toBeValidUUID();

      // Retrieve user
      const getResponse = await axios.get(`${userServiceUrl}/api/v1/users/${userId}`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.data.data.email).toBe(userData.email);
      expect(getResponse.data.data.firstName).toBe(userData.firstName);
    });

    it('should authenticate user and return JWT token', async () => {
      const credentials = {
        email: 'integration@test.com',
        password: 'password123'
      };

      const response = await axios.post(`${userServiceUrl}/api/v1/auth/login`, credentials);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('token');
      expect(response.data.data).toHaveProperty('user');
    });

    it('should create and update student profile', async () => {
      // First create a user
      const userData = {
        email: 'student@test.com',
        password: 'password123',
        firstName: 'Student',
        lastName: 'Test',
        role: 'student'
      };

      const userResponse = await axios.post(`${userServiceUrl}/api/v1/users`, userData);
      const userId = userResponse.data.data.id;

      // Create student profile
      const profileData = {
        gpa: 3.8,
        major: 'Computer Science',
        graduationYear: 2025,
        interests: ['AI', 'Web Development']
      };

      const profileResponse = await axios.post(
        `${userServiceUrl}/api/v1/users/${userId}/profile`,
        profileData
      );

      expect(profileResponse.status).toBe(201);
      expect(profileResponse.data.data.gpa).toBe(3.8);
      expect(profileResponse.data.data.major).toBe('Computer Science');

      // Update profile
      const updateData = { gpa: 3.9 };
      const updateResponse = await axios.put(
        `${userServiceUrl}/api/v1/users/${userId}/profile`,
        updateData
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.data.gpa).toBe(3.9);
    });
  });

  describe('Application Service Integration', () => {
    const applicationServiceUrl = 'http://localhost:3004';
    let authToken: string;
    let userId: string;

    beforeAll(async () => {
      // Create user and get auth token
      const userData = {
        email: 'apptest@test.com',
        password: 'password123',
        firstName: 'App',
        lastName: 'Test',
        role: 'student'
      };

      const userResponse = await axios.post('http://localhost:3001/api/v1/users', userData);
      userId = userResponse.data.data.id;

      const authResponse = await axios.post('http://localhost:3001/api/v1/auth/login', {
        email: userData.email,
        password: userData.password
      });
      authToken = authResponse.data.data.token;
    });

    it('should create and manage application lifecycle', async () => {
      const applicationData = {
        universityId: 'stanford-university',
        program: 'Computer Science',
        deadline: '2024-12-01',
        status: 'draft'
      };

      // Create application
      const createResponse = await axios.post(
        `${applicationServiceUrl}/api/v1/applications`,
        applicationData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(createResponse.status).toBe(201);
      expect(createResponse.data.success).toBe(true);
      
      const applicationId = createResponse.data.data.id;

      // Update application status
      const updateResponse = await axios.put(
        `${applicationServiceUrl}/api/v1/applications/${applicationId}`,
        { status: 'in_progress' },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.data.status).toBe('in_progress');

      // Get application
      const getResponse = await axios.get(
        `${applicationServiceUrl}/api/v1/applications/${applicationId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(getResponse.status).toBe(200);
      expect(getResponse.data.data.universityId).toBe(applicationData.universityId);
    });

    it('should track application progress', async () => {
      const applicationData = {
        universityId: 'mit-university',
        program: 'Engineering',
        deadline: '2024-11-15'
      };

      const createResponse = await axios.post(
        `${applicationServiceUrl}/api/v1/applications`,
        applicationData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      const applicationId = createResponse.data.data.id;

      // Get progress
      const progressResponse = await axios.get(
        `${applicationServiceUrl}/api/v1/applications/${applicationId}/progress`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(progressResponse.status).toBe(200);
      expect(progressResponse.data.data).toHaveProperty('percentage');
      expect(progressResponse.data.data).toHaveProperty('completedSteps');
      expect(progressResponse.data.data).toHaveProperty('totalSteps');
    });
  });

  describe('AI Service Integration', () => {
    const aiServiceUrl = 'http://localhost:8000';

    it('should get university matches for student profile', async () => {
      const studentProfile = {
        gpa: 3.8,
        satScore: 1450,
        interests: ['Computer Science', 'AI'],
        location: 'California',
        budget: 50000
      };

      const response = await axios.post(
        `${aiServiceUrl}/api/v1/matching/universities`,
        studentProfile
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data.matches)).toBe(true);
      expect(response.data.data.matches.length).toBeGreaterThan(0);
      
      const firstMatch = response.data.data.matches[0];
      expect(firstMatch).toHaveProperty('universityId');
      expect(firstMatch).toHaveProperty('matchScore');
      expect(firstMatch).toHaveProperty('explanation');
      expect(firstMatch.matchScore).toBeGreaterThan(0);
      expect(firstMatch.matchScore).toBeLessThanOrEqual(1);
    });

    it('should analyze essay content', async () => {
      const essayData = {
        content: `
          My passion for computer science began in high school when I first learned to code.
          The ability to create something from nothing, to solve complex problems with elegant solutions,
          fascinated me. Through various projects and internships, I have developed both technical skills
          and a deep appreciation for the field's potential to make a positive impact on society.
        `,
        type: 'personal_statement'
      };

      const response = await axios.post(
        `${aiServiceUrl}/api/v1/essay/analyze`,
        essayData
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('grammarScore');
      expect(response.data.data).toHaveProperty('styleScore');
      expect(response.data.data).toHaveProperty('clarityScore');
      expect(response.data.data).toHaveProperty('suggestions');
      expect(Array.isArray(response.data.data.suggestions)).toBe(true);
    });
  });

  describe('Notification Service Integration', () => {
    const notificationServiceUrl = 'http://localhost:3009';
    let authToken: string;

    beforeAll(async () => {
      // Get auth token
      const authResponse = await axios.post('http://localhost:3001/api/v1/auth/login', {
        email: 'apptest@test.com',
        password: 'password123'
      });
      authToken = authResponse.data.data.token;
    });

    it('should send email notification', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Notification',
        template: 'application_reminder',
        data: {
          studentName: 'Test Student',
          universityName: 'Test University',
          deadline: '2024-12-01'
        }
      };

      const response = await axios.post(
        `${notificationServiceUrl}/api/v1/email/send`,
        emailData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('messageId');
    });

    it('should manage notification preferences', async () => {
      const preferences = {
        email: true,
        sms: false,
        push: true,
        categories: {
          deadlines: true,
          updates: false,
          marketing: false
        }
      };

      const response = await axios.put(
        `${notificationServiceUrl}/api/v1/preferences`,
        preferences,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);

      // Get preferences
      const getResponse = await axios.get(
        `${notificationServiceUrl}/api/v1/preferences`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(getResponse.status).toBe(200);
      expect(getResponse.data.data.email).toBe(true);
      expect(getResponse.data.data.sms).toBe(false);
    });
  });

  describe('Cross-Service Data Flow', () => {
    let authToken: string;
    let userId: string;
    let applicationId: string;

    beforeAll(async () => {
      // Create user
      const userData = {
        email: 'crossservice@test.com',
        password: 'password123',
        firstName: 'Cross',
        lastName: 'Service',
        role: 'student'
      };

      const userResponse = await axios.post('http://localhost:3001/api/v1/users', userData);
      userId = userResponse.data.data.id;

      const authResponse = await axios.post('http://localhost:3001/api/v1/auth/login', {
        email: userData.email,
        password: userData.password
      });
      authToken = authResponse.data.data.token;
    });

    it('should complete full application workflow', async () => {
      // 1. Create student profile
      const profileData = {
        gpa: 3.7,
        satScore: 1400,
        major: 'Computer Science',
        interests: ['AI', 'Machine Learning']
      };

      await axios.post(
        `http://localhost:3001/api/v1/users/${userId}/profile`,
        profileData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      // 2. Get university matches
      const matchResponse = await axios.post(
        'http://localhost:8000/api/v1/matching/universities',
        profileData
      );

      expect(matchResponse.data.data.matches.length).toBeGreaterThan(0);
      const topMatch = matchResponse.data.data.matches[0];

      // 3. Create application
      const applicationData = {
        universityId: topMatch.universityId,
        program: 'Computer Science',
        deadline: '2024-12-01'
      };

      const appResponse = await axios.post(
        'http://localhost:3004/api/v1/applications',
        applicationData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      applicationId = appResponse.data.data.id;

      // 4. Analyze essay
      const essayData = {
        content: 'My passion for computer science drives my academic pursuits...',
        type: 'personal_statement'
      };

      const essayResponse = await axios.post(
        'http://localhost:8000/api/v1/essay/analyze',
        essayData
      );

      expect(essayResponse.data.success).toBe(true);

      // 5. Send notification
      const notificationData = {
        to: 'crossservice@test.com',
        subject: 'Application Created',
        template: 'application_created',
        data: {
          universityName: topMatch.name,
          deadline: applicationData.deadline
        }
      };

      const notificationResponse = await axios.post(
        'http://localhost:3009/api/v1/email/send',
        notificationData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(notificationResponse.data.success).toBe(true);
    });

    it('should handle service failures gracefully', async () => {
      // Test with invalid data to trigger error handling
      const invalidData = {
        universityId: 'non-existent-university',
        program: '',
        deadline: 'invalid-date'
      };

      try {
        await axios.post(
          'http://localhost:3004/api/v1/applications',
          invalidData,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      } catch (error) {
        expect(error.response.status).toBe(400);
        expect(error.response.data.success).toBe(false);
        expect(error.response.data.error).toBeDefined();
      }
    });
  });

  describe('Database Consistency', () => {
    it('should maintain referential integrity across services', async () => {
      // Create user
      const userData = {
        email: 'integrity@test.com',
        password: 'password123',
        firstName: 'Integrity',
        lastName: 'Test',
        role: 'student'
      };

      const userResponse = await axios.post('http://localhost:3001/api/v1/users', userData);
      const userId = userResponse.data.data.id;

      // Create application
      const authResponse = await axios.post('http://localhost:3001/api/v1/auth/login', {
        email: userData.email,
        password: userData.password
      });
      const authToken = authResponse.data.data.token;

      const applicationData = {
        universityId: 'test-university',
        program: 'Test Program',
        deadline: '2024-12-01'
      };

      const appResponse = await axios.post(
        'http://localhost:3004/api/v1/applications',
        applicationData,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      const applicationId = appResponse.data.data.id;

      // Verify user exists in application
      const getAppResponse = await axios.get(
        `http://localhost:3004/api/v1/applications/${applicationId}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(getAppResponse.data.data.userId).toBe(userId);

      // Try to delete user (should fail due to foreign key constraint)
      try {
        await axios.delete(
          `http://localhost:3001/api/v1/users/${userId}`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
      } catch (error) {
        expect(error.response.status).toBe(409); // Conflict due to foreign key
      }
    });
  });

  describe('Caching Integration', () => {
    it('should cache and retrieve data correctly', async () => {
      const studentProfile = {
        gpa: 3.8,
        satScore: 1450,
        interests: ['Computer Science']
      };

      // First request (should hit database)
      const response1 = await axios.post(
        'http://localhost:8000/api/v1/matching/universities',
        studentProfile
      );

      const startTime = Date.now();

      // Second request (should hit cache)
      const response2 = await axios.post(
        'http://localhost:8000/api/v1/matching/universities',
        studentProfile
      );

      const endTime = Date.now();

      expect(response1.data).toEqual(response2.data);
      expect(endTime - startTime).toBeLessThan(100); // Cache should be faster
    });
  });
});