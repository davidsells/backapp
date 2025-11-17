import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getBackupVerificationService } from '@/lib/backup/backup-verification.service';

/**
 * GET /api/backups/reconcile
 * Reconcile backup logs with S3 reality
 * Checks all "completed" backups to verify S3 files actually exist
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verificationService = getBackupVerificationService();
    const result = await verificationService.reconcileBackupsWithS3(session.user.id);

    return NextResponse.json({
      success: true,
      reconciliation: result,
    });
  } catch (error) {
    console.error('[API] Failed to reconcile backups:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to reconcile backups';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/backups/reconcile
 * Fix unverified backups by marking them as failed
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { logIds } = body;

    if (!logIds || !Array.isArray(logIds)) {
      return NextResponse.json(
        { success: false, error: 'logIds array is required' },
        { status: 400 }
      );
    }

    const verificationService = getBackupVerificationService();
    const updated = await verificationService.markUnverifiedBackupsAsFailed(logIds);

    return NextResponse.json({
      success: true,
      message: `${updated} backup(s) marked as failed`,
      updated,
    });
  } catch (error) {
    console.error('[API] Failed to mark backups as failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update backups';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
