import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';

// Agent is considered offline if no heartbeat in 5 minutes
const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * GET /api/agents
 * List all agents for the authenticated user
 * Automatically marks agents as offline if they haven't sent heartbeat recently
 */
export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all agents for user
    const agents = await prisma.agent.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [
        { status: 'asc' }, // Online first
        { lastSeen: 'desc' },
      ],
    });

    // Update agent status based on last heartbeat
    const now = new Date();
    const updatedAgents = await Promise.all(
      agents.map(async (agent: any) => {
        let currentStatus = agent.status;

        // If agent was online but hasn't sent heartbeat recently, mark as offline
        if (agent.status === 'online' && agent.lastSeen) {
          const timeSinceLastSeen = now.getTime() - agent.lastSeen.getTime();
          if (timeSinceLastSeen > OFFLINE_THRESHOLD_MS) {
            currentStatus = 'offline';
            // Update in database
            await prisma.agent.update({
              where: { id: agent.id },
              data: { status: 'offline' },
            });
          }
        }

        return {
          id: agent.id,
          name: agent.name,
          status: currentStatus,
          platform: agent.platform,
          lastSeen: agent.lastSeen,
          version: agent.version,
          createdAt: agent.createdAt,
          updatedAt: agent.updatedAt,
        };
      })
    );

    return NextResponse.json({
      success: true,
      agents: updatedAgents,
    });
  } catch (error) {
    console.error('[API] Failed to list agents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list agents' },
      { status: 500 }
    );
  }
}
