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
      // Validate rsync configuration
      if (!rsyncOptions) {
        throw new Error('Rsync options not configured');
      }

      if (!rsyncOptions.localReplica) {
        throw new Error('Local replica path not configured');
      }

      if (!rsyncOptions.s3Bucket) {
        throw new Error('S3 bucket not configured');
      }

      // Validate source paths exist
      this.validateSources(backupConfig.sources);

      // Ensure local replica directory exists
      this.ensureDirectory(rsyncOptions.localReplica);

      // Generate S3 path with date tag
      const dateTag = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const s3Prefix = rsyncOptions.s3Prefix
        ? `${rsyncOptions.s3Prefix}/rsync/${dateTag}/`
        : `rsync/${dateTag}/`;
      const s3Path = `s3://${rsyncOptions.s3Bucket}/${s3Prefix}`;

      this.logger.info(`Local replica: ${rsyncOptions.localReplica}`);
      this.logger.info(`S3 destination: ${s3Path}`);

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

      // Step 2: Upload to S3 using AWS CLI
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

      // Report to server
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      // Create a simple log entry (no pre-signed URL needed for rsync)
      const logResponse = await retryWithBackoff(
        () => this.apiClient.post('/api/agent/log', {
          configId: backupConfig.id,
          status: 'completed',
          filesProcessed: rsyncStats.filesTransferred,
          totalBytes: rsyncStats.totalSize,
          s3Path: s3Path,
          duration: parseFloat(duration)
        }),
        {
          ...this.retryConfig,
          onRetry: (attempt, error, delay) => {
            this.logger.warn(`Retry ${attempt}/${this.retryConfig.maxAttempts} for logging after ${(delay/1000).toFixed(1)}s: ${error.message}`);
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

      const awsProcess = spawn('aws', args);
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
