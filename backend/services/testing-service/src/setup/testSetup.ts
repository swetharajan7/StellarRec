import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Increase timeout for integration tests
  jest.setTimeout(30000);
  
  // Mock external services
  setupMocks();
});

afterAll(async () => {
  // Cleanup after all tests
  await cleanupTestData();
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

function setupMocks() {
  // Mock external APIs
  jest.mock('axios');
  
  // Mock database connections
  jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      },
      application: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
      }
    }))
  }));
  
  // Mock Redis
  jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      flushall: jest.fn(),
      quit: jest.fn()
    }));
  });
  
  // Mock file system operations
  jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    unlinkSync: jest.fn()
  }));
}

async function cleanupTestData() {
  // Cleanup test databases, files, etc.
  console.log('Cleaning up test data...');
}

// Global test utilities
global.testUtils = {
  createMockUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'student',
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  
  createMockApplication: () => ({
    id: 'test-app-id',
    userId: 'test-user-id',
    universityId: 'test-university-id',
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date()
  }),
  
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
};

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false
      };
    }
  },
  
  toBeValidEmail(received) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const pass = emailRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid email`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid email`,
        pass: false
      };
    }
  }
});

// Type declarations for global utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidEmail(): R;
    }
  }
  
  var testUtils: {
    createMockUser: () => any;
    createMockApplication: () => any;
    delay: (ms: number) => Promise<void>;
  };
}