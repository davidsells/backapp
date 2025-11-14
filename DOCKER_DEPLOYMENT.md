# BackApp - Production Docker Deployment Guide

**Target**: https://backapp.davidhsells.today
**Method**: Docker Compose + Cloudflare Tunnel
**Time Required**: 45-60 minutes

---

## Overview

BackApp is designed for Docker deployment. This guide covers deploying to production using:
- **Docker Compose** for container orchestration
- **PostgreSQL container** for database
- **Cloudflare Tunnel** for HTTPS access (no port exposure needed)
- **AWS S3** for backup storage

---

## Prerequisites

### On Your Server
- [x] Docker Engine 20.10+ installed
- [x] Docker Compose 2.0+ installed
- [x] 2GB+ RAM available
- [x] 20GB+ storage space
- [x] SSH access to server

### External Services
- [x] Cloudflare account with domain: davidhsells.today
- [x] AWS S3 bucket created
- [x] AWS IAM user credentials (S3 access)
- [x] SMTP credentials (for email alerts)

---

## Step 1: Server Setup (10 minutes)

### Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version
```

---

## Step 2: Clone and Configure (10 minutes)

### Clone Repository

```bash
cd ~
git clone https://github.com/davidsells/backapp.git
cd backapp
git checkout claude/fix-testing-phase-62-017CC8or848BkScyKbUTxqEX
```

### Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment file
nano .env
```

**Required Configuration:**

```bash
# ============================================
# Database
# ============================================
POSTGRES_DB=backapp
POSTGRES_USER=backapp
POSTGRES_PASSWORD=CHANGE_TO_STRONG_PASSWORD

# ============================================
# Application
# ============================================
NODE_ENV=production
NEXTAUTH_URL=https://backapp.davidhsells.today
NEXTAUTH_SECRET=GENERATE_WITH_OPENSSL_RAND_BASE64_32

# ============================================
# AWS S3
# ============================================
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-backup-bucket-name

# ============================================
# Email (SMTP)
# ============================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=BackApp <noreply@davidhsells.today>

# ============================================
# Application Port
# ============================================
APP_PORT=3000
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

---

## Step 3: Build and Start Application (10 minutes)

### Build Docker Images

```bash
# Build the application image
docker-compose build

# This will:
# - Install dependencies
# - Generate Prisma client
# - Build Next.js application
# - Create optimized production image
```

### Start Services

```bash
# Start all containers in detached mode
docker-compose up -d

# This starts:
# - PostgreSQL database
# - BackApp application
# - Automatic database migrations run via entrypoint
```

### Verify Deployment

```bash
# Check all containers are running
docker-compose ps

# Should show:
# backapp-db   - Up (healthy)
# backapp-app  - Up

# View application logs
docker-compose logs -f app

# Should see: "Server running on port 3000"
```

### Test Locally

```bash
# Test from server
curl http://localhost:3000

# Should return HTML (login page)
```

---

## Step 4: Install Cloudflare Tunnel (15 minutes)

### Install cloudflared

```bash
# Download cloudflared
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Install
sudo dpkg -i cloudflared.deb

# Verify
cloudflared --version
```

### Authenticate

```bash
cloudflared tunnel login
# Opens browser - login to Cloudflare
# Select domain: davidhsells.today
```

### Create Tunnel

```bash
# Create tunnel
cloudflared tunnel create backapp

# Save the TUNNEL_ID from output
# Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Configure Tunnel

```bash
# Create config directory
sudo mkdir -p /etc/cloudflared

# Create config file
sudo nano /etc/cloudflared/config.yml
```

**Paste (replace `<TUNNEL_ID>`):**

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: backapp.davidhsells.today
    service: http://localhost:3000
  - service: http_status:404
```

```bash
# Copy credentials
sudo cp ~/.cloudflared/<TUNNEL_ID>.json /root/.cloudflared/

# Create DNS record
cloudflared tunnel route dns backapp backapp.davidhsells.today
```

### Install as Service

```bash
# Install service
sudo cloudflared service install

# Start and enable
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

---

## Step 5: Verify Production Deployment (5 minutes)

### Access Application

Open browser: **https://backapp.davidhsells.today**

✅ **Verify:**
- [ ] Login page loads
- [ ] SSL certificate is valid (Cloudflare)
- [ ] Can register new user
- [ ] Can login successfully
- [ ] Dashboard loads
- [ ] No console errors

---

## Step 6: Configure Automated Backups (5 minutes)

### Database Backup Script

```bash
mkdir -p ~/backups
nano ~/backups/backup-docker-db.sh
```

**Paste:**

```bash
#!/bin/bash
BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backapp_$DATE.sql"

# Backup from Docker container
docker exec backapp-db pg_dump -U backapp backapp > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Keep only last 30 days
find "$BACKUP_DIR" -name "backapp_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

```bash
# Make executable
chmod +x ~/backups/backup-docker-db.sh

# Test backup
~/backups/backup-docker-db.sh

# Schedule with cron
crontab -e
# Add: 0 2 * * * /home/YOUR_USER/backups/backup-docker-db.sh
```

---

## Common Operations

### View Logs

```bash
# Application logs
docker-compose logs -f app

# Database logs
docker-compose logs -f db

# All services
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100 app
```

### Restart Services

```bash
# Restart application only
docker-compose restart app

# Restart all services
docker-compose restart

# Stop all services
docker-compose down

# Start all services
docker-compose up -d
```

### Update Application

```bash
# Pull latest code
git pull origin claude/fix-testing-phase-62-017CC8or848BkScyKbUTxqEX

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d

# Migrations run automatically via entrypoint
```

### Database Access

```bash
# Connect to database
docker exec -it backapp-db psql -U backapp -d backapp

# Run Prisma Studio
docker-compose exec app npx prisma studio
# Access at: http://your-server-ip:5555
```

### Container Shell Access

```bash
# Access application container
docker exec -it backapp-app sh

# Access database container
docker exec -it backapp-db sh
```

---

## Monitoring

### Check Container Status

```bash
# View running containers
docker-compose ps

# View resource usage
docker stats

# View container details
docker inspect backapp-app
```

### Health Checks

```bash
# Database health
docker-compose exec db pg_isready -U backapp

# Application health
curl http://localhost:3000/api/health || echo "No health endpoint"
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
docker-compose logs app

# Common issues:
# - Database not ready: Wait for "PostgreSQL is ready!" in logs
# - Environment variables missing: Check .env file
# - Port already in use: Change APP_PORT in .env
```

### Database Connection Errors

```bash
# Check database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Restart database
docker-compose restart db

# Verify connection string in .env matches docker-compose.yml
```

### Cloudflare Tunnel Not Working

```bash
# Check tunnel status
sudo systemctl status cloudflared

# View tunnel logs
sudo journalctl -u cloudflared -f

# Restart tunnel
sudo systemctl restart cloudflared

# Test DNS
nslookup backapp.davidhsells.today
```

### Build Failures

```bash
# Clean and rebuild
docker-compose down -v
docker system prune -a
docker-compose build --no-cache
docker-compose up -d
```

### Performance Issues

```bash
# Check resource usage
docker stats

# View container logs for errors
docker-compose logs --tail=1000 app | grep -i error

# Restart containers
docker-compose restart
```

---

## Maintenance

### Weekly
- [ ] Check application logs: `docker-compose logs --tail=100 app`
- [ ] Verify backups running: `ls -lh ~/backups/`
- [ ] Check disk space: `df -h`
- [ ] Check Docker disk usage: `docker system df`

### Monthly
- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Update Docker images: `docker-compose pull && docker-compose up -d`
- [ ] Clean unused Docker resources: `docker system prune -a`
- [ ] Review S3 storage costs

### Backups
```bash
# Manual database backup
docker exec backapp-db pg_dump -U backapp backapp > backup.sql

# Restore database backup
cat backup.sql | docker exec -i backapp-db psql -U backapp -d backapp

# Backup Docker volumes
docker run --rm -v backapp_postgres_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/postgres_data_backup.tar.gz -C /data .
```

---

## Security Hardening

### Firewall

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH (IMPORTANT!)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable

# Port 3000 is NOT exposed - only accessible via Cloudflare tunnel
```

### Docker Security

```bash
# Run Docker daemon with user namespace isolation
sudo nano /etc/docker/daemon.json
```

Add:
```json
{
  "userns-remap": "default"
}
```

```bash
sudo systemctl restart docker
```

### Update Secrets

```bash
# Stop services
docker-compose down

# Update .env with new secrets
nano .env

# Restart services
docker-compose up -d
```

---

## Rollback Procedure

If deployment fails:

1. **Stop containers:**
   ```bash
   docker-compose down
   ```

2. **Restore database:**
   ```bash
   gunzip -c ~/backups/backapp_YYYYMMDD_HHMMSS.sql.gz | \
     docker exec -i backapp-db psql -U backapp -d backapp
   ```

3. **Revert code:**
   ```bash
   git checkout <previous-commit>
   ```

4. **Rebuild and restart:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

---

## Docker Compose Configuration

### Production (docker-compose.yml)

The production configuration includes:
- **app**: Next.js application with custom server (WebSocket support)
- **db**: PostgreSQL 15 with persistent volume
- **Networks**: Isolated bridge network for container communication
- **Volumes**: Persistent data for PostgreSQL

### Optional Development Services

For local development, use:
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This adds:
- **LocalStack**: S3 mock for testing
- **MailHog**: Email testing UI
- **PgAdmin**: Database administration UI

---

## Next Steps

### Immediate (After Deployment)
1. [ ] Create admin user account
2. [ ] Test agent registration
3. [ ] Create first backup config
4. [ ] Install agent on client machine
5. [ ] Run test backup

### First Week
1. [ ] Monitor Docker logs daily
2. [ ] Verify scheduled backups run
3. [ ] Check S3 uploads working
4. [ ] Test email notifications
5. [ ] Monitor resource usage

---

## Success Criteria

✅ **Deployment successful when:**
1. All containers running: `docker-compose ps` shows "Up"
2. Application accessible at https://backapp.davidhsells.today
3. SSL certificate valid
4. Can create account and login
5. Dashboard displays correctly
6. Agent registration works
7. Database backups scheduled and running

---

## Support

**View Documentation:**
- `DEPLOYMENT.md` - Full Docker deployment guide
- `docker-compose.yml` - Production configuration
- `Dockerfile` - Application image build
- `docker-entrypoint.sh` - Startup script with migrations

**Get Logs:**
```bash
docker-compose logs -f app
sudo journalctl -u cloudflared -f
```

**Container Commands:**
```bash
docker-compose ps          # Status
docker-compose restart     # Restart
docker-compose down        # Stop
docker-compose up -d       # Start
```

---

**Estimated Deployment Time**: 45-60 minutes

**Docker makes deployment simple!** All dependencies, migrations, and configuration are handled automatically by the containers.
