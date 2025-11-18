import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getBackupService } from '@/lib/backup/backup-service';

/**
 * GET /api/backups/logs - Get backup logs
 * Query params: configId (optional), limit (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('configId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const backupService = getBackupService();

    let logs;
    if (configId) {
      logs = await backupService.getConfigLogs(configId, session.user.id, limit);
    } else {
      logs = await backupService.getRecentLogs(session.user.id, limit);
    }

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Failed to get backup logs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get backup logs' },
      { status: 500 }
    );
  }
}
