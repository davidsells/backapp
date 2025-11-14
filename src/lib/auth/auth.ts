import { compare, hash } from 'bcrypt';
import type { User, LoginCredentials, AuthResponse } from '@/types/auth.types';
import { prisma } from '@/lib/db/prisma';

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}

/**
 * Authenticate a user with email and password
 */
export async function authenticateUser(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: credentials.email },
    });

    if (!user) {
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }

    const isValid = await verifyPassword(credentials.password, user.passwordHash);

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid credentials',
      };
    }

    // Remove passwordHash from user object
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      success: true,
      user: userWithoutPassword as User,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

/**
 * Create a new user
 */
export async function createUser(email: string, name: string, password: string, role: 'admin' | 'user' = 'user'): Promise<AuthResponse> {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        error: 'User already exists',
      };
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword,
        role,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      success: true,
      user: userWithoutPassword as User,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return {
      success: false,
      error: 'Failed to create user',
    };
  }
}
