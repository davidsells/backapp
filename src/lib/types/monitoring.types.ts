import { BackupError, BackupProgress, BackupResult } from './backup.types';

export interface BackupLog {
  id: string;
  configId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  filesProcessed: number;
  filesSkipped: number;
  totalBytes: number;
  bytesTransferred: number;
  errors?: BackupError[];
  duration?: number;
}

export interface BackupMetrics {
  totalBackups: number;
  successRate: number;
  averageDuration: number;
  totalStorageUsed: number;
  lastBackupDate?: Date;
  upcomingBackups: ScheduledBackup[];
}

export interface ScheduledBackup {
  configId: string;
  configName: string;
  nextRun: Date;
  lastRun?: Date;
  lastStatus?: string;
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
  format: 'pdf' | 'csv' | 'json';
  configIds?: string[];
}

export interface Report {
  id: string;
  userId: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalBackups: number;
    successfulBackups: number;
    failedBackups: number;
    totalDataTransferred: number;
  };
  details: BackupLog[];
}

export interface MonitoringService {
  logBackupStart(configId: string): Promise<string>;
  updateBackupProgress(logId: string, progress: BackupProgress): Promise<void>;
  logBackupComplete(logId: string, result: BackupResult): Promise<void>;
  getMetrics(userId: string, period: string): Promise<BackupMetrics>;
  generateReport(userId: string, options: ReportOptions): Promise<Report>;
}
