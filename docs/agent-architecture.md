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

Add agent assignment to existing BackupConfig model.

```prisma
model BackupConfig {
  // ... existing fields ...
  agentId       String?   @map("agent_id")      // null = server-side backup
  executionMode String    @default("server")    // "server" or "agent"

  agent         Agent?    @relation(fields: [agentId], references: [id], onDelete: SetNull)

  @@index([agentId])
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
Agent reports backup started.

**Request Headers:**
```
X-Agent-API-Key: agent-api-key
```

**Request:**
```json
{
  "configId": "config-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "logId": "log-uuid",
  "s3Config": {
    "accessKeyId": "AWS_KEY",
    "secretAccessKey": "AWS_SECRET",
    "region": "us-east-1"
  }
}
```

**Server Action:** Creates BackupLog with status "running".

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
     - Call `/api/agent/backup/start` → get logId
     - Scan source directories
     - Create tar.gz archive in temp dir
     - Upload to S3 using AWS SDK
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

### S3 Access Methods

**MVP: Agent Gets AWS Credentials**
- Server provides AWS credentials in `/api/agent/backup/start`
- Agent uses AWS SDK with credentials
- Simplest implementation for prototype

**Future: Pre-signed URLs**
- Server generates pre-signed URL for upload
- Agent uploads without AWS credentials
- More secure, recommended for production

### Network Security
- All API calls over HTTPS
- API key in `X-Agent-API-Key` header
- Rate limiting on agent endpoints
- Monitor for suspicious activity

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
- ✅ Simple polling mechanism
- ✅ Manual agent execution
- ✅ Direct S3 upload with AWS credentials
- ✅ Basic status reporting

### Phase 2: Enhancement
- Background service (daemon/launchd)
- WebSocket for real-time communication
- Progress streaming
- Pre-signed URLs for S3
- Automatic retries
- Better error handling

### Phase 3: Advanced
- Agent auto-update mechanism
- Multiple simultaneous backups
- Bandwidth throttling
- Incremental backups (track changed files)
- Agent health monitoring dashboard
- Cross-platform installers (Mac/Windows/Linux)

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

## Implementation Order

1. Database schema (Agent, AgentLog models)
2. Migration script
3. Agent API endpoints (register, heartbeat, configs, backup status)
4. Agent management UI page
5. Update backup config UI (add agent assignment)
6. Build minimal agent script (Node.js)
7. Test end-to-end on MacBook → S3
8. Documentation for agent setup

## Open Questions

1. **AWS Credentials:** Environment variables on server or stored per-config?
2. **Agent Updates:** Manual npm install or auto-update mechanism?
3. **Multiple Agents:** Can same agent run multiple backup configs simultaneously?
4. **Scheduling:** Server-side cron trigger or agent-side scheduler?

## Related Documents

- `/docs/phase3-backup-system.md` - Original server-side backup design
- `/docs/s3-configuration-guide.md` - S3 setup instructions
