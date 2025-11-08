import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgentAuth, updateAgentLastSeen } from '@/lib/agent/agent-auth';
import { prisma } from '@/lib/db/prisma';

const completeBackupSchema = z.object({
  logId: z.string().uuid('Invalid log ID'),
  status: z.enum(['completed', 'failed'], {
    errorMap: () => ({ message: 'Status must be either "completed" or "failed"' }),
  }),
  filesProcessed: z.number().int().nonnegative().optional().default(0),
  bytesTransferred: z.number().int().nonnegative().optional().default(0),
  duration: z.number().int().nonnegative().optional(),
  errors: z.array(z.any()).optional(),
});

/**
 * POST /api/agent/backup/complete
 * Agent reports backup completion (success or failure)
 * Updates backup log with final results
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate agent
    const { error, agent } = await requireAgentAuth(request);
    if (error || !agent) {
      return error;
    }

    // Update agent heartbeat
    await updateAgentLastSeen(agent.id);

    // Parse and validate request body
    const body = await request.json();
    const validationResult = completeBackupSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const { logId, status, filesProcessed, bytesTransferred, duration, errors } = validationResult.data;

    // Verify log exists and belongs to a config assigned to this agent
    const log = await prisma.backupLog.findFirst({
      where: {
        id: logId,
      },
      include: {
        config: {
          select: {
            agentId: true,
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

    if (log.config.agentId !== agent.id) {
      return NextResponse.json(
        { success: false, error: 'This backup log does not belong to your agent' },
        { status: 403 }
      );
    }

    const now = new Date();

    // Update backup log and config's lastRunAt in a transaction
    await prisma.$transaction([
      prisma.backupLog.update({
        where: { id: logId },
        data: {
          endTime: now,
          status,
          filesProcessed,
          bytesTransferred: BigInt(bytesTransferred),
          duration,
          errors: errors && errors.length > 0 ? (errors as any) : null,
        },
      }),
      // Update the backup config's lastRunAt timestamp
      prisma.backupConfig.update({
        where: { id: log.configId },
        data: {
          lastRunAt: now,
        },
      }),
    ]);

    // If backup failed, create alert
    if (status === 'failed') {
      await prisma.alert.create({
        data: {
          userId: log.userId,
          configId: log.configId,
          type: 'error',
          message: `Agent backup failed: ${errors && errors.length > 0 ? errors[0] : 'Unknown error'}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Backup ${status} successfully`,
    });
  } catch (error) {
    console.error('[API] Failed to complete backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete backup';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
