import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { ApiClient } from './api-client.js';
import { Logger } from './logger.js';
import { retryWithBackoff, classifyError } from './retry-util.js';

/**
 * Handles backup execution for a configuration
 */
export class BackupExecutor {
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
   * Execute backup for a specific configuration
   * @param {object} backupConfig - Backup configuration from server
   */
  async executeBackup(backupConfig) {
    const startTime = Date.now();
    this.logger.info(`Starting backup: ${backupConfig.name}`, { configId: backupConfig.id });

    // Notify via WebSocket
    if (this.wsClient?.isReady()) {
      this.wsClient.notifyBackupStarted(backupConfig.id, backupConfig.name);
    }

    let logId = null;
    let archivePath = null;

    try {
      // Validate source paths exist (no retry - this is a configuration error)
      this.validateSources(backupConfig.sources);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${backupConfig.name}-${timestamp}.tar.gz`;
      archivePath = path.join(process.cwd(), filename);

      this.logger.info(`Creating archive: ${filename}`);

      // Send initial progress
      this.sendProgress(backupConfig, { stage: 'preparing', filesProcessed: 0, bytesProcessed: 0 });

      // Create tar.gz archive (no retry - local operation)
      const archiveSize = await this.createArchive(backupConfig.sources, archivePath, backupConfig);
      this.logger.info(`Archive created: ${archiveSize} bytes`);

      // Request pre-signed URL (with retry)
      this.logger.info('Requesting upload URL from server');
      const startResponse = await retryWithBackoff(
        () => this.apiClient.startBackup(backupConfig.id, filename),
        {
          ...this.retryConfig,
          onRetry: (attempt, error, delay) => {
            this.logger.warn(`Retry ${attempt}/${this.retryConfig.maxAttempts} for startBackup after ${(delay/1000).toFixed(1)}s: ${error.message}`);
          },
        }
      );

      logId = startResponse.logId;
      const { url: uploadUrl, s3Path } = startResponse.upload;

      this.logger.info(`Uploading to S3: ${s3Path}`);

      // Send upload progress
      this.sendProgress(backupConfig, { stage: 'uploading', filesProcessed: 0, bytesProcessed: 0, totalBytes: archiveSize });

      // Upload to S3 (with retry)
      const fileData = fs.readFileSync(archivePath);
      await retryWithBackoff(
        () => this.apiClient.uploadToS3(uploadUrl, fileData, 'application/gzip'),
        {
          ...this.retryConfig,
          maxAttempts: 5, // More retries for S3 uploads
          onRetry: (attempt, error, delay) => {
            this.logger.warn(`Retry ${attempt}/5 for S3 upload after ${(delay/1000).toFixed(1)}s: ${error.message}`);
          },
        }
      );

      this.logger.info('Upload complete');

      // Mark as complete (with retry)
      await retryWithBackoff(
        () => this.apiClient.completeBackup(logId, true, null, archiveSize),
        {
          ...this.retryConfig,
          onRetry: (attempt, error, delay) => {
            this.logger.warn(`Retry ${attempt}/${this.retryConfig.maxAttempts} for completeBackup after ${(delay/1000).toFixed(1)}s: ${error.message}`);
          },
        }
      );

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.info(`Backup completed successfully in ${duration}s`, {
        configId: backupConfig.id,
        size: archiveSize,
        duration,
      });

      // Notify success via WebSocket
      if (this.wsClient?.isReady()) {
        this.wsClient.notifyBackupCompleted(backupConfig.id, backupConfig.name, {
          size: archiveSize,
          duration: parseFloat(duration),
        });
      }

      return { success: true, size: archiveSize, duration };
    } catch (error) {
      // Classify error for better messaging
      const classification = classifyError(error);

      this.logger.error(`Backup failed (${classification.category}): ${classification.userMessage}`, {
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
          // Try to report failure (with retry)
          await retryWithBackoff(
            () => this.apiClient.completeBackup(logId, false, classification.userMessage),
            {
              maxAttempts: 2, // Only retry once for failure reporting
              baseDelay: 1000,
              onRetry: (attempt, err, delay) => {
                this.logger.warn(`Retry ${attempt}/2 for failure reporting after ${(delay/1000).toFixed(1)}s`);
              },
            }
          );
        } catch (completeError) {
          this.logger.error(`Failed to report backup failure to server: ${completeError.message}`);
          // Don't throw - we've already failed the backup
        }
      }

      return {
        success: false,
        error: classification.userMessage,
        errorCategory: classification.category,
        retriable: classification.retriable,
      };
    } finally {
      // Clean up archive file
      if (archivePath && fs.existsSync(archivePath)) {
        try {
          fs.unlinkSync(archivePath);
          this.logger.debug(`Cleaned up local archive: ${archivePath}`);
        } catch (cleanupError) {
          this.logger.warn(`Failed to cleanup archive: ${cleanupError.message}`);
        }
      }
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
   * Create tar.gz archive of source paths
   * @returns {Promise<number>} Size of created archive in bytes
   */
  async createArchive(sources, outputPath, backupConfig = null) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 6 }, // Compression level 1-9
      });

      let archiveSize = 0;
      let filesProcessed = 0;
      let bytesProcessed = 0;
      let lastProgressUpdate = Date.now();
      const progressUpdateInterval = 1000; // Update every second

      output.on('close', () => {
        archiveSize = archive.pointer();
        resolve(archiveSize);
      });

      archive.on('error', (err) => {
        reject(new Error(`Archive creation failed: ${err.message}`));
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          this.logger.warn(`File not found during archiving: ${err.message}`);
        } else {
          reject(err);
        }
      });

      // Track progress during archiving
      archive.on('entry', (entry) => {
        filesProcessed++;
        bytesProcessed += entry.stats?.size || 0;

        // Send progress update (throttled)
        const now = Date.now();
        if (now - lastProgressUpdate >= progressUpdateInterval) {
          this.sendProgress(backupConfig, {
            stage: 'archiving',
            filesProcessed,
            bytesProcessed,
            currentFile: entry.name,
          });
          lastProgressUpdate = now;
        }
      });

      archive.pipe(output);

      // Add each source to the archive
      for (const source of sources) {
        const sourcePath = source.path;

        // Re-check if path still exists (it may have been deleted since validation)
        if (!fs.existsSync(sourcePath)) {
          this.logger.warn(`Skipping missing path: ${sourcePath}`);
          continue;
        }

        const stats = fs.statSync(sourcePath);

        if (stats.isDirectory()) {
          // Add directory recursively
          const dirName = path.basename(sourcePath);
          archive.directory(sourcePath, dirName);
          this.logger.debug(`Added directory: ${sourcePath}`);
        } else if (stats.isFile()) {
          // Add individual file
          const fileName = path.basename(sourcePath);
          archive.file(sourcePath, { name: fileName });
          this.logger.debug(`Added file: ${sourcePath}`);
        } else {
          this.logger.warn(`Skipping unsupported file type: ${sourcePath}`);
        }
      }

      archive.finalize();
    });
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
