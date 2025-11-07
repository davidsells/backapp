import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { getAgentManagementService } from '@/lib/agent/agent-management.service';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  platform: z.string().optional(),
});

/**
 * POST /api/agent/register
 * Register a new agent for the authenticated user
 * Returns agent info including API key (shown ONCE only)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = registerSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Validation failed';
      return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }

    // Register agent
    const agentService = getAgentManagementService();
    const agent = await agentService.registerAgent({
      userId: session.user.id,
      name: validationResult.data.name,
      platform: validationResult.data.platform,
    });

    return NextResponse.json(
      {
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          apiKey: agent.apiKey, // IMPORTANT: Only returned once!
          status: agent.status,
          platform: agent.platform,
          createdAt: agent.createdAt,
        },
        message: 'Agent registered successfully. Save the API key securely - it will not be shown again.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API] Failed to register agent:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to register agent';
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
