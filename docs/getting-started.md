# Getting Started with BackApp

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn
- Docker and Docker Compose (optional, for containerized development)

## Installation

### Option 1: Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` and configure:
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
   - AWS S3 credentials (if using real S3)

3. **Set up the database:**
   ```bash
   npm run db:generate
   npm run db:migrate:dev
   npm run db:seed
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Option 2: Docker Compose

See [DEPLOYMENT.md](../DEPLOYMENT.md) for detailed Docker Compose instructions.

Quick start:
```bash
cp .env.example .env
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

## Development Workflow

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Code Quality

```bash
# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check

# Type check
npm run type-check
```

### Database Management

```bash
# Open Prisma Studio
npm run db:studio

# Create a new migration
npm run db:migrate:dev --name migration_name

# Reset database
npm run db:reset

# Seed database
npm run db:seed
```

## Project Structure

```
src/
├── app/              # Next.js App Router pages and API routes
├── components/       # React components
├── lib/             # Business logic and utilities
│   ├── auth/        # Authentication
│   ├── s3/          # S3 adapter
│   ├── sync/        # Backup engine
│   ├── monitoring/  # Metrics and logging
│   ├── db/          # Database client and repositories
│   ├── utils/       # Utilities
│   └── types/       # TypeScript types
└── hooks/           # Custom React hooks
```

## Next Steps

1. Review the [Architecture Plan](../ARCHITECTURE_PLAN.md)
2. Check the [Testing Strategy](../TESTING_STRATEGY.md)
3. Read the [API Documentation](./api.md)
4. Start implementing Phase 2: Authentication

## Troubleshooting

### Database Connection Issues

If you encounter database connection errors:

1. Ensure PostgreSQL is running
2. Check your `DATABASE_URL` in `.env.local`
3. Verify database user has proper permissions
4. Try connecting directly: `psql $DATABASE_URL`

### Port Already in Use

If port 3000 is already in use:

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### TypeScript Errors

```bash
# Regenerate Prisma types
npm run db:generate

# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)
