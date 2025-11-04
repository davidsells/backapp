# Deployment Guide

This guide covers deployment options for the BackApp backup system application.

## Table of Contents

- [Docker Compose Deployment](#docker-compose-deployment)
- [Production Deployment](#production-deployment)
- [Environment Configuration](#environment-configuration)
- [Database Management](#database-management)
- [Monitoring and Logging](#monitoring-and-logging)
- [Troubleshooting](#troubleshooting)

---

## Docker Compose Deployment

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available
- 20GB+ storage space

### Quick Start

1. **Clone the repository and navigate to the project directory:**

```bash
git clone <repository-url>
cd backapp
```

2. **Set up environment variables:**

```bash
cp .env.example .env
```

Edit `.env` and configure the following required variables:
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `AWS_ACCESS_KEY_ID` - Your AWS access key
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key
- `AWS_S3_BUCKET` - Your S3 bucket name
- `POSTGRES_PASSWORD` - Database password

3. **Start the application:**

**Development mode (with hot reloading):**
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

**Production mode:**
```bash
docker-compose up -d
```

4. **Verify the deployment:**

```bash
# Check all services are running
docker-compose ps

# View application logs
docker-compose logs -f app
```

5. **Access the application:**

- **Application**: http://localhost:3000
- **PgAdmin** (dev only): http://localhost:5050
- **MailHog** (dev only): http://localhost:8025
- **LocalStack S3** (dev only): http://localhost:4566

### Services Overview

| Service | Description | Port | Volume |
|---------|-------------|------|--------|
| **app** | Next.js application | 3000 | logs |
| **db** | PostgreSQL 15 | 5432 | postgres_data |
| **localstack** | S3 mock (dev) | 4566 | localstack_data |
| **mailhog** | Email testing (dev) | 1025, 8025 | - |
| **pgadmin** | DB admin (dev) | 5050 | pgadmin_data |

### Common Operations

#### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f db

# Last 100 lines
docker-compose logs --tail=100 app
```

#### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

#### Rebuilding

```bash
# Rebuild all services
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build app
```

#### Scaling (if needed)

```bash
# Scale the app service to 3 instances
docker-compose up -d --scale app=3
```

---

## Production Deployment

### Best Practices

1. **Environment Variables**
   - Never commit `.env` files to version control
   - Use strong, unique passwords for all services
   - Rotate secrets regularly

2. **Security Hardening**
   ```bash
   # Use specific versions instead of 'latest'
   # Remove development services (pgadmin, mailhog, localstack)
   # Enable SSL/TLS for all connections
   ```

3. **Resource Limits**

   Add resource limits to `docker-compose.yml`:

   ```yaml
   services:
     app:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
           reservations:
             cpus: '1'
             memory: 1G
   ```

4. **Reverse Proxy Setup**

   Use nginx or Traefik as a reverse proxy:

   ```nginx
   server {
       listen 80;
       server_name backup.example.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **SSL/TLS Certificate**

   ```bash
   # Using Let's Encrypt with Certbot
   sudo certbot --nginx -d backup.example.com
   ```

### Production Checklist

- [ ] All environment variables configured
- [ ] Strong passwords set for all services
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Database backups automated
- [ ] Log rotation configured
- [ ] Monitoring and alerts set up
- [ ] Resource limits defined
- [ ] Regular update schedule established

---

## Environment Configuration

### Required Variables

```bash
# Application
NODE_ENV=production
APP_PORT=3000

# Database
POSTGRES_DB=backapp
POSTGRES_USER=backapp
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgresql://backapp:<password>@db:5432/backapp

# Authentication
NEXTAUTH_URL=https://backup.example.com
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# AWS S3
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=us-east-1
AWS_S3_BUCKET=<your-bucket-name>

# Email (Production SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your-email>
SMTP_PASSWORD=<your-password>
SMTP_FROM=noreply@example.com
SMTP_SECURE=true
```

### Optional Variables

```bash
# Backup Configuration
MAX_CONCURRENT_BACKUPS=5
BACKUP_RETRY_ATTEMPTS=3
BACKUP_TIMEOUT_MINUTES=60

# Logging
LOG_LEVEL=info

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

### Generating Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate random password
openssl rand -base64 24
```

---

## Database Management

### Running Migrations

```bash
# Apply pending migrations
docker-compose exec app npx prisma migrate deploy

# Create a new migration (development)
docker-compose exec app npx prisma migrate dev --name migration_name
```

### Backup Database

```bash
# Backup PostgreSQL database
docker-compose exec db pg_dump -U backapp backapp > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker-compose exec -T db psql -U backapp backapp < backup_20250101_120000.sql
```

### Access Database Shell

```bash
# PostgreSQL CLI
docker-compose exec db psql -U backapp -d backapp

# Via PgAdmin (development)
# Open http://localhost:5050
# Login: admin@backapp.local / admin
```

### Database Utilities

```bash
# Reset database (WARNING: deletes all data)
docker-compose exec app npx prisma migrate reset

# View database status
docker-compose exec app npx prisma migrate status

# Generate Prisma Client
docker-compose exec app npx prisma generate
```

---

## Monitoring and Logging

### Application Logs

Logs are stored in the `./logs` directory on the host:

```bash
# View live logs
tail -f logs/app.log

# Search logs
grep "ERROR" logs/app.log
```

### Container Health Checks

```bash
# Check health status
docker-compose ps

# Inspect specific container
docker inspect backapp-app
```

### Log Rotation

Create `/etc/logrotate.d/backapp`:

```
/home/user/backapp/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 1001 1001
    sharedscripts
}
```

### Monitoring Tools

Consider integrating:
- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **Loki** - Log aggregation
- **Uptime Kuma** - Uptime monitoring

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs for errors
docker-compose logs app

# Check service status
docker-compose ps

# Verify environment variables
docker-compose config
```

### Database Connection Issues

```bash
# Test database connectivity
docker-compose exec app npx prisma db push

# Check database logs
docker-compose logs db

# Verify DATABASE_URL format
echo $DATABASE_URL
```

### Port Already in Use

```bash
# Find process using port 3000
sudo lsof -i :3000

# Kill the process
sudo kill -9 <PID>

# Or change APP_PORT in .env
```

### Out of Memory

```bash
# Check container memory usage
docker stats

# Increase Docker memory limit
# Docker Desktop: Settings > Resources > Memory

# Add resource limits to docker-compose.yml
```

### Image Build Fails

```bash
# Clear build cache
docker-compose build --no-cache

# Prune old images
docker image prune -a

# Check Dockerfile syntax
docker-compose config
```

### Application Crashes

```bash
# Check application logs
docker-compose logs -f app

# Restart specific service
docker-compose restart app

# Check health status
docker-compose ps
```

---

## Updating the Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose up -d --build

# Run migrations
docker-compose exec app npx prisma migrate deploy
```

---

## Backup and Disaster Recovery

### Backup Strategy

1. **Database backups** - Daily automated backups
2. **Volume backups** - Weekly volume snapshots
3. **Configuration backups** - Version control for docker-compose.yml and .env

### Automated Backup Script

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/backapp"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
docker-compose exec -T db pg_dump -U backapp backapp > $BACKUP_DIR/db_$DATE.sql

# Backup volumes
docker run --rm -v backapp_postgres_data:/data -v $BACKUP_DIR:/backup alpine tar czf /backup/postgres_$DATE.tar.gz -C /data .

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

---

## Support

For issues or questions:
- Check the [main README](./README.md)
- Review [Architecture Plan](./ARCHITECTURE_PLAN.md)
- Open an issue on GitHub
