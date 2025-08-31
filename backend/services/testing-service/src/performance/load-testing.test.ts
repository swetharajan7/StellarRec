import axios from 'axios';
import { performance } from 'perf_hooks';

describe('Performance and Load Testing', () => {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
  const concurrentUsers = parseInt(process.env.CONCURRENT_USERS || '50');
  const testDuration = parseInt(process.env.TEST_DURATION || '60'); // seconds

  describe('API Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const startTime = performance.now();
      
      const response = await axios.get(`${baseUrl}/health`);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(100);
    });

    it('should handle user registration within 500ms', async () => {
      const userData = {
        email: `perf-test-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Performance',
        lastName: 'Test',
        role: 'student'
      };

      const startTime = performance.now();
      
      const response = await axios.post(`${baseUrl}/api/v1/users`, userData);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(201);
      expect(responseTime).toBeLessThan(500);
    });

    it('should handle user authentication within 200ms', async () => {
      // First create a user
      const userData = {
        email: `auth-perf-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Auth',
        lastName: 'Test',
        role: 'student'
      };

      await axios.post(`${baseUrl}/api/v1/users`, userData);

      // Then test authentication performance
      const startTime = performance.now();
      
      const response = await axios.post(`${baseUrl}/api/v1/auth/login`, {
        email: userData.email,
        password: userData.password
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(200);
    });

    it('should handle university search within 300ms', async () => {
      const searchQuery = {
        query: 'Computer Science',
        location: 'California',
        limit: 20
      };

      const startTime = performance.now();
      
      const response = await axios.post(`http://localhost:8000/api/v1/search/universities`, searchQuery);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(300);
    });

    it('should handle AI essay analysis within 2000ms', async () => {
      const essayData = {
        content: `
          My passion for computer science began in high school when I first learned to code.
          The ability to create something from nothing, to solve complex problems with elegant solutions,
          fascinated me. Through various projects and internships, I have developed both technical skills
          and a deep appreciation for the field's potential to make a positive impact on society.
        `,
        type: 'personal_statement'
      };

      const startTime = performance.now();
      
      const response = await axios.post(`http://localhost:8000/api/v1/essay/analyze`, essayData);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000);
    });
  });

  describe('Concurrent User Load Tests', () => {
    it('should handle concurrent user registrations', async () => {
      const promises = [];
      const results = [];
      
      for (let i = 0; i < concurrentUsers; i++) {
        const userData = {
          email: `load-test-${Date.now()}-${i}@example.com`,
          password: 'TestPassword123!',
          firstName: `User${i}`,
          lastName: 'LoadTest',
          role: 'student'
        };

        const promise = axios.post(`${baseUrl}/api/v1/users`, userData)
          .then(response => ({
            success: true,
            status: response.status,
            responseTime: response.headers['x-response-time'] || 0
          }))
          .catch(error => ({
            success: false,
            status: error.response?.status || 0,
            error: error.message
          }));

        promises.push(promise);
      }

      const startTime = performance.now();
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const successfulRequests = responses.filter(r => r.success).length;
      const successRate = (successfulRequests / concurrentUsers) * 100;
      
      console.log(`Load Test Results:`);
      console.log(`- Concurrent Users: ${concurrentUsers}`);
      console.log(`- Total Time: ${totalTime.toFixed(2)}ms`);
      console.log(`- Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`- Requests per Second: ${(concurrentUsers / (totalTime / 1000)).toFixed(2)}`);
      
      expect(successRate).toBeGreaterThan(95); // 95% success rate
      expect(totalTime).toBeLessThan(10000); // Complete within 10 seconds
    });

    it('should handle concurrent authentication requests', async () => {
      // First create users
      const users = [];
      for (let i = 0; i < Math.min(concurrentUsers, 20); i++) {
        const userData = {
          email: `auth-load-${Date.now()}-${i}@example.com`,
          password: 'TestPassword123!',
          firstName: `AuthUser${i}`,
          lastName: 'LoadTest',
          role: 'student'
        };
        
        await axios.post(`${baseUrl}/api/v1/users`, userData);
        users.push(userData);
      }

      // Then test concurrent authentication
      const promises = users.map(user => 
        axios.post(`${baseUrl}/api/v1/auth/login`, {
          email: user.email,
          password: user.password
        })
        .then(response => ({ success: true, status: response.status }))
        .catch(error => ({ success: false, status: error.response?.status || 0 }))
      );

      const startTime = performance.now();
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const successfulRequests = responses.filter(r => r.success).length;
      const successRate = (successfulRequests / users.length) * 100;
      
      expect(successRate).toBeGreaterThan(98); // 98% success rate for auth
      expect(totalTime).toBeLessThan(5000); // Complete within 5 seconds
    });

    it('should handle concurrent university search requests', async () => {
      const searchQueries = [
        { query: 'Computer Science', location: 'California' },
        { query: 'Engineering', location: 'New York' },
        { query: 'Business', location: 'Texas' },
        { query: 'Medicine', location: 'Massachusetts' },
        { query: 'Law', location: 'Illinois' }
      ];

      const promises = [];
      
      for (let i = 0; i < concurrentUsers; i++) {
        const query = searchQueries[i % searchQueries.length];
        
        const promise = axios.post(`http://localhost:8000/api/v1/search/universities`, query)
          .then(response => ({ success: true, status: response.status }))
          .catch(error => ({ success: false, status: error.response?.status || 0 }));
        
        promises.push(promise);
      }

      const startTime = performance.now();
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const successfulRequests = responses.filter(r => r.success).length;
      const successRate = (successfulRequests / concurrentUsers) * 100;
      
      expect(successRate).toBeGreaterThan(90); // 90% success rate for search
      expect(totalTime).toBeLessThan(15000); // Complete within 15 seconds
    });
  });

  describe('Database Performance Tests', () => {
    it('should handle large dataset queries efficiently', async () => {
      // Create test user first
      const userData = {
        email: `db-perf-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Database',
        lastName: 'Performance',
        role: 'student'
      };

      const userResponse = await axios.post(`${baseUrl}/api/v1/users`, userData);
      const userId = userResponse.data.data.id;

      // Get auth token
      const authResponse = await axios.post(`${baseUrl}/api/v1/auth/login`, {
        email: userData.email,
        password: userData.password
      });
      const token = authResponse.data.data.token;

      // Test large dataset query
      const startTime = performance.now();
      
      const response = await axios.get(`${baseUrl}/api/v1/users?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should complete within 1 second
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it('should handle complex search queries efficiently', async () => {
      const complexQuery = {
        filters: {
          gpa: { min: 3.0, max: 4.0 },
          satScore: { min: 1200, max: 1600 },
          location: ['California', 'New York', 'Massachusetts'],
          programs: ['Computer Science', 'Engineering'],
          tuition: { max: 60000 }
        },
        sort: 'matchScore',
        limit: 50
      };

      const startTime = performance.now();
      
      const response = await axios.post(`http://localhost:8000/api/v1/matching/universities`, complexQuery);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(800); // Complex queries should complete within 800ms
    });
  });

  describe('Memory and Resource Usage Tests', () => {
    it('should not have memory leaks during sustained load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate sustained load for 30 seconds
      const endTime = Date.now() + 30000;
      const requests = [];
      
      while (Date.now() < endTime) {
        const request = axios.get(`${baseUrl}/health`)
          .catch(() => {}); // Ignore errors for this test
        
        requests.push(request);
        
        // Limit concurrent requests to prevent overwhelming
        if (requests.length >= 10) {
          await Promise.all(requests);
          requests.length = 0;
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Wait for remaining requests
      await Promise.all(requests);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;
      
      console.log(`Memory Usage:`);
      console.log(`- Initial: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Final: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`- Increase: ${memoryIncreasePercent.toFixed(2)}%`);
      
      // Memory increase should be reasonable (less than 50%)
      expect(memoryIncreasePercent).toBeLessThan(50);
    });

    it('should handle file upload performance', async () => {
      // Create a test file buffer (1MB)
      const fileSize = 1024 * 1024; // 1MB
      const fileBuffer = Buffer.alloc(fileSize, 'test data');
      
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer]), 'test-file.txt');
      formData.append('type', 'essay');

      const startTime = performance.now();
      
      const response = await axios.post(`http://localhost:3013/api/v1/files/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
        timeout: 30000 // 30 second timeout
      });
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(5000); // 1MB file should upload within 5 seconds
    });
  });

  describe('Stress Testing', () => {
    it('should handle burst traffic', async () => {
      const burstSize = 100;
      const promises = [];
      
      // Create burst of requests
      for (let i = 0; i < burstSize; i++) {
        const promise = axios.get(`${baseUrl}/health`)
          .then(response => ({ success: true, status: response.status }))
          .catch(error => ({ success: false, status: error.response?.status || 0 }));
        
        promises.push(promise);
      }

      const startTime = performance.now();
      const responses = await Promise.all(promises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      const successfulRequests = responses.filter(r => r.success).length;
      const successRate = (successfulRequests / burstSize) * 100;
      
      console.log(`Burst Test Results:`);
      console.log(`- Burst Size: ${burstSize}`);
      console.log(`- Total Time: ${totalTime.toFixed(2)}ms`);
      console.log(`- Success Rate: ${successRate.toFixed(2)}%`);
      
      expect(successRate).toBeGreaterThan(85); // 85% success rate under burst
    });

    it('should recover from overload conditions', async () => {
      // Create overload condition
      const overloadPromises = [];
      for (let i = 0; i < 200; i++) {
        overloadPromises.push(
          axios.get(`${baseUrl}/health`).catch(() => {})
        );
      }

      // Wait for overload to complete
      await Promise.all(overloadPromises);
      
      // Wait for recovery
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Test normal operation after overload
      const startTime = performance.now();
      const response = await axios.get(`${baseUrl}/health`);
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      
      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(200); // Should recover to normal response times
    });
  });

  describe('Caching Performance Tests', () => {
    it('should demonstrate cache performance improvement', async () => {
      const searchQuery = {
        query: 'Computer Science',
        location: 'California'
      };

      // First request (cache miss)
      const startTime1 = performance.now();
      const response1 = await axios.post(`http://localhost:8000/api/v1/search/universities`, searchQuery);
      const endTime1 = performance.now();
      const responseTime1 = endTime1 - startTime1;

      // Second request (cache hit)
      const startTime2 = performance.now();
      const response2 = await axios.post(`http://localhost:8000/api/v1/search/universities`, searchQuery);
      const endTime2 = performance.now();
      const responseTime2 = endTime2 - startTime2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.data).toEqual(response2.data);
      
      // Cache hit should be significantly faster
      expect(responseTime2).toBeLessThan(responseTime1 * 0.5);
      
      console.log(`Cache Performance:`);
      console.log(`- Cache Miss: ${responseTime1.toFixed(2)}ms`);
      console.log(`- Cache Hit: ${responseTime2.toFixed(2)}ms`);
      console.log(`- Improvement: ${((responseTime1 - responseTime2) / responseTime1 * 100).toFixed(2)}%`);
    });
  });
});