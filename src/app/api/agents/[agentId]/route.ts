import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getAgentManagementService } from '@/lib/agent/agent-management.service';

/**
 * DELETE /api/agents/[agentId]
 * Delete an agent
 */
export async function DELETE(
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

    // Verify agent belongs to user before deleting
    const agent = await agentService.getAgent(params.agentId, session.user.id);
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Delete agent (cascades to logs, sets backup configs agentId to null)
    await agentService.deleteAgent(params.agentId, session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Agent deleted successfully',
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
