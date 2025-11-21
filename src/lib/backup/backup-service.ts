import { prisma } from '../db/prisma';
import type {
  BackupConfig,
  BackupSource,
  S3Destination,
  ScheduleConfig,
  BackupOptions,
  ValidationResult,
} from '../types/backup.types';
import { FileProcessor } from './file-processor';

export interface CreateBackupConfigInput {
  userId: string;
  name: string;
  enabled?: boolean;
  executionMode: 'agent' | 'server';
  agentId?: string | null;
  sources: BackupSource[];
  destination: S3Destination;
  schedule?: ScheduleConfig;
  options: BackupOptions;
}

export interface UpdateBackupConfigInput {
  name?: string;
  enabled?: boolean;
  executionMode?: 'agent' | 'server';
  agentId?: string | null;
  sources?: BackupSource[];
  destination?: S3Destination;
  schedule?: ScheduleConfig;
  options?: BackupOptions;
}

export class BackupService {
  private fileProcessor = new FileProcessor();

  /**
   * Create a new backup configuration
   */
  async createConfig(input: CreateBackupConfigInput): Promise<BackupConfig> {
    // Validate sources
    const validation = await this.validateConfig(input);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors?.join(', ')}`);
    }

    // Validate rsync local replica uniqueness
    if (input.options.method === 'rsync' && input.options.rsync?.localReplica) {
      const duplicateCheck = await this.checkDuplicateLocalReplica(
        input.options.rsync.localReplica,
        input.userId,
        null // No configId for new configs
      );
      if (!duplicateCheck.valid) {
        throw new Error(duplicateCheck.errors?.join(', ') || 'Local replica directory validation failed');
      }
    }

    const config = await prisma.backupConfig.create({
      data: {
        userId: input.userId,
        name: input.name,
        enabled: input.enabled ?? true,
        executionMode: input.executionMode || 'server',
        agentId: input.agentId || null,
        sources: input.sources as any,
        destination: input.destination as any,
        schedule: input.schedule ? (input.schedule as any) : null,
        options: input.options as any,
      },
    });

    return this.mapToBackupConfig(config);
  }

  /**
   * Get backup configuration by ID
   */
  async getConfig(configId: string, userId: string): Promise<BackupConfig | null> {
    const config = await prisma.backupConfig.findFirst({
      where: { id: configId, userId },
    });

    if (!config) return null;

    return this.mapToBackupConfig(config);
  }

  /**
   * List all backup configurations for a user
   */
  async listConfigs(userId: string): Promise<BackupConfig[]> {
    const configs = await prisma.backupConfig.findMany({
      where: { userId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            platform: true,
            lastSeen: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return configs.map((config: any) => this.mapToBackupConfig(config));
  }

  /**
   * Update backup configuration
   */
  async updateConfig(
    configId: string,
    userId: string,
    input: UpdateBackupConfigInput
  ): Promise<BackupConfig> {
    // Validate if sources are being updated
    if (input.sources) {
      // Determine execution mode (use new one if being updated, otherwise get current)
      let executionMode: 'agent' | 'server' = input.executionMode || 'server';
      if (!input.executionMode) {
        const currentConfig = await prisma.backupConfig.findFirst({
          where: { id: configId, userId },
          select: { executionMode: true },
        });
        executionMode = (currentConfig?.executionMode as 'agent' | 'server') || 'server';
      }

      const validation = await this.validateSources(input.sources, executionMode);
      if (!validation.valid) {
        throw new Error(`Invalid sources: ${validation.errors?.join(', ')}`);
      }
    }

    // Validate rsync local replica uniqueness if being updated
    if (input.options?.method === 'rsync' && input.options.rsync?.localReplica) {
      const duplicateCheck = await this.checkDuplicateLocalReplica(
        input.options.rsync.localReplica,
        userId,
        configId // Pass configId to exclude self from check
      );
      if (!duplicateCheck.valid) {
        throw new Error(duplicateCheck.errors?.join(', ') || 'Local replica directory validation failed');
      }
    }

    const config = await prisma.backupConfig.update({
      where: { id: configId, userId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.executionMode && { executionMode: input.executionMode }),
        ...(input.agentId !== undefined && { agentId: input.agentId }),
        ...(input.sources && { sources: input.sources as any }),
        ...(input.destination && { destination: input.destination as any }),
        ...(input.schedule && { schedule: input.schedule as any }),
        ...(input.options && { options: input.options as any }),
      },
    });

    return this.mapToBackupConfig(config);
  }

  /**
   * Delete backup configuration
   */
  async deleteConfig(configId: string, userId: string): Promise<void> {
    await prisma.backupConfig.delete({
      where: { id: configId, userId },
    });
  }

  /**
   * Toggle backup configuration enabled/disabled
   */
  async toggleConfig(configId: string, userId: string, enabled: boolean): Promise<BackupConfig> {
    const config = await prisma.backupConfig.update({
      where: { id: configId, userId },
      data: { enabled },
    });

    return this.mapToBackupConfig(config);
  }

  /**
   * Get backup logs for a configuration
   */
  async getConfigLogs(configId: string, userId: string, limit = 50) {
    const logs = await prisma.backupLog.findMany({
      where: { configId, userId },
      orderBy: { startTime: 'desc' },
      take: limit,
    });

    // Convert BigInt values to numbers for JSON serialization
    return logs.map((log: any) => ({
      ...log,
      totalBytes: Number(log.totalBytes),
      bytesTransferred: Number(log.bytesTransferred),
    }));
  }

  /**
   * Get recent backup logs for user
   */
  async getRecentLogs(userId: string, limit = 20) {
    const logs = await prisma.backupLog.findMany({
      where: { userId },
      include: {
        config: {
          select: { name: true },
        },
      },
      orderBy: { startTime: 'desc' },
      take: limit,
    });

    // Convert BigInt values to numbers for JSON serialization
    return logs.map((log: any) => ({
      ...log,
      totalBytes: Number(log.totalBytes),
      bytesTransferred: Number(log.bytesTransferred),
    }));
  }

  /**
   * Get backup statistics for user
   */
  async getStats(userId: string) {
    const [totalConfigs, activeConfigs, totalBackups, completedBackups, failedBackups] = await Promise.all([
      prisma.backupConfig.count({ where: { userId } }),
      prisma.backupConfig.count({ where: { userId, enabled: true } }),
      prisma.backupLog.count({ where: { userId } }),
      prisma.backupLog.count({ where: { userId, status: 'completed' } }),
      prisma.backupLog.count({ where: { userId, status: 'failed' } }),
    ]);

    // Get all logs for total calculations
    const allLogs = await prisma.backupLog.findMany({
      where: { userId, status: 'completed' },
      select: {
        bytesTransferred: true,
        filesProcessed: true,
      },
    });

    const totalBytesTransferred = allLogs.reduce(
      (sum: number, log: any) => sum + Number(log.bytesTransferred),
      0
    );

    const totalFilesProcessed = allLogs.reduce(
      (sum: number, log: any) => sum + log.filesProcessed,
      0
    );

    // Get recent activity (last 5 backups)
    const recentActivity = await prisma.backupLog.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
      take: 5,
      include: {
        config: {
          select: { name: true },
        },
      },
    });

    // Convert BigInt values to numbers for JSON serialization
    const serializedActivity = recentActivity.map((log: any) => ({
      ...log,
      totalBytes: Number(log.totalBytes),
      bytesTransferred: Number(log.bytesTransferred),
    }));

    return {
      totalConfigs,
      activeConfigs,
      totalBackups,
      completedBackups,
      failedBackups,
      successRate: totalBackups > 0
        ? ((completedBackups / totalBackups) * 100)
        : 0,
      totalBytesTransferred,
      totalFilesProcessed,
      recentActivity: serializedActivity,
    };
  }

  /**
   * Validate backup configuration
   */
  async validateConfig(input: CreateBackupConfigInput): Promise<ValidationResult> {
    const errors: string[] = [];

    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      errors.push('Configuration name is required');
    }

    // Validate sources (skip file system checks for agent-based backups)
    const sourceValidation = await this.validateSources(input.sources, input.executionMode);
    if (!sourceValidation.valid) {
      errors.push(...(sourceValidation.errors || []));
    }

    // Validate destination
    if (!input.destination.bucket || input.destination.bucket.trim().length === 0) {
      errors.push('S3 bucket name is required');
    }
    if (!input.destination.region || input.destination.region.trim().length === 0) {
      errors.push('S3 region is required');
    }

    // Validate schedule (only if provided - manual-only backups don't need schedule)
    if (input.schedule) {
      if (!input.schedule.cronExpression) {
        errors.push('Cron expression is required');
      }
      if (!input.schedule.timezone) {
        errors.push('Timezone is required');
      }
    }

    // Validate options
    if (!['full', 'incremental'].includes(input.options.type)) {
      errors.push('Backup type must be either "full" or "incremental"');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate backup sources
   * For agent-based backups, skip file system validation (agent will validate on its machine)
   */
  private async validateSources(
    sources: BackupSource[],
    executionMode: 'agent' | 'server' = 'server'
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!sources || sources.length === 0) {
      errors.push('At least one backup source is required');
      return { valid: false, errors };
    }

    for (const [index, source] of sources.entries()) {
      if (!source.path || source.path.trim().length === 0) {
        errors.push(`Source ${index + 1}: Path is required`);
        continue;
      }

      // Skip file system validation for agent-based backups
      // The agent will validate paths on its own machine
      if (executionMode === 'server') {
        const validation = await this.fileProcessor.validateSource(source);
        if (!validation.valid) {
          errors.push(`Source ${index + 1}: ${validation.error}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Check if a local replica directory is already in use by another config
   * @param localReplica - The local replica path to check
   * @param userId - The user ID
   * @param excludeConfigId - Config ID to exclude from check (for updates)
   * @returns Validation result
   */
  private async checkDuplicateLocalReplica(
    localReplica: string,
    userId: string,
    excludeConfigId: string | null
  ): Promise<ValidationResult> {
    // Normalize the path (remove trailing slashes for comparison)
    const normalizedPath = localReplica.replace(/\/+$/, '');

    // Find all rsync configs for this user
    const configs = await prisma.backupConfig.findMany({
      where: {
        userId,
        ...(excludeConfigId && { id: { not: excludeConfigId } }), // Exclude current config for updates
      },
      select: {
        id: true,
        name: true,
        options: true,
      },
    });

    // Check if any config uses the same local replica path
    for (const config of configs) {
      const options = config.options as any;
      if (options?.method === 'rsync' && options?.rsync?.localReplica) {
        const existingPath = options.rsync.localReplica.replace(/\/+$/, '');
        if (existingPath === normalizedPath) {
          return {
            valid: false,
            errors: [
              `Local replica directory "${localReplica}" is already in use by backup configuration "${config.name}". ` +
              `Each rsync backup must use a unique local directory to prevent file conflicts.`
            ],
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Map Prisma model to BackupConfig type
   */
  private mapToBackupConfig(config: any): BackupConfig {
    return {
      id: config.id,
      userId: config.userId,
      name: config.name,
      enabled: config.enabled,
      executionMode: config.executionMode || 'server',
      agentId: config.agentId || null,
      agent: config.agent || null, // Include agent data if present
      sources: config.sources as unknown as BackupSource[],
      destination: config.destination as unknown as S3Destination,
      schedule: config.schedule ? (config.schedule as unknown as ScheduleConfig) : null,
      options: config.options as unknown as BackupOptions,
      requestedAt: config.requestedAt || null,
      lastRunAt: config.lastRunAt || null,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}

// Singleton instance
let backupServiceInstance: BackupService | null = null;

export function getBackupService(): BackupService {
  if (!backupServiceInstance) {
    backupServiceInstance = new BackupService();
  }
  return backupServiceInstance;
}
