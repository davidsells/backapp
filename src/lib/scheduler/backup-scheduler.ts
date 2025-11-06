import cron from 'node-cron';
import { prisma } from '../db/prisma';
import { getBackupExecutor } from '../backup/backup-executor';

export interface ScheduledTask {
  configId: string;
  task: cron.ScheduledTask;
}

export class BackupScheduler {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private backupExecutor = getBackupExecutor();

  /**
   * Initialize scheduler and load all enabled backup configurations
   */
  async initialize(): Promise<void> {
    console.log('[Scheduler] Initializing backup scheduler...');

    try {
      // Load all enabled backup configs
      const configs = await prisma.backupConfig.findMany({
        where: { enabled: true },
      });

      console.log(`[Scheduler] Found ${configs.length} enabled backup configurations`);

      for (const config of configs) {
        await this.scheduleBackup(config.id);
      }

      console.log('[Scheduler] Backup scheduler initialized successfully');
    } catch (error) {
      console.error('[Scheduler] Failed to initialize scheduler:', error);
      throw error;
    }
  }

  /**
   * Schedule a backup configuration
   */
  async scheduleBackup(configId: string): Promise<void> {
    try {
      // Get configuration
      const config = await prisma.backupConfig.findUnique({
        where: { id: configId },
      });

      if (!config || !config.enabled) {
        console.log(`[Scheduler] Config ${configId} not found or disabled, skipping`);
        return;
      }

      // Cancel existing schedule if any
      this.cancelSchedule(configId);

      const schedule = config.schedule as any;
      const cronExpression = schedule.cronExpression;

      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        console.error(`[Scheduler] Invalid cron expression for config ${configId}: ${cronExpression}`);
        return;
      }

      // Create scheduled task
      const task = cron.schedule(
        cronExpression,
        async () => {
          console.log(`[Scheduler] Executing scheduled backup: ${config.name} (${configId})`);

          try {
            await this.backupExecutor.executeBackup({
              configId: config.id,
              userId: config.userId,
            });

            console.log(`[Scheduler] Backup completed successfully: ${config.name}`);
          } catch (error) {
            console.error(`[Scheduler] Backup failed: ${config.name}`, error);

            // Create alert for failed backup
            await prisma.alert.create({
              data: {
                userId: config.userId,
                configId: config.id,
                type: 'error',
                message: `Scheduled backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            });
          }
        },
        {
          scheduled: true,
          timezone: schedule.timezone || 'UTC',
        }
      );

      this.scheduledTasks.set(configId, task);

      console.log(`[Scheduler] Scheduled backup: ${config.name} (${configId}) with cron: ${cronExpression}`);
    } catch (error) {
      console.error(`[Scheduler] Failed to schedule backup ${configId}:`, error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled backup
   */
  cancelSchedule(configId: string): void {
    const task = this.scheduledTasks.get(configId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(configId);
      console.log(`[Scheduler] Cancelled schedule for config: ${configId}`);
    }
  }

  /**
   * Reschedule a backup (cancel and schedule again)
   */
  async rescheduleBackup(configId: string): Promise<void> {
    this.cancelSchedule(configId);
    await this.scheduleBackup(configId);
  }

  /**
   * Get all scheduled tasks
   */
  getScheduledTasks(): string[] {
    return Array.from(this.scheduledTasks.keys());
  }

  /**
   * Stop all scheduled tasks
   */
  stopAll(): void {
    console.log('[Scheduler] Stopping all scheduled tasks...');

    for (const [configId, task] of this.scheduledTasks.entries()) {
      task.stop();
      console.log(`[Scheduler] Stopped task: ${configId}`);
    }

    this.scheduledTasks.clear();
    console.log('[Scheduler] All tasks stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    totalScheduled: number;
    scheduledConfigs: string[];
  } {
    return {
      totalScheduled: this.scheduledTasks.size,
      scheduledConfigs: Array.from(this.scheduledTasks.keys()),
    };
  }

  /**
   * Trigger immediate execution of a scheduled backup
   */
  async triggerNow(configId: string): Promise<void> {
    const config = await prisma.backupConfig.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new Error('Backup configuration not found');
    }

    console.log(`[Scheduler] Triggering immediate backup: ${config.name} (${configId})`);

    await this.backupExecutor.executeBackup({
      configId: config.id,
      userId: config.userId,
    });
  }
}

// Singleton instance
let schedulerInstance: BackupScheduler | null = null;

export function getBackupScheduler(): BackupScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new BackupScheduler();
  }
  return schedulerInstance;
}
