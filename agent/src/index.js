#!/usr/bin/env node

import { loadConfig } from './config.js';
import { ApiClient } from './api-client.js';
import { BackupExecutor } from './backup-executor.js';
import { Logger } from './logger.js';
import { AgentWebSocketClient } from './websocket-client.js';
import { filterDueConfigs, shouldRunBackup } from './schedule-checker.js';

/**
 * BackApp Agent - Client-side backup execution
 */
class Agent {
  constructor() {
    this.config = null;
    this.apiClient = null;
    this.logger = null;
    this.wsClient = null;
  }

  /**
   * Initialize agent
   */
  async initialize() {
    console.log('BackApp Agent v1.0.0');
    console.log('====================\n');

    try {
      // Load configuration
      this.config = loadConfig();
      this.logger = new Logger(null, this.config.logLevel);
      this.logger.info('Configuration loaded');

      // Initialize API client
      this.apiClient = new ApiClient(this.config);
      this.logger.apiClient = this.apiClient; // Enable remote logging

      // Send heartbeat
      this.logger.info('Connecting to server...');
      const heartbeat = await this.apiClient.sendHeartbeat();
      this.logger.info(`Connected to server as: ${heartbeat.agent?.name || 'Unknown'}`);

      // Initialize WebSocket client
      const wsUrl = this.config.serverUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/api/ws';
      this.wsClient = new AgentWebSocketClient(
        wsUrl,
        heartbeat.agent?.userId,
        heartbeat.agent?.id,
        this.logger
      );

      // Connect to WebSocket (non-blocking)
      this.wsClient.connect().catch((error) => {
        this.logger.warn(`WebSocket connection failed: ${error.message}`);
        this.logger.info('Agent will continue without real-time updates');
      });

      // Update logger with WebSocket client for log streaming
      this.logger.wsClient = this.wsClient;

      return true;
    } catch (error) {
      console.error(`Initialization failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Run backup cycle
   * Checks for:
   * 1. Requested backups (user clicked "Run Now")
   * 2. Scheduled backups (cron is due)
   */
  async run() {
    try {
      // Fetch configurations
      this.logger.info('Fetching backup configurations...');
      const configs = await this.apiClient.getConfigs();

      if (configs.length === 0) {
        this.logger.info('No backup configurations assigned to this agent');
        return;
      }

      this.logger.info(`Found ${configs.length} backup configuration(s)`);

      // Filter configs based on schedule or request status
      const dueConfigs = filterDueConfigs(configs);

      if (dueConfigs.length === 0) {
        this.logger.info('No backups are due to run at this time');

        // Show why each config was skipped
        configs.forEach((config) => {
          const check = shouldRunBackup(config);
          this.logger.debug(`Skipped "${config.name}": ${check.reason}`);
        });

        return;
      }

      this.logger.info(`${dueConfigs.length} backup(s) are due to run`);

      // Execute each due backup
      const executor = new BackupExecutor(this.config, this.apiClient, this.logger, this.wsClient);
      const results = [];

      for (const backupConfig of dueConfigs) {
        this.logger.info(`Running backup: ${backupConfig.name} - ${backupConfig._runReason}`);
        const result = await executor.executeBackup(backupConfig);
        results.push({ config: backupConfig.name, ...result });
      }

      // Print summary
      console.log('\n====================');
      console.log('Backup Summary');
      console.log('====================');

      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      results.forEach((result) => {
        const status = result.success ? '✓' : '✗';
        const details = result.success
          ? `${(result.size / 1024 / 1024).toFixed(2)} MB in ${result.duration}s`
          : result.error;
        console.log(`${status} ${result.config}: ${details}`);
      });

      console.log(`\nTotal: ${successful} succeeded, ${failed} failed`);
    } catch (error) {
      this.logger.error(`Backup cycle failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup and disconnect
   */
  cleanup() {
    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  const agent = new Agent();

  const initialized = await agent.initialize();
  if (!initialized) {
    process.exit(1);
  }

  try {
    await agent.run();
    console.log('\nBackup cycle completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('\nBackup cycle failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { Agent };
