import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { retryWithBackoff, classifyError } from './retry-util.js';

/**
 * Handles rclone-based backup with direct S3 upload
 * Single-step process: rclone sync source → S3
 * Replaces the two-step rsync → aws s3 sync pattern
 */
export class RcloneExecutor {
  constructor(config, apiClient, logger, wsClient = null) {
    this.config = config;
    this.apiClient = apiClient;
    this.logger = logger;
    this.wsClient = wsClient;
    // Retry configuration
    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 2000, // 2 seconds
      maxDelay: 30000, // 30 seconds
    };
  }

  /**
   * Execute rclone backup for a specific configuration
   * @param {object} backupConfig - Backup configuration from server
   */
  async executeBackup(backupConfig) {
    const startTime = Date.now();
    this.logger.info(`Starting rclone backup: ${backupConfig.name}`, { configId: backupConfig.id });

    // Notify via WebSocket
    if (this.wsClient?.isReady()) {
      this.wsClient.notifyBackupStarted(backupConfig.id, backupConfig.name);
    }

    let logId = null;
    const rcloneOptions = backupConfig.options?.rclone;

    try {
      // Step 0: Create backup log entry on server
      this.logger.info('Creating backup log entry...');
      const startResponse = await this.apiClient.startBackup(
        backupConfig.id,
        `rclone-${new Date().toISOString().slice(0, 10)}.log`
      );
      logId = startResponse.logId;
      this.logger.info(`Backup log created: ${logId}`);

      // Validate rclone configuration
      if (!rcloneOptions) {
        throw new Error('Rclone options not configured');
      }

      // Get AWS credentials from config (provided by server)
      const awsCredentials = backupConfig.awsCredentials;
      if (!awsCredentials) {
        throw new Error('AWS credentials not provided by server. Server must send temporary credentials for rclone backups.');
      }

      const s3Bucket = awsCredentials.bucket;
      const awsRegion = awsCredentials.region;

      if (!s3Bucket) {
        throw new Error('S3 bucket not configured in server credentials');
      }

      // Validate that userId and agentId are present for path construction
      if (!backupConfig.userId || !backupConfig.agentId) {
        throw new Error('Backup configuration missing userId or agentId for S3 path construction');
      }

      // Validate source paths exist
      this.validateSources(backupConfig.sources);

      // Auto-generate S3 path: users/{userId}/agents/{agentId}/configs/{configId}/rclone/{YYYY-MM-DD}/
      const dateTag = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const s3Prefix = `users/${backupConfig.userId}/agents/${backupConfig.agentId}/configs/${backupConfig.id}/rclone/${dateTag}/`;
      const s3Path = `:s3:${s3Bucket}/${s3Prefix}`;

      // Send initial progress
      this.sendProgress(backupConfig, {
        stage: 'preparing',
        filesProcessed: 0,
        bytesProcessed: 0
      });

      let rcloneStats;

      // Check if two-phase backup is enabled
      if (rcloneOptions.twoPhase && rcloneOptions.localBackupPath) {
        this.logger.info('Two-phase backup mode enabled');

        // Create local backup directory with date stamp
        const localBackupDir = path.join(rcloneOptions.localBackupPath, dateTag);
        this.ensureDirectory(localBackupDir);
        this.logger.info(`Local backup directory: ${localBackupDir}`);

        // Phase 1: Sync to local backup
        this.logger.info('Phase 1: Syncing to local backup directory');
        this.sendProgress(backupConfig, {
          stage: 'local-sync',
          filesProcessed: 0,
          bytesProcessed: 0
        });

        const localStats = await this.executeRcloneSync(
          backupConfig.sources,
          localBackupDir,
          null, // No AWS credentials for local sync
          rcloneOptions,
          backupConfig,
          'local'
        );

        this.logger.info(`Local sync complete: ${localStats.filesTransferred} files, ${localStats.totalSize} bytes`);

        // Phase 2: Upload to S3 (optional)
        if (rcloneOptions.uploadToRemote !== false) {
          this.logger.info(`Phase 2: Uploading to S3: ${s3Path}`);
          this.sendProgress(backupConfig, {
            stage: 'remote-sync',
            filesProcessed: localStats.filesTransferred,
            bytesProcessed: 0
          });

          const remoteStats = await this.executeRcloneSync(
            [{ path: localBackupDir }],
            s3Path,
            awsCredentials,
            rcloneOptions,
            backupConfig,
            'remote'
          );

          this.logger.info(`Remote sync complete: ${remoteStats.filesTransferred} files, ${remoteStats.totalSize} bytes`);
          rcloneStats = remoteStats; // Use remote stats for reporting
        } else {
          this.logger.info('Phase 2: Skipping remote upload (local-only backup)');
          rcloneStats = localStats;
        }

        // Clean up old local backups
        if (rcloneOptions.keepLocalCopies > 0) {
          await this.cleanupOldLocalBackups(rcloneOptions.localBackupPath, rcloneOptions.keepLocalCopies);
        }

      } else {
        // Single-phase: Direct sync to S3
        this.logger.info(`Syncing directly to S3: ${s3Path}`);
        this.sendProgress(backupConfig, {
          stage: 'syncing',
          filesProcessed: 0,
          bytesProcessed: 0
        });

        rcloneStats = await this.executeRcloneSync(
          backupConfig.sources,
          s3Path,
          awsCredentials,
          rcloneOptions,
          backupConfig,
          'direct'
        );

        this.logger.info(`Rclone sync complete: ${rcloneStats.filesTransferred} files, ${rcloneStats.totalSize} bytes`);
      }

      // Report completion to server
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      await retryWithBackoff(
        () => this.apiClient.completeBackup(
          logId,
          true, // success
          null, // no error
          rcloneStats.totalSize
        ),
        {
          ...this.retryConfig,
          onRetry: (attempt, error, delay) => {
            this.logger.warn(`Retry ${attempt}/${this.retryConfig.maxAttempts} for completeBackup after ${(delay/1000).toFixed(1)}s: ${error.message}`);
          },
        }
      );

      this.logger.info(`Rclone backup completed successfully in ${duration}s`, {
        configId: backupConfig.id,
        filesTransferred: rcloneStats.filesTransferred,
        totalSize: rcloneStats.totalSize,
        duration,
      });

      // Notify success via WebSocket
      if (this.wsClient?.isReady()) {
        this.wsClient.notifyBackupCompleted(backupConfig.id, backupConfig.name, {
          size: rcloneStats.totalSize,
          duration: parseFloat(duration),
          filesTransferred: rcloneStats.filesTransferred,
        });
      }

      return {
        success: true,
        filesTransferred: rcloneStats.filesTransferred,
        size: rcloneStats.totalSize,
        duration
      };

    } catch (error) {
      // Classify error for better messaging
      const classification = classifyError(error);

      this.logger.error(`Rclone backup failed (${classification.category}): ${classification.userMessage}`, {
        configId: backupConfig.id,
        errorCategory: classification.category,
        retriable: classification.retriable,
        originalError: error.message,
      });

      // Notify failure via WebSocket
      if (this.wsClient?.isReady()) {
        this.wsClient.notifyBackupFailed(backupConfig.id, backupConfig.name, classification.userMessage);
      }

      // Report failure to server if we have a logId
      if (logId) {
        try {
          await retryWithBackoff(
            () => this.apiClient.completeBackup(logId, false, classification.userMessage),
            {
              maxAttempts: 2,
              baseDelay: 1000,
              onRetry: (attempt, err, delay) => {
                this.logger.warn(`Retry ${attempt}/2 for failure reporting after ${(delay/1000).toFixed(1)}s`);
              },
            }
          );
        } catch (completeError) {
          this.logger.error(`Failed to report backup failure to server: ${completeError.message}`);
        }
      }

      return {
        success: false,
        error: classification.userMessage,
        errorCategory: classification.category,
        retriable: classification.retriable,
      };
    }
  }

  /**
   * Validate that all source paths exist and are accessible
   */
  validateSources(sources) {
    for (const source of sources) {
      if (!fs.existsSync(source.path)) {
        const error = new Error(`Source path does not exist: ${source.path}`);
        error.code = 'ENOENT';
        throw error;
      }

      try {
        fs.accessSync(source.path, fs.constants.R_OK);
      } catch (error) {
        error.message = `Cannot access source path: ${source.path}`;
        error.code = 'EACCES';
        throw error;
      }
    }
  }

  /**
   * Execute rclone sync command
   * @param {string} mode - 'local', 'remote', or 'direct'
   * @returns {Promise<object>} Stats about the rclone operation
   */
  async executeRcloneSync(sources, destination, awsCredentials, options, backupConfig = null, mode = 'direct') {
    return new Promise((resolve, reject) => {
      // Build rclone arguments
      const args = [
        'sync',
        '--stats', '1s',           // Show stats every second
        '--progress',              // Show progress
      ];

      // Add checksum verification if enabled (skip for local-only to save time)
      if (options.checksumVerification !== false && mode !== 'local') {
        args.push('--checksum');
      }

      // Add delete flag if specified
      if (options.delete) {
        args.push('--delete-excluded'); // Remove files in dest that don't exist in source
      }

      // Add bandwidth limit if specified
      const bwLimit = options.bandwidth || backupConfig?.options?.bandwidth;
      if (bwLimit) {
        args.push('--bwlimit', `${bwLimit}k`); // rclone expects format like "1M" or "500k"
      }

      // Add storage class if specified (S3 only)
      if (options.storageClass && mode !== 'local') {
        args.push('--s3-storage-class', options.storageClass);
      }

      // Add exclusions if any
      const exclusions = this.collectExclusions(sources);
      exclusions.forEach(pattern => {
        args.push(`--exclude`, pattern);
      });

      // Add all source paths
      // For multiple sources, we'll sync each one separately
      // (rclone sync doesn't support multiple sources in one command)
      const sourcePaths = sources.map(s => s.path);

      // For now, if multiple sources, we'll sync the first one
      // TODO: Handle multiple sources by syncing each to a subdirectory
      if (sourcePaths.length > 1) {
        this.logger.warn('Multiple sources detected. Currently syncing first source only. Consider using a wrapper directory.');
      }

      const sourcePath = sourcePaths[0];
      args.push(sourcePath);

      // Add destination
      args.push(destination);

      this.logger.debug(`Executing: rclone ${args.join(' ')}`);

      // Set environment variables
      const env = { ...process.env };

      // Add AWS credentials if provided (for S3 operations)
      if (awsCredentials) {
        env.AWS_ACCESS_KEY_ID = awsCredentials.accessKeyId;
        env.AWS_SECRET_ACCESS_KEY = awsCredentials.secretAccessKey;
        env.AWS_DEFAULT_REGION = awsCredentials.region;

        // Only set session token if it exists
        if (awsCredentials.sessionToken) {
          env.AWS_SESSION_TOKEN = awsCredentials.sessionToken;
        }

        this.logger.debug(`Using temporary credentials for rclone (expires: ${awsCredentials.expiration})`);
      }

      const rcloneProcess = spawn('rclone', args, { env });
      let stdout = '';
      let stderr = '';
      let lastStatsLine = '';

      rcloneProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        // Parse progress for WebSocket updates
        // Rclone outputs lines like:
        // "Transferred:   	  123.456 MBytes (1.234 MBytes/s), ETA 5s"
        // "Checks:               100 / 100, 100%"
        // "Transferred:            5 / 10, 50%"

        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes('Transferred:') && line.includes('/')) {
            lastStatsLine = line;
            // Try to parse transferred count
            const match = line.match(/Transferred:\s+(\d+)\s+\/\s+(\d+)/);
            if (match) {
              const transferred = parseInt(match[1]);
              this.sendProgress(backupConfig, {
                stage: 'syncing',
                filesProcessed: transferred,
                bytesProcessed: 0,
              });
            }
          }
        }
      });

      rcloneProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      rcloneProcess.on('close', (code) => {
        if (code === 0) {
          // Parse final stats from output
          const stats = this.parseRcloneStats(stdout);
          resolve(stats);
        } else {
          const error = new Error(`Rclone failed with code ${code}: ${stderr}`);
          error.code = 'RCLONE_ERROR';
          reject(error);
        }
      });

      rcloneProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          error.message = 'rclone command not found. Please install rclone: https://rclone.org/install/';
        }
        reject(error);
      });
    });
  }

  /**
   * Collect all exclusion patterns from sources
   */
  collectExclusions(sources) {
    const exclusions = new Set();

    // Add default exclusions
    exclusions.add('node_modules/');
    exclusions.add('.git/');
    exclusions.add('*.log');

    // Add user-defined exclusions
    sources.forEach(source => {
      if (source.excludePatterns) {
        source.excludePatterns.forEach(pattern => exclusions.add(pattern));
      }
    });

    return Array.from(exclusions);
  }

  /**
   * Parse rclone statistics from output
   */
  parseRcloneStats(output) {
    const stats = {
      filesTransferred: 0,
      totalSize: 0,
    };

    // Look for lines like:
    // "Transferred:            123 / 123, 100%"
    // "Transferred:   	  123.456 MBytes (1.234 MBytes/s), ETA 0s"

    // Parse transferred files
    const filesMatch = output.match(/Transferred:\s+(\d+)\s+\/\s+(\d+)/);
    if (filesMatch) {
      stats.filesTransferred = parseInt(filesMatch[1]);
    }

    // Parse total size transferred (in bytes)
    // Rclone shows sizes like "123.456 MBytes" or "1.234 GBytes"
    const sizeMatch = output.match(/Transferred:\s+([\d.]+)\s+(k|M|G|T)?Bytes/i);
    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1]);
      const unit = (sizeMatch[2] || '').toUpperCase();

      // Convert to bytes
      let multiplier = 1;
      switch (unit) {
        case 'K': multiplier = 1024; break;
        case 'M': multiplier = 1024 * 1024; break;
        case 'G': multiplier = 1024 * 1024 * 1024; break;
        case 'T': multiplier = 1024 * 1024 * 1024 * 1024; break;
      }

      stats.totalSize = Math.round(size * multiplier);
    }

    return stats;
  }

  /**
   * Send progress update via WebSocket
   */
  sendProgress(backupConfig, progress) {
    if (!backupConfig || !this.wsClient?.isReady()) {
      return;
    }

    this.wsClient.notifyBackupProgress(backupConfig.id, backupConfig.name, progress);
  }

  /**
   * Ensure directory exists, create if necessary
   */
  ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.logger.info(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Clean up old local backup copies, keeping only the most recent N
   * @param {string} localBackupPath - Base path for local backups
   * @param {number} keepCopies - Number of copies to keep
   */
  async cleanupOldLocalBackups(localBackupPath, keepCopies) {
    try {
      if (!fs.existsSync(localBackupPath)) {
        return; // Nothing to clean up
      }

      // Get all date-stamped directories (YYYY-MM-DD format)
      const entries = fs.readdirSync(localBackupPath, { withFileTypes: true });
      const dateDirs = entries
        .filter(entry => entry.isDirectory())
        .filter(entry => /^\d{4}-\d{2}-\d{2}$/.test(entry.name)) // Match YYYY-MM-DD
        .map(entry => ({
          name: entry.name,
          path: path.join(localBackupPath, entry.name),
          mtime: fs.statSync(path.join(localBackupPath, entry.name)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first

      // Keep only the specified number of copies
      const toDelete = dateDirs.slice(keepCopies);

      if (toDelete.length > 0) {
        this.logger.info(`Cleaning up ${toDelete.length} old local backup(s), keeping ${keepCopies} most recent`);

        for (const dir of toDelete) {
          this.logger.info(`Deleting old local backup: ${dir.name}`);
          fs.rmSync(dir.path, { recursive: true, force: true });
        }
      } else {
        this.logger.debug(`No old local backups to clean up (${dateDirs.length} total, keeping ${keepCopies})`);
      }
    } catch (error) {
      this.logger.warn(`Failed to clean up old local backups: ${error.message}`);
      // Don't fail the backup if cleanup fails
    }
  }
}
