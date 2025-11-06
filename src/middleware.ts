import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { baseAuthConfig } from '@/lib/auth/base-auth.config';

const { auth } = NextAuth(baseAuthConfig);

// Middleware function for auth and route protection
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { nextUrl } = req;

  // Define protected paths that require authentication
  const isProtectedPath =
    nextUrl.pathname.startsWith('/dashboard') ||
    nextUrl.pathname.startsWith('/configs') ||
    nextUrl.pathname.startsWith('/backups') ||
    nextUrl.pathname.startsWith('/reports') ||
    nextUrl.pathname.startsWith('/settings') ||
    nextUrl.pathname.startsWith('/alerts');

  // Redirect to login if accessing protected route without session
  if (isProtectedPath && !isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if (
    (nextUrl.pathname === '/login' || nextUrl.pathname === '/register') &&
    isLoggedIn
  ) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
  }

  // Add security headers
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
});

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
