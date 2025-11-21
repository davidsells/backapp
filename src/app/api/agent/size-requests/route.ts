import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth, updateAgentLastSeen } from '@/lib/agent/agent-auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/agent/size-requests - Agent polls for pending size assessment requests
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate agent
    const { error, agent } = await requireAgentAuth(request);
    if (error || !agent) {
      return error;
    }

    // Update agent heartbeat
    await updateAgentLastSeen(agent.id);

    // Get pending size assessment requests for this agent
    const requests = await prisma.sizeAssessmentRequest.findMany({
      where: {
        agentId: agent.id,
        status: 'pending',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 10, // Limit to 10 at a time
    });

    return NextResponse.json({
      success: true,
      requests: requests.map(req => ({
        id: req.id,
        sources: req.sources,
        createdAt: req.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to get size requests:', error);
    return NextResponse.json(
      { error: 'Failed to get size requests' },
      { status: 500 }
    );
  }
}
