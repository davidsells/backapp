# S3 Configuration Guide

This guide explains how to configure S3 storage for BackApp backups.

## Understanding S3 Endpoint vs Bucket

### Bucket Name
The **bucket name** is just the name of your S3 bucket, without any URLs or paths.

**Examples:**
- `my-backups`
- `company-backup-storage`
- `prod-database-backups`

### Endpoint (Optional)
The **endpoint** is only needed for S3-compatible storage (MinIO, Wasabi, DigitalOcean Spaces, etc.). It's the base URL of the S3 service, **WITHOUT** the bucket name.

**Examples:**

| Service | Endpoint | Bucket | ❌ Wrong |
|---------|----------|--------|----------|
| AWS S3 | *(leave empty)* | `my-backups` | `s3.amazonaws.com/my-backups` |
| MinIO | `http://minio.local:9000` | `backups` | `http://minio.local:9000/backups` |
| Wasabi | `https://s3.wasabisys.com` | `my-bucket` | `https://s3.wasabisys.com/my-bucket` |
| DigitalOcean | `https://nyc3.digitaloceanspaces.com` | `app-backups` | `https://nyc3.digitaloceanspaces.com/app-backups` |

## Environment Variables

Add these to your `.env` file:

```bash
# For AWS S3
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1

# For S3-compatible storage (MinIO, Wasabi, etc.)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1  # Can be any region for non-AWS

# Encryption key for backup files
BACKUP_ENCRYPTION_KEY=your-32-char-base64-key-here
```

### Generating an Encryption Key

```bash
openssl rand -base64 32
```

## Creating a Backup Configuration

When creating a backup in the UI (`/backups/new`):

### 1. Basic Information
- **Name**: Descriptive name (e.g., "Daily Database Backup")
- **Enabled**: Check to activate scheduling

### 2. Backup Sources
- **Path**: Full path to directory to backup
  - Example: `/var/lib/postgresql/data`
  - Example: `/home/app/uploads`
- Add multiple sources if needed

### 3. S3 Destination

#### For AWS S3:
- **S3 Bucket**: `my-backup-bucket`
- **Region**: `us-east-1` (match your bucket's region)
- **Prefix**: `backups` (optional, organizes files in bucket)
- **Custom Endpoint**: *(leave empty)*

#### For MinIO:
- **S3 Bucket**: `backups`
- **Region**: `us-east-1` (can be any value)
- **Prefix**: `daily` (optional)
- **Custom Endpoint**: `http://minio:9000` or `https://minio.yourdomain.com`

#### For Wasabi:
- **S3 Bucket**: `my-wasabi-bucket`
- **Region**: `us-east-1`
- **Prefix**: `backups` (optional)
- **Custom Endpoint**: `https://s3.wasabisys.com`

#### For DigitalOcean Spaces:
- **S3 Bucket**: `my-space-name`
- **Region**: `nyc3`
- **Prefix**: `backups` (optional)
- **Custom Endpoint**: `https://nyc3.digitaloceanspaces.com`

### 4. Schedule
- **Cron Expression**:
  - `0 2 * * *` = Daily at 2 AM
  - `0 */6 * * *` = Every 6 hours
  - `0 0 * * 0` = Weekly on Sunday at midnight
- **Timezone**: `UTC` or `America/New_York`, etc.

### 5. Options
- **Type**: Full (backs up all files) or Incremental (not yet implemented)
- **Compression**: Recommended for most cases
- **Compression Level**: 6 (balanced), lower=faster, higher=smaller
- **Encryption**: Enable if storing sensitive data
- **Retention Days**: How long to keep old backups (30 recommended)

## Testing Your Configuration

### 1. Create S3 Bucket (if using AWS)

```bash
aws s3 mb s3://my-backup-bucket --region us-east-1
```

### 2. Test S3 Access

```bash
# Upload a test file
echo "test" > test.txt
aws s3 cp test.txt s3://my-backup-bucket/test.txt

# List bucket contents
aws s3 ls s3://my-backup-bucket/

# Download the file
aws s3 cp s3://my-backup-bucket/test.txt downloaded.txt

# Clean up
aws s3 rm s3://my-backup-bucket/test.txt
rm test.txt downloaded.txt
```

### 3. Create Test Backup via UI

1. Go to https://backapp.yourdomain.com/backups
2. Click "Create Backup"
3. Fill in the form with your S3 details
4. Save the configuration

### 4. Trigger Manual Backup

After creating a config, you can trigger it manually:

```bash
# Via API (get your config ID from the UI)
curl -X POST https://backapp.yourdomain.com/api/backups/execute \
  -H "Content-Type: application/json" \
  -d '{"configId": "your-config-id-here"}'
```

Or use the "Run Now" button in the UI (if implemented).

### 5. Check Backup Logs

- Go to `/backups/logs` in the UI
- Check for your backup execution
- Verify it completed successfully

### 6. Verify in S3

```bash
# List your backups
aws s3 ls s3://my-backup-bucket/backups/

# You should see files like:
# Daily-Database-Backup-2025-11-06T19-30-00.tar.gz
```

## Troubleshooting

### "Failed to connect to S3 bucket"

**Causes:**
1. Incorrect endpoint URL
2. Bucket doesn't exist
3. Wrong region
4. Network connectivity issues

**Solution:**
```bash
# Test connectivity
aws s3 ls s3://my-bucket-name --region us-east-1

# Check endpoint is accessible
curl -I https://your-s3-endpoint.com
```

### "Access Denied"

**Causes:**
1. Invalid access key/secret key
2. Insufficient permissions
3. Bucket policy blocking access

**Solution:**
- Verify credentials in `.env`
- Ensure IAM user has S3 permissions:

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
        "arn:aws:s3:::my-bucket-name/*",
        "arn:aws:s3:::my-bucket-name"
      ]
    }
  ]
}
```

### "Validation failed: Bucket name is required"

Make sure you entered the bucket name (not the full URL).

**Wrong:** `https://s3.amazonaws.com/my-bucket`
**Right:** `my-bucket`

### Backup succeeds but file not in S3

Check the prefix setting. If you set prefix to `backups`, files will be in:
- `s3://my-bucket/backups/Backup-Name-2025-11-06.tar.gz`

Not in:
- `s3://my-bucket/Backup-Name-2025-11-06.tar.gz`

## S3 Bucket Lifecycle Rules (Optional)

To automatically delete old backups based on retention:

```bash
# Create lifecycle policy (example: delete after 30 days)
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-backup-bucket \
  --lifecycle-configuration file://lifecycle.json
```

**lifecycle.json:**
```json
{
  "Rules": [
    {
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "Prefix": "backups/",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

## Common S3-Compatible Storage Providers

| Provider | Endpoint Pattern | Docs |
|----------|-----------------|------|
| AWS S3 | *(default)* | https://aws.amazon.com/s3/ |
| MinIO | `http://HOST:9000` | https://min.io/docs/minio/linux/index.html |
| Wasabi | `https://s3.wasabisys.com` or regional | https://wasabi.com/s3-compatible-cloud-storage/ |
| Backblaze B2 | `https://s3.REGION.backblazeb2.com` | https://www.backblaze.com/b2/docs/s3_compatible_api.html |
| DigitalOcean Spaces | `https://REGION.digitaloceanspaces.com` | https://docs.digitalocean.com/products/spaces/ |
| Cloudflare R2 | `https://ACCOUNT.r2.cloudflarestorage.com` | https://developers.cloudflare.com/r2/ |
| Linode Object Storage | `https://CLUSTER.linodeobjects.com` | https://www.linode.com/docs/products/storage/object-storage/ |

## Security Best Practices

1. **Use separate IAM credentials** for backups (not root account)
2. **Enable encryption** in backup options for sensitive data
3. **Rotate access keys** periodically
4. **Use bucket policies** to restrict access
5. **Enable S3 versioning** for backup protection
6. **Monitor S3 costs** to avoid surprises
7. **Test restores** regularly to ensure backups are valid

## Cost Optimization

1. **Use compression** to reduce storage costs
2. **Set appropriate retention** (don't keep backups forever)
3. **Use lifecycle policies** to automatically delete old backups
4. **Consider S3 Glacier** for long-term archival (AWS)
5. **Choose the right storage class** (Standard vs Infrequent Access)

## Example Configurations

### Development (MinIO)
```
Bucket: dev-backups
Region: us-east-1
Prefix: local
Endpoint: http://localhost:9000
```

### Staging (AWS S3)
```
Bucket: staging-backups-company
Region: us-west-2
Prefix: backups/staging
Endpoint: (empty)
```

### Production (Wasabi)
```
Bucket: prod-backups-company
Region: us-east-1
Prefix: backups/production
Endpoint: https://s3.wasabisys.com
```
