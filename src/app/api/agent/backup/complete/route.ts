import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgentAuth, updateAgentLastSeen } from '@/lib/agent/agent-auth';
import { prisma } from '@/lib/db/prisma';
import { getAlertService } from '@/lib/alerts/alert-service';
import { getBackupVerificationService } from '@/lib/backup/backup-verification.service';

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
            name: true,
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
    let finalStatus = status;
    let finalErrors = errors && errors.length > 0 ? (errors as any) : null;

    // If agent reports success, verify the file actually exists in S3
    if (status === 'completed') {
      const verificationService = getBackupVerificationService();
      const verificationResult = await verificationService.verifyBackupLog(logId);

      if (!verificationResult.verified) {
        // File not found in S3 - mark as failed despite agent claiming success
        finalStatus = 'failed';
        const verificationError = {
          type: 'verification-failed',
          message: verificationResult.error || 'Backup file not found in S3',
          s3Path: log.s3Path,
          verifiedAt: now.toISOString(),
        };

        // Add verification error to existing errors
        if (finalErrors) {
          finalErrors = Array.isArray(finalErrors)
            ? [...finalErrors, verificationError]
            : [finalErrors, verificationError];
        } else {
          finalErrors = [verificationError];
        }

        console.warn(
          `[BackupComplete] Verification failed for log ${logId}:`,
          verificationError
        );
      } else {
        console.log(
          `[BackupComplete] S3 verification successful for log ${logId}, file: ${log.s3Path}`
        );
      }
    }

    // Update backup log and config's lastRunAt in a transaction
    await prisma.$transaction([
      prisma.backupLog.update({
        where: { id: logId },
        data: {
          endTime: now,
          status: finalStatus,
          filesProcessed,
          bytesTransferred: BigInt(bytesTransferred),
          duration,
          errors: finalErrors,
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

    // If backup failed (including verification failures), create alert using alert service
    if (finalStatus === 'failed') {
      const alertService = getAlertService();
      let errorMessage = 'Unknown error';

      if (finalErrors && Array.isArray(finalErrors) && finalErrors.length > 0) {
        const firstError = finalErrors[0];
        if (typeof firstError === 'string') {
          errorMessage = firstError;
        } else if (firstError.message) {
          errorMessage = firstError.message;
        } else {
          errorMessage = JSON.stringify(firstError);
        }
      }

      await alertService.createBackupFailureAlert(
        log.userId,
        log.configId,
        log.config.name,
        errorMessage
      );
    }

    return NextResponse.json({
      success: true,
      message: `Backup ${finalStatus} successfully`,
      verified: status === 'completed' && finalStatus === 'completed',
    });
  } catch (error) {
    console.error('[API] Failed to complete backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to complete backup';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
