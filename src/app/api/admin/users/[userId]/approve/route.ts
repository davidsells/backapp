import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/admin-auth';
import { getUserManagementService } from '@/lib/admin/user-management-service';

/**
 * PATCH /api/admin/users/[userId]/approve - Approve a user
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  try {
    const userManagementService = getUserManagementService();
    const user = await userManagementService.approveUser(params.userId);

    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error('Failed to approve user:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to approve user' },
      { status: 500 }
    );
  }
}
