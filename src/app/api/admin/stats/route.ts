import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin/admin-auth';
import { getUserManagementService } from '@/lib/admin/user-management-service';

/**
 * GET /api/admin/stats - Get admin dashboard statistics
 */
export async function GET() {
  const { error } = await requireAdminApi();
  if (error) return error;

  try {
    const userManagementService = getUserManagementService();
    const stats = await userManagementService.getUserStats();

    return NextResponse.json({ success: true, stats });
  } catch (err) {
    console.error('Failed to get stats:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to get statistics' },
      { status: 500 }
    );
  }
}
