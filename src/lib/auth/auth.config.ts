import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { authService } from './auth-service';
import { baseAuthConfig } from './base-auth.config';

/**
 * Full auth configuration with providers
 * This is used in API routes where Node.js APIs are available
 */
export const authConfig: NextAuthConfig = {
  ...baseAuthConfig,
  trustHost: true, // Trust the host from NEXTAUTH_URL
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await authService.validateCredentials(
          credentials.email as string,
          credentials.password as string
        );

        return user;
      },
    }),
  ],
};
