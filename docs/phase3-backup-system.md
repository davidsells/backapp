# Phase 3: Backup System Implementation

This document describes the S3 backup system implementation for BackApp.

## Overview

Phase 3 implements the core backup functionality, including:
- S3 storage adapter for AWS S3 or S3-compatible storage
- File scanning and archiving with compression/encryption
- Backup configuration management
- Automated scheduling with cron
- Real-time progress tracking
- Backup logs and statistics

## Architecture

### Components

1. **S3 Adapter** (`src/lib/storage/s3-adapter.ts`)
   - Handles all S3 operations (upload, download, list, delete)
   - Supports custom S3-compatible endpoints
   - Provides progress tracking for uploads
   - Singleton pattern for shared configuration

2. **File Processor** (`src/lib/backup/file-processor.ts`)
   - Scans directories with include/exclude patterns
   - Creates tar archives with optional gzip compression
   - Handles AES-256 encryption for backups
   - Pattern matching for file filtering

3. **Backup Service** (`src/lib/backup/backup-service.ts`)
   - Business logic for backup configurations
   - CRUD operations for backup configs
   - Configuration validation
   - Statistics and reporting

4. **Backup Executor** (`src/lib/backup/backup-executor.ts`)
   - Orchestrates the backup process
   - Creates backup logs with detailed metrics
   - Handles errors and creates alerts
   - Manages temporary files and cleanup

5. **Backup Scheduler** (`src/lib/scheduler/backup-scheduler.ts`)
   - Manages cron-based scheduled backups
   - Runs as a separate process
   - Graceful startup/shutdown
   - Per-configuration timezone support

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1

# Backup Encryption Key (generate with: openssl rand -base64 32)
BACKUP_ENCRYPTION_KEY=your-encryption-key-here

# Optional: For S3-compatible storage (MinIO, LocalStack, etc.)
AWS_S3_ENDPOINT=https://s3.example.com
```

### S3 Bucket Setup

1. Create an S3 bucket for backups
2. Configure bucket lifecycle policies for retention
3. Set up appropriate IAM permissions:

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
        "arn:aws:s3:::your-bucket-name/*",
        "arn:aws:s3:::your-bucket-name"
      ]
    }
  ]
}
```

## API Endpoints

### Backup Configurations

- `GET /api/backups/configs` - List all backup configurations
- `POST /api/backups/configs` - Create a new backup configuration
- `GET /api/backups/configs/[id]` - Get backup configuration by ID
- `PATCH /api/backups/configs/[id]` - Update backup configuration
- `DELETE /api/backups/configs/[id]` - Delete backup configuration

### Backup Execution

- `POST /api/backups/execute` - Trigger a backup job
  - Body: `{ "configId": "uuid" }`
  - Executes asynchronously

### Backup Logs

- `GET /api/backups/logs` - Get backup logs
  - Query params: `configId` (optional), `limit` (optional)

### Statistics

- `GET /api/backups/stats` - Get backup statistics
  - Returns: total configs, active configs, total backups, success rate, etc.

## UI Pages

### Backup List Page (`/backups`)

- Overview statistics dashboard
- List of all backup configurations
- Quick actions: View, Edit, Create
- Link to backup logs

### Backup Logs Page (`/backups/logs`)

- Recent backup execution history
- Status indicators (completed, failed, running)
- File counts and data transferred
- Execution duration

### Create Backup Page (`/backups/new`)

- Form to create new backup configuration
- Sections:
  - Basic Information (name, enabled)
  - Sources (directory paths with patterns)
  - S3 Destination (bucket, region, prefix, endpoint)
  - Schedule (cron expression, timezone)
  - Options (type, compression, encryption, retention)

## Backup Configuration Schema

```typescript
{
  name: string;                    // Configuration name
  enabled: boolean;                // Enable/disable this config
  sources: [                       // Source directories to backup
    {
      path: string;                // Directory path
      excludePatterns?: string[];  // Files to exclude (glob patterns)
      includePatterns?: string[];  // Files to include (glob patterns)
    }
  ];
  destination: {
    bucket: string;                // S3 bucket name
    region: string;                // AWS region
    prefix?: string;               // S3 key prefix
    endpoint?: string;             // Custom S3 endpoint
  };
  schedule: {
    cronExpression: string;        // Cron schedule
    timezone: string;              // Timezone for schedule
  };
  options: {
    type: 'full' | 'incremental';  // Backup type
    compression: boolean;          // Enable gzip compression
    compressionLevel?: number;     // 1-9 (default: 6)
    encryption: boolean;           // Enable AES-256 encryption
    retentionDays?: number;        // Days to retain backups
    bandwidth?: number;            // KB/s limit (optional)
  };
}
```

## Running the Scheduler

The backup scheduler runs as a separate process to execute scheduled backups.

### In Development

```bash
npm run scheduler
```

### In Production (Docker)

The scheduler should run as a separate container or process:

```yaml
scheduler:
  build: .
  command: npm run scheduler
  environment:
    - DATABASE_URL=${DATABASE_URL}
    - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
    - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    - BACKUP_ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}
  depends_on:
    - db
```

Or add to your existing container as a background process in the entrypoint script:

```bash
# Start scheduler in background
npm run scheduler &

# Start Next.js
npm start
```

## Backup Process Flow

1. **Trigger**: Manual or scheduled via cron
2. **Initialize**: Create backup log entry with "running" status
3. **Scan**: Scan all source directories, apply patterns
4. **Archive**: Create tar.gz archive in temporary directory
5. **Encrypt**: Optionally encrypt the archive with AES-256
6. **Upload**: Upload to S3 with progress tracking
7. **Cleanup**: Remove temporary files
8. **Log**: Update backup log with metrics and status
9. **Alert**: Create alert if backup failed

## Monitoring and Alerts

### Backup Logs

Each backup execution creates a log entry with:
- Start/end time and duration
- Files processed and skipped
- Total bytes and bytes transferred
- Status (running, completed, failed, cancelled)
- Error details (if any)

### Alerts

Alerts are created for:
- Backup failures
- Configuration errors
- S3 connection issues

Alerts can be viewed in the UI and marked as acknowledged.

## Security Considerations

1. **Encryption**: Use strong encryption keys (32+ bytes)
2. **Credentials**: Store AWS credentials securely (environment variables, secrets manager)
3. **Access Control**: All API endpoints require authentication
4. **S3 Bucket**: Use bucket policies to restrict access
5. **Logs**: Sensitive data should not be logged

## Performance

### Optimization Tips

1. **Compression Level**: Lower levels (1-3) are faster, higher levels (7-9) save space
2. **Exclude Patterns**: Exclude unnecessary files to reduce backup size
3. **Bandwidth Limiting**: Use bandwidth option to limit network usage
4. **Retention**: Configure appropriate retention to manage storage costs
5. **Incremental Backups**: Use incremental backups for large datasets (when implemented)

## Troubleshooting

### Common Issues

**Backup fails with "AWS credentials not configured"**
- Ensure `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
- Check that credentials have necessary S3 permissions

**Backup fails with "Failed to connect to S3 bucket"**
- Verify bucket exists and region is correct
- Check S3 endpoint URL if using custom endpoint
- Ensure network connectivity to S3

**Scheduler not running scheduled backups**
- Check scheduler process is running: `ps aux | grep scheduler`
- Verify cron expression is valid
- Check timezone settings
- Review scheduler logs for errors

**Backup takes too long**
- Reduce compression level
- Use exclude patterns to skip large unnecessary files
- Check network bandwidth
- Consider incremental backups

**Out of disk space during backup**
- Backups use temporary directory (usually `/tmp`)
- Ensure sufficient space in temp directory
- Implement cleanup for old backups

## Future Enhancements

Potential improvements for future phases:
- Incremental backup implementation (track file changes)
- Backup restoration functionality
- Multi-threaded file scanning
- Resume interrupted backups
- Email notifications for backup status
- Backup verification and integrity checks
- Bandwidth throttling
- Differential backups
- Backup deduplication

## Testing

### Manual Testing

1. Create a backup configuration through the UI
2. Trigger a manual backup
3. Monitor logs for completion
4. Verify backup file appears in S3 bucket
5. Check backup log shows correct metrics

### API Testing

```bash
# Create backup config
curl -X POST http://localhost:3000/api/backups/configs \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Backup",
    "enabled": true,
    "sources": [{"path": "/data/test"}],
    "destination": {"bucket": "my-bucket", "region": "us-east-1"},
    "schedule": {"cronExpression": "0 2 * * *", "timezone": "UTC"},
    "options": {"type": "full", "compression": true, "encryption": false, "retentionDays": 30}
  }'

# Trigger backup
curl -X POST http://localhost:3000/api/backups/execute \
  -H "Content-Type: application/json" \
  -d '{"configId": "config-id-here"}'

# Check logs
curl http://localhost:3000/api/backups/logs?limit=10
```

## Support

For issues or questions about the backup system:
1. Check logs: `docker-compose logs app` and `docker-compose logs scheduler`
2. Review backup logs in the UI
3. Check S3 bucket contents
4. Verify environment variables are set correctly
