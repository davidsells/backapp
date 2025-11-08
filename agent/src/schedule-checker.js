import parser from 'cron-parser';

/**
 * Check if a backup configuration should run based on its schedule
 * @param {object} config - Backup configuration from server
 * @param {object} [options] - Options for schedule checking
 * @param {boolean} [options.forceManual] - If true, only run manual (no-schedule) configs
 * @returns {object} - {shouldRun: boolean, reason: string}
 */
export function shouldRunBackup(config, options = {}) {
  const { forceManual = false } = options;

  // If config has no schedule, it's manual-only
  if (!config.schedule || !config.schedule.cronExpression) {
    if (forceManual) {
      return {
        shouldRun: true,
        reason: 'Manual backup requested',
      };
    } else {
      return {
        shouldRun: false,
        reason: 'Manual-only backup (no schedule)',
      };
    }
  }

  // If forceManual is true, skip scheduled backups
  if (forceManual) {
    return {
      shouldRun: false,
      reason: 'Skipping scheduled backup in manual mode',
    };
  }

  // Check if the schedule is due
  try {
    const cronExpression = config.schedule.cronExpression;
    const timezone = config.schedule.timezone || 'UTC';

    const interval = parser.parseExpression(cronExpression, {
      currentDate: new Date(),
      tz: timezone,
    });

    // Get the next scheduled time
    const nextRun = interval.next().toDate();

    // Get the previous scheduled time
    interval.reset();
    const prevRun = interval.prev().toDate();

    const now = new Date();

    // Check if we're within the window of the previous scheduled time
    // This prevents running the same backup multiple times
    const timeSinceLastScheduled = now - prevRun;
    const timeUntilNextScheduled = nextRun - now;

    // Run if:
    // 1. We're past the previous scheduled time
    // 2. We're within 5 minutes of the previous scheduled time (to account for agent startup delay)
    // 3. We're more than 5 minutes before the next scheduled time (to avoid running too early)

    const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

    if (timeSinceLastScheduled >= 0 && timeSinceLastScheduled <= WINDOW_MS) {
      return {
        shouldRun: true,
        reason: `Scheduled backup is due (cron: ${cronExpression})`,
      };
    }

    return {
      shouldRun: false,
      reason: `Not due yet. Next run at ${nextRun.toISOString()}`,
    };
  } catch (error) {
    return {
      shouldRun: false,
      reason: `Invalid cron expression: ${error.message}`,
    };
  }
}

/**
 * Filter configs to only those that should run
 * @param {Array} configs - Array of backup configurations
 * @param {object} [options] - Options for filtering
 * @returns {Array} - Filtered configs with reason
 */
export function filterDueConfigs(configs, options = {}) {
  return configs
    .map((config) => ({
      config,
      check: shouldRunBackup(config, options),
    }))
    .filter((item) => item.check.shouldRun)
    .map((item) => ({
      ...item.config,
      _runReason: item.check.reason,
    }));
}
