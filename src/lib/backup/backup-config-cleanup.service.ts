import { prisma } from '../db/prisma';

/**
 * Service for cleaning up and fixing backup configuration issues
 */
export class BackupConfigCleanupService {
  /**
   * Fix orphaned agent references in backup configurations
   * Sets agentId to null and executionMode to 'server' for configs
   * where agentId points to a non-existent agent
   */
  async fixOrphanedAgentReferences(userId?: string): Promise<{
    fixed: number;
    configs: Array<{
      id: string;
      name: string;
      orphanedAgentId: string;
    }>;
  }> {
    try {
      // Find all configs with agent-based execution mode
      const whereClause: any = {
        executionMode: 'agent',
      };

      if (userId) {
        whereClause.userId = userId;
      }

      const agentConfigs = await prisma.backupConfig.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          agentId: true,
          userId: true,
          agent: {
            select: {
              id: true,
            },
          },
        },
      });

      // Filter to only orphaned configs (agentId set but agent doesn't exist)
      const orphanedConfigs = agentConfigs.filter(
        (config) => config.agentId && !config.agent
      );

      if (orphanedConfigs.length === 0) {
        return { fixed: 0, configs: [] };
      }

      // Fix each orphaned config
      const results = orphanedConfigs.map((config) => ({
        id: config.id,
        name: config.name,
        orphanedAgentId: config.agentId!,
      }));

      // Update all orphaned configs in batch
      await prisma.backupConfig.updateMany({
        where: {
          id: { in: orphanedConfigs.map((c) => c.id) },
        },
        data: {
          agentId: null,
          executionMode: 'server',
        },
      });

      return {
        fixed: orphanedConfigs.length,
        configs: results,
      };
    } catch (error) {
      console.error('[BackupConfigCleanup] Failed to fix orphaned agent references:', error);
      throw new Error('Failed to fix orphaned agent references');
    }
  }

  /**
   * Fix a single backup configuration's orphaned agent reference
   */
  async fixConfigAgentReference(configId: string, userId: string): Promise<boolean> {
    try {
      const config = await prisma.backupConfig.findFirst({
        where: {
          id: configId,
          userId,
          executionMode: 'agent',
        },
        select: {
          agentId: true,
          agent: {
            select: {
              id: true,
            },
          },
        },
      });

      // Only fix if orphaned (agentId set but agent doesn't exist)
      if (!config || !config.agentId || config.agent) {
        return false;
      }

      await prisma.backupConfig.update({
        where: {
          id: configId,
          userId,
        },
        data: {
          agentId: null,
          executionMode: 'server',
        },
      });

      return true;
    } catch (error) {
      console.error('[BackupConfigCleanup] Failed to fix config agent reference:', error);
      throw new Error('Failed to fix config agent reference');
    }
  }

  /**
   * Get count of configs with orphaned agent references
   */
  async getOrphanedConfigCount(userId?: string): Promise<number> {
    try {
      const whereClause: any = {
        executionMode: 'agent',
      };

      if (userId) {
        whereClause.userId = userId;
      }

      const agentConfigs = await prisma.backupConfig.findMany({
        where: whereClause,
        select: {
          agentId: true,
          agent: {
            select: {
              id: true,
            },
          },
        },
      });

      return agentConfigs.filter((config) => config.agentId && !config.agent).length;
    } catch (error) {
      console.error('[BackupConfigCleanup] Failed to count orphaned configs:', error);
      return 0;
    }
  }
}

// Singleton instance
let backupConfigCleanupServiceInstance: BackupConfigCleanupService | null = null;

export function getBackupConfigCleanupService(): BackupConfigCleanupService {
  if (!backupConfigCleanupServiceInstance) {
    backupConfigCleanupServiceInstance = new BackupConfigCleanupService();
  }
  return backupConfigCleanupServiceInstance;
}
