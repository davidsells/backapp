import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { getBackupExecutor } from '@/lib/backup/backup-executor';

const executeSchema = z.object({
  configId: z.string().min(1, 'Configuration ID is required'),
});

/**
 * POST /api/backups/execute - Execute a backup job
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = executeSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const backupExecutor = getBackupExecutor();

    // Execute backup asynchronously
    backupExecutor
      .executeBackup({
        configId: validationResult.data.configId,
        userId: session.user.id,
      })
      .catch((error) => {
        console.error('Backup execution failed:', error);
      });

    return NextResponse.json({
      success: true,
      message: 'Backup job started',
    });
  } catch (error) {
    console.error('Failed to start backup:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start backup';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
