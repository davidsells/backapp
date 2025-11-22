import bcrypt from 'bcrypt';
import { prisma } from '@/lib/db/client';
import { RegisterData, User } from '@/lib/types/auth.types';

const SALT_ROUNDS = 10;

class AuthService {
  /**
   * Hash a password using bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify a password against a hash
   */
  private async verifyPassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Register a new user
   */
  async registerUser(data: RegisterData): Promise<User> {
    // Get app settings to check if approval is required
    const settings = await prisma.appSettings.findFirst();
    const requireApproval = settings?.requireApproval ?? true;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    if (data.password.length < 12) {
      throw new Error('Password must be at least 12 characters long');
    }

    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(data.password);
    const hasLowerCase = /[a-z]/.test(data.password);
    const hasNumber = /[0-9]/.test(data.password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      throw new Error('Password must contain uppercase, lowercase, and numbers');
    }

    // Hash password
    const passwordHash = await this.hashPassword(data.password);

    // Create user (approved=false if approval required)
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        role: 'user',
        approved: !requireApproval, // Auto-approve if not required
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user as User;
  }

  /**
   * Validate user credentials and return user if valid
   */
  async validateCredentials(
    email: string,
    password: string
  ): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    // Check if user is soft-deleted
    if (user.deletedAt) {
      return null;
    }

    // Check if user is suspended
    if (user.suspended) {
      throw new Error('Your account has been suspended. Please contact an administrator.');
    }

    // Check if user is approved
    if (!user.approved) {
      throw new Error('Your account is pending approval. Please contact an administrator.');
    }

    const isValid = await this.verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'admin' | 'user',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return null;
    }

    return user as User;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return null;
    }

    return user as User;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    data: { name?: string; email?: string }
  ): Promise<User> {
    // If email is being updated, check if it's already in use
    if (data.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new Error('Email is already in use');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user as User;
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await this.verifyPassword(
      currentPassword,
      user.passwordHash
    );

    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (newPassword.length < 12) {
      throw new Error('New password must be at least 12 characters long');
    }

    // Check for password complexity
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      throw new Error('New password must contain uppercase, lowercase, and numbers');
    }

    // Hash and update password
    const passwordHash = await this.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}

export const authService = new AuthService();
