# Backup System Application

A comprehensive, user-friendly web application for managing backups to Amazon S3 or S3-compatible storage for Ubuntu, Linux, and macOS systems.

## Overview

This application provides an intuitive interface to configure, schedule, monitor, and manage file backups to cloud storage. Built with Next.js and featuring a modern tech stack, it offers enterprise-grade backup capabilities with a focus on reliability, security, and ease of use.

## Key Features

- **Multi-platform Support**: Ubuntu, Linux, and macOS compatibility
- **Flexible Configuration**: Configure multiple backup jobs with custom schedules
- **S3 Integration**: Native support for Amazon S3 and S3-compatible storage
- **Incremental Backups**: Smart incremental backups to minimize storage costs
- **Real-time Monitoring**: Track backup progress and view detailed logs
- **Automated Scheduling**: Set up recurring backups with cron expressions
- **Compression & Encryption**: Built-in compression and encryption options
- **Reporting & Analytics**: Comprehensive backup reports and usage statistics
- **Alert System**: Get notified of backup failures or issues
- **User Management**: Secure authentication with role-based access control

## Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js Server Components & API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js (Auth.js v5)
- **Storage**: AWS S3 SDK v3
- **Testing**: Jest, React Testing Library, Playwright
- **Deployment**: Remote cloud with Cloudflare tunnel

## Project Status

This project is currently in the **planning phase**. The architecture and components have been designed, and implementation is ready to begin.

## Documentation

- [Architecture Plan](./ARCHITECTURE_PLAN.md) - Comprehensive system architecture and component design
- [Testing Strategy](./TESTING_STRATEGY.md) - Detailed testing approach for all components
- [Project Structure](./PROJECT_STRUCTURE.md) - Directory layout and setup instructions
- [Deployment Guide](./DEPLOYMENT.md) - Docker Compose and production deployment instructions

## Quick Start

### Option 1: Docker Compose (Recommended)

The fastest way to get started with Docker Compose:

```bash
# Clone the repository
git clone <repository-url>
cd backapp

# Copy environment file
cp .env.example .env
# Edit .env with your configuration (especially NEXTAUTH_SECRET and AWS credentials)

# Development mode (with hot reloading)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Production mode
docker-compose up -d
```

Visit `http://localhost:3000` to access the application.

**Additional services available in development:**
- **PostgreSQL**: `localhost:5432`
- **PgAdmin**: `http://localhost:5050` (admin@backapp.local / admin)
- **LocalStack (S3)**: `http://localhost:4566`
- **MailHog (Email testing)**: `http://localhost:8025`

**Common Docker commands:**
```bash
# View logs
docker-compose logs -f app

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up -d --build

# Run database migrations
docker-compose exec app npx prisma migrate deploy

# Access database shell
docker-compose exec db psql -U backapp -d backapp
```

### Option 2: Local Development (Coming Soon)

Once implementation begins, local development will include:

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your configuration

# Set up database
npm run db:setup

# Start development server
npm run dev
```

Visit `http://localhost:3000` to access the application.

## Development Roadmap

### Phase 1: Foundation (Weeks 1-2)
- Project setup with Next.js and TypeScript
- Database schema and Prisma setup
- Testing framework configuration
- CI/CD pipeline setup

### Phase 2: Authentication (Week 3)
- User registration and login
- Session management
- Protected routes

### Phase 3: S3 Adapter (Week 4)
- AWS SDK integration
- Upload/download managers
- Progress tracking and error handling

### Phase 4: Sync Configuration (Weeks 5-6)
- Backup configuration UI
- File scanning and filtering
- Sync engine implementation
- Scheduling system

### Phase 5: Monitoring & Reporting (Week 7)
- Backup logging system
- Dashboard with metrics
- Alert system
- Report generation

### Phase 6: Integration & Testing (Week 8)
- End-to-end testing
- Performance optimization
- Security audit

### Phase 7: Deployment (Week 9)
- Production deployment
- Documentation
- Beta testing

## Core Components

### 1. Authentication Component
Handles user authentication, authorization, and session management using NextAuth.js.

**Features**:
- Email/password authentication
- OAuth providers support
- Role-based access control
- Session management with JWT

### 2. S3 Adapter Component
Manages all interactions with Amazon S3 storage.

**Features**:
- Multipart upload support
- Progress tracking
- Automatic retry logic
- Bandwidth throttling
- Storage quota management

### 3. Sync Configuration Component
Manages backup job configurations and execution.

**Features**:
- Multiple backup configurations
- Flexible scheduling (cron)
- Incremental and full backup modes
- File/directory exclusion patterns
- Compression and encryption
- Pre/post backup hooks

### 4. Monitoring and Reporting Component
Tracks backup operations and provides insights.

**Features**:
- Real-time progress tracking
- Historical backup logs
- Success/failure statistics
- Storage usage analytics
- Email notifications
- Exportable reports (PDF, CSV)

## System Requirements

### Development
- Node.js 20+
- PostgreSQL 15+
- npm or yarn
- Git

### Production
- All development requirements
- AWS account (or S3-compatible storage)
- SMTP server (for notifications)
- 2GB+ RAM
- 20GB+ storage

## API Overview

The application provides a RESTful API for all operations:

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Backup Configurations
- `GET /api/configs` - List configurations
- `POST /api/configs` - Create configuration
- `PUT /api/configs/:id` - Update configuration
- `DELETE /api/configs/:id` - Delete configuration

### Backup Operations
- `POST /api/backups/execute/:configId` - Execute backup
- `GET /api/backups/logs` - Get backup logs
- `POST /api/backups/:id/cancel` - Cancel backup

### Monitoring
- `GET /api/metrics` - Get metrics
- `GET /api/alerts` - Get alerts
- `GET /api/reports` - Generate report

## Security

Security is a top priority for this backup system:

- **Authentication**: Secure password hashing with bcrypt
- **Authorization**: Role-based access control (RBAC)
- **Data Protection**: Encryption at rest and in transit
- **Input Validation**: Comprehensive validation with Zod
- **CSRF Protection**: Built-in Next.js CSRF protection
- **Rate Limiting**: API rate limiting on sensitive endpoints
- **Audit Logs**: Complete audit trail of all operations
- **Secure Credentials**: Environment-based credential management

## Testing

Comprehensive testing strategy covering:

- **Unit Tests**: 70% of test suite
- **Integration Tests**: 20% of test suite
- **E2E Tests**: 10% of test suite

**Coverage Goals**:
- Overall: 85%+
- Authentication: 95%+
- S3 Adapter: 90%+
- Sync Engine: 90%+
- Monitoring: 85%+

**Testing Tools**:
- Jest for unit and integration tests
- React Testing Library for component tests
- Playwright for E2E tests
- k6 for performance testing

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Write tests for your changes
4. Implement your feature
5. Ensure all tests pass: `npm run test`
6. Commit your changes: `git commit -m 'feat: add your feature'`
7. Push to the branch: `git push origin feature/your-feature`
8. Open a pull request

### Code Style

- Follow the existing code style
- Use TypeScript for type safety
- Write meaningful commit messages (Conventional Commits)
- Add tests for new features
- Update documentation as needed

## License

[MIT License](LICENSE)

## Support

For questions, issues, or feature requests, please open an issue on GitHub.

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - The React framework
- [NextAuth.js](https://next-auth.js.org/) - Authentication
- [Prisma](https://www.prisma.io/) - Database ORM
- [AWS SDK](https://aws.amazon.com/sdk-for-javascript/) - S3 integration
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

**Note**: This project is currently in the planning phase. The architecture has been designed and documented. Implementation will begin soon following the roadmap outlined above.

For detailed technical information, please refer to:
- [Architecture Plan](./ARCHITECTURE_PLAN.md)
- [Testing Strategy](./TESTING_STRATEGY.md)
- [Project Structure](./PROJECT_STRUCTURE.md)
