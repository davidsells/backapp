import { getS3Adapter } from '../storage/s3-adapter';
import { prisma } from '../db/prisma';

export interface VerificationResult {
  verified: boolean;
  s3Path?: string;
  fileSize?: number;
  error?: string;
}

/**
 * Service for verifying backup completion against S3 storage
 */
export class BackupVerificationService {
  /**
   * Verify that a backup file exists in S3
   */
  async verifyBackupInS3(s3Path: string): Promise<VerificationResult> {
    try {
      // Configure S3 adapter
      const s3 = getS3Adapter();
      await s3.configure({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET || '',
      });

      // Check if file exists
      const exists = await s3.fileExists(s3Path);

      if (!exists) {
        return {
          verified: false,
          s3Path,
          error: 'File not found in S3',
        };
      }

      // File exists - get its details
      const files = await s3.listFiles(s3Path);
      const file = files.find(f => f.key === s3Path);

      return {
        verified: true,
        s3Path,
        fileSize: file?.size,
      };
    } catch (error) {
      console.error('[BackupVerification] Failed to verify S3 file:', error);
      return {
        verified: false,
        s3Path,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify a backup log entry by checking S3
   */
  async verifyBackupLog(logId: string): Promise<VerificationResult> {
    try {
      // Get the backup log
      const log = await prisma.backupLog.findUnique({
        where: { id: logId },
        select: {
          id: true,
          s3Path: true,
          status: true,
        },
      });

      if (!log) {
        return {
          verified: false,
          error: 'Backup log not found',
        };
      }

      if (!log.s3Path) {
        return {
          verified: false,
          error: 'No S3 path recorded for this backup',
        };
      }

      // Verify the file in S3
      return await this.verifyBackupInS3(log.s3Path);
    } catch (error) {
      console.error('[BackupVerification] Failed to verify backup log:', error);
      return {
        verified: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Reconcile all completed backups with S3 reality
   * Returns list of backup logs that claim completion but have no S3 file
   */
  async reconcileBackupsWithS3(userId: string): Promise<{
    totalCompleted: number;
    verified: number;
    missing: number;
    missingLogs: Array<{
      id: string;
      configId: string;
      configName: string;
      s3Path: string | null;
      startTime: Date;
      status: string;
    }>;
  }> {
    try {
      // Get all "completed" backups for this user
      const completedLogs = await prisma.backupLog.findMany({
        where: {
          userId,
          status: 'completed',
        },
        include: {
          config: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          startTime: 'desc',
        },
      });

      const missingLogs: Array<{
        id: string;
        configId: string;
        configName: string;
        s3Path: string | null;
        startTime: Date;
        status: string;
      }> = [];

      let verified = 0;
      let missing = 0;

      // Check each backup against S3
      for (const log of completedLogs) {
        if (!log.s3Path) {
          // No S3 path recorded - this is a problem
          missing++;
          missingLogs.push({
            id: log.id,
            configId: log.configId,
            configName: log.config.name,
            s3Path: log.s3Path,
            startTime: log.startTime,
            status: log.status,
          });
          continue;
        }

        // Verify file exists in S3
        const result = await this.verifyBackupInS3(log.s3Path);
        if (result.verified) {
          verified++;
        } else {
          missing++;
          missingLogs.push({
            id: log.id,
            configId: log.configId,
            configName: log.config.name,
            s3Path: log.s3Path,
            startTime: log.startTime,
            status: log.status,
          });
        }
      }

      return {
        totalCompleted: completedLogs.length,
        verified,
        missing,
        missingLogs,
      };
    } catch (error) {
      console.error('[BackupVerification] Failed to reconcile backups:', error);
      throw new Error('Failed to reconcile backups with S3');
    }
  }

  /**
   * Mark unverified backups as failed
   */
  async markUnverifiedBackupsAsFailed(logIds: string[]): Promise<number> {
    try {
      const result = await prisma.backupLog.updateMany({
        where: {
          id: { in: logIds },
        },
        data: {
          status: 'failed',
          errors: {
            type: 'verification-failed',
            message: 'Backup marked as completed but file not found in S3',
            verifiedAt: new Date().toISOString(),
          },
        },
      });

      return result.count;
    } catch (error) {
      console.error('[BackupVerification] Failed to mark backups as failed:', error);
      throw new Error('Failed to update backup statuses');
    }
  }

  /**
   * Check for stale backup requests and mark them as timed out
   * A backup request is stale if:
   * 1. Status is "requested"
   * 2. More than timeoutMinutes have passed since startTime
   */
  async timeoutStaleRequests(timeoutMinutes: number = 30): Promise<{
    timedOut: number;
    staledRequests: Array<{
      id: string;
      configId: string;
      configName: string;
      startTime: Date;
      minutesElapsed: number;
    }>;
  }> {
    try {
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - timeoutMinutes * 60 * 1000);

      // Find all stale requests
      const staleRequests = await prisma.backupLog.findMany({
        where: {
          status: 'requested',
          startTime: {
            lt: cutoffTime,
          },
        },
        include: {
          config: {
            select: {
              name: true,
              agentId: true,
              agent: {
                select: {
                  status: true,
                  lastSeen: true,
                },
              },
            },
          },
        },
      });

      const staledRequests = staleRequests.map((log: any) => ({
        id: log.id,
        configId: log.configId,
        configName: log.config.name,
        startTime: log.startTime,
        minutesElapsed: Math.floor((now.getTime() - log.startTime.getTime()) / 60000),
      }));

      // Mark them as failed with timeout error
      if (staleRequests.length > 0) {
        await prisma.backupLog.updateMany({
          where: {
            id: { in: staleRequests.map((r: any) => r.id) },
          },
          data: {
            status: 'failed',
            endTime: now,
            errors: {
              type: 'timeout',
              message: `Backup request timed out after ${timeoutMinutes} minutes. Agent may have been offline or unavailable.`,
              timedOutAt: now.toISOString(),
              timeoutMinutes,
            },
          },
        });

        // Clear requestedAt timestamp on configs
        const configIds = [...new Set(staleRequests.map((r: any) => r.configId))];
        await prisma.backupConfig.updateMany({
          where: {
            id: { in: configIds },
          },
          data: {
            requestedAt: null,
          },
        });
      }

      return {
        timedOut: staleRequests.length,
        staledRequests,
      };
    } catch (error) {
      console.error('[BackupVerification] Failed to timeout stale requests:', error);
      throw new Error('Failed to timeout stale requests');
    }
  }

  /**
   * Get status of backup requests for a user
   * Shows which backups are waiting for agents
   */
  async getBackupRequestStatus(userId: string): Promise<{
    requested: number;
    running: number;
    pendingRequests: Array<{
      id: string;
      configId: string;
      configName: string;
      startTime: Date;
      minutesWaiting: number;
      agentStatus: string | null;
      agentLastSeen: Date | null;
    }>;
  }> {
    try {
      const now = new Date();

      // Get counts
      const [requested, running] = await Promise.all([
        prisma.backupLog.count({
          where: { userId, status: 'requested' },
        }),
        prisma.backupLog.count({
          where: { userId, status: 'running' },
        }),
      ]);

      // Get details of pending requests
      const pendingLogs = await prisma.backupLog.findMany({
        where: {
          userId,
          status: 'requested',
        },
        include: {
          config: {
            select: {
              name: true,
              agentId: true,
              agent: {
                select: {
                  status: true,
                  lastSeen: true,
                },
              },
            },
          },
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      const pendingRequests = pendingLogs.map((log: any) => ({
        id: log.id,
        configId: log.configId,
        configName: log.config.name,
        startTime: log.startTime,
        minutesWaiting: Math.floor((now.getTime() - log.startTime.getTime()) / 60000),
        agentStatus: log.config.agent?.status || null,
        agentLastSeen: log.config.agent?.lastSeen || null,
      }));

      return {
        requested,
        running,
        pendingRequests,
      };
    } catch (error) {
      console.error('[BackupVerification] Failed to get request status:', error);
      throw new Error('Failed to get backup request status');
    }
  }
}

// Singleton instance
let backupVerificationServiceInstance: BackupVerificationService | null = null;

export function getBackupVerificationService(): BackupVerificationService {
  if (!backupVerificationServiceInstance) {
    backupVerificationServiceInstance = new BackupVerificationService();
  }
  return backupVerificationServiceInstance;
}
