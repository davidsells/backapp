import { getS3Adapter } from '../storage/s3-adapter';
import { S3Object } from '../types/s3.types';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface BackupFile extends S3Object {
  configId: string;
  configName?: string;
  timestamp: Date;
  downloadUrl?: string;
}

/**
 * Service for managing backup files stored in S3
 */
export class S3BackupManagementService {
  /**
   * List all backup files for a specific user
   */
  async listUserBackups(userId: string): Promise<BackupFile[]> {
    const s3 = getS3Adapter();
    const prefix = `users/${userId}/`;

    try {
      const objects = await s3.listFiles(prefix);
      return this.parseBackupFiles(objects);
    } catch (error) {
      console.error('[S3BackupManagement] Failed to list user backups:', error);
      throw new Error('Failed to list backups from S3');
    }
  }

  /**
   * List all backup files for a specific agent
   */
  async listAgentBackups(userId: string, agentId: string): Promise<BackupFile[]> {
    const s3 = getS3Adapter();
    const prefix = `users/${userId}/agents/${agentId}/`;

    try {
      const objects = await s3.listFiles(prefix);
      return this.parseBackupFiles(objects);
    } catch (error) {
      console.error('[S3BackupManagement] Failed to list agent backups:', error);
      throw new Error('Failed to list agent backups from S3');
    }
  }

  /**
   * List all backup files for a specific configuration
   */
  async listConfigBackups(userId: string, agentId: string, configId: string): Promise<BackupFile[]> {
    const s3 = getS3Adapter();
    const prefix = `users/${userId}/agents/${agentId}/configs/${configId}/`;

    try {
      const objects = await s3.listFiles(prefix);
      return this.parseBackupFiles(objects);
    } catch (error) {
      console.error('[S3BackupManagement] Failed to list config backups:', error);
      throw new Error('Failed to list configuration backups from S3');
    }
  }

  /**
   * Delete a backup file from S3
   */
  async deleteBackup(s3Key: string, userId: string): Promise<void> {
    // Verify the key belongs to this user (security check)
    if (!s3Key.startsWith(`users/${userId}/`)) {
      throw new Error('Unauthorized: Cannot delete backup from another user');
    }

    const s3 = getS3Adapter();

    try {
      await s3.deleteFile(s3Key);
    } catch (error) {
      console.error('[S3BackupManagement] Failed to delete backup:', error);
      throw new Error('Failed to delete backup from S3');
    }
  }

  /**
   * Delete all backups for a specific agent
   */
  async deleteAgentBackups(userId: string, agentId: string): Promise<number> {
    const backups = await this.listAgentBackups(userId, agentId);
    const s3 = getS3Adapter();

    let deletedCount = 0;
    for (const backup of backups) {
      try {
        await s3.deleteFile(backup.key);
        deletedCount++;
      } catch (error) {
        console.error(`[S3BackupManagement] Failed to delete ${backup.key}:`, error);
      }
    }

    return deletedCount;
  }

  /**
   * Generate a presigned download URL for a backup file
   */
  async getDownloadUrl(s3Key: string, userId: string, expiresIn: number = 3600): Promise<string> {
    // Verify the key belongs to this user (security check)
    if (!s3Key.startsWith(`users/${userId}/`)) {
      throw new Error('Unauthorized: Cannot access backup from another user');
    }

    const s3 = getS3Adapter();
    const bucketName = s3.getBucketName();

    // We need to create a new S3Client with credentials for presigning
    // Note: This requires AWS credentials to be configured
    const client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
    });

    try {
      const url = await getSignedUrl(client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('[S3BackupManagement] Failed to generate download URL:', error);
      throw new Error('Failed to generate download URL');
    }
  }

  /**
   * Get storage statistics for a user
   */
  async getUserStorageStats(userId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    byAgent: Record<string, { files: number; size: number }>;
  }> {
    const backups = await this.listUserBackups(userId);

    const stats = {
      totalFiles: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      byAgent: {} as Record<string, { files: number; size: number }>,
    };

    // Group by agent
    for (const backup of backups) {
      const agentIdMatch = backup.key.match(/users\/[^/]+\/agents\/([^/]+)\//);
      if (agentIdMatch && agentIdMatch[1]) {
        const agentId = agentIdMatch[1];
        if (!stats.byAgent[agentId]) {
          stats.byAgent[agentId] = { files: 0, size: 0 };
        }
        stats.byAgent[agentId].files++;
        stats.byAgent[agentId].size += backup.size;
      }
    }

    return stats;
  }

  /**
   * Parse S3 objects into BackupFile format
   * Handles both archive backups (.tar.gz) and rsync backups (grouped by date)
   */
  private parseBackupFiles(objects: S3Object[]): BackupFile[] {
    const backupEntries: BackupFile[] = [];

    // Separate files by type
    const archiveFiles: S3Object[] = [];
    const rsyncFilesByGroup: Map<string, S3Object[]> = new Map();

    for (const obj of objects) {
      const filename = obj.key.split('/').pop() || '';

      // Archive backups (.tar.gz files)
      if (filename.endsWith('.tar.gz')) {
        archiveFiles.push(obj);
      }
      // Rsync backups (files in /rsync/{date}/ directories)
      else if (obj.key.includes('/rsync/')) {
        // Extract configId and date from path
        // Pattern: users/{userId}/agents/{agentId}/configs/{configId}/rsync/{YYYY-MM-DD}/...
        const configMatch = obj.key.match(/\/configs\/([^/]+)\/rsync/);
        const dateMatch = obj.key.match(/\/rsync\/(\d{4}-\d{2}-\d{2})\//);

        if (configMatch && configMatch[1] && dateMatch && dateMatch[1]) {
          const configId = configMatch[1];
          const date = dateMatch[1];
          const groupKey = `${configId}:${date}`;

          if (!rsyncFilesByGroup.has(groupKey)) {
            rsyncFilesByGroup.set(groupKey, []);
          }
          rsyncFilesByGroup.get(groupKey)!.push(obj);
        }
      }
    }

    // Process archive backups
    for (const obj of archiveFiles) {
      const pathParts = obj.key.split('/');
      const configsIndex = pathParts.indexOf('configs');
      const configIdIndex = configsIndex >= 0 ? configsIndex + 1 : -1;
      const configIdFromPath = configIdIndex >= 0 && configIdIndex < pathParts.length
        ? pathParts[configIdIndex]
        : undefined;
      const configId = configIdFromPath || 'unknown';

      // Extract timestamp from filename
      const filename = pathParts[pathParts.length - 1] || '';
      let timestamp = obj.lastModified;

      const timestampMatch = filename.match(/backup-(\d{4})-(\d{2})-(\d{2})-(\d{6})/);
      if (timestampMatch && timestampMatch.length >= 5) {
        const year = timestampMatch[1];
        const month = timestampMatch[2];
        const day = timestampMatch[3];
        const time = timestampMatch[4];
        if (year && month && day && time) {
          const hours = time.substring(0, 2);
          const minutes = time.substring(2, 4);
          const seconds = time.substring(4, 6);
          timestamp = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`);
        }
      }

      backupEntries.push({
        ...obj,
        configId,
        timestamp,
      });
    }

    // Process rsync backups - create grouped entries
    for (const [groupKey, files] of rsyncFilesByGroup.entries()) {
      const [configId, date] = groupKey.split(':');

      // Skip if date is missing (shouldn't happen but TypeScript safety)
      if (!date) continue;

      // Calculate total size of all files in this rsync backup
      const totalSize = files.reduce((sum, f) => sum + f.size, 0);

      // Use the most recent lastModified date from all files
      const mostRecentDate = files.reduce((latest, f) =>
        f.lastModified > latest ? f.lastModified : latest,
        files[0]?.lastModified || new Date()
      );

      // Create a virtual backup entry representing the rsync backup
      // Use the first file's key as base, but modify to show it's a grouped rsync backup
      const baseKey = files[0]?.key || '';
      const rsyncDirKey = baseKey.substring(0, baseKey.indexOf('/rsync/') + 7 + date.length + 1);

      backupEntries.push({
        key: rsyncDirKey,
        size: totalSize,
        lastModified: mostRecentDate,
        timestamp: new Date(date + 'T00:00:00Z'),
        configId: configId || 'unknown',
        etag: undefined,
      });
    }

    // Sort by timestamp descending (most recent first)
    return backupEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

// Singleton instance
let s3BackupManagementInstance: S3BackupManagementService | null = null;

export function getS3BackupManagementService(): S3BackupManagementService {
  if (!s3BackupManagementInstance) {
    s3BackupManagementInstance = new S3BackupManagementService();
  }
  return s3BackupManagementInstance;
}
