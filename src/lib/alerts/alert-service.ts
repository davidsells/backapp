import { prisma } from '../db/prisma';

export type AlertType = 'failure' | 'warning' | 'info';

export interface CreateAlertInput {
  userId: string;
  configId: string;
  type: AlertType;
  message: string;
}

export class AlertService {
  /**
   * Create a new alert
   */
  async createAlert(input: CreateAlertInput) {
    return prisma.alert.create({
      data: {
        userId: input.userId,
        configId: input.configId,
        type: input.type,
        message: input.message,
        acknowledged: false,
      },
      include: {
        config: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get unacknowledged alerts for a user
   */
  async getUnacknowledgedAlerts(userId: string) {
    return prisma.alert.findMany({
      where: {
        userId,
        acknowledged: false,
      },
      include: {
        config: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });
  }

  /**
   * Get all alerts for a user
   */
  async getAllAlerts(userId: string, limit = 50) {
    return prisma.alert.findMany({
      where: {
        userId,
      },
      include: {
        config: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string) {
    return prisma.alert.updateMany({
      where: {
        id: alertId,
        userId, // Ensure user owns this alert
      },
      data: {
        acknowledged: true,
      },
    });
  }

  /**
   * Acknowledge all alerts for a user
   */
  async acknowledgeAllAlerts(userId: string) {
    return prisma.alert.updateMany({
      where: {
        userId,
        acknowledged: false,
      },
      data: {
        acknowledged: true,
      },
    });
  }

  /**
   * Delete old acknowledged alerts (cleanup)
   */
  async cleanupOldAlerts(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return prisma.alert.deleteMany({
      where: {
        acknowledged: true,
        timestamp: {
          lt: cutoffDate,
        },
      },
    });
  }

  /**
   * Create an alert for a failed backup
   */
  async createBackupFailureAlert(
    userId: string,
    configId: string,
    configName: string,
    error: string
  ) {
    const message = `Backup "${configName}" failed: ${error}`;
    return this.createAlert({
      userId,
      configId,
      type: 'failure',
      message,
    });
  }

  /**
   * Create an alert for backup timeout
   */
  async createBackupTimeoutAlert(
    userId: string,
    configId: string,
    configName: string
  ) {
    const message = `Backup "${configName}" timed out. Agent may not be running.`;
    return this.createAlert({
      userId,
      configId,
      type: 'warning',
      message,
    });
  }
}

// Singleton instance
let alertServiceInstance: AlertService | null = null;

export function getAlertService(): AlertService {
  if (!alertServiceInstance) {
    alertServiceInstance = new AlertService();
  }
  return alertServiceInstance;
}
