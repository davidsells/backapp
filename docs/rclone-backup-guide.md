# Rclone Backup Guide

## Overview

The Rclone backup method provides a modern, efficient, and unified backup solution that syncs files directly to cloud storage. Rclone is a powerful command-line tool that supports 70+ storage backends with built-in features like automatic retries, checksums, and progress tracking.

**Important Note:** Both the "rsync" and "rclone" backup methods now use rclone under the hood. The traditional rsync tool and AWS CLI have been replaced with rclone for better performance and reliability. Existing "rsync" configurations continue to work without any changes.

## Why Rclone? (Advantages over Rsync)

Rclone is the **recommended backup method** for the following reasons:

### 🚀 **Single-Step Process**
```bash
# Rclone: One command does it all
rclone sync /source/ :s3:bucket/path/ --delete-excluded

# Old rsync method: Two-step process
rsync -av /source/ /staging/
aws s3 sync /staging/ s3://bucket/path/
```

### 🌍 **Multi-Cloud Support**
- Amazon S3
- Wasabi
- Backblaze B2
- Google Cloud Storage
- Azure Blob Storage
- 70+ other backends

### ✅ **Built-in Features**
- **Automatic retries** with exponential backoff
- **Checksum verification** for data integrity
- **Resume capability** for interrupted transfers
- **Bandwidth limiting** to avoid network congestion
- **Progress reporting** with detailed stats
- **Server-side copy** operations (no download/re-upload)
- **Encryption layer** via rclone crypt

### 💰 **Cost-Efficient**
- No local staging directory required (saves disk space)
- Efficient S3 operations (minimal LIST requests)
- Supports all S3 storage classes (STANDARD_IA, GLACIER, etc.)

### 🛡️ **Reliable**
- Unified error handling and clear error messages
- Battle-tested by millions of users worldwide
- Active development and community support

---

## Backup Methods Comparison

Both backup methods now use rclone, but they differ in configuration and use cases:

### **"Rsync" Method (Legacy Configuration)**
- **Use Case**: Two-phase backup (local staging + cloud upload)
- **Configuration**: Uses `localReplica` path for staging directory
- **Behavior**:
  1. Syncs sources to local staging directory
  2. Uploads staging directory to S3
- **Backward Compatible**: Existing rsync configs work without changes
- **Example**: Local backup to `/var/backups/myapp/`, then upload to S3

### **"Rclone" Method (Recommended)**
- **Use Case**: Flexible backup with two-phase and direct-to-cloud options
- **Configuration**: Modern configuration with `twoPhase` option
- **Behavior**:
  - **Two-phase mode**: Local backup + optional cloud upload (with automatic cleanup)
  - **Direct mode**: Single-step sync directly to cloud
  - **Local-only mode**: No cloud upload (air-gapped environments)
- **Advanced Features**: Storage class selection, bandwidth limiting, checksum verification
- **Example**: Can do local + cloud with automatic retention management

**Migration Recommendation**: New backups should use the "Rclone" method for more flexibility. Existing "Rsync" configurations will continue to work.

---

## Prerequisites

Before using either the Rclone or Rsync backup methods, ensure your agent system has rclone installed:

### Installation

**macOS:**
```bash
brew install rclone

# Verify installation
rclone version
```

**Ubuntu/Debian:**
```bash
sudo apt-get install rclone

# Verify installation
rclone version
```

**Other Linux:**
```bash
curl https://rclone.org/install.sh | sudo bash

# Verify installation
rclone version
```

**Minimum Version:** rclone v1.50 or higher (latest version recommended)

---

## Configuration

When creating a backup configuration with the Rclone method, you'll need to specify:

### Required Settings

1. **Backup Method**: Select "Rclone (Recommended - Multi-cloud sync)" from the dropdown
2. **Source Paths**: One or more directories to backup
3. **Agent**: The agent that will execute the backup (must have rclone installed)

**Note**: The S3 bucket is configured globally in the application's environment settings (`AWS_S3_BUCKET`). All users and agents share this bucket. The S3 path is automatically organized by user and agent:
```
s3://bucket/users/{userId}/agents/{agentId}/configs/{configId}/rclone/{YYYY-MM-DD}/
```

### Optional Settings

#### **Storage Backend**
Choose your cloud storage provider:
- **Amazon S3** (default) - AWS S3
- **Wasabi** - S3-compatible, cost-effective
- **Backblaze B2** - Low-cost cloud storage
- **Google Cloud Storage** - Google's object storage
- **Azure Blob Storage** - Microsoft's cloud storage

*Currently only S3 is fully configured. Other backends require additional setup.*

#### **Storage Class** (S3)
Optimize costs by choosing the right storage class:
- **STANDARD**: Frequently accessed data
- **STANDARD_IA**: Infrequent Access (recommended for backups) - 50% cheaper than STANDARD
- **GLACIER**: Long-term archival, retrieval takes hours - 80% cheaper
- **DEEP_ARCHIVE**: Lowest cost, retrieval takes 12+ hours - 95% cheaper

#### **Bandwidth Limit**
Limit upload speed to avoid network congestion:
- `0` = unlimited (default)
- `1024` = 1 MB/s
- `10240` = 10 MB/s

#### **Mirror Deletions**
- ☑️ **Enabled** (default): Files deleted from source are also removed from backup
- ☐ **Disabled**: Files remain in backup even if deleted from source

#### **Checksum Verification**
- ☑️ **Enabled** (default recommended): Verify data integrity with checksums
- ☐ **Disabled**: Skip checksum verification (faster but less safe)

### Exclusion Patterns

You can specify patterns to exclude from the backup:

```
node_modules/
.git/
*.log
*.tmp
.DS_Store
```

Default exclusions are automatically applied.

---

## Backup Structure

### S3 Path Organization

```
backapp-bucket/
└── users/{userId}/
    └── agents/{agentId}/
        └── configs/{configId}/
            └── rclone/
                ├── 2025-01-15/
                │   ├── documents/
                │   ├── photos/
                │   └── code/
                ├── 2025-01-16/
                │   ├── documents/
                │   ├── photos/
                │   └── code/
                └── 2025-01-17/
                    ├── documents/
                    ├── photos/
                    └── code/
```

**Key Points:**
- Each backup run creates a new date-stamped directory
- Files are synced to maintain directory structure
- Mirror deletions keep backup in sync with source
- Multiple daily backups append a timestamp suffix if needed

---

## How It Works

### Backup Execution Flow

1. **Agent polls server** for backup configurations
2. **Server sends temporary AWS credentials** (1-hour expiration)
3. **Agent validates** source paths and rclone installation
4. **Rclone syncs** files directly to S3:
   ```bash
   rclone sync /source/ :s3:bucket/path/ \
     --stats 1s \
     --progress \
     --checksum \
     --delete-excluded \
     --bwlimit 1024k \
     --s3-storage-class STANDARD_IA
   ```
5. **Agent reports** success/failure to server
6. **Server logs** backup results (files processed, bytes transferred, duration)

### Progress Reporting

During backup, you'll see real-time progress:
- Files processed count
- Bytes transferred
- Current file being synced
- Estimated time remaining
- Transfer speed

---

## Comparison with Rsync Method

| Feature | Rclone | Rsync + AWS CLI |
|---------|--------|-----------------|
| **Steps** | 1 (direct sync) | 2 (rsync → staging, then S3 sync) |
| **Local Storage** | Not required | Requires staging directory |
| **Multi-Cloud** | 70+ backends | S3 only |
| **Retries** | Built-in | Manual handling |
| **Checksums** | Built-in | Manual MD5 |
| **Bandwidth Limiting** | Native support | Via tc/trickle |
| **Progress** | Real-time stats | Basic stdout |
| **Resumability** | Built-in | Partial |
| **Complexity** | Low | Higher |

---

## Best Practices

### 1. Choose the Right Storage Class

For backups:
- **Daily/Weekly**: STANDARD_IA (cost-effective, instant retrieval)
- **Monthly**: GLACIER (cheap, 3-5 hour retrieval)
- **Yearly/Archive**: DEEP_ARCHIVE (cheapest, 12-48 hour retrieval)

### 2. Set Bandwidth Limits

On production servers or during business hours:
```
Bandwidth: 10240 KB/s (10 MB/s)
```

This prevents backup from saturating your network connection.

### 3. Enable Checksum Verification

Always keep this enabled for critical data. The performance impact is minimal and data integrity is priceless.

### 4. Use Exclusion Patterns

Exclude unnecessary files:
```
node_modules/
*.log
*.tmp
.cache/
build/
dist/
```

### 5. Schedule Smartly

- **Production servers**: Run during off-peak hours (2-4 AM)
- **Development machines**: Run during lunch or end of day
- **Frequency**: Daily for active data, weekly for archives

---

## Troubleshooting

### Rclone Not Found

**Error**: `rclone command not found`

**Solution**:
```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Verify installation
which rclone
rclone version
```

### Insufficient Permissions

**Error**: `Failed to access source path: /data`

**Solution**:
- Ensure the agent user has read access to source directories
- Check file permissions: `ls -la /data`
- Run agent with appropriate user: `sudo -u backupuser node src/daemon.js`

### S3 Authentication Failed

**Error**: `NoCredentialsError: Unable to locate credentials`

**Solution**:
- This means temporary credentials expired or weren't generated
- Check server logs: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
- Verify IAM permissions for S3 bucket access
- Agent automatically receives fresh credentials from server

### Slow Transfer Speed

**Symptoms**: Backup taking too long

**Solutions**:
1. **Check bandwidth limit**: Set to 0 for unlimited
2. **Network congestion**: Schedule during off-peak hours
3. **Large files**: Normal for initial full backup
4. **Storage class**: GLACIER has slower upload speeds

### Out of Disk Space

**Error**: `No space left on device`

**Solution**:
Rclone doesn't require local staging! If you see this error:
- Check you're using `rclone` method, not `rsync`
- Verify source paths are accessible
- Ensure agent has temp space for logs (~100MB)

---

## Migration from Rsync

If you're currently using the rsync method, here's how to migrate:

### Step 1: Create New Config

1. Go to **Configs → New Configuration**
2. Select **Rclone** method
3. Use the same source paths
4. Configure storage class and options

### Step 2: Test Run

Run a manual backup:
1. Click **Run Now** on the new config
2. Monitor progress in real-time
3. Verify files in S3 browser

### Step 3: Disable Old Config

Once verified:
1. Edit the old rsync config
2. Uncheck "Enable this backup configuration"
3. Keep for reference or delete

### Step 4: Clean Up (Optional)

Remove local staging directories:
```bash
rm -rf /tmp/backup-staging
rm -rf /var/backups/staging
```

---

## Cost Estimation

Use the **Calculate S3 Cost Estimate** button in the UI to estimate storage costs before running backups.

### Example Monthly Costs (US East)

**100 GB backup with STANDARD_IA:**
- Storage: $1.25/month
- PUT requests: ~$0.05
- **Total: ~$1.30/month**

**1 TB backup with STANDARD_IA:**
- Storage: $12.50/month
- PUT requests: ~$0.50
- **Total: ~$13.00/month**

**1 TB backup with GLACIER:**
- Storage: $4.00/month
- PUT requests: ~$0.50
- Retrieval (if needed): ~$40 (1-time)
- **Total: ~$4.50/month**

---

## Advanced: Multiple Sources

Rclone currently syncs one source at a time. For multiple sources:

**Option 1: Multiple Configs**
Create separate backup configs for each source:
- Config A: `/home/user/documents`
- Config B: `/home/user/photos`
- Config C: `/var/www/html`

**Option 2: Wrapper Directory**
Create a parent directory with symlinks:
```bash
mkdir /backups/all
ln -s /home/user/documents /backups/all/documents
ln -s /home/user/photos /backups/all/photos
ln -s /var/www/html /backups/all/www

# Then backup /backups/all
```

---

## Support

### Check Agent Logs

```bash
# Agent logs location
tail -f ~/.backapp-agent/logs/agent.log

# Or if running as service
journalctl -u backapp-agent -f
```

### Verbose Rclone Output

Enable debug logging in agent config:
```json
{
  "logLevel": "debug"
}
```

### Community Resources

- [Rclone Documentation](https://rclone.org/docs/)
- [Rclone Forum](https://forum.rclone.org/)
- [Rclone GitHub Issues](https://github.com/rclone/rclone/issues)

---

## Summary

**Important Change:** Both "Rsync" and "Rclone" backup methods now use rclone under the hood. You no longer need to install:
- ❌ Traditional `rsync` command
- ❌ AWS CLI (`aws`)

**Only rclone is required** for all backup methods.

Rclone provides:
- ✅ Simplicity (unified tool for all backups)
- ✅ Reliability (built-in retries and checksums)
- ✅ Flexibility (70+ storage backends)
- ✅ Efficiency (optimized cloud operations)
- ✅ Features (bandwidth limits, progress tracking, resume capability)

**Recommendation:** Use the "Rclone" method for new backups to take advantage of advanced features like two-phase mode with automatic cleanup, storage class selection, and flexible configuration options.
