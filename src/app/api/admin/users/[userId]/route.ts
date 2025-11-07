import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminApi } from '@/lib/admin/admin-auth';
import { getUserManagementService } from '@/lib/admin/user-management-service';

const updateRoleSchema = z.object({
  role: z.enum(['user', 'admin']),
});

const actionSchema = z.object({
  action: z.enum(['reject', 'restore']),
});

/**
 * DELETE /api/admin/users/[userId] - Soft delete a user
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  try {
    // Prevent admin from deleting themselves
    if (session.user.id === params.userId) {
      return NextResponse.json(
        { success: false, error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    const userManagementService = getUserManagementService();
    const user = await userManagementService.softDeleteUser(params.userId);

    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error('Failed to delete user:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users/[userId] - Update user (reject, restore, role)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { error, session } = await requireAdminApi();
  if (error) return error;

  try {
    const body = await request.json();
    const userManagementService = getUserManagementService();

    // Check if it's a role update
    const roleValidation = updateRoleSchema.safeParse(body);
    if (roleValidation.success) {
      // Prevent admin from changing their own role
      if (session.user.id === params.userId) {
        return NextResponse.json(
          { success: false, error: 'You cannot change your own role' },
          { status: 400 }
        );
      }

      const user = await userManagementService.updateUserRole(
        params.userId,
        roleValidation.data.role
      );
      return NextResponse.json({ success: true, user });
    }

    // Check if it's an action (reject/restore)
    const actionValidation = actionSchema.safeParse(body);
    if (actionValidation.success) {
      if (actionValidation.data.action === 'reject') {
        await userManagementService.rejectUser(params.userId);
        return NextResponse.json({ success: true });
      } else if (actionValidation.data.action === 'restore') {
        const user = await userManagementService.restoreUser(params.userId);
        return NextResponse.json({ success: true, user });
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  } catch (err) {
    console.error('Failed to update user:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
