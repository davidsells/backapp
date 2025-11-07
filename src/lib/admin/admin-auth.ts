import { auth } from '../auth/auth';
import { NextResponse } from 'next/server';

/**
 * Check if the current user is an admin
 * Returns the session if admin, otherwise returns null
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  if (session.user.role !== 'admin') {
    return null;
  }

  return session;
}

/**
 * API handler helper to require admin access
 * Returns error response if not admin, otherwise returns session
 */
export async function requireAdminApi() {
  const session = await requireAdmin();

  if (!session) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      ),
      session: null,
    };
  }

  return { error: null, session };
}
