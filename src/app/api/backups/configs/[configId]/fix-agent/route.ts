import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getBackupConfigCleanupService } from '@/lib/backup/backup-config-cleanup.service';

/**
 * POST /api/backups/configs/[configId]/fix-agent
 * Fix orphaned agent reference for a specific config
 * Sets agentId to null and executionMode to 'server'
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cleanupService = getBackupConfigCleanupService();
    const fixed = await cleanupService.fixConfigAgentReference(
      params.configId,
      session.user.id
    );

    if (!fixed) {
      return NextResponse.json({
        success: false,
        message: 'Configuration does not have an orphaned agent reference or was not found',
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated to server-side execution mode',
    });
  } catch (error) {
    console.error('[API] Failed to fix config agent reference:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fix config';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
