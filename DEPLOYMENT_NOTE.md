# Deployment Methods

BackApp supports two deployment methods:

## 🐳 Docker Compose (RECOMMENDED)

**File**: `DOCKER_DEPLOYMENT.md`

**Advantages:**
- ✅ Faster deployment (45-60 minutes)
- ✅ All dependencies bundled
- ✅ Automatic database migrations
- ✅ Isolated environment
- ✅ Easy rollback
- ✅ One command to start: `docker-compose up -d`

**Best for:**
- Production deployments
- Consistent environments
- Easy maintenance
- Quick updates

**Start here**: Follow `DOCKER_DEPLOYMENT.md`

---

## 📦 Manual Installation (ALTERNATIVE)

**Files**: 
- `DEPLOYMENT_QUICKSTART.md` (45-60 min quick guide)
- `DEPLOYMENT_PROCEDURE.md` (detailed 2-3 hour guide)
- `PRE_DEPLOYMENT_CHECKLIST.md` (verification checklist)

**When to use:**
- Docker not available
- Need direct control over services
- Custom system requirements
- Integration with existing infrastructure

**Advantages:**
- Direct system access
- Fine-grained control
- No Docker overhead
- Integrates with existing PostgreSQL/Node.js

**Start here**: Follow `DEPLOYMENT_QUICKSTART.md`

---

## Which Should I Choose?

**Choose Docker if:**
- ✅ You want the fastest, easiest deployment
- ✅ You're deploying to a cloud server
- ✅ You want consistent environments
- ✅ You prefer containerized applications

**Choose Manual if:**
- You cannot use Docker
- You need to integrate with existing services
- You require specific system configurations
- You prefer traditional deployment methods

---

## Getting Started

### Docker Deployment (Recommended)
```bash
# 1. Clone repository
git clone https://github.com/davidsells/backapp.git
cd backapp

# 2. Configure environment
cp .env.production.example .env
nano .env  # Fill in your values

# 3. Start services
docker-compose up -d

# 4. View logs
docker-compose logs -f app
```

See `DOCKER_DEPLOYMENT.md` for full instructions.

### Manual Deployment
See `DEPLOYMENT_QUICKSTART.md` for step-by-step instructions.

---

**Both methods deploy to**: https://backapp.davidhsells.today
**Both methods use**: Cloudflare Tunnel for HTTPS access
**Both methods are**: Fully production-ready

**Recommendation**: Use Docker unless you have a specific reason not to.
