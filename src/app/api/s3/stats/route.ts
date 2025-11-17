import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getS3BackupManagementService } from '@/lib/storage/s3-backup-management.service';
import { getS3Adapter } from '@/lib/storage/s3-adapter';

/**
 * GET /api/s3/stats
 * Get storage statistics for the user
 */
export async function GET(_request: NextRequest) {
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

    const s3Service = getS3BackupManagementService();
    const stats = await s3Service.getUserStorageStats(session.user.id);

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('[API] Failed to get storage stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get storage stats';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
