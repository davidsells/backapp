import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getBackupService } from '@/lib/backup/backup-service';

/**
 * GET /api/backups/stats - Get backup statistics
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backupService = getBackupService();
    const stats = await backupService.getStats(session.user.id);

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Failed to get backup stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get backup statistics' },
      { status: 500 }
    );
  }
}
