import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgentAuth } from '@/lib/agent/agent-auth';
import { getAgentManagementService } from '@/lib/agent/agent-management.service';

const logSchema = z.object({
  level: z.enum(['info', 'warning', 'error'], {
    errorMap: () => ({ message: 'Level must be info, warning, or error' }),
  }),
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  metadata: z.any().optional(),
});

/**
 * POST /api/agent/log
 * Agent sends log message to server
 * Stored in agent_logs table
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate agent
    const { error, agent } = await requireAgentAuth(request);
    if (error || !agent) {
      return error;
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = logSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    const { level, message, metadata } = validationResult.data;

    // Create log entry
    const agentService = getAgentManagementService();
    await agentService.createLog(agent.id, level, message, metadata);

    // Note: Agent status is managed by heartbeat (online) and auto-offline detection (offline)
    // Error logs do not automatically set agent to 'error' status - they're just logged
    // The 'error' status is reserved for critical agent failures and is set manually

    return NextResponse.json({
      success: true,
      message: 'Log recorded',
    });
  } catch (error) {
    console.error('[API] Failed to create agent log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record log' },
      { status: 500 }
    );
  }
}
