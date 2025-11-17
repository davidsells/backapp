import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getBackupConfigCleanupService } from '@/lib/backup/backup-config-cleanup.service';

/**
 * GET /api/backups/configs/cleanup
 * Get count of configs with orphaned agent references
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cleanupService = getBackupConfigCleanupService();
    const count = await cleanupService.getOrphanedConfigCount(session.user.id);

    return NextResponse.json({
      success: true,
      orphanedCount: count,
    });
  } catch (error) {
    console.error('[API] Failed to get orphaned config count:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get count';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/backups/configs/cleanup
 * Fix all orphaned agent references for the current user
 * Sets agentId to null and executionMode to 'server' for affected configs
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cleanupService = getBackupConfigCleanupService();
    const result = await cleanupService.fixOrphanedAgentReferences(session.user.id);

    return NextResponse.json({
      success: true,
      message: `Fixed ${result.fixed} configuration(s) with orphaned agent references`,
      fixed: result.fixed,
      configs: result.configs,
    });
  } catch (error) {
    console.error('[API] Failed to fix orphaned agent references:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fix configs';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
