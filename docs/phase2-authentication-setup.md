# Phase 2: Authentication - Setup Guide

## Overview

Phase 2 implements the complete authentication system for BackApp, including user registration, login, session management, protected routes, and user profile management.

## What's Included

### 1. Authentication Infrastructure

- **NextAuth.js v5**: Modern authentication framework with credentials provider
- **Password Hashing**: Secure bcrypt hashing with configurable salt rounds
- **JWT Sessions**: Stateless session management with 30-day expiration
- **Middleware Protection**: Automatic route protection for authenticated pages

### 2. API Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth endpoints (login, logout, session)
- `GET /api/user/profile` - Get current user profile
- `PATCH /api/user/profile` - Update user profile
- `POST /api/user/change-password` - Change password

### 3. UI Pages

- `/login` - User login page
- `/register` - User registration page
- `/dashboard` - Protected dashboard (requires authentication)
- `/settings/profile` - User profile management

### 4. Components

- `LoginForm` - Login form component
- `RegisterForm` - Registration form component
- `ProfileForm` - Profile update form
- `ChangePasswordForm` - Password change form
- Reusable UI components: Button, Input, Card, Label

## Setup Instructions

### Prerequisites

1. PostgreSQL database running (via Docker Compose)
2. Environment variables configured in `.env` file

### Environment Variables

Create a `.env` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://backapp:backapp@localhost:5432/backapp_db?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here-generate-with-openssl-rand-base64-32"

# Node Environment
NODE_ENV="development"
```

### Database Setup

1. **Start PostgreSQL via Docker Compose**:
   ```bash
   docker-compose up -d postgres
   ```

2. **Generate Prisma Client**:
   ```bash
   npm run db:generate
   # or
   npx prisma generate
   ```

3. **Run Database Migrations**:
   ```bash
   npm run db:migrate
   # or
   npx prisma migrate deploy
   ```

4. **Verify Database Schema**:
   ```bash
   npx prisma studio
   ```

### Running the Application

1. **Install Dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```

3. **Access the Application**:
   - Landing page: http://localhost:3000
   - Login: http://localhost:3000/login
   - Register: http://localhost:3000/register

## Testing

### Unit Tests

Run authentication service tests:
```bash
npm run test:unit src/lib/auth/__tests__/auth-service.test.ts
```

### Manual Testing Flow

1. **Register a New User**:
   - Navigate to `/register`
   - Enter name, email, and password (min 8 characters)
   - Submit form
   - Should redirect to `/login` with success message

2. **Login**:
   - Navigate to `/login`
   - Enter email and password
   - Submit form
   - Should redirect to `/dashboard`

3. **Protected Routes**:
   - Try accessing `/dashboard` without logging in
   - Should redirect to `/login`
   - After login, should access dashboard successfully

4. **Profile Management**:
   - Navigate to `/settings/profile`
   - Update name or email
   - Change password
   - Verify changes are saved

5. **Logout**:
   - Click "Sign Out" in navigation
   - Should redirect to `/login`
   - Protected routes should no longer be accessible

## Security Features

### Implemented Security Measures

1. **Password Security**:
   - Minimum 8 characters requirement
   - Bcrypt hashing with 10 salt rounds
   - Password confirmation on registration and change

2. **Session Security**:
   - JWT-based sessions
   - 30-day expiration
   - Secure httpOnly cookies
   - Automatic session refresh

3. **Route Protection**:
   - Middleware-based authentication check
   - Automatic redirect to login for protected routes
   - Callback URL support for post-login redirect

4. **Security Headers**:
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: 1; mode=block
   - Referrer-Policy: strict-origin-when-cross-origin

5. **Input Validation**:
   - Zod schema validation on API endpoints
   - Client-side form validation
   - Email format validation
   - SQL injection prevention via Prisma

## Architecture

### Authentication Flow

```
User Registration:
1. User submits registration form
2. Client sends POST to /api/auth/register
3. Server validates input (Zod)
4. Server checks if email exists
5. Server hashes password (bcrypt)
6. Server creates user in database
7. Client redirects to login

User Login:
1. User submits login form
2. Client calls signIn from next-auth/react
3. NextAuth validates credentials
4. AuthService checks email/password
5. If valid, creates JWT session
6. Client redirects to dashboard

Protected Route Access:
1. User navigates to protected route
2. Middleware checks session
3. If no session, redirect to login
4. If session exists, allow access
```

### Database Schema

```sql
users:
- id (UUID, primary key)
- email (unique, indexed)
- name
- password_hash
- role (default: 'user')
- created_at
- updated_at

(Other tables: backup_configs, backup_logs, alerts)
```

## Troubleshooting

### Common Issues

1. **"Cannot connect to database"**:
   - Ensure PostgreSQL container is running: `docker-compose ps`
   - Check DATABASE_URL in `.env`
   - Verify PostgreSQL is accessible: `psql $DATABASE_URL`

2. **"Invalid credentials" on login**:
   - Ensure user was created successfully
   - Check password meets minimum requirements
   - Verify bcrypt is installed: `npm list bcrypt`

3. **"Unauthorized" on protected routes**:
   - Check NEXTAUTH_SECRET is set in `.env`
   - Clear cookies and try logging in again
   - Verify session in browser DevTools

4. **Prisma client errors**:
   - Run `npx prisma generate`
   - Ensure migrations are up to date
   - Check database connection

## Next Steps

With Phase 2 complete, you can proceed to:

- **Phase 3**: S3 Adapter implementation
- **Phase 4**: Sync Configuration
- **Phase 5**: Monitoring & Reporting

## Files Created in Phase 2

### Authentication Core
- `src/lib/auth/auth.ts`
- `src/lib/auth/auth.config.ts`
- `src/lib/auth/auth-service.ts`
- `src/types/next-auth.d.ts`

### API Routes
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/api/user/profile/route.ts`
- `src/app/api/user/change-password/route.ts`

### Pages
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/(app)/settings/profile/page.tsx`
- `src/app/(app)/layout.tsx`

### Components
- `src/components/auth/login-form.tsx`
- `src/components/auth/register-form.tsx`
- `src/components/settings/profile-form.tsx`
- `src/components/settings/change-password-form.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/label.tsx`

### Tests
- `src/lib/auth/__tests__/auth-service.test.ts`

### Database
- `prisma/migrations/20250105000000_init/migration.sql`

### Middleware
- `src/middleware.ts` (updated)

## Support

For issues or questions:
- Check the main README.md
- Review the ARCHITECTURE_PLAN.md
- Consult NextAuth.js documentation: https://next-auth.js.org/
