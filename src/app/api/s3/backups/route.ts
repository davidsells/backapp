import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getS3BackupManagementService } from '@/lib/storage/s3-backup-management.service';
import { getS3Adapter } from '@/lib/storage/s3-adapter';

/**
 * GET /api/s3/backups
 * List backup files from S3
 * Query params:
 *   - agentId: Filter by agent (optional)
 *   - configId: Filter by config (requires agentId)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if S3 is configured
    try {
      const s3 = getS3Adapter();
      await s3.configure({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET || '',
      });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'S3 not configured. Please set AWS environment variables.' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const configId = searchParams.get('configId');

    const s3Service = getS3BackupManagementService();
    let backups;

    if (configId && agentId) {
      // List backups for specific configuration
      backups = await s3Service.listConfigBackups(session.user.id, agentId, configId);
    } else if (agentId) {
      // List backups for specific agent
      backups = await s3Service.listAgentBackups(session.user.id, agentId);
    } else {
      // List all user backups
      backups = await s3Service.listUserBackups(session.user.id);
    }

    return NextResponse.json({ success: true, backups });
  } catch (error) {
    console.error('[API] Failed to list S3 backups:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to list backups';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/s3/backups
 * Delete a backup file from S3
 * Body: { s3Key: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if S3 is configured
    try {
      const s3 = getS3Adapter();
      await s3.configure({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        region: process.env.AWS_REGION || 'us-east-1',
        bucket: process.env.AWS_S3_BUCKET || '',
      });
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'S3 not configured. Please set AWS environment variables.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { s3Key } = body;

    if (!s3Key || typeof s3Key !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid s3Key parameter' },
        { status: 400 }
      );
    }

    const s3Service = getS3BackupManagementService();
    await s3Service.deleteBackup(s3Key, session.user.id);

    return NextResponse.json({ success: true, message: 'Backup deleted successfully' });
  } catch (error) {
    console.error('[API] Failed to delete S3 backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete backup';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
