#!/usr/bin/env node

/**
 * Backup Scheduler Runner
 *
 * This script runs as a separate process to execute scheduled backups.
 * It should be started alongside the main Next.js application.
 *
 * Usage:
 *   npm run scheduler
 *   or
 *   node --loader ts-node/esm src/lib/scheduler/scheduler-runner.ts
 */

import { getBackupScheduler } from './backup-scheduler';

async function main() {
  console.log('===========================================');
  console.log('  BackApp - Backup Scheduler');
  console.log('===========================================');
  console.log('');

  try {
    const scheduler = getBackupScheduler();

    // Initialize scheduler with all enabled configs
    await scheduler.initialize();

    // Display status
    const status = scheduler.getStatus();
    console.log('');
    console.log('Scheduler Status:');
    console.log(`  Total Scheduled: ${status.totalScheduled}`);
    console.log(`  Scheduled Configs: ${status.scheduledConfigs.join(', ') || 'None'}`);
    console.log('');
    console.log('Scheduler is running. Press Ctrl+C to stop.');

    // Graceful shutdown handler
    const shutdown = () => {
      console.log('');
      console.log('Shutting down scheduler...');
      scheduler.stopAll();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Keep process alive
    process.stdin.resume();
  } catch (error) {
    console.error('Failed to start scheduler:', error);
    process.exit(1);
  }
}

main();
