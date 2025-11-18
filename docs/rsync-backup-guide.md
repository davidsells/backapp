# Rsync Backup Guide

## Overview

The Rsync backup method provides an efficient, incremental backup solution that combines the power of `rsync` for local file synchronization with AWS S3 for cloud storage. This approach is ideal for backing up large datasets where you want to minimize bandwidth usage and upload times.

## How It Works

The Rsync backup process follows a two-step workflow:

1. **Local Sync with rsync**: Your source directories are synchronized to a local staging directory using `rsync`. This tool is extremely efficient at identifying and copying only changed files.

2. **S3 Upload with AWS CLI**: After the local sync completes, the staging directory is uploaded to S3 using the `aws s3 sync` command, which also only uploads changed files.

This hybrid approach offers several advantages:

- **Bandwidth-friendly**: Only changed blocks hit the network (rsync delta)
- **S3-cost-friendly**: One `aws s3 sync` call per folder, no excessive LIST operations
- **Resume-safe**: Both rsync and `aws s3 sync` can continue partial transfers
- **Versioned backups**: Each backup is stored under a date-stamped path in S3
- **Lifecycle ready**: Compatible with S3 lifecycle policies for automatic archival or expiration

## Prerequisites

Before using the Rsync backup method, ensure your agent system has the following installed:

1. **rsync**: The rsync command-line tool
   ```bash
   # On Ubuntu/Debian
   sudo apt-get install rsync

   # On macOS
   brew install rsync
   ```

2. **AWS CLI v2**: The AWS command-line interface
   ```bash
   # Installation instructions at:
   # https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

   # Verify installation
   aws --version
   ```

3. **AWS Credentials**: Configure AWS credentials for S3 access
   ```bash
   aws configure
   # Or set environment variables:
   # AWS_ACCESS_KEY_ID
   # AWS_SECRET_ACCESS_KEY
   # AWS_DEFAULT_REGION
   ```

## Configuration

When creating a backup configuration with the Rsync method, you'll need to specify:

### Required Settings

- **Backup Method**: Select "Rsync + S3" from the dropdown
- **Source Paths**: One or more directories to backup
- **Local Staging Directory**: Where rsync will create a local replica (e.g., `/tmp/backup-staging`)
- **Agent**: The agent that will execute the backup (must have rsync and AWS CLI installed)

**Note**: The S3 bucket is configured globally in the application's environment settings (`AWS_S3_BUCKET`). All users and agents share this bucket, organizing their backups using the S3 Prefix field.

### Optional Settings

- **S3 Prefix**: Path prefix within the shared bucket for organizing backups by user/agent (e.g., "users/john/agent-1")
- **Storage Class**: S3 storage class to use
  - `STANDARD`: Standard storage
  - `STANDARD_IA`: Infrequent Access (cost-effective for backups)
  - `GLACIER`: Long-term archival
  - `DEEP_ARCHIVE`: Lowest-cost archival
- **Mirror Deletions**: When enabled, files deleted from the source will also be removed from the backup

### Exclusion Patterns

You can specify patterns to exclude from the backup, such as:
- `node_modules`
- `.git`
- `*.log`
- `*.tmp`

Default exclusions are automatically applied.

## Backup Structure

### Shared Bucket Architecture

**Important**: The application uses a single S3 bucket configured via the `AWS_S3_BUCKET` environment variable. All users and agents share this bucket, organizing their backups using the S3 Prefix field in their backup configurations.

AWS S3 uses "object keys" (similar to file paths) to organize data, so there's no technical difference between using separate buckets or organizing data within a single bucket using prefixes.

**Benefits of this shared bucket approach:**
- Simplified AWS account management (one bucket to create and manage)
- Centralized billing and monitoring
- Easier to apply bucket-wide policies (encryption, versioning, lifecycle rules)
- More cost-effective (no per-bucket overhead)
- Users cannot accidentally misconfigure different buckets

**Organization pattern:**
```
s3://${AWS_S3_BUCKET}/{user-prefix}/{agent-prefix}/rsync/{YYYY-MM-DD}/
```

### Path Structure

Backups are organized in S3 using the following structure:

```
s3://${AWS_S3_BUCKET}/{prefix}/rsync/{YYYY-MM-DD}/
```

**Examples:**

If you don't specify a prefix:
```
s3://${AWS_S3_BUCKET}/rsync/2025-11-18/
```

With user/agent organization (recommended):
```
s3://${AWS_S3_BUCKET}/users/john/agent-1/rsync/2025-11-18/
s3://${AWS_S3_BUCKET}/users/john/agent-2/rsync/2025-11-18/
s3://${AWS_S3_BUCKET}/users/jane/agent-1/rsync/2025-11-18/
```

Each date gets its own folder, making it easy to implement retention policies and manage backup versions.

## Workflow Monitoring

The webapp monitors rsync backups through the following stages:

1. **Preparing**: Validating sources and configuration
2. **Rsync**: Syncing files to local staging directory
3. **Uploading**: Uploading to S3 via AWS CLI
4. **Completed**: Backup finished successfully

Progress updates are sent via WebSocket and displayed in the UI.

## Comparison: Archive vs Rsync

| Feature | Archive (tar.gz) | Rsync + S3 |
|---------|-----------------|------------|
| **Method** | Creates compressed archive | Incremental file sync |
| **Best for** | Small to medium datasets | Large, frequently updated datasets |
| **Bandwidth** | Uploads entire archive each time | Only uploads changed files |
| **Speed** | Slower for large datasets | Faster for incremental changes |
| **Local storage** | Temporary archive file | Persistent staging directory |
| **File recovery** | Must download entire archive | Can download individual files |
| **Compression** | Built-in gzip compression | Files stored uncompressed in S3 |
| **Versioning** | Each backup is separate archive | Daily snapshots with incremental changes |

## Example Use Cases

### Use Case 1: External Drive Backup to S3

Backup an external drive to both a local directory and S3:

- **Source**: `/Volumes/ExternalDrive/Photos`
- **Local Staging**: `/Users/me/backups/photos-replica`
- **S3 Prefix**: `personal/photos`
- **Mirror Deletions**: Enabled

This configuration maintains a local replica on your machine and keeps a synchronized copy in the shared S3 bucket configured via `AWS_S3_BUCKET`.

### Use Case 2: Multi-User Organization

Multiple users backing up to the shared bucket with organized prefixes:

**User 1 Configuration:**
- **Source**: `/home/john/documents`
- **Local Staging**: `/backup/john-staging`
- **S3 Prefix**: `users/john/laptop`
- **Storage Class**: `STANDARD_IA`
- **Schedule**: Daily at 2 AM

**User 2 Configuration:**
- **Source**: `/home/jane/projects`
- **Local Staging**: `/backup/jane-staging`
- **S3 Prefix**: `users/jane/desktop`
- **Storage Class**: `STANDARD_IA`
- **Schedule**: Daily at 3 AM

This configuration creates organized daily snapshots in the shared bucket (configured via `AWS_S3_BUCKET`):
- `s3://${AWS_S3_BUCKET}/users/john/laptop/rsync/2025-11-18/`
- `s3://${AWS_S3_BUCKET}/users/john/laptop/rsync/2025-11-19/`
- `s3://${AWS_S3_BUCKET}/users/jane/desktop/rsync/2025-11-18/`
- `s3://${AWS_S3_BUCKET}/users/jane/desktop/rsync/2025-11-19/`

## Lifecycle Management

To automatically expire old backups, configure an S3 lifecycle policy on your bucket (configured via `AWS_S3_BUCKET`):

```json
{
  "Rules": [
    {
      "Id": "ExpireOldRsyncBackups",
      "Filter": {
        "Prefix": "users/"
      },
      "Status": "Enabled",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

This will automatically delete all user backups older than 30 days. You can adjust the prefix filter to target specific users or leave it empty to apply to all backups in the bucket.

## Troubleshooting

### rsync command not found

Install rsync on your agent system:
```bash
# Ubuntu/Debian
sudo apt-get install rsync

# macOS
brew install rsync
```

### aws command not found

Install AWS CLI v2:
```bash
# Follow instructions at:
# https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
```

### Permission denied on S3 upload

Ensure your AWS credentials have the necessary S3 permissions for the bucket configured in `AWS_S3_BUCKET`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${AWS_S3_BUCKET}/*",
        "arn:aws:s3:::${AWS_S3_BUCKET}"
      ]
    }
  ]
}
```

Replace `${AWS_S3_BUCKET}` with your actual bucket name when creating the IAM policy.

### Staging directory fills up disk

The local staging directory grows to match the size of your backup sources. Ensure you have adequate disk space, or use a different staging location with more space.

Consider:
- Using a separate volume for staging
- Implementing cleanup scripts to remove old staging data
- Monitoring disk usage on your agent system

## Best Practices

1. **Choose appropriate storage class**: Use `STANDARD_IA` for backups accessed infrequently
2. **Set up lifecycle policies**: Automatically archive or delete old backups
3. **Monitor disk space**: Ensure adequate space for local staging directory
4. **Test restores**: Periodically verify you can restore from your backups
5. **Use encryption**: Enable S3 bucket encryption for sensitive data
6. **Schedule during off-hours**: Run backups when system load is low

## Security Considerations

- Store AWS credentials securely on the agent system
- Use IAM roles with least-privilege access to S3
- Enable S3 bucket encryption (SSE-S3 or SSE-KMS)
- Consider using S3 Object Lock for compliance requirements
- Regularly rotate AWS credentials
- Monitor S3 access logs for unusual activity
