# Backup System - Project Structure

## Directory Layout

```
backapp/
├── .github/
│   └── workflows/
│       ├── test.yml                    # CI/CD testing workflow
│       ├── deploy.yml                  # Deployment workflow
│       └── security.yml                # Security scanning
├── prisma/
│   ├── schema.prisma                   # Database schema
│   ├── migrations/                     # Database migrations
│   └── seed.ts                         # Database seeding
├── public/
│   ├── images/
│   └── favicon.ico
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── (auth)/                     # Auth group routes
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── forgot-password/
│   │   │       └── page.tsx
│   │   ├── (app)/                      # Protected app routes
│   │   │   ├── layout.tsx              # App layout with sidebar
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── configs/
│   │   │   │   ├── page.tsx            # List configs
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx        # Create config
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx        # View config
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx    # Edit config
│   │   │   ├── backups/
│   │   │   │   ├── page.tsx            # Backup history
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx        # Backup details
│   │   │   ├── reports/
│   │   │   │   └── page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── profile/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── s3/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── notifications/
│   │   │   │       └── page.tsx
│   │   │   └── alerts/
│   │   │       └── page.tsx
│   │   ├── api/                        # API routes
│   │   │   ├── auth/
│   │   │   │   ├── register/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── login/
│   │   │   │   │   └── route.ts
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts
│   │   │   ├── configs/
│   │   │   │   ├── route.ts            # GET, POST
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts        # GET, PUT, DELETE
│   │   │   │       └── validate/
│   │   │   │           └── route.ts
│   │   │   ├── backups/
│   │   │   │   ├── execute/
│   │   │   │   │   └── [configId]/
│   │   │   │   │       └── route.ts
│   │   │   │   ├── logs/
│   │   │   │   │   └── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       └── cancel/
│   │   │   │           └── route.ts
│   │   │   ├── metrics/
│   │   │   │   └── route.ts
│   │   │   ├── alerts/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── acknowledge/
│   │   │   │           └── route.ts
│   │   │   ├── reports/
│   │   │   │   └── route.ts
│   │   │   └── s3/
│   │   │       ├── validate/
│   │   │       │   └── route.ts
│   │   │       ├── buckets/
│   │   │       │   └── route.ts
│   │   │       └── test-connection/
│   │   │           └── route.ts
│   │   ├── layout.tsx                  # Root layout
│   │   ├── page.tsx                    # Landing page
│   │   └── globals.css                 # Global styles
│   ├── components/                     # React components
│   │   ├── ui/                         # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── toast.tsx
│   │   │   └── ...
│   │   ├── auth/
│   │   │   ├── login-form.tsx
│   │   │   ├── register-form.tsx
│   │   │   └── auth-provider.tsx
│   │   ├── configs/
│   │   │   ├── config-form.tsx
│   │   │   ├── config-list.tsx
│   │   │   ├── config-card.tsx
│   │   │   └── source-selector.tsx
│   │   ├── backups/
│   │   │   ├── backup-progress.tsx
│   │   │   ├── backup-log-viewer.tsx
│   │   │   └── backup-history.tsx
│   │   ├── dashboard/
│   │   │   ├── stats-card.tsx
│   │   │   ├── recent-backups.tsx
│   │   │   └── storage-chart.tsx
│   │   ├── reports/
│   │   │   ├── report-viewer.tsx
│   │   │   └── chart-components.tsx
│   │   └── layout/
│   │       ├── sidebar.tsx
│   │       ├── header.tsx
│   │       └── footer.tsx
│   ├── lib/                            # Core library code
│   │   ├── auth/
│   │   │   ├── auth.config.ts          # NextAuth configuration
│   │   │   ├── auth-service.ts         # Auth business logic
│   │   │   ├── middleware.ts           # Auth middleware
│   │   │   └── __tests__/
│   │   │       ├── auth-service.test.ts
│   │   │       └── auth.integration.test.ts
│   │   ├── s3/
│   │   │   ├── s3-adapter.ts           # Main S3 adapter
│   │   │   ├── s3-client.ts            # AWS SDK wrapper
│   │   │   ├── upload-manager.ts       # Upload logic
│   │   │   ├── download-manager.ts     # Download logic
│   │   │   ├── storage-calculator.ts   # Storage utils
│   │   │   └── __tests__/
│   │   │       ├── s3-adapter.test.ts
│   │   │       └── s3-adapter.integration.test.ts
│   │   ├── sync/
│   │   │   ├── sync-engine.ts          # Main sync engine
│   │   │   ├── config-manager.ts       # Config CRUD
│   │   │   ├── file-scanner.ts         # File scanning
│   │   │   ├── scheduler.ts            # Job scheduling
│   │   │   ├── incremental-tracker.ts  # Track changes
│   │   │   ├── compression.ts          # Compression logic
│   │   │   ├── encryption.ts           # Encryption logic
│   │   │   └── __tests__/
│   │   │       ├── sync-engine.test.ts
│   │   │       └── sync-engine.integration.test.ts
│   │   ├── monitoring/
│   │   │   ├── backup-logger.ts        # Logging service
│   │   │   ├── metrics-collector.ts    # Metrics calculation
│   │   │   ├── alert-manager.ts        # Alert logic
│   │   │   ├── report-generator.ts     # Report generation
│   │   │   ├── notification-service.ts # Notifications
│   │   │   └── __tests__/
│   │   │       ├── metrics-collector.test.ts
│   │   │       └── monitoring.integration.test.ts
│   │   ├── db/
│   │   │   ├── client.ts               # Prisma client
│   │   │   └── repositories/           # Data access layer
│   │   │       ├── user-repository.ts
│   │   │       ├── config-repository.ts
│   │   │       ├── log-repository.ts
│   │   │       └── alert-repository.ts
│   │   ├── utils/
│   │   │   ├── validation.ts           # Validation helpers
│   │   │   ├── formatting.ts           # Formatting utils
│   │   │   ├── file-system.ts          # FS helpers
│   │   │   └── crypto.ts               # Crypto utils
│   │   └── types/
│   │       ├── auth.types.ts
│   │       ├── backup.types.ts
│   │       ├── s3.types.ts
│   │       └── monitoring.types.ts
│   ├── hooks/                          # Custom React hooks
│   │   ├── use-auth.ts
│   │   ├── use-backups.ts
│   │   ├── use-configs.ts
│   │   └── use-metrics.ts
│   └── middleware.ts                   # Next.js middleware
├── tests/
│   ├── setup.ts                        # Test setup
│   ├── fixtures/                       # Test data
│   │   ├── users.ts
│   │   ├── configs.ts
│   │   └── logs.ts
│   └── helpers/                        # Test helpers
│       ├── db-helpers.ts
│       ├── auth-helpers.ts
│       └── s3-helpers.ts
├── e2e/                                # E2E tests
│   ├── auth.spec.ts
│   ├── backup-config.spec.ts
│   ├── backup-execution.spec.ts
│   └── dashboard.spec.ts
├── k6/                                 # Performance tests
│   ├── load-test.js
│   └── stress-test.js
├── scripts/
│   ├── setup-dev.sh                    # Dev environment setup
│   └── generate-test-data.ts          # Test data generation
├── docs/
│   ├── api.md                          # API documentation
│   ├── deployment.md                   # Deployment guide
│   └── user-guide.md                   # User documentation
├── .env.example                        # Environment template
├── .env.local                          # Local environment (gitignored)
├── .env.test                           # Test environment
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── jest.config.js
├── playwright.config.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── package-lock.json
├── README.md
├── ARCHITECTURE_PLAN.md               # This planning document
├── TESTING_STRATEGY.md                # Testing documentation
└── PROJECT_STRUCTURE.md               # This file
```

## Initial Setup

### Prerequisites

- Node.js 20+ and npm
- PostgreSQL 15+
- AWS account (or S3-compatible storage)
- Git

### Installation Steps

```bash
# 1. Clone repository
git clone <repository-url>
cd backapp

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# 4. Set up database
npm run db:setup

# 5. Run migrations
npm run db:migrate

# 6. Seed database (optional)
npm run db:seed

# 7. Start development server
npm run dev

# 8. In another terminal, start the backup scheduler
npm run scheduler
```

## Package Dependencies

### Core Dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "next-auth": "^5.0.0-beta.19",
    "@prisma/client": "^5.15.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "@aws-sdk/lib-storage": "^3.600.0",
    "bcrypt": "^5.1.1",
    "zod": "^3.23.8",
    "react-hook-form": "@hookform/resolvers": "^3.6.0",
    "node-cron": "^3.0.3",
    "winston": "^3.13.0",
    "archiver": "^7.0.1",
    "tar": "^7.2.0",
    "crypto-js": "^4.2.0",
    "date-fns": "^3.6.0",
    "recharts": "^2.12.7",
    "tailwindcss": "^3.4.4",
    "clsx": "^2.1.1",
    "lucide-react": "^0.396.0"
  }
}
```

### Development Dependencies

```json
{
  "devDependencies": {
    "@types/node": "^20.14.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/bcrypt": "^5.0.2",
    "@types/node-cron": "^3.0.11",
    "typescript": "^5.5.2",
    "eslint": "^8.57.0",
    "eslint-config-next": "^14.2.0",
    "prettier": "^3.3.2",
    "prisma": "^5.15.0",
    "jest": "^29.7.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/user-event": "^14.5.2",
    "jest-environment-jsdom": "^29.7.0",
    "@playwright/test": "^1.45.0",
    "supertest": "^7.0.0",
    "msw": "^2.3.1",
    "localstack": "^0.2.0",
    "ts-node": "^10.9.2",
    "tsx": "^4.15.7"
  }
}
```

## NPM Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit",

    "db:setup": "prisma generate && prisma migrate dev",
    "db:migrate": "prisma migrate deploy",
    "db:migrate:dev": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:reset": "prisma migrate reset",

    "scheduler": "tsx src/lib/sync/scheduler-runner.ts",

    "test": "jest",
    "test:unit": "jest --testPathPattern='.test.ts'",
    "test:integration": "jest --testPathPattern='.integration.test.ts'",
    "test:e2e": "playwright test",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:security": "npm audit && snyk test",
    "test:performance": "k6 run k6/load-test.js",

    "prepare": "husky install",
    "precommit": "lint-staged"
  }
}
```

## Environment Configuration

### Development (.env.local)

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/backupdb"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret-here"

# AWS S3 (Optional for testing)
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"

# Email (Optional for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="noreply@backupapp.com"

# App Configuration
NODE_ENV="development"
LOG_LEVEL="debug"
MAX_UPLOAD_SIZE="5368709120" # 5GB in bytes
```

### Test (.env.test)

```bash
# Test Database
DATABASE_URL="postgresql://test:test@localhost:5433/backupdb_test"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="test-secret"

# LocalStack S3
AWS_ENDPOINT="http://localhost:4566"
AWS_ACCESS_KEY_ID="test"
AWS_SECRET_ACCESS_KEY="test"
AWS_REGION="us-east-1"

# Email (Mock)
SMTP_HOST="localhost"
SMTP_PORT="1025" # MailHog

# App Configuration
NODE_ENV="test"
LOG_LEVEL="error"
```

### Production (.env.production)

```bash
# Database (use connection pooling)
DATABASE_URL="postgresql://prod_user:strong_password@db.example.com:5432/backupdb?schema=public&pgbouncer=true"

# NextAuth
NEXTAUTH_URL="https://backapp.davidhsells.today"
NEXTAUTH_SECRET="production-secret-very-long-and-random"

# AWS S3
AWS_ACCESS_KEY_ID="prod-access-key"
AWS_SECRET_ACCESS_KEY="prod-secret-key"
AWS_REGION="us-east-1"

# Email
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASS="your-sendgrid-api-key"
SMTP_FROM="noreply@yourdomain.com"

# App Configuration
NODE_ENV="production"
LOG_LEVEL="warn"
MAX_UPLOAD_SIZE="5368709120"

# Monitoring
SENTRY_DSN="your-sentry-dsn"
```

## Database Setup

### Prisma Schema Overview

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(uuid())
  email         String         @unique
  name          String
  passwordHash  String
  role          String         @default("user")
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  configs       BackupConfig[]
  logs          BackupLog[]
  alerts        Alert[]
}

model BackupConfig {
  id            String         @id @default(uuid())
  userId        String
  name          String
  enabled       Boolean        @default(true)
  sources       Json
  destination   Json
  schedule      Json
  options       Json
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  logs          BackupLog[]
  alerts        Alert[]

  @@index([userId])
}

model BackupLog {
  id                String         @id @default(uuid())
  configId          String
  userId            String
  startTime         DateTime
  endTime           DateTime?
  status            String
  filesProcessed    Int            @default(0)
  filesSkipped      Int            @default(0)
  totalBytes        BigInt         @default(0)
  bytesTransferred  BigInt         @default(0)
  errors            Json?
  duration          Int?
  createdAt         DateTime       @default(now())

  config            BackupConfig   @relation(fields: [configId], references: [id], onDelete: Cascade)
  user              User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([configId])
  @@index([startTime])
}

model Alert {
  id            String         @id @default(uuid())
  userId        String
  configId      String
  type          String
  message       String
  acknowledged  Boolean        @default(false)
  timestamp     DateTime       @default(now())

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  config        BackupConfig   @relation(fields: [configId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([configId])
}
```

## Git Workflow

### Branch Strategy

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: Feature branches
- `bugfix/*`: Bug fix branches
- `hotfix/*`: Production hotfixes

### Commit Convention

Follow Conventional Commits:

```
feat: Add user registration functionality
fix: Resolve S3 upload timeout issue
docs: Update API documentation
test: Add integration tests for sync engine
refactor: Simplify backup configuration logic
chore: Update dependencies
```

## Code Quality Tools

### ESLint Configuration

```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { "allow": ["warn", "error"] }]
  }
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "arrowParens": "avoid"
}
```

### Husky Pre-commit Hooks

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run lint
npm run type-check
npm run test:unit
```

## Development Workflow

### Daily Development

1. Pull latest changes from `develop`
2. Create feature branch: `git checkout -b feature/your-feature`
3. Develop with TDD approach:
   - Write failing test
   - Implement feature
   - Verify test passes
   - Refactor if needed
4. Commit changes following conventions
5. Push branch and create PR
6. Wait for CI/CD to pass
7. Request code review
8. Merge after approval

### Local Testing

```bash
# Start all services
docker-compose up -d  # PostgreSQL, LocalStack

# Run application
npm run dev

# In another terminal, run tests
npm run test:watch

# Run full test suite before commit
npm run test:coverage
```

## Deployment

### Cloud Deployment with Cloudflare Tunnel

The application will be deployed to a remote cloud account and made accessible through a Cloudflare tunnel.

**Access URL**: https://backapp.davidhsells.today

**Deployment Steps**:

1. **Prepare Cloud Instance**
   - Set up remote cloud server (Ubuntu/Linux)
   - Install Node.js 20+ and PostgreSQL 15+
   - Configure firewall rules (only local access needed)

2. **Deploy Application**
   - Clone repository to cloud instance
   - Install dependencies: `npm ci`
   - Configure environment variables
   - Build application: `npm run build`
   - Set up systemd service for application
   - Start application: `npm run start`

3. **Configure Cloudflare Tunnel**
   - Install cloudflared on cloud instance
   - Create tunnel: `cloudflared tunnel create backapp`
   - Configure tunnel routing to local application port (3000)
   - Route subdomain: backapp.davidhsells.today
   - Start tunnel service

4. **Database Setup**
   - Configure PostgreSQL for production use
   - Run migrations: `npm run db:migrate`
   - Set up automated backups for database

5. **Monitoring**
   - Configure application logging
   - Set up health checks
   - Monitor tunnel status

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

### Monitoring Setup

- **Application Monitoring**: Sentry
- **Infrastructure Monitoring**: Datadog/New Relic
- **Logging**: Winston + CloudWatch/Papertrail
- **Uptime Monitoring**: UptimeRobot
- **Analytics**: Google Analytics/Plausible

---

This structure provides a solid foundation for building a scalable, maintainable backup system application with comprehensive testing and monitoring capabilities.
