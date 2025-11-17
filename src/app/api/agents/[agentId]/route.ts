import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getAgentManagementService } from '@/lib/agent/agent-management.service';
import { getS3BackupManagementService } from '@/lib/storage/s3-backup-management.service';
import { getS3Adapter } from '@/lib/storage/s3-adapter';

/**
 * DELETE /api/agents/[agentId]
 * Delete an agent and optionally its S3 backups
 * Query params:
 *   - deleteBackups: true/false (optional, default: false)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const deleteBackups = searchParams.get('deleteBackups') === 'true';

    const agentService = getAgentManagementService();

    // Verify agent belongs to user before deleting
    const agent = await agentService.getAgent(params.agentId, session.user.id);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    let deletedBackupsCount = 0;

    // Delete S3 backups if requested
    if (deleteBackups) {
      try {
        // Configure S3 adapter
        const s3 = getS3Adapter();
        await s3.configure({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
          region: process.env.AWS_REGION || 'us-east-1',
          bucket: process.env.AWS_S3_BUCKET || '',
        });

        const s3Service = getS3BackupManagementService();
        deletedBackupsCount = await s3Service.deleteAgentBackups(session.user.id, params.agentId);
      } catch (error) {
        console.error('[API] Failed to delete agent S3 backups:', error);
        // Continue with agent deletion even if S3 deletion fails
      }
    }

    // Delete agent (cascades to logs, sets backup configs agentId to null)
    await agentService.deleteAgent(params.agentId, session.user.id);

    return NextResponse.json({
      success: true,
      message: `Agent deleted successfully${deleteBackups ? `. ${deletedBackupsCount} backup file(s) deleted from S3.` : ''}`,
      deletedBackupsCount: deleteBackups ? deletedBackupsCount : 0,
    });
  } catch (error) {
    console.error('[API] Failed to delete agent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete agent';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/agents/[agentId]
 * Get agent details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agentService = getAgentManagementService();
    const agent = await agentService.getAgent(params.agentId, session.user.id);

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, agent });
  } catch (error) {
    console.error('[API] Failed to get agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get agent' },
      { status: 500 }
    );
  }
}
