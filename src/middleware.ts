import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple middleware without NextAuth - just check cookies manually
export async function middleware(request: NextRequest) {
  const { nextUrl } = request;

  // Get the session token from cookies
  const token = request.cookies.get('authjs.session-token') ||
                request.cookies.get('__Secure-authjs.session-token');

  const isLoggedIn = !!token;

  console.log('[Middleware] Path:', nextUrl.pathname, 'Has token:', isLoggedIn);

  // Define protected paths that require authentication
  const isProtectedPath =
    nextUrl.pathname.startsWith('/dashboard') ||
    nextUrl.pathname.startsWith('/configs') ||
    nextUrl.pathname.startsWith('/backups') ||
    nextUrl.pathname.startsWith('/reports') ||
    nextUrl.pathname.startsWith('/settings') ||
    nextUrl.pathname.startsWith('/alerts') ||
    nextUrl.pathname.startsWith('/admin') ||
    nextUrl.pathname.startsWith('/agents') ||
    nextUrl.pathname.startsWith('/storage');

  // Redirect to login if accessing protected route without session
  if (isProtectedPath && !isLoggedIn) {
    console.log('[Middleware] Redirecting to login - no session token');
    const loginUrl = new URL('/login', nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if (
    (nextUrl.pathname === '/login' || nextUrl.pathname === '/register') &&
    isLoggedIn
  ) {
    console.log('[Middleware] Redirecting to dashboard - has session token');
    return NextResponse.redirect(new URL('/dashboard', nextUrl.origin));
  }

  // Add security headers
  const response = NextResponse.next();

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

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
