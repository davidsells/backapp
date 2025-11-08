#!/usr/bin/env node

import { Agent } from './index.js';
import { Logger } from './logger.js';

/**
 * BackApp Agent Daemon
 * Runs continuously in the background, polling for backup tasks
 */
class AgentDaemon {
  constructor() {
    this.agent = null;
    this.logger = null;
    this.running = false;
    this.pollInterval = 5 * 60 * 1000; // 5 minutes
    this.pollTimer = null;
  }

  /**
   * Start the daemon
   */
  async start() {
    console.log('BackApp Agent Daemon v1.0.0');
    console.log('============================\n');

    // Handle graceful shutdown
    this.setupSignalHandlers();

    this.running = true;
    this.logger = new Logger(null, process.env.LOG_LEVEL || 'info');
    this.logger.info('Daemon starting...');

    // Initialize agent
    this.agent = new Agent();
    const initialized = await this.agent.initialize();

    if (!initialized) {
      this.logger.error('Failed to initialize agent');
      process.exit(1);
    }

    this.logger.info('Agent initialized successfully');
    this.logger.info(`Polling interval: ${this.pollInterval / 1000 / 60} minutes`);

    // Start polling loop
    await this.pollLoop();
  }

  /**
   * Main polling loop
   */
  async pollLoop() {
    while (this.running) {
      try {
        this.logger.info('Starting backup cycle...');
        await this.agent.run();
        this.logger.info('Backup cycle completed');
      } catch (error) {
        this.logger.error(`Backup cycle error: ${error.message}`);
        // Continue running despite errors
      }

      // Wait for next poll interval (if still running)
      if (this.running) {
        this.logger.info(`Next backup cycle in ${this.pollInterval / 1000 / 60} minutes`);
        await this.sleep(this.pollInterval);
      }
    }

    this.logger.info('Daemon stopped');
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => {
      this.pollTimer = setTimeout(resolve, ms);
    });
  }

  /**
   * Gracefully shutdown the daemon
   */
  async shutdown() {
    if (!this.running) return;

    this.logger.info('Shutdown signal received, stopping daemon...');
    this.running = false;

    // Cancel pending timer
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Cleanup agent connections
    if (this.agent) {
      this.agent.cleanup();
    }

    // Give time for current operations to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.logger.info('Daemon shutdown complete');
    process.exit(0);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  setupSignalHandlers() {
    // Handle SIGTERM (from systemd/launchd)
    process.on('SIGTERM', () => {
      this.logger?.info('Received SIGTERM signal');
      this.shutdown();
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.logger?.info('Received SIGINT signal');
      this.shutdown();
    });

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      this.logger?.error(`Uncaught exception: ${error.message}`);
      this.logger?.error(error.stack);
      // Don't exit, just log the error
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger?.error(`Unhandled rejection at ${promise}: ${reason}`);
      // Don't exit, just log the error
    });
  }
}

/**
 * Main entry point
 */
async function main() {
  const daemon = new AgentDaemon();
  await daemon.start();
}

// Run daemon
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
