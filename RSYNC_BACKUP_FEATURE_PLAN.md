# Rsync Backup Feature - Implementation Plan

## Overview

Add rsync-based backup capability to the backup system, supporting:
1. **Local rsync backups**: Source → Local/External Drive
2. **Two-stage rsync-to-S3**: Source → Local Replica → S3 (bandwidth & cost optimized)

This provides an efficient alternative to direct S3 uploads, especially for:
- Large datasets where incremental sync is crucial
- External drive backups
- Situations where local replica is valuable before cloud upload

## Architecture

### Backup Types

Currently: `direct-s3` (agent uploads tar.gz directly to S3)
**New**:
- `rsync-local` - rsync to local/external directory only
- `rsync-to-s3` - two-stage: rsync local, then aws s3 sync to S3

### Workflow Comparison

**Current (direct-s3)**:
```
Source Files → Agent tar.gz → S3 Presigned Upload → S3 Bucket
```

**New (rsync-local)**:
```
Source Files → rsync → Local/External Drive Destination
```

**New (rsync-to-s3)**:
```
Source Files → rsync → Local Replica → aws s3 sync → S3 Bucket
             (Stage 1)                (Stage 2)
```

## Database Schema Changes

### BackupConfig Updates

```prisma
model BackupConfig {
  // ... existing fields ...

  backupType    String      @default("direct-s3") // "direct-s3" | "rsync-local" | "rsync-to-s3"

  // rsync-specific options (stored in options Json field)
  options       Json        // Extended to include:
                           // {
                           //   type: 'full' | 'incremental',
                           //   compression: boolean,
                           //   retention: { count, days },
                           //
                           //   // NEW rsync options:
                           //   rsync?: {
                           //     localDestination: string,      // /Volumes/Backup or ./backups
                           //     deleteExtraneous: boolean,     // --delete flag
                           //     excludePatterns: string[],     // --exclude patterns
                           //     hardLinks: boolean,            // --hard-links
                           //     dryRun: boolean,              // --dry-run
                           //
                           //     // For rsync-to-s3 mode only:
                           //     syncToS3?: {
                           //       enabled: boolean,
                           //       storageClass: string,        // STANDARD_IA, GLACIER, etc.
                           //       s3Prefix: string,            // rsync/YYYY-MM-DD/
                           //       deleteFromS3: boolean        // mirror deletions to S3
                           //     }
                           //   }
                           // }
}
```

### BackupLog Updates

```prisma
model BackupLog {
  // ... existing fields ...

  rsyncStats    Json?       // Store rsync-specific stats:
                           // {
                           //   stage1: {
                           //     filesTransferred: number,
                           //     bytesTransferred: number,
                           //     speedupRatio: number,
                           //     duration: number
                           //   },
                           //   stage2?: {
                           //     filesUploaded: number,
                           //     bytesUploaded: number,
                           //     s3Path: string,
                           //     duration: number
                           //   }
                           // }
}
```

## Type Definitions

### New Types

```typescript
// src/lib/types/backup.types.ts

export type BackupType = 'direct-s3' | 'rsync-local' | 'rsync-to-s3';

export interface RsyncOptions {
  localDestination: string;          // /Volumes/Backup or /mnt/external
  deleteExtraneous: boolean;         // --delete
  excludePatterns: string[];         // ['node_modules', '.git', '*.log']
  hardLinks: boolean;                // --hard-links (deduplication)
  dryRun: boolean;                   // --dry-run (preview mode)
  syncToS3?: RsyncToS3Options;
}

export interface RsyncToS3Options {
  enabled: boolean;
  storageClass: 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'GLACIER_IR';
  s3Prefix: string;                  // 'rsync/YYYY-MM-DD/'
  deleteFromS3: boolean;             // mirror deletions
}

export interface RsyncStats {
  stage1: {
    filesTransferred: number;
    bytesTransferred: number;
    speedupRatio: number;            // rsync speedup due to delta
    duration: number;
    localPath: string;
  };
  stage2?: {
    filesUploaded: number;
    bytesUploaded: number;
    s3Path: string;
    duration: number;
  };
}

// Extend existing BackupOptions
export interface BackupOptions {
  type: 'full' | 'incremental';
  compression: boolean;
  retention: {
    count: number;
    days: number;
  };
  rsync?: RsyncOptions;              // NEW: only present for rsync backup types
}
```

## Agent Implementation

### Agent Capabilities

The agent needs to:
1. Check for `rsync` binary availability
2. Check for `aws cli` availability (for rsync-to-s3 mode)
3. Execute rsync with progress reporting
4. Execute aws s3 sync with progress reporting
5. Parse rsync/aws output for stats
6. Report progress via WebSocket or polling

### Agent Endpoints (Backend)

#### Check Capabilities
```
GET /api/agent/capabilities
Response: {
  rsync: { available: boolean, version: string },
  awscli: { available: boolean, version: string }
}
```

#### Start Rsync Backup
```
POST /api/agent/backup/rsync/start
Request: {
  configId: string,
  sources: BackupSource[],
  rsyncOptions: RsyncOptions
}
Response: {
  logId: string,
  stage: 'rsync' | 's3-sync',
  estimatedTime: number
}
```

#### Report Rsync Progress
```
POST /api/agent/backup/rsync/progress
Request: {
  logId: string,
  stage: 'rsync' | 's3-sync',
  filesProcessed: number,
  bytesTransferred: number,
  currentFile?: string,
  percentage?: number
}
```

#### Complete Rsync Backup
```
POST /api/agent/backup/rsync/complete
Request: {
  logId: string,
  status: 'completed' | 'failed',
  rsyncStats: RsyncStats,
  errors?: any[]
}
```

### Agent-Side Executor (Pseudo-code)

```typescript
// In the agent codebase

class RsyncBackupExecutor {
  async execute(config: BackupConfig): Promise<void> {
    const logId = await this.startBackup(config);

    try {
      // Stage 1: rsync
      const rsyncStats = await this.executeRsync(config, logId);

      // Stage 2: S3 sync (if enabled)
      let s3Stats;
      if (config.options.rsync?.syncToS3?.enabled) {
        s3Stats = await this.executeS3Sync(config, rsyncStats.localPath, logId);
      }

      await this.completeBackup(logId, { stage1: rsyncStats, stage2: s3Stats });
    } catch (error) {
      await this.failBackup(logId, error);
    }
  }

  private async executeRsync(config, logId): Promise<RsyncStage1Stats> {
    const args = [
      '--archive',
      '--human-readable',
      '--progress',
      '--stats',
      config.options.rsync.deleteExtraneous ? '--delete' : '',
      ...config.options.rsync.excludePatterns.map(p => `--exclude=${p}`),
      config.options.rsync.hardLinks ? '--hard-links' : '',
      config.options.rsync.dryRun ? '--dry-run' : '',
      '--verbose',
      `${config.sources[0].path}/`,
      config.options.rsync.localDestination
    ].filter(Boolean);

    const rsync = spawn('rsync', args);

    // Parse output for progress and report to server
    rsync.stdout.on('data', (data) => {
      const progress = this.parseRsyncOutput(data);
      this.reportProgress(logId, 'rsync', progress);
    });

    return new Promise((resolve, reject) => {
      rsync.on('exit', (code) => {
        if (code === 0) {
          resolve(this.parseRsyncStats(rsync.stderr));
        } else {
          reject(new Error(`rsync failed with code ${code}`));
        }
      });
    });
  }

  private async executeS3Sync(config, localPath, logId): Promise<S3SyncStats> {
    const s3Options = config.options.rsync.syncToS3;
    const dateTag = new Date().toISOString().slice(0, 10);
    const s3Path = `s3://${config.destination.bucket}/${s3Options.s3Prefix}${dateTag}/`;

    const args = [
      's3', 'sync',
      localPath,
      s3Path,
      `--storage-class=${s3Options.storageClass}`,
      s3Options.deleteFromS3 ? '--delete' : '',
      '--only-show-errors'
    ].filter(Boolean);

    const aws = spawn('aws', args);

    aws.stdout.on('data', (data) => {
      // Parse and report progress
      this.reportProgress(logId, 's3-sync', { /* ... */ });
    });

    return new Promise((resolve, reject) => {
      aws.on('exit', (code) => {
        if (code === 0) {
          resolve({ s3Path, /* ... stats ... */ });
        } else {
          reject(new Error(`aws s3 sync failed with code ${code}`));
        }
      });
    });
  }
}
```

## Backend API Changes

### New Routes

1. **`src/app/api/agent/backup/rsync/start/route.ts`**
   - Validates rsync config
   - Creates backup log with status='running'
   - Returns logId

2. **`src/app/api/agent/backup/rsync/progress/route.ts`**
   - Updates backup log with progress
   - Emits WebSocket event for real-time UI updates

3. **`src/app/api/agent/backup/rsync/complete/route.ts`**
   - Updates backup log with final stats
   - Performs verification (check local path exists, check S3 if applicable)
   - Creates alerts on failure

4. **`src/app/api/agent/capabilities/route.ts`**
   - Agent reports what tools are available
   - Stored in agent record for UI display

### Validation Updates

```typescript
// src/lib/backup/backup-service.ts

async validateConfig(input: CreateBackupConfigInput): Promise<ValidationResult> {
  // ... existing validation ...

  if (input.backupType === 'rsync-local' || input.backupType === 'rsync-to-s3') {
    if (!input.options.rsync) {
      errors.push('rsync options are required for rsync backup type');
    }

    if (!input.options.rsync.localDestination) {
      errors.push('local destination path is required');
    }

    // Only validate S3 config if rsync-to-s3
    if (input.backupType === 'rsync-to-s3') {
      if (!input.options.rsync.syncToS3?.enabled) {
        errors.push('S3 sync must be enabled for rsync-to-s3 backup type');
      }
      if (!input.destination.bucket) {
        errors.push('S3 bucket is required for rsync-to-s3 backup type');
      }
    }
  }

  // ... rest of validation ...
}
```

## Frontend UI Changes

### Configuration Form Updates

**`src/components/backup/backup-config-form.tsx`**

Add new section after "Execution Mode":

```tsx
{/* Backup Type Selection */}
<div>
  <Label>Backup Type</Label>
  <Select value={backupType} onChange={setBackupType}>
    <option value="direct-s3">Direct to S3 (tar.gz)</option>
    <option value="rsync-local">Rsync to Local/External Drive</option>
    <option value="rsync-to-s3">Rsync + S3 Sync (Two-Stage)</option>
  </Select>
</div>

{/* Rsync Options (conditional) */}
{(backupType === 'rsync-local' || backupType === 'rsync-to-s3') && (
  <Card>
    <CardHeader>
      <CardTitle>Rsync Configuration</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Local Destination */}
      <div>
        <Label>Local Destination Path</Label>
        <Input
          placeholder="/Volumes/Backup or /mnt/external"
          value={rsyncOptions.localDestination}
          onChange={(e) => setRsyncOptions({...rsyncOptions, localDestination: e.target.value})}
        />
        <p className="text-sm text-muted-foreground">
          Path to local directory or external drive where backup will be stored
        </p>
      </div>

      {/* Delete Extraneous Files */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rsyncOptions.deleteExtraneous}
          onChange={(e) => setRsyncOptions({...rsyncOptions, deleteExtraneous: e.target.checked})}
        />
        <Label>Delete files in destination that don't exist in source</Label>
      </div>

      {/* Exclude Patterns */}
      <div>
        <Label>Exclude Patterns</Label>
        <TagInput
          tags={rsyncOptions.excludePatterns}
          onChange={(patterns) => setRsyncOptions({...rsyncOptions, excludePatterns: patterns})}
          placeholder="node_modules, .git, *.log"
        />
      </div>

      {/* Hard Links */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rsyncOptions.hardLinks}
          onChange={(e) => setRsyncOptions({...rsyncOptions, hardLinks: e.target.checked})}
        />
        <Label>Use hard links for deduplication (saves space)</Label>
      </div>
    </CardContent>
  </Card>
)}

{/* S3 Sync Options (conditional) */}
{backupType === 'rsync-to-s3' && (
  <Card>
    <CardHeader>
      <CardTitle>S3 Sync Configuration</CardTitle>
      <CardDescription>
        After rsync completes locally, sync to S3
      </CardDescription>
    </CardHeader>
    <CardContent>
      {/* S3 Storage Class */}
      <div>
        <Label>S3 Storage Class</Label>
        <Select value={rsyncOptions.syncToS3.storageClass}>
          <option value="STANDARD">Standard</option>
          <option value="STANDARD_IA">Standard-IA (cost-optimized)</option>
          <option value="GLACIER_IR">Glacier Instant Retrieval</option>
          <option value="GLACIER">Glacier Flexible Retrieval</option>
        </Select>
      </div>

      {/* S3 Prefix */}
      <div>
        <Label>S3 Prefix Pattern</Label>
        <Input
          value={rsyncOptions.syncToS3.s3Prefix}
          placeholder="rsync/YYYY-MM-DD/"
        />
        <p className="text-sm text-muted-foreground">
          YYYY-MM-DD will be replaced with the backup date
        </p>
      </div>

      {/* Delete from S3 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rsyncOptions.syncToS3.deleteFromS3}
        />
        <Label>Mirror deletions to S3 (remove files deleted from source)</Label>
      </div>
    </CardContent>
  </Card>
)}
```

### Progress Display Updates

**`src/components/backup/backup-progress-monitor.tsx`**

Add two-stage progress display:

```tsx
{log.config.backupType === 'rsync-to-s3' && (
  <div>
    {/* Stage 1: Rsync Progress */}
    <div>
      <h4>Stage 1: Rsync to Local</h4>
      <ProgressBar
        value={rsyncProgress.percentage}
        label={`${rsyncProgress.filesTransferred} files, ${formatBytes(rsyncProgress.bytesTransferred)}`}
      />
      {rsyncProgress.currentFile && (
        <p className="text-xs text-muted-foreground">
          Current: {rsyncProgress.currentFile}
        </p>
      )}
    </div>

    {/* Stage 2: S3 Sync Progress */}
    {s3SyncProgress && (
      <div>
        <h4>Stage 2: Syncing to S3</h4>
        <ProgressBar
          value={s3SyncProgress.percentage}
          label={`${s3SyncProgress.filesUploaded} files, ${formatBytes(s3SyncProgress.bytesUploaded)}`}
        />
      </div>
    )}
  </div>
)}
```

### Configuration List Display

Show backup type badge:

```tsx
<span className={`text-xs px-2 py-1 rounded ${getBackupTypeBadgeColor(config.backupType)}`}>
  {config.backupType === 'direct-s3' && '☁️ Direct S3'}
  {config.backupType === 'rsync-local' && '💾 Rsync Local'}
  {config.backupType === 'rsync-to-s3' && '🔄 Rsync → S3'}
</span>
```

## Agent Requirements Display

Show agent capabilities:

```tsx
// src/components/agent/agent-capabilities.tsx

export function AgentCapabilities({ agent }: { agent: Agent }) {
  return (
    <div>
      <h4>Agent Capabilities</h4>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {agent.capabilities?.rsync ? '✅' : '❌'}
          <span>rsync</span>
          {agent.capabilities?.rsync?.version && (
            <span className="text-xs text-muted-foreground">
              v{agent.capabilities.rsync.version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {agent.capabilities?.awscli ? '✅' : '❌'}
          <span>AWS CLI</span>
          {agent.capabilities?.awscli?.version && (
            <span className="text-xs text-muted-foreground">
              v{agent.capabilities.awscli.version}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Migration Path

### Database Migration

```prisma
-- Add backupType column
ALTER TABLE backup_configs
ADD COLUMN backup_type VARCHAR(20) DEFAULT 'direct-s3';

-- Create index
CREATE INDEX idx_backup_configs_backup_type ON backup_configs(backup_type);

-- Add rsyncStats column to backup_logs
ALTER TABLE backup_logs
ADD COLUMN rsync_stats JSONB;
```

### Backward Compatibility

- Existing configs default to `backupType: 'direct-s3'`
- Agent handles both old and new backup types
- UI gracefully handles configs without rsync options

## Testing Strategy

### Unit Tests

1. **Rsync option validation**
   - Valid rsync config
   - Invalid local destination paths
   - Missing required fields

2. **Type guards**
   - `isRsyncBackup(config)`
   - `requiresS3Sync(config)`

### Integration Tests

1. **Agent rsync execution**
   - Mock rsync binary
   - Parse output correctly
   - Handle errors

2. **Two-stage workflow**
   - Rsync completes → triggers S3 sync
   - Progress reporting at each stage
   - Verification after each stage

### E2E Tests

1. **Full rsync-local workflow**
   - Create rsync config
   - Agent executes backup
   - Verify local files exist
   - Check backup log stats

2. **Full rsync-to-s3 workflow**
   - Create rsync-to-s3 config
   - Agent executes both stages
   - Verify S3 files exist
   - Check both stage stats in log

## Benefits

### For Users

1. **Bandwidth Efficiency**: Only changed blocks transferred
2. **Cost Savings**: Incremental S3 uploads, not full snapshots
3. **Local Backups**: Fast recovery from local drive
4. **Flexibility**: Choose local-only or local + cloud
5. **Resume-Safe**: Both rsync and aws s3 sync support partial transfers

### For Large Datasets

Example: 1TB photo library
- **Direct S3**: Upload 1TB every time (hours, expensive)
- **Rsync → S3**:
  - First backup: 1TB (same as direct)
  - Subsequent: Only changed files (minutes, cheap)

## Implementation Phases

### Phase 1: Foundation (This PR)
- [ ] Database schema updates
- [ ] Type definitions
- [ ] Validation logic updates
- [ ] Documentation

### Phase 2: Backend APIs
- [ ] Agent rsync endpoints
- [ ] Progress reporting
- [ ] Verification logic
- [ ] Agent capabilities tracking

### Phase 3: Agent Implementation
- [ ] Rsync executor
- [ ] S3 sync executor
- [ ] Progress parser
- [ ] Error handling

### Phase 4: Frontend UI
- [ ] Configuration form updates
- [ ] Rsync options UI
- [ ] Two-stage progress display
- [ ] Agent capabilities display

### Phase 5: Testing & Polish
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Documentation
- [ ] User guide

## Open Questions

1. **Multi-source rsync**: Should we support multiple sources in one rsync config, or require separate configs?
   - **Recommendation**: Separate configs for cleaner rsync execution

2. **Dry-run preview**: Should dry-run be a per-execution option or config-level?
   - **Recommendation**: Per-execution, available via "Preview" button in UI

3. **Progress granularity**: How often should agent report progress?
   - **Recommendation**: Every 5 seconds or 100 files, whichever comes first

4. **S3 verification**: For rsync-to-s3, should we verify S3 files after upload?
   - **Recommendation**: Yes, similar to existing S3 verification

5. **Local disk space**: Should we check available disk space before rsync?
   - **Recommendation**: Yes, add pre-flight check

## Documentation Needs

1. **User Guide**: How to configure rsync backups
2. **Agent Setup**: Installing rsync and AWS CLI
3. **Best Practices**: When to use each backup type
4. **Troubleshooting**: Common rsync/aws cli issues
5. **Migration Guide**: Converting direct-s3 configs to rsync-to-s3

## Success Criteria

- [ ] Users can create rsync-local backup configurations
- [ ] Users can create rsync-to-s3 backup configurations
- [ ] Agents execute rsync with proper options
- [ ] Agents report progress during both stages
- [ ] UI displays two-stage progress correctly
- [ ] Backup logs contain detailed rsync stats
- [ ] S3 verification works for rsync-to-s3 backups
- [ ] Agent capabilities are tracked and displayed
- [ ] All existing direct-s3 backups continue to work
- [ ] Documentation is comprehensive
