import type { NextAuthConfig } from 'next-auth';

/**
 * Base auth configuration that can be used in middleware (Edge Runtime)
 * This doesn't include providers that require Node.js APIs
 */
export const baseAuthConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    signOut: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnConfigs = nextUrl.pathname.startsWith('/configs');
      const isOnBackups = nextUrl.pathname.startsWith('/backups');
      const isOnReports = nextUrl.pathname.startsWith('/reports');
      const isOnSettings = nextUrl.pathname.startsWith('/settings');
      const isOnAlerts = nextUrl.pathname.startsWith('/alerts');

      const isOnProtectedRoute =
        isOnDashboard ||
        isOnConfigs ||
        isOnBackups ||
        isOnReports ||
        isOnSettings ||
        isOnAlerts;

      if (isOnProtectedRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn) {
        const isOnAuthPage =
          nextUrl.pathname === '/login' || nextUrl.pathname === '/register';
        if (isOnAuthPage) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
      }
      return true;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [], // Providers will be added in the full config
};
