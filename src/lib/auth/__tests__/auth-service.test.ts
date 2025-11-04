import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  hashPassword,
  verifyPassword,
  createUser,
  validateCredentials,
} from '../auth-service';
import { prisma } from '../../db/client';

// Mock Prisma client
jest.mock('../../db/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'TestPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for valid password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword('WrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await createUser({
        email: 'test@example.com',
        password: 'TestPassword123',
        name: 'Test User',
      });

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw error if user already exists', async () => {
      const existingUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);

      await expect(
        createUser({
          email: 'test@example.com',
          password: 'TestPassword123',
          name: 'Test User',
        })
      ).rejects.toThrow('User with this email already exists');
    });
  });

  describe('validateCredentials', () => {
    it('should return user for valid credentials', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: hash,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await validateCredentials('test@example.com', password);

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null for invalid password', async () => {
      const password = 'TestPassword123';
      const hash = await hashPassword(password);

      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: hash,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await validateCredentials(
        'test@example.com',
        'WrongPassword'
      );

      expect(result).toBeNull();
    });

    it('should return null for non-existent user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await validateCredentials(
        'test@example.com',
        'TestPassword123'
      );

      expect(result).toBeNull();
    });
  });
});
