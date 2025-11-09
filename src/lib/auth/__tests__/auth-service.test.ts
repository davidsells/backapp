import { authService } from '../auth-service';
import { prisma } from '@/lib/db/client';
import bcrypt from 'bcrypt';

// Mock Prisma
jest.mock('@/lib/db/client', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    appSettings: {
      findFirst: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock('bcrypt');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should successfully register a new user', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.appSettings.findFirst as jest.Mock).mockResolvedValue({ requireApproval: false });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.registerUser({
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePass123',
      });

      expect(result).toEqual({
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw error if user already exists', async () => {
      (prisma.appSettings.findFirst as jest.Mock).mockResolvedValue({ requireApproval: false });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '123',
        email: 'test@example.com',
      });

      await expect(
        authService.registerUser({
          email: 'test@example.com',
          name: 'Test User',
          password: 'SecurePass123',
        })
      ).rejects.toThrow('User with this email already exists');
    });

    it('should throw error if password is too short', async () => {
      (prisma.appSettings.findFirst as jest.Mock).mockResolvedValue({ requireApproval: false });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.registerUser({
          email: 'test@example.com',
          name: 'Test User',
          password: 'short',
        })
      ).rejects.toThrow('Password must be at least 12 characters long');
    });

    it('should throw error if password lacks uppercase', async () => {
      (prisma.appSettings.findFirst as jest.Mock).mockResolvedValue({ requireApproval: false });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.registerUser({
          email: 'test@example.com',
          name: 'Test User',
          password: 'lowercase123',
        })
      ).rejects.toThrow('Password must contain uppercase, lowercase, and numbers');
    });

    it('should throw error if password lacks lowercase', async () => {
      (prisma.appSettings.findFirst as jest.Mock).mockResolvedValue({ requireApproval: false });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.registerUser({
          email: 'test@example.com',
          name: 'Test User',
          password: 'UPPERCASE123',
        })
      ).rejects.toThrow('Password must contain uppercase, lowercase, and numbers');
    });

    it('should throw error if password lacks numbers', async () => {
      (prisma.appSettings.findFirst as jest.Mock).mockResolvedValue({ requireApproval: false });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.registerUser({
          email: 'test@example.com',
          name: 'Test User',
          password: 'NoNumbersHere',
        })
      ).rejects.toThrow('Password must contain uppercase, lowercase, and numbers');
    });
  });

  describe('validateCredentials', () => {
    it('should return user if credentials are valid', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed_password',
        role: 'user',
        approved: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.validateCredentials(
        'test@example.com',
        'SecurePass123'
      );

      expect(result).toEqual({
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should return null if user does not exist', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await authService.validateCredentials(
        'test@example.com',
        'SecurePass123'
      );

      expect(result).toBeNull();
    });

    it('should return null if password is invalid', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        approved: true,
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await authService.validateCredentials(
        'test@example.com',
        'wrongpassword'
      );

      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('should return user if found', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.getUserById('123');

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await authService.getUserById('999');

      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should successfully update user profile', async () => {
      const mockUser = {
        id: '123',
        email: 'newemail@example.com',
        name: 'New Name',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.updateUserProfile('123', {
        name: 'New Name',
        email: 'newemail@example.com',
      });

      expect(result).toEqual(mockUser);
    });

    it('should throw error if email is already in use', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '456',
        email: 'existing@example.com',
      });

      await expect(
        authService.updateUserProfile('123', {
          email: 'existing@example.com',
        })
      ).rejects.toThrow('Email is already in use');
    });
  });

  describe('changePassword', () => {
    it('should successfully change password', async () => {
      const mockUser = {
        id: '123',
        passwordHash: 'old_hashed_password',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await authService.changePassword('123', 'OldPassword1', 'NewPassword123');

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.changePassword('999', 'OldPassword1', 'NewPassword123')
      ).rejects.toThrow('User not found');
    });

    it('should throw error if current password is incorrect', async () => {
      const mockUser = {
        id: '123',
        passwordHash: 'old_hashed_password',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.changePassword('123', 'WrongPassword1', 'NewPassword123')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error if new password is too short', async () => {
      const mockUser = {
        id: '123',
        passwordHash: 'old_hashed_password',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        authService.changePassword('123', 'OldPassword1', 'short')
      ).rejects.toThrow('New password must be at least 12 characters long');
    });

    it('should throw error if new password lacks complexity', async () => {
      const mockUser = {
        id: '123',
        passwordHash: 'old_hashed_password',
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        authService.changePassword('123', 'OldPassword1', 'nocomplexity')
      ).rejects.toThrow('New password must contain uppercase, lowercase, and numbers');
    });
  });
});
