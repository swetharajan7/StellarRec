import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// Mock the user service
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  studentProfile: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn()
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

jest.mock('bcrypt');

describe('User Service Unit Tests', () => {
  let userService: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Import the service after mocks are set up
    userService = require('../../user-service/src/services/userService');
  });

  describe('User Registration', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student'
      };

      const hashedPassword = 'hashed_password';
      const createdUser = {
        id: 'user-123',
        ...userData,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrisma.user.create.mockResolvedValue(createdUser);

      const result = await userService.createUser(userData);

      expect(bcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          ...userData,
          password: hashedPassword
        }
      });
      expect(result).toEqual(createdUser);
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student'
      };

      mockPrisma.user.create.mockRejectedValue(new Error('Unique constraint failed'));

      await expect(userService.createUser(userData)).rejects.toThrow('Unique constraint failed');
    });

    it('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student'
      };

      await expect(userService.createUser(userData)).rejects.toThrow('Invalid email format');
    });

    it('should validate password strength', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student'
      };

      await expect(userService.createUser(userData)).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('User Authentication', () => {
    it('should authenticate user with correct credentials', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashed_password';
      
      const user = {
        id: 'user-123',
        email,
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        role: 'student'
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await userService.authenticateUser(email, password);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email }
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toEqual(user);
    });

    it('should return null for incorrect password', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      
      const user = {
        id: 'user-123',
        email,
        password: 'hashed_password',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student'
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await userService.authenticateUser(email, password);

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.authenticateUser(email, password);

      expect(result).toBeNull();
    });
  });

  describe('User Profile Management', () => {
    it('should update user profile successfully', async () => {
      const userId = 'user-123';
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      const updatedUser = {
        id: userId,
        email: 'test@example.com',
        ...updateData,
        role: 'student',
        updatedAt: new Date()
      };

      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser(userId, updateData);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData
      });
      expect(result).toEqual(updatedUser);
    });

    it('should get user by ID', async () => {
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student'
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await userService.getUserById(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: {
          studentProfile: true,
          recommenderProfile: true
        }
      });
      expect(result).toEqual(user);
    });

    it('should return null for non-existent user ID', async () => {
      const userId = 'non-existent';

      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await userService.getUserById(userId);

      expect(result).toBeNull();
    });
  });

  describe('Student Profile Management', () => {
    it('should create student profile', async () => {
      const userId = 'user-123';
      const profileData = {
        gpa: 3.8,
        major: 'Computer Science',
        graduationYear: 2024,
        interests: ['AI', 'Web Development']
      };

      const createdProfile = {
        id: 'profile-123',
        userId,
        ...profileData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.studentProfile.create.mockResolvedValue(createdProfile);

      const result = await userService.createStudentProfile(userId, profileData);

      expect(mockPrisma.studentProfile.create).toHaveBeenCalledWith({
        data: {
          userId,
          ...profileData
        }
      });
      expect(result).toEqual(createdProfile);
    });

    it('should validate GPA range', async () => {
      const userId = 'user-123';
      const profileData = {
        gpa: 5.0, // Invalid GPA
        major: 'Computer Science',
        graduationYear: 2024
      };

      await expect(userService.createStudentProfile(userId, profileData))
        .rejects.toThrow('GPA must be between 0.0 and 4.0');
    });

    it('should validate graduation year', async () => {
      const userId = 'user-123';
      const profileData = {
        gpa: 3.8,
        major: 'Computer Science',
        graduationYear: 2020 // Past year
      };

      await expect(userService.createStudentProfile(userId, profileData))
        .rejects.toThrow('Graduation year must be in the future');
    });
  });

  describe('User Search and Filtering', () => {
    it('should search users by email', async () => {
      const searchTerm = 'john';
      const users = [
        {
          id: 'user-1',
          email: 'john@example.com',
          firstName: 'John',
          lastName: 'Doe'
        },
        {
          id: 'user-2',
          email: 'johnny@example.com',
          firstName: 'Johnny',
          lastName: 'Smith'
        }
      ];

      mockPrisma.user.findMany.mockResolvedValue(users);

      const result = await userService.searchUsers(searchTerm);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: searchTerm, mode: 'insensitive' } },
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        take: 50
      });
      expect(result).toEqual(users);
    });

    it('should filter users by role', async () => {
      const role = 'student';
      const students = [
        {
          id: 'user-1',
          email: 'student1@example.com',
          role: 'student'
        },
        {
          id: 'user-2',
          email: 'student2@example.com',
          role: 'student'
        }
      ];

      mockPrisma.user.findMany.mockResolvedValue(students);

      const result = await userService.getUsersByRole(role);

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { role },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toEqual(students);
    });
  });

  describe('Password Reset', () => {
    it('should generate password reset token', async () => {
      const email = 'test@example.com';
      const user = {
        id: 'user-123',
        email,
        firstName: 'John',
        lastName: 'Doe'
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue({
        ...user,
        resetToken: 'reset-token-123',
        resetTokenExpiry: new Date(Date.now() + 3600000)
      });

      const result = await userService.generatePasswordResetToken(email);

      expect(result).toHaveProperty('resetToken');
      expect(result.resetToken).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should reset password with valid token', async () => {
      const token = 'valid-token';
      const newPassword = 'newpassword123';
      const hashedPassword = 'hashed_new_password';

      const user = {
        id: 'user-123',
        resetToken: token,
        resetTokenExpiry: new Date(Date.now() + 1800000) // 30 minutes from now
      };

      mockPrisma.user.findFirst.mockResolvedValue(user);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrisma.user.update.mockResolvedValue({
        ...user,
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      });

      const result = await userService.resetPassword(token, newPassword);

      expect(result).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null
        }
      });
    });

    it('should reject expired reset token', async () => {
      const token = 'expired-token';
      const newPassword = 'newpassword123';

      const user = {
        id: 'user-123',
        resetToken: token,
        resetTokenExpiry: new Date(Date.now() - 3600000) // 1 hour ago
      };

      mockPrisma.user.findFirst.mockResolvedValue(user);

      await expect(userService.resetPassword(token, newPassword))
        .rejects.toThrow('Reset token has expired');
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields', async () => {
      const incompleteData = {
        email: 'test@example.com',
        // Missing password, firstName, lastName, role
      };

      await expect(userService.createUser(incompleteData))
        .rejects.toThrow('Missing required fields');
    });

    it('should sanitize input data', async () => {
      const userData = {
        email: '  TEST@EXAMPLE.COM  ',
        password: 'password123',
        firstName: '  John  ',
        lastName: '  Doe  ',
        role: 'student'
      };

      const hashedPassword = 'hashed_password';
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'student',
        password: hashedPassword
      });

      await userService.createUser(userData);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          firstName: 'John',
          lastName: 'Doe',
          role: 'student'
        }
      });
    });
  });
});