import { prisma } from '../db/prisma';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface GenerateReportOptions {
  userId: string;
  period: ReportPeriod;
  startDate?: Date;
  endDate?: Date;
  configIds?: string[]; // Optional: filter by specific backup configs
}

export interface BackupSummary {
  id: string;
  configName: string;
  startTime: Date;
  endTime: Date | null;
  status: string;
  filesProcessed: number;
  bytesTransferred: number;
  duration: number | null;
  hasErrors: boolean;
}

export interface Report {
  period: {
    start: Date;
    end: Date;
    type: ReportPeriod;
  };
  summary: {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    successRate: number;
    totalDataTransferred: number;
    totalFilesProcessed: number;
    averageDuration: number;
  };
  backups: BackupSummary[];
  configs: {
    id: string;
    name: string;
    backupCount: number;
    successCount: number;
    lastBackup: Date | null;
  }[];
}

export class ReportService {
  /**
   * Calculate date range for period
   */
  private calculateDateRange(period: ReportPeriod, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
    const end = customEnd || new Date();
    let start: Date;

    switch (period) {
      case 'daily':
        start = new Date(end);
        start.setHours(0, 0, 0, 0);
        break;
      case 'weekly':
        start = new Date(end);
        start.setDate(end.getDate() - 7);
        break;
      case 'monthly':
        start = new Date(end);
        start.setMonth(end.getMonth() - 1);
        break;
      case 'custom':
        start = customStart || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days
        break;
      default:
        start = new Date(end);
        start.setDate(end.getDate() - 7);
    }

    return { start, end };
  }

  /**
   * Generate a backup report for the specified period
   */
  async generateReport(options: GenerateReportOptions): Promise<Report> {
    const { userId, period, startDate, endDate, configIds } = options;

    // Calculate date range
    const dateRange = this.calculateDateRange(period, startDate, endDate);

    // Build query filter
    const where: any = {
      userId,
      startTime: {
        gte: dateRange.start,
        lte: dateRange.end,
      },
    };

    if (configIds && configIds.length > 0) {
      where.configId = { in: configIds };
    }

    // Fetch backup logs
    const logs = await prisma.backupLog.findMany({
      where,
      include: {
        config: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    // Calculate summary statistics
    const totalBackups = logs.length;
    const successfulBackups = logs.filter((log) => log.status === 'completed').length;
    const failedBackups = logs.filter((log) => log.status === 'failed').length;
    const successRate = totalBackups > 0 ? (successfulBackups / totalBackups) * 100 : 0;

    const totalDataTransferred = logs.reduce((sum, log) => sum + Number(log.bytesTransferred), 0);
    const totalFilesProcessed = logs.reduce((sum, log) => sum + log.filesProcessed, 0);

    const completedLogs = logs.filter((log) => log.duration !== null);
    const averageDuration = completedLogs.length > 0
      ? completedLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / completedLogs.length
      : 0;

    // Group by config
    const configMap = new Map<string, {
      id: string;
      name: string;
      backupCount: number;
      successCount: number;
      lastBackup: Date | null;
    }>();

    logs.forEach((log) => {
      const configId = log.config.id;
      const existing = configMap.get(configId);

      if (existing) {
        existing.backupCount++;
        if (log.status === 'completed') {
          existing.successCount++;
        }
        if (!existing.lastBackup || log.startTime > existing.lastBackup) {
          existing.lastBackup = log.startTime;
        }
      } else {
        configMap.set(configId, {
          id: log.config.id,
          name: log.config.name,
          backupCount: 1,
          successCount: log.status === 'completed' ? 1 : 0,
          lastBackup: log.startTime,
        });
      }
    });

    // Format backups for report
    const backups: BackupSummary[] = logs.map((log) => ({
      id: log.id,
      configName: log.config.name,
      startTime: log.startTime,
      endTime: log.endTime,
      status: log.status,
      filesProcessed: log.filesProcessed,
      bytesTransferred: Number(log.bytesTransferred),
      duration: log.duration,
      hasErrors: !!log.errors,
    }));

    return {
      period: {
        start: dateRange.start,
        end: dateRange.end,
        type: period,
      },
      summary: {
        totalBackups,
        successfulBackups,
        failedBackups,
        successRate,
        totalDataTransferred,
        totalFilesProcessed,
        averageDuration: Math.round(averageDuration),
      },
      backups,
      configs: Array.from(configMap.values()),
    };
  }

  /**
   * Get available report periods for a user
   */
  async getAvailableReports(userId: string) {
    // Get earliest backup
    const earliest = await prisma.backupLog.findFirst({
      where: { userId },
      orderBy: { startTime: 'asc' },
      select: { startTime: true },
    });

    if (!earliest) {
      return {
        hasData: false,
        earliestBackup: null,
        availablePeriods: [],
      };
    }

    const now = new Date();
    const earliestDate = earliest.startTime;
    const daysSinceEarliest = Math.floor((now.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      hasData: true,
      earliestBackup: earliestDate,
      availablePeriods: [
        { period: 'daily', label: 'Last 24 Hours', available: true },
        { period: 'weekly', label: 'Last 7 Days', available: daysSinceEarliest >= 1 },
        { period: 'monthly', label: 'Last 30 Days', available: daysSinceEarliest >= 7 },
        { period: 'custom', label: 'Custom Range', available: true },
      ],
    };
  }
}

// Singleton instance
let reportServiceInstance: ReportService | null = null;

export function getReportService(): ReportService {
  if (!reportServiceInstance) {
    reportServiceInstance = new ReportService();
  }
  return reportServiceInstance;
}
