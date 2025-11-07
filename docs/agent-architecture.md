# Agent-Based Backup Architecture

## Overview

This document describes the agent-based backup system that allows clients (e.g., MacBooks, workstations) to backup files directly to S3 while being managed by a central web application.

## Architecture

```
┌─────────────────┐
│   Your MacBook  │
│                 │
│  ┌───────────┐  │
│  │   Agent   │  │ ← Node.js script running locally
│  │ (Node.js) │  │
│  └─────┬─────┘  │
│        │        │
│        │ API    │
│        │ calls  │
└────────┼────────┘
         │
         ↓
┌────────────────────┐       ┌──────────┐
│  Server (Ubuntu)   │       │    S3    │
│                    │       │          │
│  - Web UI          │       │  Backup  │
│  - API Endpoints   │←──────┤  Storage │
│  - Config Storage  │ read  │          │
│  - Status Tracking │       └──────────┘
└────────────────────┘             ↑
                                   │
                           Agent uploads directly
```

## Data Models

### Agent

Represents a client machine that can execute backups.

```prisma
model Agent {
  id           String        @id @default(uuid())
  name         String                              // "David's MacBook"
  apiKey       String        @unique              // Authentication token
  apiKeyHash   String                             // Hashed version for storage
  lastSeen     DateTime?     @map("last_seen")    // Last heartbeat
  status       String        @default("offline")  // online, offline, error
  platform     String?                            // darwin, linux, win32
  version      String?                            // agent version
  userId       String        @map("user_id")
  createdAt    DateTime      @default(now()) @map("created_at")
  updatedAt    DateTime      @updatedAt @map("updated_at")

  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  configs      BackupConfig[]
  logs         AgentLog[]

  @@index([userId])
  @@map("agents")
}

model AgentLog {
  id        String   @id @default(uuid())
  agentId   String   @map("agent_id")
  level     String                        // info, warning, error
  message   String
  metadata  Json?                         // Additional context
  timestamp DateTime @default(now())

  agent     Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([agentId])
  @@index([timestamp])
  @@map("agent_logs")
}
```

### Updated BackupConfig

Add agent assignment and S3 path tracking to existing BackupConfig model.

```prisma
model BackupConfig {
  // ... existing fields ...
  agentId       String?   @map("agent_id")      // null = server-side backup
  executionMode String    @default("server")    // "server" or "agent"

  agent         Agent?    @relation(fields: [agentId], references: [id], onDelete: SetNull)

  @@index([agentId])
}
```

### Updated BackupLog

Add S3 path tracking to backup logs.

```prisma
model BackupLog {
  // ... existing fields ...
  s3Path        String?   @map("s3_path")      // Full S3 key where backup is stored
}
```

## API Endpoints

### Agent Authentication & Management

#### POST /api/agent/register
Register a new agent and receive API key.

**Request:**
```json
{
  "name": "David's MacBook",
  "platform": "darwin"
}
```

**Response:**
```json
{
  "success": true,
  "agent": {
    "id": "uuid",
    "name": "David's MacBook",
    "apiKey": "generated-api-key-show-once",
    "status": "offline"
  }
}
```

**Security:** Requires user authentication (session). API key shown ONCE only.

#### POST /api/agent/heartbeat
Agent reports it's alive.

**Request Headers:**
```
X-Agent-API-Key: agent-api-key
```

**Request:**
```json
{
  "version": "0.1.0",
  "platform": "darwin"
}
```

**Response:**
```json
{
  "success": true,
  "status": "online"
}
```

**Server Action:** Updates `lastSeen` timestamp, sets status to "online".

#### GET /api/agent/configs
Agent fetches assigned backup configurations.

**Request Headers:**
```
X-Agent-API-Key: agent-api-key
```

**Response:**
```json
{
  "success": true,
  "configs": [
    {
      "id": "config-uuid",
      "name": "Daily Backup",
      "sources": [
        { "path": "/Users/davidsells/backup" }
      ],
      "destination": {
        "bucket": "my-backups",
        "region": "us-east-1",
        "prefix": "backups"
      },
      "options": {
        "type": "full",
        "compression": true,
        "encryption": false,
        "retentionDays": 30
      }
    }
  ]
}
```

#### POST /api/agent/backup/start
Agent reports backup started and receives pre-signed URL for upload.

**Request Headers:**
```
X-Agent-API-Key: agent-api-key
```

**Request:**
```json
{
  "configId": "config-uuid",
  "filename": "backup-2025-01-07-143022.tar.gz",
  "filesize": 1024000
}
```

**Response:**
```json
{
  "success": true,
  "logId": "log-uuid",
  "upload": {
    "url": "https://s3.amazonaws.com/backapp-backups/users/user-abc/agents/agent-xyz/configs/config-123/backup-2025-01-07-143022.tar.gz?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...&X-Amz-Signature=...",
    "method": "PUT",
    "expiresAt": "2025-01-07T15:00:00Z",
    "s3Path": "users/user-abc/agents/agent-xyz/configs/config-123/backup-2025-01-07-143022.tar.gz"
  }
}
```

**Server Actions:**
1. Validates agent owns the config
2. Generates S3 path using pattern: `users/{userId}/agents/{agentId}/configs/{configId}/{filename}`
3. Creates pre-signed URL valid for 1 hour with PUT-only access
4. Creates BackupLog with status "running" and stores s3Path
5. Returns pre-signed URL to agent

**Security:** Agent never receives AWS credentials. Pre-signed URL is scoped to exact path and expires after 1 hour.

#### POST /api/agent/backup/complete
Agent reports backup finished.

**Request Headers:**
```
X-Agent-API-Key: agent-api-key
```

**Request:**
```json
{
  "logId": "log-uuid",
  "status": "completed",
  "filesProcessed": 150,
  "bytesTransferred": 1024000,
  "duration": 45000,
  "errors": []
}
```

**Response:**
```json
{
  "success": true
}
```

**Server Action:** Updates BackupLog with completion data.

#### POST /api/agent/log
Agent sends log message.

**Request Headers:**
```
X-Agent-API-Key: agent-api-key
```

**Request:**
```json
{
  "level": "info",
  "message": "Scanning directory /Users/davidsells/backup",
  "metadata": {
    "filesFound": 150
  }
}
```

## Agent Implementation (Node.js)

### Directory Structure

```
agent/
├── package.json
├── agent.js           # Main entry point
├── lib/
│   ├── api-client.js  # Server API communication
│   ├── backup.js      # Backup execution logic
│   ├── scanner.js     # File scanning
│   ├── archiver.js    # Archive creation
│   └── uploader.js    # S3 upload
└── config.json        # Agent configuration
```

### Configuration File (config.json)

```json
{
  "serverUrl": "https://backapp.davidhsells.org",
  "apiKey": "agent-api-key-from-registration",
  "agentId": "uuid-from-registration",
  "pollInterval": 30000,
  "tempDir": "/tmp/backapp-agent"
}
```

### Execution Flow

1. **Startup**
   - Load config.json
   - Send heartbeat to server
   - Fetch assigned backup configs

2. **Backup Execution**
   - For each config:
     - Validate source paths exist locally
     - Scan source directories
     - Create tar.gz archive in temp dir
     - Call `/api/agent/backup/start` with filename → get pre-signed URL and logId
     - Upload to S3 using pre-signed URL (simple PUT request)
     - Call `/api/agent/backup/complete` with results
     - Clean up temp files

3. **Error Handling**
   - Log errors to server via `/api/agent/log`
   - Continue with next backup config
   - Update backup status to "failed"

4. **Exit**
   - Send final heartbeat
   - Clean up temp directory
   - Exit process

## Security Considerations

### API Key Storage
- Agent stores API key in config.json
- Server stores bcrypt hash of API key
- API key shown ONCE during registration
- User must save API key securely

### S3 Access via Pre-signed URLs

**Security Model:**
- Agent **never receives AWS credentials**
- Server holds single set of AWS credentials (from .env)
- Server generates pre-signed URLs on-demand
- Each URL is scoped to exact S3 path and operation (PUT only)
- URLs expire after 1 hour
- Agent cannot access other users' data or perform other S3 operations

**S3 Path Structure:**
```
users/{userId}/agents/{agentId}/configs/{configId}/{filename}
```

**Example:**
```
users/user-abc123/agents/agent-xyz789/configs/config-daily/backup-2025-01-07-143022.tar.gz
```

**Benefits:**
- ✅ No credentials on client machines
- ✅ User isolation enforced by path structure
- ✅ Agent can only upload to assigned paths
- ✅ Time-limited access (URLs expire)
- ✅ Operation-limited (PUT only, no list/delete)
- ✅ Server maintains full control
- ✅ Simple AWS credential management (one set in .env)

### Network Security
- All API calls over HTTPS
- API key in `X-Agent-API-Key` header
- Rate limiting on agent endpoints
- Monitor for suspicious activity
- Pre-signed URLs transmitted over HTTPS only

## UI Changes

### Agent Management Page

New page: `/agents`

**Features:**
- List all registered agents
- Register new agent (shows API key once)
- View agent status (online/offline/last seen)
- View agent logs
- Deactivate/delete agent
- Assign backup configs to agents

### Backup Configuration Page Updates

**Changes:**
- Add "Execution Mode" radio buttons:
  - [ ] Server-side (backup files on this server)
  - [ ] Agent-based (backup files on remote client)
- If agent-based selected:
  - Show dropdown: "Select Agent"
  - Note: "Source paths are relative to the agent's machine"

## Migration Path

### Phase 1: MVP (Current)
- ✅ Basic agent registration
- ✅ API key authentication
- ✅ Manual agent execution (run on-demand)
- ✅ Pre-signed URLs for secure S3 upload
- ✅ Per-user S3 path isolation
- ✅ Basic status reporting
- ✅ Single AWS credential set (server-side)

### Phase 2: Enhancement
- Background service (daemon/launchd on Mac)
- Scheduled execution (cron-like)
- WebSocket for real-time communication
- Progress streaming during backup
- Automatic retries on failure
- Better error handling and recovery
- Agent log streaming to UI

### Phase 3: Advanced
- Agent auto-update mechanism
- Multiple simultaneous backups
- Bandwidth throttling
- Incremental backups (track changed files)
- Agent health monitoring dashboard
- Cross-platform installers (Mac/Windows/Linux)
- Agent clustering for high-availability

## Testing Strategy

### Unit Tests
- API endpoint authentication
- Backup config assignment
- Agent status tracking

### Integration Tests
- Agent registration flow
- Full backup execution
- S3 upload verification
- Error handling and recovery

### Manual Testing
1. Register agent from web UI
2. Save API key to config.json on MacBook
3. Run agent: `node agent.js`
4. Verify backup appears in S3
5. Verify logs in web UI
6. Test with non-existent source path
7. Test with network interruption

## Success Criteria

**MVP is complete when:**
- [x] User can register agent via web UI
- [x] Agent authenticates with server using API key
- [x] Agent fetches backup config from server
- [x] Agent scans local directory on MacBook
- [x] Agent creates tar.gz archive
- [x] Agent uploads archive directly to S3
- [x] Agent reports success/failure to server
- [x] Web UI shows backup log with agent execution
- [x] User can see agent online/offline status

## S3 Bucket Organization

### Bucket Structure

**Configuration:**
- Bucket Name: `backapp-backups` (or user-configurable via AWS_S3_BUCKET)
- Region: Configurable via AWS_S3_REGION
- Single bucket for entire application

### Path Hierarchy

```
backapp-backups/
  └── users/
      └── {userId}/                    # e.g., user-abc123
          └── agents/
              └── {agentId}/            # e.g., agent-xyz789
                  └── configs/
                      └── {configId}/   # e.g., config-daily-home
                          ├── backup-2025-01-07-143022.tar.gz
                          ├── backup-2025-01-07-183045.tar.gz
                          └── backup-2025-01-08-143022.tar.gz
```

### Path Template

```
users/{userId}/agents/{agentId}/configs/{configId}/{filename}
```

### Example Paths

```
# User David's MacBook backing up home directory
users/user-abc123/agents/agent-macbook-xyz/configs/config-home-daily/backup-2025-01-07-143022.tar.gz

# User David's work laptop backing up documents
users/user-abc123/agents/agent-work-def/configs/config-docs-weekly/backup-2025-01-07-183045.tar.gz

# User Jane's server backing up database
users/user-def456/agents/agent-server-mno/configs/config-db-hourly/backup-2025-01-07-140000.tar.gz
```

### Benefits of This Structure

1. **User Isolation:** Each user has dedicated namespace under `users/{userId}/`
2. **Multi-Agent Support:** Users can have multiple agents (MacBook, work laptop, server)
3. **Config Organization:** Each backup config gets its own folder
4. **Clear Ownership:** Path shows user → agent → config hierarchy
5. **Easy Cleanup:** Delete user prefix to remove all their data
6. **Security Scoping:** Pre-signed URLs can be scoped to exact paths
7. **Scalability:** S3 automatically partitions by prefix for performance

### Lifecycle Policies

**Recommended Setup:**
```json
{
  "Rules": [
    {
      "Id": "archive-old-backups",
      "Status": "Enabled",
      "Prefix": "users/",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER_IR"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

### Cost Optimization

**Storage Classes:**
- First 30 days: S3 Standard (frequent access)
- 30-90 days: Glacier Instant Retrieval (infrequent access)
- 90-365 days: Glacier Flexible Retrieval (rare access)
- After 365 days: Delete (configurable per config)

### Security Configuration

**Bucket Policy (Recommended):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::backapp-backups/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

**Block Public Access:** Enabled (all settings)

### Environment Variables

Required in `.env`:
```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=backapp-backups
AWS_S3_ENDPOINT=  # Optional: for S3-compatible services
```

## Implementation Order

1. Database schema (Agent, AgentLog models)
2. Migration script
3. Agent API endpoints (register, heartbeat, configs, backup status)
4. S3 pre-signed URL generation service
5. Agent management UI page
6. Update backup config UI (add agent assignment)
7. Build minimal agent script (Node.js)
8. Test end-to-end on MacBook → S3
9. Documentation for agent setup

## Architecture Decisions

### Resolved for MVP:

1. **✅ AWS Credentials:** Single set from server's `.env` file
   - All agents use same AWS account
   - Server generates pre-signed URLs with these credentials
   - No credentials distributed to agents

2. **✅ S3 Organization:** One bucket with per-user prefixes
   - Structure: `users/{userId}/agents/{agentId}/configs/{configId}/`
   - Scalable to unlimited users and agents
   - Pre-signed URLs enforce path isolation

3. **✅ Upload Security:** Pre-signed URLs (not STS or direct credentials)
   - Agent receives time-limited, operation-scoped URLs
   - No AWS credentials on client machines
   - Server maintains full control

### Open for Future Phases:

1. **Agent Updates:** Manual npm install (MVP) → Auto-update mechanism (Phase 3)
2. **Multiple Configs:** Sequential execution (MVP) → Parallel execution (Phase 3)
3. **Scheduling:** Manual execution (MVP) → Server-triggered or agent-side scheduler (Phase 2)
4. **Platform Support:** Node.js script on Mac (MVP) → Cross-platform installers (Phase 3)

## Related Documents

- `/docs/phase3-backup-system.md` - Original server-side backup design
- `/docs/s3-configuration-guide.md` - S3 setup instructions
