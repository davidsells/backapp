import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { getBackupService } from '@/lib/backup/backup-service';

const backupSourceSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  excludePatterns: z.array(z.string()).optional(),
  includePatterns: z.array(z.string()).optional(),
});

const s3DestinationSchema = z.object({
  bucket: z.string().min(1, 'Bucket name is required'),
  region: z.string().min(1, 'Region is required'),
  prefix: z.string().optional(),
  endpoint: z.string().optional(),
});

const scheduleSchema = z.object({
  cronExpression: z.string().min(1, 'Cron expression is required'),
  timezone: z.string().min(1, 'Timezone is required'),
});

const rsyncOptionsSchema = z.object({
  localReplica: z.string().min(1, 'Local replica path is required'),
  delete: z.boolean().optional(),
  uploadToS3: z.boolean().optional().default(true), // Default to true for backward compatibility
  storageClass: z.enum(['STANDARD', 'STANDARD_IA', 'GLACIER', 'DEEP_ARCHIVE']).optional(),
});

const rcloneOptionsSchema = z.object({
  remoteType: z.enum(['s3', 'wasabi', 'b2', 'gcs', 'azure']).default('s3'),
  delete: z.boolean().optional(),
  storageClass: z.enum(['STANDARD', 'STANDARD_IA', 'GLACIER', 'DEEP_ARCHIVE']).optional(),
  bandwidth: z.number().optional(),
  checksumVerification: z.boolean().optional().default(true),
});

const backupOptionsSchema = z.object({
  method: z.enum(['archive', 'rsync', 'rclone']).optional().default('archive'),
  type: z.enum(['full', 'incremental']),
  compression: z.boolean(),
  compressionLevel: z.number().min(1).max(9).optional(),
  encryption: z.boolean(),
  retentionDays: z.number().min(1).optional(),
  bandwidth: z.number().optional(),
  rsync: rsyncOptionsSchema.optional(),
  rclone: rcloneOptionsSchema.optional(),
});

const createConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean().optional(),
  executionMode: z.enum(['agent', 'server']).default('agent'),
  agentId: z.string().optional().nullable(),
  sources: z.array(backupSourceSchema).min(1, 'At least one source is required'),
  destination: s3DestinationSchema.optional(), // Optional for agent-based backups
  schedule: scheduleSchema.optional(), // Optional for manual-only backups
  options: backupOptionsSchema,
});

/**
 * GET /api/backups/configs - List all backup configurations
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch configs with agent data from Prisma directly
    const { prisma } = await import('@/lib/db/prisma');
    const configsWithAgents = await prisma.backupConfig.findMany({
      where: { userId: session.user.id },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            status: true,
            platform: true,
            lastSeen: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Debug logging for agent not found issue
    configsWithAgents.forEach((config: any) => {
      if (config.executionMode === 'agent' && config.agentId && !config.agent) {
        console.warn(`[API] Config "${config.name}" (${config.id}) references non-existent agent: ${config.agentId}`);
      }
    });

    return NextResponse.json({ success: true, configs: configsWithAgents });
  } catch (error) {
    console.error('Failed to list backup configs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list backup configurations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backups/configs - Create a new backup configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = createConfigSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const data = validationResult.data;

    // Mode-specific validation
    if (data.executionMode === 'agent') {
      if (!data.agentId) {
        return NextResponse.json(
          { success: false, error: 'Agent ID is required for agent-based backups' },
          { status: 400 }
        );
      }

      // Verify agent exists and belongs to user
      const { prisma } = await import('@/lib/db/prisma');
      const agent = await prisma.agent.findUnique({
        where: { id: data.agentId },
      });

      if (!agent) {
        return NextResponse.json(
          { success: false, error: 'Agent not found' },
          { status: 404 }
        );
      }

      if (agent.userId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Agent does not belong to user' },
          { status: 403 }
        );
      }
    }

    // Prepare S3 destination - use env vars for agent-based backups
    let destination: { bucket: string; region: string; prefix?: string; endpoint?: string };

    if (data.executionMode === 'agent') {
      // For agent-based backups, use application S3 configuration from environment
      const bucket = process.env.AWS_S3_BUCKET || process.env.DEFAULT_S3_BUCKET || '';

      if (!bucket) {
        return NextResponse.json(
          { success: false, error: 'S3 bucket not configured. Please set AWS_S3_BUCKET in environment variables.' },
          { status: 500 }
        );
      }

      destination = {
        bucket,
        region: process.env.AWS_REGION || process.env.DEFAULT_S3_REGION || 'us-east-1',
        prefix: data.destination?.prefix || `backups/${session.user.id}/`,
        endpoint: process.env.AWS_ENDPOINT || process.env.DEFAULT_S3_ENDPOINT,
      };
    } else if (data.executionMode === 'server') {
      // For server-side, require destination to be provided
      if (!data.destination || !data.destination.bucket || !data.destination.region) {
        return NextResponse.json(
          { success: false, error: 'S3 bucket and region are required for server-side backups' },
          { status: 400 }
        );
      }
      destination = data.destination;
    } else {
      // This should never happen due to Zod validation, but TypeScript needs it
      return NextResponse.json(
        { success: false, error: 'Invalid execution mode' },
        { status: 400 }
      );
    }

    const backupService = getBackupService();
    const config = await backupService.createConfig({
      userId: session.user.id,
      ...data,
      destination,
    });

    return NextResponse.json({ success: true, config }, { status: 201 });
  } catch (error) {
    console.error('Failed to create backup config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create backup configuration';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/backups/configs - Delete a backup configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const configId = searchParams.get('id');

    if (!configId) {
      return NextResponse.json(
        { success: false, error: 'Configuration ID is required' },
        { status: 400 }
      );
    }

    const backupService = getBackupService();

    // Verify config exists and belongs to user before deleting
    const config = await backupService.getConfig(configId, session.user.id);
    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Configuration not found' },
        { status: 404 }
      );
    }

    await backupService.deleteConfig(configId, session.user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Failed to delete backup config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete backup configuration';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
