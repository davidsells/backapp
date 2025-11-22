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
  method?: 'archive' | 'rsync' | 'rclone'; // Backup method: tar.gz archive, rsync, or rclone (defaults to 'archive')
  type: 'full' | 'incremental';
  compression: boolean;
  compressionLevel?: number;
  encryption: boolean;
  retentionDays?: number;
  bandwidth?: number; // KB/s
  // Rsync-specific options (legacy - migrate to rclone)
  rsync?: {
    localReplica: string; // Local staging directory for rsync
    delete?: boolean; // Mirror deletions (--delete flag)
    uploadToS3?: boolean; // Upload to S3 after rsync (default: true for backward compatibility)
    storageClass?: string; // S3 storage class (STANDARD_IA, GLACIER, etc.)
  };
  // Rclone-specific options (recommended)
  rclone?: {
    remoteType: 's3' | 'wasabi' | 'b2' | 'gcs' | 'azure'; // Storage backend type
    delete?: boolean; // Mirror deletions (--delete-excluded flag)
    storageClass?: string; // S3 storage class (STANDARD, STANDARD_IA, GLACIER, DEEP_ARCHIVE)
    bandwidth?: number; // KB/s bandwidth limit (overrides top-level if set)
    checksumVerification?: boolean; // Verify checksums after transfer (default: true)
    // Two-phase backup options (local + remote)
    twoPhase?: boolean; // Enable two-phase backup: local first, then remote
    localBackupPath?: string; // Local backup directory (e.g., /var/backups/myapp/)
    uploadToRemote?: boolean; // Upload to cloud after local backup (default: true)
    keepLocalCopies?: number; // Number of local date-stamped copies to keep (0 = keep all)
  };
}

// Agent types for backup configuration
export interface Agent {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  platform?: string;
  lastSeen?: Date | null;
}

export interface BackupConfig {
  id: string;
  userId: string;
  name: string;
  enabled: boolean;
  executionMode: ExecutionMode;
  agentId?: string | null;
  agent?: Agent | null; // Populated when config is fetched with agent data
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

export interface BackupConfigWithAgent extends BackupConfig {
  agent?: Agent | null;
}
