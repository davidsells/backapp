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

const backupOptionsSchema = z.object({
  type: z.enum(['full', 'incremental']),
  compression: z.boolean(),
  compressionLevel: z.number().min(1).max(9).optional(),
  encryption: z.boolean(),
  retentionDays: z.number().min(1).optional(),
  bandwidth: z.number().optional(),
});

const createConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean().optional(),
  executionMode: z.enum(['agent', 'server']).default('agent'),
  agentId: z.string().optional().nullable(),
  sources: z.array(backupSourceSchema).min(1, 'At least one source is required'),
  destination: s3DestinationSchema,
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

    const backupService = getBackupService();
    const configs = await backupService.listConfigs(session.user.id);

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

    const backupService = getBackupService();
    const config = await backupService.createConfig({
      userId: session.user.id,
      ...data,
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
