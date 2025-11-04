export interface ScheduledBackup {
  configId: string;
  configName: string;
  nextRun: Date;
}

export interface BackupMetrics {
  totalBackups: number;
  successRate: number;
  averageDuration: number;
  totalStorageUsed: number;
  lastBackupDate?: Date;
  upcomingBackups: ScheduledBackup[];
}

export interface Alert {
  id: string;
  type: 'failure' | 'warning' | 'info';
  configId: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface ReportOptions {
  startDate: Date;
  endDate: Date;
  configIds?: string[];
  format?: 'pdf' | 'csv' | 'json';
}

export interface Report {
  id: string;
  userId: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  metrics: BackupMetrics;
  data: unknown;
}

export interface MonitoringService {
  logBackupStart(configId: string): Promise<string>;
  updateBackupProgress(
    logId: string,
    progress: import('./backup.types').BackupProgress
  ): Promise<void>;
  logBackupComplete(
    logId: string,
    result: import('./backup.types').BackupResult
  ): Promise<void>;
  getMetrics(userId: string, period: string): Promise<BackupMetrics>;
  generateReport(userId: string, options: ReportOptions): Promise<Report>;
}
