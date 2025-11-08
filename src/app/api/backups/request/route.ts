import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

const requestSchema = z.object({
  configId: z.string().uuid('Invalid config ID'),
});

/**
 * POST /api/backups/request
 * User-authenticated endpoint to request immediate backup execution
 *
 * For agent-based backups: Sets requestedAt timestamp, agent picks it up on next poll
 * For server-side backups: Triggers immediate execution (like execute endpoint)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = requestSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const { configId } = validationResult.data;

    // Fetch config and verify ownership
    const config = await prisma.backupConfig.findFirst({
      where: {
        id: configId,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        executionMode: true,
        enabled: true,
        agentId: true,
        agent: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Configuration not found' },
        { status: 404 }
      );
    }

    if (!config.enabled) {
      return NextResponse.json(
        { success: false, error: 'Configuration is disabled' },
        { status: 400 }
      );
    }

    // Handle based on execution mode
    if (config.executionMode === 'agent') {
      // For agent-based: Create BackupLog with "requested" status and set requestedAt
      const now = new Date();

      const backupLog = await prisma.backupLog.create({
        data: {
          configId,
          userId: session.user.id,
          startTime: now,
          status: 'requested', // New status to track requests
          filesProcessed: 0,
          filesSkipped: 0,
          totalBytes: BigInt(0),
          bytesTransferred: BigInt(0),
        },
      });

      // Set requestedAt so agent picks it up
      await prisma.backupConfig.update({
        where: { id: configId },
        data: { requestedAt: now },
      });

      return NextResponse.json({
        success: true,
        message: 'Backup requested. Agent will execute within 10 minutes.',
        executionMode: 'agent',
        estimatedDelay: '10 minutes',
        logId: backupLog.id, // Return logId for UI to poll
      });
    } else {
      // For server-side: Trigger immediate execution
      // Use existing backup executor
      const { getBackupExecutor } = await import('@/lib/backup/backup-executor');
      const backupExecutor = getBackupExecutor();

      // Execute backup asynchronously
      backupExecutor
        .executeBackup({
          configId,
          userId: session.user.id,
        })
        .catch((error) => {
          console.error('Server-side backup execution failed:', error);
        });

      return NextResponse.json({
        success: true,
        message: 'Backup started',
        executionMode: 'server',
      });
    }
  } catch (error) {
    console.error('Failed to request backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to request backup';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
