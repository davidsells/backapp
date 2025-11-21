import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/agent/size-requests - Agent polls for pending size assessment requests
 */
export async function GET(request: NextRequest) {
  try {
    // Verify agent authentication
    const agentKey = request.headers.get('x-agent-key');
    if (!agentKey) {
      return NextResponse.json({ error: 'Agent key required' }, { status: 401 });
    }

    // Find agent by key
    const agent = await prisma.agent.findFirst({
      where: { apiKeyHash: agentKey },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Invalid agent key' }, { status: 401 });
    }

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
