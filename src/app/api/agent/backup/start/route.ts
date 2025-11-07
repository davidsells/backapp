import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgentAuth, updateAgentLastSeen } from '@/lib/agent/agent-auth';
import { getS3PresignedUrlService } from '@/lib/agent/s3-presigned-url.service';
import { prisma } from '@/lib/db/prisma';

const startBackupSchema = z.object({
  configId: z.string().uuid('Invalid config ID'),
  filename: z.string().min(1, 'Filename is required'),
  filesize: z.number().optional(),
});

/**
 * POST /api/agent/backup/start
 * Agent reports backup started and requests pre-signed URL for upload
 * Returns: logId, pre-signed URL, s3Path
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
    const validationResult = startBackupSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const { configId, filename } = validationResult.data;

    // Verify config belongs to this agent
    const config = await prisma.backupConfig.findFirst({
      where: {
        id: configId,
        agentId: agent.id,
        executionMode: 'agent',
      },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Configuration not found or not assigned to this agent' },
        { status: 404 }
      );
    }

    // Create backup log entry
    const log = await prisma.backupLog.create({
      data: {
        configId: config.id,
        userId: config.userId,
        startTime: new Date(),
        status: 'running',
      },
    });

    // Generate pre-signed URL for S3 upload
    const s3Service = getS3PresignedUrlService();
    const presignedUrl = await s3Service.generateUploadUrl({
      userId: config.userId,
      agentId: agent.id,
      configId: config.id,
      filename,
    });

    // Update log with S3 path
    await prisma.backupLog.update({
      where: { id: log.id },
      data: { s3Path: presignedUrl.s3Path },
    });

    return NextResponse.json({
      success: true,
      logId: log.id,
      upload: {
        url: presignedUrl.url,
        method: presignedUrl.method,
        s3Path: presignedUrl.s3Path,
        expiresAt: presignedUrl.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[API] Failed to start backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start backup';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
