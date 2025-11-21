import axios from 'axios';

/**
 * API client for communicating with BackApp server
 */
export class ApiClient {
  constructor(config) {
    this.config = config;
    this.apiKey = config.apiKey;
    this.serverUrl = config.serverUrl.replace(/\/$/, ''); // Remove trailing slash

    this.client = axios.create({
      baseURL: this.serverUrl,
      headers: {
        'X-Agent-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });
  }

  /**
   * Send heartbeat to server
   */
  async sendHeartbeat() {
    try {
      const response = await this.client.post('/api/agent/heartbeat', {
        platform: this.config.agent.platform,
        version: this.config.agent.version,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Heartbeat failed: ${error.message}`);
    }
  }

  /**
   * Fetch backup configurations assigned to this agent
   */
  async getConfigs() {
    try {
      const response = await this.client.get('/api/agent/configs');
      return response.data.configs || [];
    } catch (error) {
      throw new Error(`Failed to fetch configs: ${error.message}`);
    }
  }

  /**
   * Start a backup and get pre-signed URL for upload
   * @param {string} configId - Backup configuration ID
   * @param {string} filename - Name of the backup file
   * @returns {Promise<{logId: string, upload: {url: string, method: string, s3Path: string}}>}
   */
  async startBackup(configId, filename) {
    try {
      const response = await this.client.post('/api/agent/backup/start', {
        configId,
        filename,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to start backup: ${error.message}`);
    }
  }

  /**
   * Mark backup as complete
   * @param {string} logId - Backup log ID
   * @param {boolean} success - Whether backup succeeded
   * @param {string} [error] - Error message if failed
   * @param {number} [fileSize] - Size of uploaded file in bytes
   */
  async completeBackup(logId, success, error = null, fileSize = null) {
    try {
      const response = await this.client.post('/api/agent/backup/complete', {
        logId,
        status: success ? 'completed' : 'failed',  // Convert boolean to status string
        filesProcessed: 0,  // TODO: Track actual file count
        bytesTransferred: fileSize || 0,
        duration: undefined,  // TODO: Calculate from start time
        errors: error ? [error] : undefined,
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to complete backup: ${error.message}`);
    }
  }

  /**
   * Send log message to server
   * @param {'info' | 'warn' | 'error'} level - Log level
   * @param {string} message - Log message
   * @param {object} [metadata] - Additional metadata
   */
  async sendLog(level, message, metadata = {}) {
    try {
      await this.client.post('/api/agent/log', {
        level,
        message,
        metadata,
      });
    } catch (error) {
      // Don't throw on log failures, just console.error
      console.error(`Failed to send log: ${error.message}`);
    }
  }

  /**
   * Upload file to S3 using pre-signed URL
   * @param {string} url - Pre-signed URL
   * @param {Buffer} data - File data
   * @param {string} contentType - MIME type
   */
  async uploadToS3(url, data, contentType = 'application/gzip') {
    try {
      await axios.put(url, data, {
        headers: {
          'Content-Type': contentType,
        },
        timeout: 300000, // 5 minutes for upload
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });
    } catch (error) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  /**
   * Fetch pending size assessment requests
   */
  async getSizeRequests() {
    try {
      const response = await this.client.get('/api/agent/size-requests');
      return response.data.requests || [];
    } catch (error) {
      throw new Error(`Failed to fetch size requests: ${error.message}`);
    }
  }

  /**
   * Report size assessment results
   * @param {string} requestId - Size assessment request ID
   * @param {number} totalBytes - Total size in bytes
   * @param {number} totalFiles - Total file count
   * @param {string} [error] - Error message if failed
   */
  async reportSize(requestId, totalBytes, totalFiles, error = null) {
    try {
      const payload = {
        requestId,
        totalBytes,
        totalFiles,
      };

      // Only include error field if it has a value
      if (error) {
        payload.error = error;
      }

      const response = await this.client.post('/api/agent/size-assessment', payload);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to report size: ${error.message}`);
    }
  }
}
