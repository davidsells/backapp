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
  type: 'full' | 'incremental';
  compression: boolean;
  compressionLevel?: number;
  encryption: boolean;
  retentionDays?: number;
  bandwidth?: number; // KB/s
  rsync?: RsyncOptions; // NEW: rsync-specific options
}

// NEW: Backup type discriminator
export type BackupType = 'direct-s3' | 'rsync-local' | 'rsync-to-s3';

// NEW: Rsync backup options
export interface RsyncOptions {
  localDestination: string;          // /Volumes/Backup or /mnt/external
  deleteExtraneous: boolean;         // --delete flag (remove files in dest not in source)
  excludePatterns: string[];         // ['node_modules', '.git', '*.log']
  hardLinks: boolean;                // --hard-links (deduplication)
  dryRun: boolean;                   // --dry-run (preview mode)
  verbose: boolean;                  // --verbose
  syncToS3?: RsyncToS3Options;       // Optional S3 sync after rsync
}

// NEW: S3 sync options for rsync-to-s3 mode
export interface RsyncToS3Options {
  enabled: boolean;
  storageClass: 'STANDARD' | 'STANDARD_IA' | 'GLACIER_IR' | 'GLACIER' | 'DEEP_ARCHIVE';
  s3Prefix: string;                  // 'rsync/YYYY-MM-DD/' or custom pattern
  deleteFromS3: boolean;             // Mirror deletions to S3
}

// NEW: Rsync execution stats
export interface RsyncStats {
  stage1: RsyncStage1Stats;
  stage2?: RsyncStage2Stats;         // Only present for rsync-to-s3 mode
}

export interface RsyncStage1Stats {
  filesTransferred: number;
  bytesTransferred: number;
  speedupRatio: number;              // rsync speedup due to delta transfer
  duration: number;                  // milliseconds
  localPath: string;
  totalFiles: number;
  totalBytes: number;
}

export interface RsyncStage2Stats {
  filesUploaded: number;
  bytesUploaded: number;
  s3Path: string;
  duration: number;                  // milliseconds
  storageClass: string;
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
