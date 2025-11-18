export interface BackupSource {
  path: string;
  excludePatterns?: string[];
  includePatterns?: string[];
}

export interface S3Destination {
  bucket: string;
  region: string;
  prefix?: string;
  endpoint?: string;
}

export interface ScheduleConfig {
  cronExpression: string;
  timezone: string;
}

export interface BackupOptions {
  method: 'archive' | 'rsync'; // Backup method: tar.gz archive or rsync
  type: 'full' | 'incremental';
  compression: boolean;
  compressionLevel?: number;
  encryption: boolean;
  retentionDays?: number;
  bandwidth?: number; // KB/s
  // Rsync-specific options
  rsync?: {
    localReplica: string; // Local staging directory for rsync
    delete: boolean; // Mirror deletions (--delete flag)
    s3Bucket: string; // S3 bucket for final storage
    s3Prefix?: string; // Optional S3 prefix/path
    storageClass?: string; // S3 storage class (STANDARD_IA, etc.)
  };
}

export interface BackupConfig {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  sources: BackupSource[];
  destination: S3Destination;
  schedule: ScheduleConfig;
  options: BackupOptions;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupProgress {
  filesProcessed: number;
  filesSkipped: number;
  totalBytes: number;
  bytesTransferred: number;
  currentFile?: string;
  percentage: number;
}

export interface BackupError {
  file: string;
  error: string;
  timestamp: Date;
}

export interface BackupResult {
  success: boolean;
  filesProcessed: number;
  filesSkipped: number;
  totalBytes: number;
  bytesTransferred: number;
  duration: number;
  errors?: BackupError[];
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export type ExecutionMode = 'server' | 'agent';

export interface Agent {
  id: string;
  name: string;
  status: string;
  platform?: string;
  version?: string;
  lastSeen?: Date;
}
