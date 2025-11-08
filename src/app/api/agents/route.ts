import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { getAgentManagementService } from '@/lib/agent/agent-management.service';

/**
 * List agents for authenticated user
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const agentService = getAgentManagementService();
    const agents = await agentService.listAgents(session.user.id);

    return NextResponse.json({
      success: true,
      agents,
    });
  } catch (error) {
    console.error('Failed to list agents:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list agents',
      },
      { status: 500 }
    );
  }
}
