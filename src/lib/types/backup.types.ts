export interface BackupSource {
  path: string;
  excludePatterns?: string[];
  includePatterns?: string[];
}

export type ExecutionMode = 'agent' | 'server';

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
  type: 'full' | 'incremental';
  compression: boolean;
  compressionLevel?: number;
  encryption: boolean;
  retentionDays?: number;
  bandwidth?: number; // KB/s
}

export interface BackupConfig {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  executionMode: ExecutionMode;
  agentId?: string | null;
  sources: BackupSource[];
  destination: S3Destination;
  schedule?: ScheduleConfig | null;
  options: BackupOptions;
  requestedAt?: Date | null;  // Set when user clicks "Run Now"
  lastRunAt?: Date | null;     // Timestamp of last execution
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

// Agent types for backup configuration
export interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  platform?: string;
  lastSeen?: Date | null;
}

export interface BackupConfigWithAgent extends BackupConfig {
  agent?: Agent | null;
}
