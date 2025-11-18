import { prisma } from '../db/prisma';

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  approved: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class UserManagementService {
  /**
   * Get all users (including soft-deleted)
   */
  async getAllUsers(includeDeleted = false): Promise<UserInfo[]> {
    const users = await prisma.user.findMany({
      where: includeDeleted ? {} : { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      approved: user.approved,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  /**
   * Get pending users (not approved)
   */
  async getPendingUsers(): Promise<UserInfo[]> {
    const users = await prisma.user.findMany({
      where: {
        approved: false,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user: any) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      approved: user.approved,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  }

  /**
   * Approve a user
   */
  async approveUser(userId: string): Promise<UserInfo> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { approved: true },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      approved: user.approved,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Reject a user (soft delete immediately)
   */
  async rejectUser(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Soft delete a user
   */
  async softDeleteUser(userId: string): Promise<UserInfo> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      approved: user.approved,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Restore a soft-deleted user
   */
  async restoreUser(userId: string): Promise<UserInfo> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      approved: user.approved,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: string): Promise<UserInfo> {
    if (!['user', 'admin'].includes(role)) {
      throw new Error('Invalid role. Must be "user" or "admin"');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      approved: user.approved,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    const [total, active, pending, deleted, admins] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { approved: true, deletedAt: null } }),
      prisma.user.count({ where: { approved: false, deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: { not: null } } }),
      prisma.user.count({ where: { role: 'admin', deletedAt: null } }),
    ]);

    return {
      total,
      active,
      pending,
      deleted,
      admins,
    };
  }
}

// Singleton instance
let userManagementServiceInstance: UserManagementService | null = null;

export function getUserManagementService(): UserManagementService {
  if (!userManagementServiceInstance) {
    userManagementServiceInstance = new UserManagementService();
  }
  return userManagementServiceInstance;
}
