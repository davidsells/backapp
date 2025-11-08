import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/backups/status/:logId
 * Poll backup status by logId
 * Returns current status, progress, and timing information
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { logId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { logId } = params;

    // Fetch backup log with config info
    const log = await prisma.backupLog.findFirst({
      where: {
        id: logId,
        userId: session.user.id, // Ensure user owns this log
      },
      include: {
        config: {
          select: {
            name: true,
            executionMode: true,
          },
        },
      },
    });

    if (!log) {
      return NextResponse.json(
        { success: false, error: 'Backup log not found' },
        { status: 404 }
      );
    }

    // Calculate elapsed time
    const now = new Date();
    const elapsedMs = now.getTime() - log.startTime.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    // Determine if timed out (20 minutes for agent-based)
    const timeoutMs = log.config.executionMode === 'agent' ? 20 * 60 * 1000 : 30 * 60 * 1000;
    const timedOut = elapsedMs > timeoutMs && log.status === 'requested';

    return NextResponse.json({
      success: true,
      log: {
        id: log.id,
        configName: log.config.name,
        status: timedOut ? 'timeout' : log.status,
        startTime: log.startTime,
        endTime: log.endTime,
        filesProcessed: log.filesProcessed,
        bytesTransferred: Number(log.bytesTransferred),
        duration: log.duration,
        errors: log.errors,
        elapsedSeconds,
        timedOut,
      },
    });
  } catch (error) {
    console.error('[API] Failed to get backup status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get status';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
