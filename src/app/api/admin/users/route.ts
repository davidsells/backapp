import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/admin-auth';
import { getUserManagementService } from '@/lib/admin/user-management-service';

/**
 * GET /api/admin/users - Get all users
 * Query params: includeDeleted (optional)
 */
export async function GET(request: NextRequest) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    const userManagementService = getUserManagementService();
    const users = await userManagementService.getAllUsers(includeDeleted);

    return NextResponse.json({ success: true, users });
  } catch (err) {
    console.error('Failed to get users:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to get users' },
      { status: 500 }
    );
  }
}
