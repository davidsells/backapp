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
  sources: BackupSource[];
  destination: S3Destination;
  schedule?: ScheduleConfig;
  options: BackupOptions;
}

export interface UpdateBackupConfigInput {
  name?: string;
  enabled?: boolean;
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

    const config = await prisma.backupConfig.create({
      data: {
        userId: input.userId,
        name: input.name,
        enabled: input.enabled ?? true,
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
      orderBy: { createdAt: 'desc' },
    });

    return configs.map((config) => this.mapToBackupConfig(config));
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
      const validation = await this.validateSources(input.sources);
      if (!validation.valid) {
        throw new Error(`Invalid sources: ${validation.errors?.join(', ')}`);
      }
    }

    const config = await prisma.backupConfig.update({
      where: { id: configId, userId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.enabled !== undefined && { enabled: input.enabled }),
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
    return prisma.backupLog.findMany({
      where: { configId, userId },
      orderBy: { startTime: 'desc' },
      take: limit,
    });
  }

  /**
   * Get recent backup logs for user
   */
  async getRecentLogs(userId: string, limit = 20) {
    return prisma.backupLog.findMany({
      where: { userId },
      include: {
        config: {
          select: { name: true },
        },
      },
      orderBy: { startTime: 'desc' },
      take: limit,
    });
  }

  /**
   * Get backup statistics for user
   */
  async getStats(userId: string) {
    const [totalConfigs, activeConfigs, totalBackups, failedBackups] = await Promise.all([
      prisma.backupConfig.count({ where: { userId } }),
      prisma.backupConfig.count({ where: { userId, enabled: true } }),
      prisma.backupLog.count({ where: { userId } }),
      prisma.backupLog.count({ where: { userId, status: 'failed' } }),
    ]);

    const recentLogs = await prisma.backupLog.findMany({
      where: { userId },
      orderBy: { startTime: 'desc' },
      take: 10,
      select: {
        bytesTransferred: true,
        filesProcessed: true,
      },
    });

    const totalBytesTransferred = recentLogs.reduce(
      (sum, log) => sum + Number(log.bytesTransferred),
      0
    );

    const totalFilesProcessed = recentLogs.reduce(
      (sum, log) => sum + log.filesProcessed,
      0
    );

    return {
      totalConfigs,
      activeConfigs,
      totalBackups,
      failedBackups,
      successRate: totalBackups > 0
        ? ((totalBackups - failedBackups) / totalBackups) * 100
        : 0,
      totalBytesTransferred,
      totalFilesProcessed,
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

    // Validate sources
    const sourceValidation = await this.validateSources(input.sources);
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
   */
  private async validateSources(sources: BackupSource[]): Promise<ValidationResult> {
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

      const validation = await this.fileProcessor.validateSource(source);
      if (!validation.valid) {
        errors.push(`Source ${index + 1}: ${validation.error}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
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
      sources: config.sources as unknown as BackupSource[],
      destination: config.destination as unknown as S3Destination,
      schedule: config.schedule ? (config.schedule as unknown as ScheduleConfig) : null,
      options: config.options as unknown as BackupOptions,
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
