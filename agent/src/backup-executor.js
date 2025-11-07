import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { ApiClient } from './api-client.js';
import { Logger } from './logger.js';

/**
 * Handles backup execution for a configuration
 */
export class BackupExecutor {
  constructor(config, apiClient, logger) {
    this.config = config;
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Execute backup for a specific configuration
   * @param {object} backupConfig - Backup configuration from server
   */
  async executeBackup(backupConfig) {
    const startTime = Date.now();
    this.logger.info(`Starting backup: ${backupConfig.name}`, { configId: backupConfig.id });

    let logId = null;
    let archivePath = null;

    try {
      // Validate source paths exist
      this.validateSources(backupConfig.sources);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${backupConfig.name}-${timestamp}.tar.gz`;
      archivePath = path.join(process.cwd(), filename);

      this.logger.info(`Creating archive: ${filename}`);

      // Create tar.gz archive
      const archiveSize = await this.createArchive(backupConfig.sources, archivePath);
      this.logger.info(`Archive created: ${archiveSize} bytes`);

      // Request pre-signed URL
      this.logger.info('Requesting upload URL from server');
      const startResponse = await this.apiClient.startBackup(backupConfig.id, filename);
      logId = startResponse.logId;
      const { url: uploadUrl, s3Path } = startResponse.upload;

      this.logger.info(`Uploading to S3: ${s3Path}`);

      // Upload to S3
      const fileData = fs.readFileSync(archivePath);
      await this.apiClient.uploadToS3(uploadUrl, fileData, 'application/gzip');

      this.logger.info('Upload complete');

      // Mark as complete
      await this.apiClient.completeBackup(logId, true, null, archiveSize);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.info(`Backup completed successfully in ${duration}s`, {
        configId: backupConfig.id,
        size: archiveSize,
        duration,
      });

      return { success: true, size: archiveSize, duration };
    } catch (error) {
      this.logger.error(`Backup failed: ${error.message}`, { configId: backupConfig.id });

      // Report failure to server if we have a logId
      if (logId) {
        try {
          await this.apiClient.completeBackup(logId, false, error.message);
        } catch (completeError) {
          this.logger.error(`Failed to report backup failure: ${completeError.message}`);
        }
      }

      return { success: false, error: error.message };
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
        throw new Error(`Source path does not exist: ${source.path}`);
      }

      try {
        fs.accessSync(source.path, fs.constants.R_OK);
      } catch (error) {
        throw new Error(`Cannot access source path: ${source.path}`);
      }
    }
  }

  /**
   * Create tar.gz archive of source paths
   * @returns {Promise<number>} Size of created archive in bytes
   */
  async createArchive(sources, outputPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 6 }, // Compression level 1-9
      });

      let archiveSize = 0;

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

      archive.pipe(output);

      // Add each source to the archive
      for (const source of sources) {
        const sourcePath = source.path;
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
}
