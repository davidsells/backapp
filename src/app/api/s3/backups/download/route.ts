import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getS3BackupManagementService } from '@/lib/storage/s3-backup-management.service';
import { getS3Adapter } from '@/lib/storage/s3-adapter';

/**
 * POST /api/s3/backups/download
 * Generate a presigned download URL for a backup file
 * Body: { s3Key: string }
 */
export async function POST(request: NextRequest) {
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
    const downloadUrl = await s3Service.getDownloadUrl(s3Key, session.user.id, 3600); // 1 hour expiry

    return NextResponse.json({
      success: true,
      downloadUrl,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error('[API] Failed to generate download URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate download URL';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
