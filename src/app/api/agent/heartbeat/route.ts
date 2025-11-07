import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgentAuth, updateAgentLastSeen } from '@/lib/agent/agent-auth';
import { getAgentManagementService } from '@/lib/agent/agent-management.service';

const heartbeatSchema = z.object({
  version: z.string().optional(),
  platform: z.string().optional(),
});

/**
 * POST /api/agent/heartbeat
 * Agent reports it's alive
 * Updates lastSeen timestamp and status to 'online'
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate agent
    const { error, agent } = await requireAgentAuth(request);
    if (error || !agent) {
      return error;
    }

    // Parse body (optional version/platform info)
    const body = await request.json().catch(() => ({}));
    const validationResult = heartbeatSchema.safeParse(body);

    // Update lastSeen and status
    await updateAgentLastSeen(agent.id);

    // If version or platform provided, update agent info
    if (validationResult.success) {
      const updates: any = {};
      if (validationResult.data.version) {
        updates.version = validationResult.data.version;
      }

      if (Object.keys(updates).length > 0) {
        const agentService = getAgentManagementService();
        await agentService.updateAgent(agent.id, agent.userId, updates);
      }
    }

    return NextResponse.json({
      success: true,
      status: 'online',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Heartbeat error:', error);
    return NextResponse.json(
      { success: false, error: 'Heartbeat failed' },
      { status: 500 }
    );
  }
}
