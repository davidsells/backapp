import { auth } from '@/lib/auth';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Define protected and auth routes
  const isAuthPage =
    nextUrl.pathname.startsWith('/login') ||
    nextUrl.pathname.startsWith('/register');

  const isProtectedPage =
    nextUrl.pathname.startsWith('/dashboard') ||
    nextUrl.pathname.startsWith('/configs') ||
    nextUrl.pathname.startsWith('/backups') ||
    nextUrl.pathname.startsWith('/reports') ||
    nextUrl.pathname.startsWith('/settings') ||
    nextUrl.pathname.startsWith('/alerts');

  // Redirect to dashboard if logged in and on auth page
  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL('/dashboard', nextUrl));
  }

  // Redirect to login if not logged in and on protected page
  if (!isLoggedIn && isProtectedPage) {
    return Response.redirect(new URL('/login', nextUrl));
  }

  return;
});

// Configure which routes to run middleware on
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
