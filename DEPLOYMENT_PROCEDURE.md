# BackApp - Deployment Procedure

**Version**: 1.0
**Target**: Production deployment to remote cloud server
**URL**: https://backapp.davidhsells.today
**Date**: 2025-11-14

---

## Overview

This document provides step-by-step instructions for deploying BackApp to a production environment using:
- Remote cloud server (Ubuntu/Debian Linux)
- PostgreSQL database
- Cloudflare tunnel for HTTPS access
- systemd for process management

**Estimated Time**: 2-3 hours for first-time deployment

---

## Prerequisites

Before starting, ensure you have:

- [ ] Remote cloud server with SSH access (Ubuntu 20.04+ or Debian 11+)
- [ ] Root or sudo access on the server
- [ ] Cloudflare account with domain: davidhsells.today
- [ ] AWS account with S3 bucket created
- [ ] AWS IAM user with S3 access (Access Key ID and Secret)
- [ ] SMTP credentials for email notifications (optional but recommended)
- [ ] This repository cloned locally

---

## Step 1: Prepare Server Environment

### 1.1 Connect to Server

```bash
ssh user@your-server-ip
```

### 1.2 Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.3 Install Node.js 20+

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version   # Should be 10.x.x
```

### 1.4 Install PostgreSQL

```bash
# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Verify installation
sudo systemctl status postgresql
```

### 1.5 Install Git

```bash
sudo apt install -y git

# Verify
git --version
```

---

## Step 2: Configure Database

### 2.1 Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In psql prompt:
CREATE DATABASE backapp;
CREATE USER backapp WITH ENCRYPTED PASSWORD 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE backapp TO backapp;
\q
```

### 2.2 Verify Database Access

```bash
# Test connection
psql -U backapp -d backapp -h localhost -c "SELECT 1;"
# Enter password when prompted
```

---

## Step 3: Clone and Configure Application

### 3.1 Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone repository
git clone https://github.com/davidsells/backapp.git
cd backapp

# Checkout the deployment branch
git checkout claude/fix-testing-phase-62-017CC8or848BkScyKbUTxqEX
```

### 3.2 Create Environment File

```bash
# Create production environment file
nano .env.production
```

Paste the following configuration (replace `<...>` placeholders):

```bash
# ============================================
# Database Configuration
# ============================================
DATABASE_URL="postgresql://backapp:<DATABASE_PASSWORD>@localhost:5432/backapp"

# ============================================
# Application Configuration
# ============================================
NODE_ENV="production"
APP_PORT="3000"
NEXTAUTH_URL="https://backapp.davidhsells.today"
NEXTAUTH_SECRET="<GENERATE_32_CHAR_SECRET>"

# ============================================
# AWS S3 Configuration
# ============================================
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="<YOUR_AWS_ACCESS_KEY>"
AWS_SECRET_ACCESS_KEY="<YOUR_AWS_SECRET_KEY>"
AWS_S3_BUCKET="<YOUR_BUCKET_NAME>"

# ============================================
# Email/SMTP Configuration
# ============================================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="true"
SMTP_USER="<YOUR_EMAIL@gmail.com>"
SMTP_PASSWORD="<YOUR_APP_PASSWORD>"
SMTP_FROM="BackApp <noreply@davidhsells.today>"

# ============================================
# Logging
# ============================================
LOG_LEVEL="info"
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 3.3 Install Dependencies

```bash
# Install production dependencies
npm ci --production

# If you need dev dependencies for build:
npm install
```

### 3.4 Generate Prisma Client

```bash
npx prisma generate
```

### 3.5 Run Database Migrations

```bash
npx prisma migrate deploy
```

### 3.6 Build Application

```bash
npm run build
```

### 3.7 Test Application

```bash
# Start application in foreground (for testing)
NODE_ENV=production node server.js

# In another terminal, test locally:
curl http://localhost:3000

# Should see HTML response
# Press Ctrl+C to stop
```

---

## Step 4: Configure systemd Service

### 4.1 Create Log Directory

```bash
sudo mkdir -p /var/log/backapp
sudo chown $USER:$USER /var/log/backapp
```

### 4.2 Create systemd Service File

```bash
sudo nano /etc/systemd/system/backapp.service
```

Paste the following (replace `<YOUR_USER>` with your username):

```ini
[Unit]
Description=BackApp Backup System
After=network.target postgresql.service

[Service]
Type=simple
User=<YOUR_USER>
WorkingDirectory=/home/<YOUR_USER>/backapp
Environment="NODE_ENV=production"
EnvironmentFile=/home/<YOUR_USER>/backapp/.env.production
ExecStart=/usr/bin/node /home/<YOUR_USER>/backapp/server.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/backapp/app.log
StandardError=append:/var/log/backapp/error.log

[Install]
WantedBy=multi-user.target
```

### 4.3 Enable and Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable backapp

# Start service
sudo systemctl start backapp

# Check status
sudo systemctl status backapp
```

### 4.4 Verify Service is Running

```bash
# Check logs
tail -f /var/log/backapp/app.log

# Should see: "Server running on port 3000"
# Press Ctrl+C to stop tailing

# Test locally
curl http://localhost:3000
```

---

## Step 5: Configure Firewall

### 5.1 Install and Configure UFW

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH (IMPORTANT: do this first!)
sudo ufw allow 22/tcp

# Allow PostgreSQL (only if remote access needed)
# sudo ufw allow 5432/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**Note**: Port 3000 is NOT exposed externally - only accessible through Cloudflare tunnel.

---

## Step 6: Install Cloudflare Tunnel

### 6.1 Install cloudflared

```bash
# Download cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Install
sudo dpkg -i cloudflared.deb

# Verify
cloudflared --version
```

### 6.2 Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This will:
1. Open a browser window
2. Prompt you to login to Cloudflare
3. Select domain: davidhsells.today
4. Download certificate to `~/.cloudflared/cert.pem`

### 6.3 Create Tunnel

```bash
# Create tunnel named "backapp"
cloudflared tunnel create backapp
```

**Save the Tunnel ID** from the output (looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 6.4 Create Tunnel Configuration

```bash
# Create config directory
sudo mkdir -p /etc/cloudflared

# Create config file
sudo nano /etc/cloudflared/config.yml
```

Paste the following (replace `<TUNNEL_ID>` with your actual tunnel ID):

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: backapp.davidhsells.today
    service: http://localhost:3000
  - service: http_status:404
```

**Important**: Copy credentials file to root:
```bash
sudo cp ~/.cloudflared/<TUNNEL_ID>.json /root/.cloudflared/
```

### 6.5 Create DNS Record

```bash
cloudflared tunnel route dns backapp backapp.davidhsells.today
```

This creates a CNAME record pointing `backapp.davidhsells.today` to your tunnel.

### 6.6 Install cloudflared as Service

```bash
# Install service
sudo cloudflared service install

# Start service
sudo systemctl start cloudflared

# Enable on boot
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

### 6.7 Verify Tunnel is Working

```bash
# Check tunnel logs
sudo journalctl -u cloudflared -n 50

# Should see: "Connection established" or similar

# Test from external machine or browser:
# Open: https://backapp.davidhsells.today
# Should see BackApp login page
```

---

## Step 7: Post-Deployment Verification

### 7.1 Access Application

Open in browser: https://backapp.davidhsells.today

You should see:
- BackApp login page
- Valid SSL certificate (Cloudflare)
- No console errors

### 7.2 Create First User

1. Click "Sign Up" or navigate to `/register`
2. Create admin account
3. Login successfully

### 7.3 Test Core Functionality

**Test Agent Registration:**
1. Navigate to "Agents" page
2. Click "Register New Agent"
3. Copy API key (shown once)
4. Verify agent appears in list

**Test Backup Configuration:**
1. Navigate to "Backup Configs"
2. Create new config
3. Assign to agent
4. Save successfully

**Test Dashboard:**
1. Navigate to Dashboard
2. Verify statistics load
3. Check for any errors

### 7.4 Monitor Logs

```bash
# Application logs
tail -f /var/log/backapp/app.log

# Error logs
tail -f /var/log/backapp/error.log

# Cloudflare tunnel logs
sudo journalctl -u cloudflared -f

# systemd service logs
sudo journalctl -u backapp -f
```

---

## Step 8: Configure Log Rotation

### 8.1 Create logrotate Configuration

```bash
sudo nano /etc/logrotate.d/backapp
```

Paste:

```
/var/log/backapp/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 <YOUR_USER> <YOUR_USER>
    sharedscripts
    postrotate
        systemctl reload backapp > /dev/null 2>&1 || true
    endscript
}
```

### 8.2 Test logrotate

```bash
sudo logrotate -d /etc/logrotate.d/backapp
```

---

## Step 9: Schedule Database Backups

### 9.1 Create Backup Script

```bash
mkdir -p ~/backups
nano ~/backups/backup-db.sh
```

Paste:

```bash
#!/bin/bash
BACKUP_DIR="/home/<YOUR_USER>/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backapp_$DATE.sql"

# Create backup
pg_dump -U backapp -d backapp > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

# Keep only last 30 days
find "$BACKUP_DIR" -name "backapp_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Make executable:
```bash
chmod +x ~/backups/backup-db.sh
```

### 9.2 Schedule with cron

```bash
crontab -e
```

Add:
```
# Backup database daily at 2 AM
0 2 * * * /home/<YOUR_USER>/backups/backup-db.sh >> /var/log/backapp/backup.log 2>&1
```

---

## Step 10: Final Checklist

- [ ] Application accessible at https://backapp.davidhsells.today
- [ ] SSL certificate valid
- [ ] Can create user account
- [ ] Can login successfully
- [ ] Can register agent
- [ ] Can create backup config
- [ ] Dashboard loads correctly
- [ ] No errors in application logs
- [ ] No errors in cloudflared logs
- [ ] Database backups scheduled
- [ ] Log rotation configured
- [ ] Firewall enabled
- [ ] Services set to start on boot

---

## Troubleshooting

### Application Not Starting

```bash
# Check service status
sudo systemctl status backapp

# View recent logs
sudo journalctl -u backapp -n 100

# Check for port conflicts
sudo netstat -tulpn | grep 3000

# Verify environment file exists
ls -la ~/.env.production

# Test database connection
psql -U backapp -d backapp -h localhost -c "SELECT 1;"
```

### Cloudflare Tunnel Not Working

```bash
# Check tunnel status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -n 100

# Verify credentials file
sudo ls -la /root/.cloudflared/

# Test tunnel manually
sudo cloudflared tunnel run backapp

# Verify DNS record
nslookup backapp.davidhsells.today
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
sudo -u postgres psql -l | grep backapp

# Check user exists
sudo -u postgres psql -c "\du" | grep backapp

# Reset password if needed
sudo -u postgres psql -c "ALTER USER backapp WITH PASSWORD 'newpassword';"

# Update DATABASE_URL in .env.production
```

### Build Errors

```bash
# Clear node_modules and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build

# If Prisma errors
npx prisma generate
npx prisma migrate deploy
```

---

## Rollback Procedure

If something goes wrong:

1. **Stop services:**
   ```bash
   sudo systemctl stop backapp
   sudo systemctl stop cloudflared
   ```

2. **Restore database backup:**
   ```bash
   gunzip -c ~/backups/backapp_YYYYMMDD_HHMMSS.sql.gz | psql -U backapp -d backapp
   ```

3. **Revert code:**
   ```bash
   cd ~/backapp
   git checkout <previous-commit-hash>
   npm ci --production
   npm run build
   ```

4. **Restart services:**
   ```bash
   sudo systemctl start backapp
   sudo systemctl start cloudflared
   ```

---

## Maintenance Tasks

### Weekly
- [ ] Check application logs for errors
- [ ] Verify backups are running
- [ ] Check disk space: `df -h`
- [ ] Review security logs

### Monthly
- [ ] Update system packages: `sudo apt update && sudo apt upgrade`
- [ ] Review and rotate logs
- [ ] Check S3 storage costs
- [ ] Review user accounts

### Quarterly
- [ ] Update Node.js if needed
- [ ] Update application dependencies
- [ ] Security audit
- [ ] Performance review

---

## Support Contacts

**Application Issues:**
- Check logs: `/var/log/backapp/`
- Review SECURITY_AUDIT_REPORT.md
- Check GitHub issues

**Infrastructure:**
- Cloudflare support for tunnel issues
- AWS support for S3 issues

---

## Next Steps After Deployment

1. **Install Agent on Client Machine**
   - Follow agent installation guide in `/agent/README.md`
   - Use API key from agent registration

2. **Configure First Backup**
   - Create backup configuration
   - Assign to agent
   - Test manual backup execution

3. **Monitor First 24 Hours**
   - Watch logs for errors
   - Verify scheduled backups run
   - Check email notifications

4. **Documentation**
   - Create user guide
   - Document custom procedures
   - Share access with team (if applicable)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-14
**Deployment Status**: Ready
