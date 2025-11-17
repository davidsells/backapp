# Rsync Backup Type 3: Two-Stage Process Clarification

## rsync-to-s3: Two Sequential Stages

The third backup type (`rsync-to-s3`) operates as a **two-stage sequential process**:

### Stage 1: Rsync to Local/External Drive
```bash
rsync --archive --hard-links --delete \
      /source/path/ \
      /local/destination/
```

**What happens:**
- Files are incrementally synced to local/external drive
- Only changed blocks are transferred (rsync delta algorithm)
- Local backup is created or updated
- **This backup persists permanently** - it's NOT a temporary staging area

**Duration:** Fast (only transfers changes)
**Result:** `/local/destination/` contains full backup

### Stage 2: AWS S3 Sync to Cloud
```bash
aws s3 sync /local/destination/ \
            s3://my-bucket/rsync/2025-11-17/ \
            --storage-class STANDARD_IA \
            --delete
```

**What happens:**
- **Only executes AFTER Stage 1 completes successfully**
- Syncs the local destination to S3
- Only uploads files that changed since last S3 sync
- Much faster than uploading everything

**Duration:** Variable (depends on changes since last sync)
**Result:** S3 bucket contains copy of local backup

## End Result

After both stages complete, you have:

1. **Local backup** at `/local/destination/` (or `/Volumes/ExternalDrive/`)
   - Fast access for quick recovery
   - Incremental updates on each run
   - Persists permanently

2. **Cloud backup** at `s3://my-bucket/rsync/YYYY-MM-DD/`
   - Offsite protection
   - Automated storage tiering options
   - Lifecycle management

## Error Handling

**If Stage 1 fails:**
- Stage 2 never executes
- Previous local backup remains unchanged
- Error reported to user

**If Stage 2 fails:**
- Local backup from Stage 1 is still valid
- You can recover from local backup immediately
- User can retry S3 sync manually or wait for next scheduled run

## Configuration Example

```json
{
  "backupType": "rsync-to-s3",
  "sources": [{ "path": "/data/photos" }],
  "options": {
    "rsync": {
      "localDestination": "/Volumes/Backup/photos",
      "deleteExtraneous": true,
      "excludePatterns": [".DS_Store", "Thumbs.db"],
      "hardLinks": true,
      "syncToS3": {
        "enabled": true,
        "storageClass": "STANDARD_IA",
        "s3Prefix": "rsync/photos/",
        "deleteFromS3": true
      }
    }
  },
  "destination": {
    "bucket": "my-backups",
    "region": "us-east-1"
  },
  "schedule": {
    "cronExpression": "0 2 * * *",
    "timezone": "America/New_York"
  }
}
```

## Daily Execution Example

**Day 1 (Initial Backup):**
- Stage 1: Rsync 50GB of photos to `/Volumes/Backup/photos` (takes 30 min)
- Stage 2: Upload all 50GB to S3 (takes 2 hours)
- Total: 2.5 hours

**Day 2 (Incremental Backup):**
- Stage 1: Rsync only 500MB of new/changed photos (takes 1 min)
- Stage 2: Upload only 500MB to S3 (takes 5 min)
- Total: 6 minutes

**Day 30 (After Month of Use):**
- Stage 1: Rsync only today's changes (takes 1 min)
- Stage 2: Upload only today's changes (takes 5 min)
- Total: 6 minutes
- **But you still have full 60GB backup in both local AND cloud**

## Key Points

✅ **Local backup always created first** (Stage 1)
✅ **Cloud backup follows** (Stage 2)
✅ **Both backups persist** (not temporary)
✅ **Sequential execution** (Stage 2 waits for Stage 1)
✅ **Incremental efficiency** (only changes transferred)
✅ **Dual redundancy** (local + cloud)

## Why This Matters

This two-stage approach gives you:
1. **Speed**: Incremental rsync is much faster than full uploads
2. **Bandwidth**: Only changes hit the network
3. **Cost**: Fewer S3 API calls and data transfer charges
4. **Safety**: Local backup succeeds even if internet fails
5. **Flexibility**: Can recover from either local or cloud

## Agent Implementation

The agent will:
```typescript
async executeRsyncToS3Backup(config: BackupConfig) {
  // Stage 1: Rsync to local
  const stage1Stats = await this.executeRsync(config);

  // Only proceed to Stage 2 if Stage 1 succeeded
  if (stage1Stats.success) {
    // Stage 2: S3 sync
    const stage2Stats = await this.executeS3Sync(config, stage1Stats.localPath);

    return { stage1: stage1Stats, stage2: stage2Stats };
  }

  throw new Error('Stage 1 failed, skipping Stage 2');
}
```
