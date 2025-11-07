import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth, updateAgentLastSeen } from '@/lib/agent/agent-auth';
import { prisma } from '@/lib/db/prisma';

/**
 * GET /api/agent/configs
 * Agent fetches assigned backup configurations
 * Returns configs where executionMode='agent' and agentId matches
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

    // Fetch backup configs assigned to this agent
    const configs = await prisma.backupConfig.findMany({
      where: {
        agentId: agent.id,
        executionMode: 'agent',
        enabled: true, // Only return enabled configs
      },
      select: {
        id: true,
        name: true,
        sources: true,
        destination: true,
        schedule: true,
        options: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      configs: configs.map((config) => ({
        id: config.id,
        name: config.name,
        sources: config.sources,
        destination: config.destination,
        schedule: config.schedule,
        options: config.options,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[API] Failed to fetch agent configs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}
