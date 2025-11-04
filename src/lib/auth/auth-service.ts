import { hash, compare } from 'bcrypt';
import { prisma } from '../db/client';
import type { User } from '@prisma/client';

const SALT_ROUNDS = 12;

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await compare(password, hashedPassword);
}

/**
 * Create a new user
 */
export async function createUser(
  input: CreateUserInput
): Promise<UserResponse> {
  const { email, password, name, role = 'user' } = input;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role,
    },
  });

  return toUserResponse(user);
}

/**
 * Find user by email
 */
export async function findUserByEmail(
  email: string
): Promise<User | null> {
  return await prisma.user.findUnique({
    where: { email },
  });
}

/**
 * Find user by ID
 */
export async function findUserById(id: string): Promise<UserResponse | null> {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  return user ? toUserResponse(user) : null;
}

/**
 * Validate user credentials
 */
export async function validateCredentials(
  email: string,
  password: string
): Promise<UserResponse | null> {
  const user = await findUserByEmail(email);

  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return toUserResponse(user);
}

/**
 * Update user profile
 */
export async function updateUser(
  id: string,
  data: Partial<Pick<User, 'name' | 'email'>>
): Promise<UserResponse> {
  const user = await prisma.user.update({
    where: { id },
    data,
  });

  return toUserResponse(user);
}

/**
 * Update user password
 */
export async function updatePassword(
  id: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const isValid = await verifyPassword(currentPassword, user.passwordHash);

  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<void> {
  await prisma.user.delete({
    where: { id },
  });
}

/**
 * Convert User model to UserResponse (exclude password hash)
 */
function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
