import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getBackupVerificationService } from '@/lib/backup/backup-verification.service';

/**
 * GET /api/backups/requests
 * Get status of pending backup requests
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verificationService = getBackupVerificationService();
    const status = await verificationService.getBackupRequestStatus(session.user.id);

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[API] Failed to get backup request status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get request status';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/backups/requests
 * Timeout stale backup requests
 * Query params:
 *   - timeoutMinutes: number (default: 30)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeoutMinutes = parseInt(searchParams.get('timeoutMinutes') || '30', 10);

    if (timeoutMinutes < 1 || timeoutMinutes > 1440) {
      return NextResponse.json(
        { success: false, error: 'timeoutMinutes must be between 1 and 1440' },
        { status: 400 }
      );
    }

    const verificationService = getBackupVerificationService();
    const result = await verificationService.timeoutStaleRequests(timeoutMinutes);

    return NextResponse.json({
      success: true,
      message: `${result.timedOut} stale backup request(s) timed out`,
      result,
    });
  } catch (error) {
    console.error('[API] Failed to timeout stale requests:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to timeout requests';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
