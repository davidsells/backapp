# BackApp - Deployment Quick Start

**Target**: https://backapp.davidhsells.today
**Time Required**: 2-3 hours
**Branch**: `claude/fix-testing-phase-62-017CC8or848BkScyKbUTxqEX`

---

## Before You Begin

✅ **Prerequisites Checklist:**
- [ ] Remote cloud server with Ubuntu 20.04+ (SSH access)
- [ ] Cloudflare account with domain: davidhsells.today
- [ ] AWS S3 bucket created
- [ ] AWS IAM user credentials (Access Key + Secret)
- [ ] SMTP credentials (Gmail or other) for email alerts
- [ ] This repository cloned on your server

---

## Quick Deployment Steps

### 1. Server Setup (15 minutes)

```bash
# SSH into your server
ssh user@your-server-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Git
sudo apt install -y git

# Verify installations
node --version  # v20.x.x
psql --version  # PostgreSQL 15+
```

### 2. Database Setup (5 minutes)

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE backapp;
CREATE USER backapp WITH ENCRYPTED PASSWORD 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE backapp TO backapp;
\q
EOF

# Test connection
psql -U backapp -d backapp -h localhost -c "SELECT 1;"
```

### 3. Clone & Configure Application (10 minutes)

```bash
# Clone repository
cd ~
git clone https://github.com/davidsells/backapp.git
cd backapp
git checkout claude/fix-testing-phase-62-017CC8or848BkScyKbUTxqEX

# Copy environment template
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

**Required values to configure:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `AWS_ACCESS_KEY_ID` - Your AWS access key
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key
- `AWS_S3_BUCKET` - Your S3 bucket name
- `SMTP_USER` - Your email for SMTP
- `SMTP_PASSWORD` - Your SMTP password

### 4. Install & Build (15 minutes)

```bash
# Install dependencies
npm ci --production

# Or if you need dev dependencies for build:
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Build application
npm run build

# Test start (should not crash)
NODE_ENV=production node server.js
# Ctrl+C to stop
```

### 5. Setup systemd Service (10 minutes)

```bash
# Create log directory
sudo mkdir -p /var/log/backapp
sudo chown $USER:$USER /var/log/backapp

# Create service file
sudo nano /etc/systemd/system/backapp.service
```

**Paste** (replace `<YOUR_USER>` with your username):
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

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable backapp
sudo systemctl start backapp

# Verify
sudo systemctl status backapp
tail -f /var/log/backapp/app.log
```

### 6. Install Cloudflare Tunnel (20 minutes)

```bash
# Download and install
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb

# Authenticate (opens browser)
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create backapp
# Save the TUNNEL_ID from output

# Create config
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

**Paste** (replace `<TUNNEL_ID>`):
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: backapp.davidhsells.today
    service: http://localhost:3000
  - service: http_status:404
```

```bash
# Copy credentials to root
sudo cp ~/.cloudflared/<TUNNEL_ID>.json /root/.cloudflared/

# Create DNS record
cloudflared tunnel route dns backapp backapp.davidhsells.today

# Install and start service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared

# Verify
sudo systemctl status cloudflared
```

### 7. Configure Firewall (5 minutes)

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH (IMPORTANT!)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable

# Verify
sudo ufw status
```

### 8. Test Deployment (10 minutes)

**Open browser:** https://backapp.davidhsells.today

✅ **Verify:**
- [ ] Login page loads
- [ ] SSL certificate is valid
- [ ] Can register new user
- [ ] Can login successfully
- [ ] Dashboard loads
- [ ] No console errors

### 9. Setup Automated Backups (10 minutes)

```bash
# Create backup script
mkdir -p ~/backups
nano ~/backups/backup-db.sh
```

**Paste:**
```bash
#!/bin/bash
BACKUP_DIR="$HOME/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U backapp -d backapp > "$BACKUP_DIR/backapp_$DATE.sql"
gzip "$BACKUP_DIR/backapp_$DATE.sql"
find "$BACKUP_DIR" -name "backapp_*.sql.gz" -mtime +30 -delete
```

```bash
# Make executable
chmod +x ~/backups/backup-db.sh

# Add to crontab
crontab -e
# Add: 0 2 * * * /home/YOUR_USER/backups/backup-db.sh
```

### 10. Monitor & Verify (Ongoing)

```bash
# Watch application logs
tail -f /var/log/backapp/app.log

# Watch tunnel logs
sudo journalctl -u cloudflared -f

# Check service status
sudo systemctl status backapp cloudflared

# Check disk space
df -h
```

---

## Common Issues & Quick Fixes

### Application Won't Start
```bash
# Check logs
sudo journalctl -u backapp -n 50
# Look for: Database connection, missing env vars, port conflicts
```

### Cloudflare Tunnel Not Working
```bash
# Check status
sudo systemctl status cloudflared
# Restart
sudo systemctl restart cloudflared
```

### Database Connection Errors
```bash
# Verify PostgreSQL is running
sudo systemctl status postgresql
# Test connection
psql -U backapp -d backapp -h localhost -c "SELECT 1;"
```

### Build Fails
```bash
# Clear and rebuild
rm -rf node_modules .next
npm install
npx prisma generate
npm run build
```

---

## Post-Deployment Tasks

### Immediate (Today)
- [ ] Test agent registration
- [ ] Create first backup config
- [ ] Install agent on client machine
- [ ] Run first backup test
- [ ] Verify email notifications work

### First Week
- [ ] Monitor logs daily
- [ ] Test scheduled backups
- [ ] Verify S3 uploads
- [ ] Check database backups running

### Ongoing
- [ ] Weekly: Review logs for errors
- [ ] Monthly: Update system packages
- [ ] Quarterly: Security review

---

## Need Help?

**Full Documentation:**
- `DEPLOYMENT_PROCEDURE.md` - Detailed step-by-step guide
- `PRE_DEPLOYMENT_CHECKLIST.md` - Comprehensive checklist
- `SECURITY_AUDIT_REPORT.md` - Security considerations

**Logs:**
```bash
# Application
tail -f /var/log/backapp/app.log

# Cloudflare tunnel
sudo journalctl -u cloudflared -f

# PostgreSQL
sudo journalctl -u postgresql -f
```

---

## Success Criteria

✅ **Deployment is successful when:**
1. https://backapp.davidhsells.today loads with valid SSL
2. You can create an account and login
3. Dashboard displays correctly
4. Agent can be registered
5. Backup config can be created
6. Services auto-start on server reboot

---

**Estimated Total Time**: 2-3 hours for first deployment

**Next Step**: Follow this guide on your server, then install the agent on your client machine!
