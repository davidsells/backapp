import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/admin-auth';
import { getUserManagementService } from '@/lib/admin/user-management-service';

/**
 * GET /api/admin/users/pending - Get pending users awaiting approval
 */
export async function GET() {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  try {
    const userManagementService = getUserManagementService();
    const users = await userManagementService.getPendingUsers();

    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error('Failed to get pending users:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to get pending users' },
      { status: 500 }
    );
  }
}
