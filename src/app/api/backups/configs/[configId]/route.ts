import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { getBackupService } from '@/lib/backup/backup-service';

const backupSourceSchema = z.object({
  path: z.string().min(1),
  excludePatterns: z.array(z.string()).optional(),
  includePatterns: z.array(z.string()).optional(),
});

const s3DestinationSchema = z.object({
  bucket: z.string().min(1),
  region: z.string().min(1),
  prefix: z.string().optional(),
  endpoint: z.string().optional(),
});

const scheduleSchema = z.object({
  cronExpression: z.string().min(1),
  timezone: z.string().min(1),
});

const rsyncOptionsSchema = z.object({
  localReplica: z.string().min(1, 'Local replica path is required'),
  delete: z.boolean().optional(),
  storageClass: z.enum(['STANDARD', 'STANDARD_IA', 'GLACIER', 'DEEP_ARCHIVE']).optional(),
});

const backupOptionsSchema = z.object({
  method: z.enum(['archive', 'rsync']).optional().default('archive'),
  type: z.enum(['full', 'incremental']),
  compression: z.boolean(),
  compressionLevel: z.number().min(1).max(9).optional(),
  encryption: z.boolean(),
  retentionDays: z.number().min(1).optional(),
  bandwidth: z.number().optional(),
  rsync: rsyncOptionsSchema.optional(),
});

const updateConfigSchema = z.object({
  name: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  sources: z.array(backupSourceSchema).optional(),
  destination: s3DestinationSchema.optional(),
  schedule: scheduleSchema.optional(),
  options: backupOptionsSchema.optional(),
});

/**
 * GET /api/backups/configs/[configId] - Get backup configuration by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backupService = getBackupService();
    const config = await backupService.getConfig(params.configId, session.user.id);

    if (!config) {
      return NextResponse.json(
        { success: false, error: 'Configuration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Failed to get backup config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get backup configuration' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/backups/configs/[configId] - Update backup configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = updateConfigSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const backupService = getBackupService();
    const config = await backupService.updateConfig(
      params.configId,
      session.user.id,
      validationResult.data
    );

    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error('Failed to update backup config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update backup configuration';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/backups/configs/[configId] - Delete backup configuration
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { configId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const backupService = getBackupService();
    await backupService.deleteConfig(params.configId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete backup config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete backup configuration' },
      { status: 500 }
    );
  }
}
