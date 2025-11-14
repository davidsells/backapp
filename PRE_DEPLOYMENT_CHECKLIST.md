# BackApp - Pre-Deployment Checklist

**Target URL**: https://backapp.davidhsells.today
**Deployment Type**: Remote cloud server with Cloudflare tunnel
**Date**: 2025-11-14

---

## ✅ Phase 1: Code Quality Verification

### Build & Tests
- [x] All tests passing (45/45 - 100%)
- [x] TypeScript compilation successful (`npm run build`)
- [x] ESLint checks passing (`npm run lint`)
- [ ] No console.log statements in production code (optional cleanup)

### Security
- [x] Security audit completed (Phase 6.1)
- [x] Critical vulnerabilities addressed
- [x] Password requirements enforced (12+ chars, complexity)
- [x] WebSocket authentication verified
- [x] Agent API key authentication tested
- [ ] Review SECURITY_AUDIT_REPORT.md for any remaining items

---

## ✅ Phase 2: Environment Configuration

### Required Environment Variables

Create `.env.production` file with:

```bash
# ============================================
# Database Configuration
# ============================================
DATABASE_URL="postgresql://backapp:<STRONG_PASSWORD>@localhost:5432/backapp"

# ============================================
# Application Configuration
# ============================================
NODE_ENV="production"
APP_PORT="3000"
NEXTAUTH_URL="https://backapp.davidhsells.today"
NEXTAUTH_SECRET="<GENERATE_WITH: openssl rand -base64 32>"

# ============================================
# AWS S3 Configuration
# ============================================
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="<YOUR_AWS_ACCESS_KEY>"
AWS_SECRET_ACCESS_KEY="<YOUR_AWS_SECRET_KEY>"
AWS_S3_BUCKET="<YOUR_BUCKET_NAME>"

# ============================================
# Email/SMTP Configuration (for alerts)
# ============================================
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="true"
SMTP_USER="<YOUR_EMAIL@gmail.com>"
SMTP_PASSWORD="<YOUR_APP_PASSWORD>"
SMTP_FROM="BackApp <noreply@davidhsells.today>"

# ============================================
# Optional: Logging & Monitoring
# ============================================
LOG_LEVEL="info"
ENABLE_METRICS="true"
```

### Checklist
- [ ] All required environment variables documented
- [ ] NEXTAUTH_SECRET generated (32+ character random string)
- [ ] Strong PostgreSQL password set
- [ ] AWS credentials configured (IAM user with S3 access)
- [ ] S3 bucket created and accessible
- [ ] SMTP credentials configured
- [ ] Test email can be sent

---

## ✅ Phase 3: Database Setup

### PostgreSQL Installation
- [ ] PostgreSQL 15+ installed on server
- [ ] PostgreSQL service running
- [ ] Database user created: `backapp`
- [ ] Database created: `backapp`
- [ ] User has appropriate permissions

### Prisma Migrations
- [ ] Prisma client generated: `npx prisma generate`
- [ ] Migrations applied: `npx prisma migrate deploy`
- [ ] Database schema verified: `npx prisma studio` (optional)

### Database Verification
```bash
# Test connection
psql -U backapp -d backapp -c "\dt"

# Should show tables:
# - users
# - backup_configs
# - backup_logs
# - alerts
# - agents
# - agent_logs
# - app_settings
```

---

## ✅ Phase 4: Application Deployment

### Server Requirements
- [ ] Node.js 20+ installed
- [ ] npm 10+ installed
- [ ] Git installed
- [ ] Sufficient disk space (20GB+ recommended)
- [ ] 2GB+ RAM available

### Application Setup
```bash
# Clone repository
git clone <repository-url>
cd backapp

# Install dependencies
npm ci --production

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build application
npm run build

# Test start (should not error)
npm start
# Ctrl+C to stop
```

### Checklist
- [ ] Repository cloned to server
- [ ] Dependencies installed successfully
- [ ] Prisma client generated
- [ ] Migrations run successfully
- [ ] Build completed without errors
- [ ] Application starts without crashing

---

## ✅ Phase 5: Process Management (systemd)

### Create systemd service

Create file: `/etc/systemd/system/backapp.service`

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

### Setup Commands
```bash
# Create log directory
sudo mkdir -p /var/log/backapp
sudo chown <YOUR_USER>:<YOUR_USER> /var/log/backapp

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable backapp
sudo systemctl start backapp

# Check status
sudo systemctl status backapp

# View logs
tail -f /var/log/backapp/app.log
```

### Checklist
- [ ] systemd service file created
- [ ] Log directory created with proper permissions
- [ ] Service enabled to start on boot
- [ ] Service started successfully
- [ ] No errors in logs
- [ ] Application accessible on localhost:3000

---

## ✅ Phase 6: Cloudflare Tunnel Setup

### Prerequisites
- [ ] Cloudflare account with domain: davidhsells.today
- [ ] cloudflared installed on server

### Installation
```bash
# Download cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Authenticate
cloudflared tunnel login
# Follow browser prompts
```

### Create Tunnel
```bash
# Create tunnel
cloudflared tunnel create backapp

# Note the tunnel ID from output
# Create config file
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

### Configuration File
Create `/etc/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: backapp.davidhsells.today
    service: http://localhost:3000
  - service: http_status:404
```

### DNS Configuration
```bash
# Create DNS record
cloudflared tunnel route dns backapp backapp.davidhsells.today
```

### Service Setup
```bash
# Install as service
sudo cloudflared service install

# Start service
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Check status
sudo systemctl status cloudflared
```

### Checklist
- [ ] cloudflared installed
- [ ] Tunnel created successfully
- [ ] Configuration file created
- [ ] DNS record created (backapp.davidhsells.today)
- [ ] cloudflared service running
- [ ] HTTPS URL accessible externally

---

## ✅ Phase 7: Post-Deployment Verification

### Application Access
- [ ] https://backapp.davidhsells.today loads successfully
- [ ] Login page displays correctly
- [ ] SSL certificate is valid (Cloudflare)
- [ ] No console errors in browser

### Functional Testing

#### Authentication
- [ ] Can register new user account
- [ ] Can login with credentials
- [ ] Can logout successfully
- [ ] Session persists across page refreshes

#### Agent Management
- [ ] Can register new agent
- [ ] Agent API key is displayed once
- [ ] Agent appears in agents list
- [ ] Can delete agent

#### Backup Configuration
- [ ] Can create new backup config
- [ ] Can assign config to agent
- [ ] Can enable/disable config
- [ ] Can delete config

#### Backup Execution (requires agent installed)
- [ ] Can trigger manual backup
- [ ] Backup status updates in UI
- [ ] Backup completes successfully
- [ ] Backup appears in logs
- [ ] Files uploaded to S3 bucket

#### Monitoring
- [ ] Dashboard shows statistics
- [ ] Backup logs are visible
- [ ] Alerts are generated for failures
- [ ] Email notifications sent (if configured)

### Performance Testing
- [ ] Page load times < 2 seconds
- [ ] API responses < 500ms
- [ ] No memory leaks (monitor over 24 hours)
- [ ] Database queries optimized

---

## ✅ Phase 8: Monitoring & Logging

### Application Logs
```bash
# View application logs
tail -f /var/log/backapp/app.log

# View error logs
tail -f /var/log/backapp/error.log

# View systemd logs
sudo journalctl -u backapp -f
```

### Database Monitoring
```bash
# Monitor database connections
psql -U backapp -d backapp -c "SELECT * FROM pg_stat_activity;"

# Check database size
psql -U backapp -d backapp -c "SELECT pg_size_pretty(pg_database_size('backapp'));"
```

### S3 Storage
- [ ] Monitor S3 bucket size
- [ ] Verify backup files are being created
- [ ] Check S3 lifecycle policies (optional)

### Checklist
- [ ] Log rotation configured
- [ ] Monitoring tools set up (optional: Grafana, Prometheus)
- [ ] Alerts configured for critical errors
- [ ] Backup of database scheduled
- [ ] Disaster recovery plan documented

---

## ✅ Phase 9: Security Hardening

### Firewall
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 5432/tcp  # PostgreSQL (if remote)
sudo ufw enable

# Note: Port 3000 is NOT exposed - only through Cloudflare tunnel
```

### Database Security
- [ ] PostgreSQL only listens on localhost
- [ ] Strong database password used
- [ ] Regular backups scheduled

### Application Security
- [ ] NEXTAUTH_SECRET is strong and unique
- [ ] AWS credentials have minimal required permissions
- [ ] No sensitive data in logs
- [ ] Rate limiting enabled (optional)

---

## ✅ Phase 10: Documentation

### User Documentation
- [ ] Getting started guide
- [ ] Agent installation instructions
- [ ] Backup configuration guide
- [ ] Troubleshooting guide

### Admin Documentation
- [ ] Deployment procedure documented
- [ ] Backup/restore procedures
- [ ] Monitoring procedures
- [ ] Incident response plan

---

## 🚀 Final Go-Live Checklist

Before announcing to users:

- [ ] All tests passing
- [ ] Application deployed and accessible
- [ ] Database migrations applied
- [ ] Cloudflare tunnel working
- [ ] SSL certificate valid
- [ ] All functional tests passed
- [ ] Performance acceptable
- [ ] Monitoring in place
- [ ] Logs accessible
- [ ] Backup strategy implemented
- [ ] Security hardening complete
- [ ] Documentation complete
- [ ] Support process defined

---

## 📞 Support & Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check logs
sudo journalctl -u backapp -n 50

# Check environment variables
cat .env.production

# Test database connection
psql -U backapp -d backapp -c "SELECT 1;"
```

**Cloudflare tunnel not working:**
```bash
# Check tunnel status
sudo systemctl status cloudflared

# View tunnel logs
sudo journalctl -u cloudflared -n 50

# Restart tunnel
sudo systemctl restart cloudflared
```

**Database connection errors:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check database exists
sudo -u postgres psql -l | grep backapp

# Reset password if needed
sudo -u postgres psql -c "ALTER USER backapp WITH PASSWORD 'newpassword';"
```

---

## 📝 Rollback Plan

If deployment fails:

1. Stop application: `sudo systemctl stop backapp`
2. Restore previous database: `psql -U backapp -d backapp < backup.sql`
3. Revert code: `git checkout <previous-commit>`
4. Rebuild: `npm run build`
5. Restart: `sudo systemctl start backapp`

---

**Document Version**: 1.0
**Last Updated**: 2025-11-14
**Status**: Ready for deployment
