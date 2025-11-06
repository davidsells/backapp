# Cloudflare Tunnel Configuration Guide

If you're accessing BackApp through a Cloudflare tunnel, you need to configure the application to know its public URL.

## Setup Steps

### 1. Update Environment Variables

Edit your `.env` file and set:

```bash
# Change from:
NEXTAUTH_URL=http://localhost:3000

# To your Cloudflare tunnel URL:
NEXTAUTH_URL=https://backapp.davidhsells.org
```

### 2. Restart Docker Containers

After updating `.env`:

```bash
docker-compose down
docker-compose up -d
```

### 3. Verify

- Navigate to: `https://backapp.davidhsells.org/login`
- After login, you should stay on the Cloudflare domain
- URL should be: `https://backapp.davidhsells.org/dashboard` (NOT localhost)

## Troubleshooting

### Still redirecting to localhost?

1. **Check environment variable is loaded:**
   ```bash
   docker-compose exec app env | grep NEXTAUTH_URL
   # Should show: NEXTAUTH_URL=https://backapp.davidhsells.org
   ```

2. **Clear browser cookies:**
   - NextAuth stores cookies that might have old URLs
   - Clear cookies for backapp.davidhsells.org
   - Or use incognito/private mode

3. **Verify Cloudflare tunnel:**
   ```bash
   # Check tunnel is running
   cloudflared tunnel info

   # Check tunnel routes
   cloudflared tunnel route dns
   ```

### HTTPS/SSL Issues

If you see SSL errors:

1. **Ensure Cloudflare SSL is set to "Full" or "Full (strict)"**
   - Go to Cloudflare Dashboard → SSL/TLS
   - Set to "Full" mode

2. **Check your origin server:**
   - Cloudflare connects to: `http://localhost:3000` (internal)
   - Users see: `https://backapp.davidhsells.org` (external)
   - This is normal and correct!

### Session Issues

If login works but sessions don't persist:

1. **Check NEXTAUTH_SECRET is set:**
   ```bash
   docker-compose exec app env | grep NEXTAUTH_SECRET
   ```

2. **Generate a strong secret if not set:**
   ```bash
   openssl rand -base64 32
   ```

3. **Update .env and restart:**
   ```bash
   NEXTAUTH_SECRET=<your-generated-secret>
   docker-compose restart app
   ```

## Example Production .env

```bash
# Application
NODE_ENV=production
APP_PORT=3000

# Database
DATABASE_URL=postgresql://backapp:your-password@db:5432/backapp

# NextAuth - IMPORTANT: Use your Cloudflare tunnel URL!
NEXTAUTH_URL=https://backapp.davidhsells.org
NEXTAUTH_SECRET=your-generated-secret-from-openssl

# AWS S3 (your actual credentials)
AWS_ACCESS_KEY_ID=your-real-key
AWS_SECRET_ACCESS_KEY=your-real-secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket

# SMTP (optional, for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@backapp.davidhsells.org
```

## Architecture

```
User Browser
    ↓
    ↓ https://backapp.davidhsells.org
    ↓
Cloudflare Tunnel (cloudflared)
    ↓
    ↓ http://localhost:3000 (internal)
    ↓
Docker Container (backapp-app)
    ↓
Next.js App (sees NEXTAUTH_URL as public URL)
```

The key is: **NEXTAUTH_URL must match what users see in their browser**, not the internal Docker URL.
