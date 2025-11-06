import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';
import { randomBytes } from 'crypto';
import { prisma } from '../db/prisma';
import { getS3Adapter } from '../storage/s3-adapter';
import { FileProcessor } from './file-processor';
import type {
  BackupConfig,
  BackupResult,
  BackupProgress,
  BackupError,
  BackupSource,
} from '../types/backup.types';
import type { S3Config } from '../types/s3.types';

export interface BackupExecutionOptions {
  configId: string;
  userId: string;
  onProgress?: (progress: BackupProgress) => void;
}

export class BackupExecutor {
  private fileProcessor = new FileProcessor();
  private s3Adapter = getS3Adapter();

  /**
   * Execute a backup job
   */
  async executeBackup(options: BackupExecutionOptions): Promise<BackupResult> {
    const startTime = new Date();
    const errors: BackupError[] = [];

    // Create backup log entry
    const log = await prisma.backupLog.create({
      data: {
        configId: options.configId,
        userId: options.userId,
        startTime,
        status: 'running',
      },
    });

    try {
      // Get backup configuration
      const config = await prisma.backupConfig.findUnique({
        where: { id: options.configId },
      });

      if (!config) {
        throw new Error('Backup configuration not found');
      }

      const backupConfig: BackupConfig = {
        id: config.id,
        userId: config.userId,
        name: config.name,
        enabled: config.enabled,
        sources: config.sources as unknown as BackupSource[],
        destination: config.destination as unknown as any,
        schedule: config.schedule as unknown as any,
        options: config.options as unknown as any,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      };

      // Configure S3 adapter
      await this.configureS3(backupConfig.destination);

      // Create temporary working directory
      const workDir = join(tmpdir(), `backup-${randomBytes(8).toString('hex')}`);
      await mkdir(workDir, { recursive: true });

      try {
        // Execute backup
        const result = await this.performBackup(backupConfig, workDir, options.onProgress);

        // Update log with success
        const endTime = new Date();
        await prisma.backupLog.update({
          where: { id: log.id },
          data: {
            endTime,
            status: 'completed',
            filesProcessed: result.filesProcessed,
            filesSkipped: result.filesSkipped,
            totalBytes: BigInt(result.totalBytes),
            bytesTransferred: BigInt(result.bytesTransferred),
            duration: result.duration,
            errors: errors.length > 0 ? (errors as any) : null,
          },
        });

        return result;
      } finally {
        // Cleanup temporary directory
        await rm(workDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Update log with failure
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({
        file: 'backup-execution',
        error: errorMessage,
        timestamp: new Date(),
      });

      await prisma.backupLog.update({
        where: { id: log.id },
        data: {
          endTime,
          status: 'failed',
          duration,
          errors: errors as any,
        },
      });

      // Create alert for failed backup
      await prisma.alert.create({
        data: {
          userId: options.userId,
          configId: options.configId,
          type: 'error',
          message: `Backup failed: ${errorMessage}`,
        },
      });

      throw error;
    }
  }

  /**
   * Perform the actual backup process
   */
  private async performBackup(
    config: BackupConfig,
    workDir: string,
    onProgress?: (progress: BackupProgress) => void
  ): Promise<BackupResult> {
    const startTime = Date.now();
    let filesProcessed = 0;
    let filesSkipped = 0;
    let totalBytes = 0;
    let bytesTransferred = 0;
    const errors: BackupError[] = [];

    // Scan all source directories
    const allFiles = [];
    for (const source of config.sources) {
      try {
        const files = await this.fileProcessor.scanDirectory(source);
        allFiles.push(...files);
      } catch (error) {
        errors.push({
          file: source.path,
          error: error instanceof Error ? error.message : 'Failed to scan directory',
          timestamp: new Date(),
        });
      }
    }

    totalBytes = allFiles.reduce((sum, file) => sum + file.size, 0);

    // Report initial progress
    if (onProgress) {
      onProgress({
        filesProcessed: 0,
        filesSkipped: 0,
        totalBytes,
        bytesTransferred: 0,
        percentage: 0,
      });
    }

    // Create archive
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `${config.name}-${timestamp}.tar${config.options.compression ? '.gz' : ''}`;
    const archivePath = join(workDir, archiveName);

    const archiveResult = await this.fileProcessor.createArchive(
      allFiles,
      archivePath,
      config.options,
      (processed, total) => {
        filesProcessed = processed;
        const percentage = (processed / total) * 50; // First 50% for archiving

        if (onProgress) {
          onProgress({
            filesProcessed,
            filesSkipped,
            totalBytes,
            bytesTransferred,
            percentage,
          });
        }
      }
    );

    filesProcessed = archiveResult.filesProcessed;

    // Encrypt if enabled
    let finalPath = archivePath;
    if (config.options.encryption) {
      const encryptedPath = `${archivePath}.enc`;
      const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || 'default-key-change-me';

      await this.fileProcessor.encryptFile(archivePath, encryptedPath, encryptionKey);
      finalPath = encryptedPath;
    }

    // Upload to S3
    const s3Key = `${config.destination.prefix || 'backups'}/${archiveName}${
      config.options.encryption ? '.enc' : ''
    }`;

    await this.s3Adapter.uploadFile({
      path: s3Key,
      localPath: finalPath,
      metadata: {
        'backup-config-id': config.id,
        'backup-config-name': config.name,
        'backup-type': config.options.type,
        'files-processed': filesProcessed.toString(),
        'total-bytes': totalBytes.toString(),
      },
      onProgress: (percentage) => {
        const uploadPercentage = 50 + percentage * 0.5; // Second 50% for uploading

        if (onProgress) {
          onProgress({
            filesProcessed,
            filesSkipped,
            totalBytes,
            bytesTransferred: Math.floor((percentage / 100) * archiveResult.totalBytes),
            percentage: uploadPercentage,
          });
        }
      },
    });

    bytesTransferred = archiveResult.totalBytes;

    const duration = Date.now() - startTime;

    return {
      success: true,
      filesProcessed,
      filesSkipped,
      totalBytes,
      bytesTransferred,
      duration,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Configure S3 adapter from destination config
   */
  private async configureS3(destination: any): Promise<void> {
    const s3Config: S3Config = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: destination.region,
      bucket: destination.bucket,
      endpoint: destination.endpoint,
    };

    if (!s3Config.accessKeyId || !s3Config.secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    await this.s3Adapter.configure(s3Config);
  }

  /**
   * Get backup status
   */
  async getBackupStatus(logId: string): Promise<any> {
    return prisma.backupLog.findUnique({
      where: { id: logId },
      include: {
        config: {
          select: { name: true },
        },
      },
    });
  }

  /**
   * Cancel running backup
   */
  async cancelBackup(logId: string): Promise<void> {
    await prisma.backupLog.update({
      where: { id: logId },
      data: {
        status: 'cancelled',
        endTime: new Date(),
      },
    });
  }

  /**
   * Cleanup old backups based on retention policy
   */
  async cleanupOldBackups(configId: string): Promise<number> {
    const config = await prisma.backupConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new Error('Backup configuration not found');
    }

    const options = config.options as any;
    const retentionDays = options.retentionDays || 30;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Get old backup logs
    const oldLogs = await prisma.backupLog.findMany({
      where: {
        configId,
        startTime: { lt: cutoffDate },
        status: 'completed',
      },
    });

    // Configure S3
    const destination = config.destination as any;
    await this.configureS3(destination);

    // Delete from S3 and database
    let deletedCount = 0;
    for (const log of oldLogs) {
      try {
        // Extract S3 key from log (would need to be stored in log)
        // For now, we'll just delete the log entry
        await prisma.backupLog.delete({ where: { id: log.id } });
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete old backup log ${log.id}:`, error);
      }
    }

    return deletedCount;
  }
}

// Singleton instance
let backupExecutorInstance: BackupExecutor | null = null;

export function getBackupExecutor(): BackupExecutor {
  if (!backupExecutorInstance) {
    backupExecutorInstance = new BackupExecutor();
  }
  return backupExecutorInstance;
}
