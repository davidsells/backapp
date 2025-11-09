# Security Audit Report - BackApp
**Date**: 2025-11-09
**Auditor**: Claude (Anthropic AI)
**Phase**: 6.1 - Security Audit
**Version**: 1.0

## Executive Summary

This security audit was conducted on the BackApp backup management system to identify vulnerabilities before production deployment. The audit covered authentication, authorization, API security, data storage, and secrets management.

**Overall Security Posture**: MODERATE - Some critical issues identified requiring attention

**Key Findings**:
- 2 CRITICAL vulnerabilities identified
- 1 HIGH priority issue (FIXED)
- 1 MEDIUM priority issue (FIXED)
- Multiple security best practices documented

---

## Vulnerability Summary

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 2     | 0     | 2         |
| HIGH     | 1     | 1     | 0         |
| MEDIUM   | 1     | 1     | 0         |
| LOW      | 0     | 0     | 0         |

---

## Critical Vulnerabilities

### CRITICAL-001: Agent API Keys Stored in Plaintext
**Status**: ⚠️ NOT FIXED (Architectural Issue)
**Location**: `prisma/schema.prisma` (Agent model), `src/lib/agent/agent-auth.ts:36`
**CVSS Score**: 9.1 (Critical)

**Description**:
Agent API keys are stored in plaintext in the database for lookup purposes. While they are also stored hashed for validation, the plaintext storage creates a significant security risk.

**Impact**:
- If the database is compromised, all agent API keys are exposed
- Attackers could impersonate agents and access/modify user backup data
- No ability to invalidate compromised keys without database access

**Current Implementation**:
```typescript
// Agent model stores both plaintext and hash
const agent = await prisma.agent.findUnique({
  where: { apiKey }, // Lookup by plaintext key
  select: { apiKeyHash: true, ... }
});
```

**Recommended Fix** (Requires Migration):
1. Remove `apiKey` field from database schema
2. Add `agentIdentifier` (UUID) field
3. Modify authentication to use header combo: `X-Agent-ID` + `X-Agent-API-Key`
4. Lookup by agent ID, verify hash
5. Provide migration path for existing agents

**Workarounds** (Until Fixed):
- Ensure database is encrypted at rest
- Implement strict database access controls
- Enable audit logging for database queries
- Use network segmentation for database access
- Rotate keys regularly

**Migration Complexity**: HIGH - Breaks existing agents

---

### CRITICAL-002: WebSocket Authentication Bypass
**Status**: ⚠️ PARTIALLY FIXED (Documented, Not Implemented)
**Location**: `src/lib/websocket/websocket-service.ts:146`
**CVSS Score**: 8.6 (Critical)

**Description**:
WebSocket clients can specify any `userId` during authentication without validation. This allows any client to impersonate any user and receive their real-time updates, logs, and alerts.

**Impact**:
- Unauthorized access to user's backup progress and logs
- Ability to receive sensitive backup notifications
- Potential information disclosure about backup schedules and data
- Agent disconnection/reconnection events visible to wrong users

**Current Implementation**:
```typescript
// SECURITY WARNING: Not validating userId against session
private authenticateClient(ws: WebSocket, data: { userId: string }) {
  client.userId = data.userId; // Trusts client-provided userId!
  client.authenticated = true;
}
```

**Recommended Fix**:
1. Validate JWT session token during WebSocket upgrade
2. Extract userId from verified session, not from client message
3. Implement proper session validation using NextAuth

**Example Secure Implementation**:
```typescript
// In server.js - during WebSocket upgrade
wss.on('upgrade', async (request, socket, head) => {
  const session = await getSessionFromCookies(request);
  if (!session) {
    socket.destroy();
    return;
  }
  // Pass verified userId to WebSocket service
  wss.handleUpgrade(request, socket, head, (ws) => {
    wsService.addClient(ws, session.user.id);
  });
});
```

**Workarounds** (Current):
- Audit logging added for all authentication attempts
- Security warnings added to code
- Document requirement for network security

**Migration Complexity**: MEDIUM - Requires integration with NextAuth session validation

---

## High Priority Issues

### HIGH-001: Hardcoded Encryption Key Fallback
**Status**: ✅ FIXED
**Location**: `src/lib/backup/backup-executor.ts:211`

**Description**:
The backup encryption function fell back to a hardcoded default key (`'default-key-change-me'`) if the environment variable was not set. This created a serious risk of data being encrypted with a known, weak key.

**Fix Applied**:
```typescript
// Before:
const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || 'default-key-change-me';

// After:
const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
if (!encryptionKey) {
  throw new Error('Encryption enabled but BACKUP_ENCRYPTION_KEY not set');
}
```

**Verification**: Now fails fast if encryption is enabled but key not configured.

---

## Medium Priority Issues

### MEDIUM-001: Weak Password Requirements
**Status**: ✅ FIXED
**Location**: `src/lib/auth/auth-service.ts`, API routes

**Description**:
Password requirements were too weak (minimum 8 characters, no complexity requirements), making accounts vulnerable to brute force attacks.

**Fix Applied**:
- **Old**: Minimum 8 characters
- **New**: Minimum 12 characters + complexity requirements
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number

**Implementation**:
```typescript
// Server-side validation
if (data.password.length < 12) {
  throw new Error('Password must be at least 12 characters long');
}

const hasUpperCase = /[A-Z]/.test(data.password);
const hasLowerCase = /[a-z]/.test(data.password);
const hasNumber = /[0-9]/.test(data.password);

if (!hasUpperCase || !hasLowerCase || !hasNumber) {
  throw new Error('Password must contain uppercase, lowercase, and numbers');
}
```

**Applied To**:
- User registration (`/api/auth/register`)
- Password change (`/api/user/change-password`)
- Both Zod schemas and service layer

---

## Security Strengths Identified

### ✅ Strong Areas

1. **Authentication & Authorization**
   - Proper session management with NextAuth
   - Bcrypt password hashing with appropriate salt rounds (10)
   - Middleware protection for sensitive routes
   - Role-based access control (admin vs user)

2. **API Security**
   - All user-facing APIs verify user ownership
   - Proper use of Prisma prevents SQL injection
   - Input validation with Zod schemas
   - Agent authentication via API keys

3. **S3 Security**
   - Pre-signed URLs with 1-hour expiration
   - Per-user S3 path isolation: `users/{userId}/agents/{agentId}/...`
   - Agent authorization verified before URL generation
   - Metadata tagging for audit trails

4. **Data Isolation**
   - All queries filter by userId
   - Cascade deletes configured properly
   - Agent configs verified against agent ownership
   - No horizontal privilege escalation found

---

## Recommendations

### Immediate Actions (Before Production)

1. **Fix CRITICAL-002 (WebSocket Auth)**
   - Priority: CRITICAL
   - Effort: 4-6 hours
   - Implement proper session validation in WebSocket server

2. **Plan CRITICAL-001 Migration (API Keys)**
   - Priority: HIGH
   - Effort: 8-12 hours + testing
   - Design migration strategy
   - Create agent update mechanism
   - Test rollout plan

### Short-term (Within 1 Month)

3. **Add Rate Limiting**
   - Protect against brute force on login
   - Limit API key authentication attempts
   - Suggested: 5 attempts per minute per IP

4. **Implement Audit Logging**
   - Log all authentication attempts
   - Log admin actions
   - Log backup operations
   - Retention: 90 days minimum

5. **Add Security Headers**
   - Content Security Policy (CSP)
   - Strict Transport Security (HSTS)
   - Already have: X-Frame-Options, X-Content-Type-Options

### Medium-term (1-3 Months)

6. **Penetration Testing**
   - Third-party security assessment
   - Automated vulnerability scanning
   - Code review for OWASP Top 10

7. **Secrets Management**
   - Move to proper secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Implement secret rotation
   - Remove secrets from environment variables

8. **Database Security**
   - Enable encryption at rest
   - Implement connection pooling
   - Add query logging for sensitive operations
   - Regular backup testing

---

## Testing Recommendations

### Security Testing Checklist

- [ ] Authentication bypass attempts
- [ ] Authorization checks for all endpoints
- [ ] SQL injection testing (via Prisma)
- [ ] XSS testing on user inputs
- [ ] CSRF protection verification
- [ ] Session fixation testing
- [ ] Password reset flow security
- [ ] File upload validation
- [ ] API rate limiting
- [ ] WebSocket security
- [ ] S3 access control testing

### Automated Security Tools

Recommend integrating:
- **Snyk** or **Dependabot** for dependency scanning
- **OWASP ZAP** for dynamic application security testing
- **SonarQube** for static code analysis
- **npm audit** in CI/CD pipeline

---

## Compliance Considerations

### Data Protection
- **GDPR**: User data deletion implemented (soft delete)
- **Data Retention**: Configure backup retention policies
- **Encryption**: In-transit (HTTPS), at-rest recommended

### Access Control
- **Principle of Least Privilege**: Implemented
- **Role-Based Access**: Admin/User roles functional
- **Audit Trail**: Partial (needs enhancement)

---

## Conclusion

BackApp has a solid security foundation with proper authentication, authorization, and data isolation. However, two critical vulnerabilities must be addressed before production deployment:

1. **WebSocket authentication bypass** - can be exploited immediately
2. **Plaintext API key storage** - requires database encryption and access controls as mitigation

The fixes applied in this audit (encryption key, password strength) significantly improve security posture. With the recommended immediate actions implemented, BackApp will be ready for production deployment with appropriate security controls.

**Risk Assessment**: After implementing WebSocket auth fix and database encryption, risk level: **ACCEPTABLE FOR PRODUCTION**

---

## Appendix A: Security Testing Commands

### Test Password Requirements
```bash
# Should fail - too short
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test","password":"Short1"}'

# Should fail - no uppercase
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test","password":"lowercase123"}'

# Should succeed
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test","password":"SecurePass123"}'
```

### Test Encryption Requirement
```bash
# Set backup with encryption but no BACKUP_ENCRYPTION_KEY env var
# Should fail with: "Encryption enabled but BACKUP_ENCRYPTION_KEY not set"
```

---

## Appendix B: Environment Variables Checklist

Required for secure production deployment:

```bash
# Authentication
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-production-domain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/db
# Ensure database uses SSL in production

# S3 / Storage
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_S3_BUCKET=<bucket>
AWS_REGION=<region>

# Encryption
BACKUP_ENCRYPTION_KEY=<generate-with-openssl-rand-base64-32>

# SMTP (if email notifications enabled)
SMTP_HOST=<host>
SMTP_PORT=<port>
SMTP_USER=<user>
SMTP_PASSWORD=<password>
SMTP_FROM=<from-address>
SMTP_SECURE=true  # Use TLS in production
```

---

**Report Version**: 1.0
**Next Review**: After CRITICAL issues resolved
**Contact**: Document security findings via GitHub Issues
