# Backup System Application - High-Level Architecture Plan

## Executive Summary

This document outlines the high-level architecture for a cross-platform backup system designed to assist users in setting up and managing backups for Ubuntu, Linux, and macOS systems. The application will provide a user-friendly web interface built with Next.js, enabling users to configure, monitor, and manage their backup operations to Amazon S3 storage.

## System Overview

### Target Platforms
- Ubuntu Linux
- Generic Linux distributions
- macOS

### Core Capabilities
- Configure backup sources (files, directories)
- Manage S3 storage destinations
- Schedule and execute backup operations
- Monitor backup status and health
- Generate reports on backup operations
- Secure authentication and authorization

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **UI Library**: React 18+
- **Styling**: Tailwind CSS
- **State Management**: React Context API / Zustand
- **Form Handling**: React Hook Form + Zod validation

### Backend
- **Runtime**: Next.js Server Components & API Routes
- **Authentication**: NextAuth.js (Auth.js v5)
- **Database**: PostgreSQL (user config, backup history)
- **ORM**: Prisma
- **File Operations**: Node.js fs/promises
- **S3 Integration**: AWS SDK v3

### Testing
- **Unit Tests**: Jest + React Testing Library
- **Integration Tests**: Jest + Supertest
- **E2E Tests**: Playwright
- **API Testing**: Jest + MSW (Mock Service Worker)

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│              Next.js Application                     │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │         Frontend (Client Components)       │    │
│  │  - Dashboard UI                            │    │
│  │  - Configuration Forms                     │    │
│  │  - Monitoring Displays                     │    │
│  │  - Report Viewers                          │    │
│  └────────────────────────────────────────────┘    │
│                      │                              │
│                      ▼                              │
│  ┌────────────────────────────────────────────┐    │
│  │      Backend (Server Components & APIs)    │    │
│  │  - Authentication Layer                    │    │
│  │  - Business Logic                          │    │
│  │  - Data Access Layer                       │    │
│  └────────────────────────────────────────────┘    │
│                      │                              │
└──────────────────────┼──────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐            ┌─────────────────┐
│  PostgreSQL   │            │   Amazon S3     │
│   Database    │            │   Storage       │
│               │            │                 │
│ - Users       │            │ - Backup Files  │
│ - Configs     │            │ - Archives      │
│ - Logs        │            │                 │
└───────────────┘            └─────────────────┘
        ▲                             ▲
        │                             │
        └─────────────┬───────────────┘
                      │
              ┌───────────────┐
              │ Backup Agent  │
              │  (Scheduler)  │
              └───────────────┘
```

## Component Architecture

### 1. Authentication Component

**Responsibility**: Manage user authentication, authorization, and session management.

**Sub-components**:
- `auth-provider`: NextAuth.js configuration
- `auth-middleware`: Route protection
- `user-service`: User management operations
- `session-manager`: Session state management

**Key Features**:
- Email/password authentication
- OAuth providers (Google, GitHub) - optional
- Role-based access control (RBAC)
- Session management with JWT
- Password reset functionality

**Interfaces**:
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

interface AuthSession {
  user: User;
  accessToken: string;
  expiresAt: Date;
}
```

**Testing Requirements**:
- Unit tests for authentication logic
- Integration tests for login/logout flows
- Security tests for token validation
- E2E tests for user registration and login

---

### 2. S3 Adapter Component

**Responsibility**: Handle all interactions with Amazon S3 storage.

**Sub-components**:
- `s3-client`: AWS SDK wrapper
- `upload-manager`: Handle file uploads with retry logic
- `download-manager`: Handle file downloads
- `bucket-manager`: Bucket operations and validation
- `storage-calculator`: Calculate storage usage

**Key Features**:
- Multipart upload support
- Upload progress tracking
- Automatic retry on failure
- Bandwidth throttling
- Storage quota management
- Bucket lifecycle management

**Interfaces**:
```typescript
interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string; // For S3-compatible services
}

interface UploadOptions {
  path: string;
  localPath: string;
  metadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
}

interface S3Adapter {
  configure(config: S3Config): Promise<void>;
  uploadFile(options: UploadOptions): Promise<string>;
  downloadFile(key: string, destination: string): Promise<void>;
  listFiles(prefix: string): Promise<S3Object[]>;
  deleteFile(key: string): Promise<void>;
  getStorageUsage(): Promise<StorageStats>;
}
```

**Testing Requirements**:
- Unit tests with S3 mocks (using AWS SDK mock)
- Integration tests with LocalStack/MinIO
- Error handling tests (network failures, auth failures)
- Performance tests for large files
- Concurrent upload/download tests

---

### 3. Sync Configuration Component

**Responsibility**: Manage backup job configurations, scheduling, and execution.

**Sub-components**:
- `config-manager`: CRUD operations for backup configs
- `scheduler`: Job scheduling using node-cron
- `sync-engine`: Execute backup operations
- `file-scanner`: Scan and index files to backup
- `incremental-tracker`: Track file changes for incremental backups
- `exclusion-matcher`: Handle file/directory exclusions

**Key Features**:
- Multiple backup configurations per user
- Flexible scheduling (cron expressions)
- Incremental and full backup modes
- File/directory inclusion/exclusion patterns
- Compression options
- Encryption at rest
- Pre/post backup hooks

**Interfaces**:
```typescript
interface BackupConfig {
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

interface BackupSource {
  path: string;
  excludePatterns?: string[];
  includePatterns?: string[];
}

interface ScheduleConfig {
  cronExpression: string;
  timezone: string;
}

interface BackupOptions {
  type: 'full' | 'incremental';
  compression: boolean;
  compressionLevel?: number;
  encryption: boolean;
  retentionDays?: number;
  bandwidth?: number; // KB/s
}

interface SyncEngine {
  executeBackup(configId: string): Promise<BackupResult>;
  validateConfig(config: BackupConfig): Promise<ValidationResult>;
  estimateBackupSize(config: BackupConfig): Promise<number>;
}
```

**Testing Requirements**:
- Unit tests for configuration validation
- Integration tests for backup execution
- Tests for file scanning and filtering
- Incremental backup logic tests
- Scheduling tests (cron validation)
- Compression and encryption tests
- Concurrent backup tests

---

### 4. Monitoring and Reporting Component

**Responsibility**: Track backup operations, provide real-time monitoring, and generate reports.

**Sub-components**:
- `backup-logger`: Log backup operations
- `metrics-collector`: Collect performance metrics
- `alert-manager`: Generate alerts for failures
- `report-generator`: Generate backup reports
- `dashboard-service`: Aggregate data for dashboard
- `notification-service`: Send notifications (email, webhook)

**Key Features**:
- Real-time backup progress tracking
- Historical backup logs
- Success/failure statistics
- Storage usage analytics
- Backup duration tracking
- Email notifications
- Webhook integrations
- Exportable reports (PDF, CSV)

**Interfaces**:
```typescript
interface BackupLog {
  id: string;
  configId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  filesProcessed: number;
  filesSkipped: number;
  totalBytes: number;
  bytesTransferred: number;
  errors?: BackupError[];
  duration?: number; // milliseconds
}

interface BackupMetrics {
  totalBackups: number;
  successRate: number;
  averageDuration: number;
  totalStorageUsed: number;
  lastBackupDate?: Date;
  upcomingBackups: ScheduledBackup[];
}

interface Alert {
  id: string;
  type: 'failure' | 'warning' | 'info';
  configId: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface MonitoringService {
  logBackupStart(configId: string): Promise<string>;
  updateBackupProgress(logId: string, progress: BackupProgress): Promise<void>;
  logBackupComplete(logId: string, result: BackupResult): Promise<void>;
  getMetrics(userId: string, period: string): Promise<BackupMetrics>;
  generateReport(userId: string, options: ReportOptions): Promise<Report>;
}
```

**Testing Requirements**:
- Unit tests for log processing
- Integration tests for metrics aggregation
- Tests for alert triggering logic
- Report generation tests
- Notification delivery tests
- Performance tests for large datasets

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Backup Configs Table
```sql
CREATE TABLE backup_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  sources JSONB NOT NULL,
  destination JSONB NOT NULL,
  schedule JSONB NOT NULL,
  options JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Backup Logs Table
```sql
CREATE TABLE backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES backup_configs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  status VARCHAR(50) NOT NULL,
  files_processed INTEGER DEFAULT 0,
  files_skipped INTEGER DEFAULT 0,
  total_bytes BIGINT DEFAULT 0,
  bytes_transferred BIGINT DEFAULT 0,
  errors JSONB,
  duration INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Alerts Table
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  config_id UUID REFERENCES backup_configs(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN DEFAULT false,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

## Development Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Next.js project with TypeScript
- [ ] Configure Tailwind CSS
- [ ] Set up PostgreSQL and Prisma
- [ ] Implement basic project structure
- [ ] Set up testing framework (Jest, Playwright)
- [ ] Configure CI/CD pipeline

### Phase 2: Authentication (Week 3)
- [ ] Implement NextAuth.js configuration
- [ ] Create user registration and login pages
- [ ] Implement session management
- [ ] Add protected routes middleware
- [ ] Write authentication tests
- [ ] Create user profile management

### Phase 3: S3 Adapter (Week 4)
- [ ] Implement AWS SDK wrapper
- [ ] Create upload/download managers
- [ ] Add multipart upload support
- [ ] Implement progress tracking
- [ ] Add error handling and retry logic
- [ ] Write S3 adapter tests with mocks

### Phase 4: Sync Configuration (Weeks 5-6)
- [ ] Create backup configuration UI
- [ ] Implement configuration manager
- [ ] Build file scanner and indexer
- [ ] Implement sync engine
- [ ] Add incremental backup support
- [ ] Implement scheduler (node-cron)
- [ ] Create compression and encryption layers
- [ ] Write comprehensive sync tests

### Phase 5: Monitoring & Reporting (Week 7)
- [ ] Implement backup logging system
- [ ] Create metrics collector
- [ ] Build dashboard UI
- [ ] Implement alert system
- [ ] Add notification service (email)
- [ ] Create report generator
- [ ] Write monitoring tests

### Phase 6: Integration & Testing (Week 8)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Load testing
- [ ] Bug fixes and refinements
- [ ] Documentation

### Phase 7: Deployment (Week 9)
- [ ] Production environment setup (remote cloud account)
- [ ] Deploy application to cloud instance
- [ ] Configure Cloudflare tunnel for https://backapp.davidhsells.today
- [ ] Set up monitoring and logging
- [ ] Create user documentation
- [ ] Beta testing

## Testing Strategy

### Unit Testing
**Tools**: Jest, React Testing Library

**Coverage Targets**:
- Utilities and helpers: 100%
- Business logic: 95%
- Components: 85%
- API routes: 90%

**Key Areas**:
- Authentication logic
- S3 operations (with mocks)
- File scanning and filtering
- Configuration validation
- Metrics calculations
- Report generation

### Integration Testing
**Tools**: Jest, Supertest, LocalStack/MinIO

**Focus Areas**:
- API endpoint flows
- Database operations with Prisma
- S3 operations with local S3 (LocalStack)
- Authentication flows
- Backup execution pipeline

### E2E Testing
**Tools**: Playwright

**Scenarios**:
- User registration and login
- Creating a backup configuration
- Running a manual backup
- Viewing backup logs and reports
- Modifying configurations
- Alert notifications

### Performance Testing
**Tools**: k6, Lighthouse

**Metrics**:
- API response times
- Upload/download speeds
- Database query performance
- UI rendering performance
- Memory usage during backups

## Security Considerations

### Authentication & Authorization
- Secure password hashing (bcrypt/argon2)
- JWT token expiration and refresh
- CSRF protection
- Rate limiting on auth endpoints
- Role-based access control

### Data Protection
- Encryption at rest (S3)
- Encryption in transit (HTTPS/TLS)
- Secure credential storage (environment variables)
- AWS credentials encryption in database
- Input validation and sanitization

### Backup Security
- File integrity verification (checksums)
- Encrypted backups option
- Secure file paths (prevent directory traversal)
- Access logs and audit trails

## Configuration Management

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/backupdb

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# AWS (optional defaults)
AWS_REGION=us-east-1

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password

# App
NODE_ENV=development
```

## API Structure

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Get current session

### Backup Configuration Endpoints
- `GET /api/configs` - List user's backup configs
- `POST /api/configs` - Create new backup config
- `GET /api/configs/:id` - Get specific config
- `PUT /api/configs/:id` - Update config
- `DELETE /api/configs/:id` - Delete config
- `POST /api/configs/:id/validate` - Validate config

### Backup Operations Endpoints
- `POST /api/backups/execute/:configId` - Run backup manually
- `POST /api/backups/:id/cancel` - Cancel running backup
- `GET /api/backups/logs` - Get backup logs
- `GET /api/backups/:id` - Get specific backup details

### Monitoring Endpoints
- `GET /api/metrics` - Get user metrics
- `GET /api/alerts` - Get user alerts
- `PUT /api/alerts/:id/acknowledge` - Acknowledge alert
- `GET /api/reports` - Generate report
- `GET /api/storage/usage` - Get S3 storage usage

### S3 Endpoints
- `POST /api/s3/validate` - Validate S3 credentials
- `GET /api/s3/buckets` - List available buckets
- `POST /api/s3/test-connection` - Test S3 connection

## UI Pages Structure

```
/
├── (auth)
│   ├── login/
│   ├── register/
│   └── forgot-password/
├── (app)
│   ├── dashboard/              # Main dashboard
│   ├── configs/
│   │   ├── page.tsx           # List configs
│   │   ├── new/               # Create config
│   │   └── [id]/edit/         # Edit config
│   ├── backups/
│   │   ├── page.tsx           # Backup history
│   │   └── [id]/              # Backup details
│   ├── reports/               # Reports and analytics
│   ├── settings/
│   │   ├── profile/
│   │   ├── s3/                # S3 settings
│   │   └── notifications/
│   └── alerts/                # Alerts page
```

## Success Criteria

### Functional Requirements
- ✅ Users can register and login securely
- ✅ Users can configure multiple backup jobs
- ✅ System successfully backs up files to S3
- ✅ Scheduled backups execute automatically
- ✅ Users can monitor backup progress in real-time
- ✅ System generates alerts on failures
- ✅ Users can view reports and analytics

### Non-Functional Requirements
- ✅ System handles files up to 5TB per backup
- ✅ UI loads within 2 seconds
- ✅ API endpoints respond within 500ms (95th percentile)
- ✅ 99% uptime for scheduled backups
- ✅ Test coverage above 85%
- ✅ Security audit passed
- ✅ WCAG 2.1 Level AA compliance

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Large file upload failures | High | Medium | Implement multipart upload with retry logic |
| Database performance issues | High | Medium | Add indexes, implement pagination, use caching |
| S3 credential exposure | Critical | Low | Encrypt credentials, use environment variables |
| Backup scheduling failures | High | Medium | Implement health checks, monitoring, and alerts |
| Concurrent backup conflicts | Medium | Medium | Implement job queue and locking mechanism |
| Cross-platform compatibility | Medium | Medium | Test on all target platforms, abstract OS-specific code |

## Next Steps

1. Review and approve this architecture plan
2. Set up development environment
3. Initialize Next.js project with proper structure
4. Begin Phase 1 implementation
5. Set up project management (GitHub Issues/Projects)
6. Schedule regular architecture review meetings

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
