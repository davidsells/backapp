import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { retryWithBackoff, classifyError } from './retry-util.js';

/**
 * Handles rsync-based backup with S3 upload
 * Based on the rsync → S3 pattern:
 * 1. rsync source → local replica (delta copy with hard-links)
 * 2. aws s3 sync local replica → S3 bucket
 */
export class RsyncExecutor {
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
   * Execute rsync backup for a specific configuration
   * @param {object} backupConfig - Backup configuration from server
   */
  async executeBackup(backupConfig) {
    const startTime = Date.now();
    this.logger.info(`Starting rsync backup: ${backupConfig.name}`, { configId: backupConfig.id });

    // Notify via WebSocket
    if (this.wsClient?.isReady()) {
      this.wsClient.notifyBackupStarted(backupConfig.id, backupConfig.name);
    }

    let logId = null;
    const rsyncOptions = backupConfig.options?.rsync;

    try {
      // Step 0: Create backup log entry on server
      this.logger.info('Creating backup log entry...');
      const startResponse = await this.apiClient.startBackup(
        backupConfig.id,
        `rsync-${new Date().toISOString().slice(0, 10)}.log` // Dummy filename for rsync
      );
      logId = startResponse.logId;
      this.logger.info(`Backup log created: ${logId}`);

      // Validate rsync configuration
      if (!rsyncOptions) {
        throw new Error('Rsync options not configured');
      }

      if (!rsyncOptions.localReplica) {
        throw new Error('Local replica path not configured');
      }

      // Determine if we're uploading to S3 (default true for backward compatibility)
      const uploadToS3 = rsyncOptions.uploadToS3 !== false;

      // If uploading to S3, validate AWS credentials
      let s3Bucket, awsRegion, s3Prefix, s3Path;
      if (uploadToS3) {
        // Get AWS credentials from config (provided by server)
        const awsCredentials = backupConfig.awsCredentials;
        if (!awsCredentials) {
          throw new Error('AWS credentials not provided by server. Server must send temporary credentials for rsync backups.');
        }

        s3Bucket = awsCredentials.bucket;
        awsRegion = awsCredentials.region;

        if (!s3Bucket) {
          throw new Error('S3 bucket not configured in server credentials');
        }

        // Validate that userId and agentId are present for path construction
        if (!backupConfig.userId || !backupConfig.agentId) {
          throw new Error('Backup configuration missing userId or agentId for S3 path construction');
        }
      }

      // Validate source paths exist
      this.validateSources(backupConfig.sources);

      // Ensure local replica directory exists
      this.ensureDirectory(rsyncOptions.localReplica);

      // Auto-generate S3 path if uploading to S3
      if (uploadToS3) {
        // Auto-generate S3 path: users/{userId}/agents/{agentId}/configs/{configId}/rsync/{YYYY-MM-DD}
        // Include configId to prevent multiple rsync configs from overwriting each other
        const dateTag = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        s3Prefix = `users/${backupConfig.userId}/agents/${backupConfig.agentId}/configs/${backupConfig.id}/rsync/${dateTag}/`;
        s3Path = `s3://${s3Bucket}/${s3Prefix}`;
      }

      this.logger.info(`Local replica: ${rsyncOptions.localReplica}`);
      if (uploadToS3) {
        this.logger.info(`S3 destination: ${s3Path}`);
      } else {
        this.logger.info('Local-only backup (S3 upload disabled)');
      }

      // Send initial progress
      this.sendProgress(backupConfig, {
        stage: 'preparing',
        filesProcessed: 0,
        bytesProcessed: 0
      });

      // Step 1: Rsync to local replica
      this.logger.info('Step 1: Syncing to local replica with rsync');
      this.sendProgress(backupConfig, {
        stage: 'rsync',
        filesProcessed: 0,
        bytesProcessed: 0
      });

      const rsyncStats = await this.executeRsync(
        backupConfig.sources,
        rsyncOptions.localReplica,
        rsyncOptions.delete,
        backupConfig
      );

      this.logger.info(`Rsync complete: ${rsyncStats.filesTransferred} files, ${rsyncStats.totalSize} bytes`);

      // Step 2: Upload to S3 using AWS CLI (optional)
      if (uploadToS3) {
        this.logger.info('Step 2: Uploading to S3');
        this.sendProgress(backupConfig, {
          stage: 'uploading',
          filesProcessed: rsyncStats.filesTransferred,
          bytesProcessed: 0,
          totalBytes: rsyncStats.totalSize
        });

        await this.uploadToS3(
          rsyncOptions.localReplica,
          s3Path,
          rsyncOptions.storageClass || 'STANDARD_IA',
          rsyncOptions.delete,
          backupConfig
        );

        this.logger.info('S3 upload complete');
      } else {
        this.logger.info('Step 2: Skipping S3 upload (local-only backup)');
      }

      // Report completion to server
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      await retryWithBackoff(
        () => this.apiClient.completeBackup(
          logId,
          true, // success
          null, // no error
          rsyncStats.totalSize
        ),
        {
          ...this.retryConfig,
          onRetry: (attempt, error, delay) => {
            this.logger.warn(`Retry ${attempt}/${this.retryConfig.maxAttempts} for completeBackup after ${(delay/1000).toFixed(1)}s: ${error.message}`);
          },
        }
      );

      this.logger.info(`Rsync backup completed successfully in ${duration}s`, {
        configId: backupConfig.id,
        filesTransferred: rsyncStats.filesTransferred,
        totalSize: rsyncStats.totalSize,
        duration,
      });

      // Notify success via WebSocket
      if (this.wsClient?.isReady()) {
        this.wsClient.notifyBackupCompleted(backupConfig.id, backupConfig.name, {
          size: rsyncStats.totalSize,
          duration: parseFloat(duration),
          filesTransferred: rsyncStats.filesTransferred,
        });
      }

      return {
        success: true,
        filesTransferred: rsyncStats.filesTransferred,
        size: rsyncStats.totalSize,
        duration
      };

    } catch (error) {
      // Classify error for better messaging
      const classification = classifyError(error);

      this.logger.error(`Rsync backup failed (${classification.category}): ${classification.userMessage}`, {
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
   * Ensure directory exists, create if necessary
   */
  ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.logger.info(`Created directory: ${dirPath}`);
    }
  }

  /**
   * Execute rsync command to sync sources to local replica
   * @returns {Promise<object>} Stats about the rsync operation
   */
  async executeRsync(sources, localReplica, deleteFlag, backupConfig = null) {
    return new Promise((resolve, reject) => {
      // Build rsync arguments
      const args = [
        '--archive',           // Archive mode (recursive, preserve permissions, etc.)
        '--hard-links',        // Preserve hard links
        '--human-readable',    // Human-readable output
        '--stats',             // Show statistics
        '--progress',          // Show progress
      ];

      if (deleteFlag) {
        args.push('--delete'); // Remove files in dest that don't exist in source
      }

      // Add exclusions if any
      const exclusions = this.collectExclusions(sources);
      exclusions.forEach(pattern => {
        args.push(`--exclude=${pattern}`);
      });

      // Add all source paths
      // Note: Adding trailing slash to copy contents, not folder itself
      sources.forEach(source => {
        const sourcePath = source.path.endsWith('/') ? source.path : `${source.path}/`;
        args.push(sourcePath);
      });

      // Add destination
      args.push(localReplica);

      this.logger.debug(`Executing: rsync ${args.join(' ')}`);

      const rsyncProcess = spawn('rsync', args);
      let stdout = '';
      let stderr = '';
      let filesTransferred = 0;
      let totalSize = 0;

      rsyncProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        // Parse progress for WebSocket updates
        // Look for lines like: "1,234 files... 12.34M bytes..."
        const progressMatch = output.match(/(\d+[,\d]*)\s+files/);
        if (progressMatch) {
          const files = parseInt(progressMatch[1].replace(/,/g, ''));
          this.sendProgress(backupConfig, {
            stage: 'rsync',
            filesProcessed: files,
            bytesProcessed: 0,
          });
        }
      });

      rsyncProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      rsyncProcess.on('close', (code) => {
        if (code === 0) {
          // Parse stats from output
          const stats = this.parseRsyncStats(stdout);
          resolve(stats);
        } else {
          const error = new Error(`Rsync failed with code ${code}: ${stderr}`);
          error.code = 'RSYNC_ERROR';
          reject(error);
        }
      });

      rsyncProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          error.message = 'rsync command not found. Please install rsync.';
        }
        reject(error);
      });
    });
  }

  /**
   * Upload local replica to S3 using AWS CLI
   */
  async uploadToS3(localReplica, s3Path, storageClass, deleteFlag, backupConfig = null) {
    return new Promise((resolve, reject) => {
      const args = [
        's3', 'sync',
        localReplica,
        s3Path,
        `--storage-class=${storageClass}`,
      ];

      if (deleteFlag) {
        args.push('--delete'); // Mirror deletions to S3
      }

      this.logger.debug(`Executing: aws ${args.join(' ')}`);

      // Set AWS credentials from backupConfig (provided by server)
      const env = {
        ...process.env,
      };

      if (backupConfig?.awsCredentials) {
        env.AWS_ACCESS_KEY_ID = backupConfig.awsCredentials.accessKeyId;
        env.AWS_SECRET_ACCESS_KEY = backupConfig.awsCredentials.secretAccessKey;
        env.AWS_DEFAULT_REGION = backupConfig.awsCredentials.region;

        // Only set session token if it exists (not all credentials have it)
        if (backupConfig.awsCredentials.sessionToken) {
          env.AWS_SESSION_TOKEN = backupConfig.awsCredentials.sessionToken;
        }

        this.logger.debug(`Using temporary credentials for S3 upload (expires: ${backupConfig.awsCredentials.expiration})`);
      } else {
        this.logger.warn('No AWS credentials provided in backupConfig, attempting with environment credentials');
      }

      const awsProcess = spawn('aws', args, { env });
      let stdout = '';
      let stderr = '';

      awsProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;

        // AWS CLI outputs upload progress
        // Send updates via WebSocket if available
        if (this.wsClient?.isReady() && backupConfig) {
          this.sendProgress(backupConfig, {
            stage: 'uploading',
            filesProcessed: 0,
            bytesProcessed: 0,
          });
        }
      });

      awsProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      awsProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          const error = new Error(`AWS S3 sync failed with code ${code}: ${stderr}`);
          error.code = 'S3_SYNC_ERROR';
          reject(error);
        }
      });

      awsProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          error.message = 'aws command not found. Please install AWS CLI v2.';
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
    exclusions.add('node_modules');
    exclusions.add('.git');
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
   * Parse rsync statistics from output
   */
  parseRsyncStats(output) {
    const stats = {
      filesTransferred: 0,
      totalSize: 0,
    };

    // Look for lines like:
    // "Number of files: 1,234 (reg: 1,000, dir: 234)"
    // "Total file size: 12,345,678 bytes"
    const filesMatch = output.match(/Number of files:\s*(\d+[,\d]*)/);
    if (filesMatch) {
      stats.filesTransferred = parseInt(filesMatch[1].replace(/,/g, ''));
    }

    const sizeMatch = output.match(/Total file size:\s*(\d+[,\d]*)\s*bytes/);
    if (sizeMatch) {
      stats.totalSize = parseInt(sizeMatch[1].replace(/,/g, ''));
    }

    // Fallback: look for "sent X bytes  received Y bytes"
    const sentMatch = output.match(/sent\s+(\d+[,\d]*)\s+bytes/);
    if (sentMatch && stats.totalSize === 0) {
      stats.totalSize = parseInt(sentMatch[1].replace(/,/g, ''));
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
}
