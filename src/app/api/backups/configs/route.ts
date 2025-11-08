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

// Base schema for both modes
const baseConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean().optional(),
  executionMode: z.enum(['agent', 'server'], {
    errorMap: () => ({ message: 'Execution mode must be either "agent" or "server"' }),
  }),
  sources: z.array(backupSourceSchema).min(1, 'At least one source is required'),
  schedule: scheduleSchema.optional(), // Optional for manual-only backups
  options: backupOptionsSchema,
});

// Agent-based config schema
const agentConfigSchema = baseConfigSchema.extend({
  executionMode: z.literal('agent'),
  agentId: z.string().min(1, 'Agent ID is required for agent-based backups'),
  destination: s3DestinationSchema.optional(), // Optional, will use app defaults
});

// Server-side config schema
const serverConfigSchema = baseConfigSchema.extend({
  executionMode: z.literal('server'),
  agentId: z.string().optional().nullable(),
  destination: s3DestinationSchema,
});

// Union of both schemas
const createConfigSchema = z.discriminatedUnion('executionMode', [
  agentConfigSchema,
  serverConfigSchema,
]);

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

    return NextResponse.json({ success: true, configs });
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

    // For agent-based configs, validate agent ownership
    if (data.executionMode === 'agent') {
      const { getAgentManagementService } = await import('@/lib/agent/agent-management.service');
      const agentService = getAgentManagementService();

      const agent = await agentService.getAgent(data.agentId, session.user.id);
      if (!agent) {
        return NextResponse.json(
          { success: false, error: 'Agent not found or does not belong to you' },
          { status: 404 }
        );
      }

      // Apply default S3 configuration from environment if not provided
      if (!data.destination) {
        data.destination = {
          bucket: process.env.AWS_S3_BUCKET || '',
          region: process.env.AWS_REGION || 'us-east-1',
          prefix: '', // Will be constructed as users/{userId}/agents/{agentId}/...
          endpoint: process.env.AWS_S3_ENDPOINT || '',
        };
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
