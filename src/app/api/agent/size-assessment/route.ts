import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgentAuth, updateAgentLastSeen } from '@/lib/agent/agent-auth';
import { prisma } from '@/lib/db/prisma';

const reportSizeSchema = z.object({
  requestId: z.string(),
  totalBytes: z.number(),
  totalFiles: z.number(),
  error: z.string().optional(),
});

/**
 * POST /api/agent/size-assessment - Agent reports directory size
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate agent
    const { error: authError, agent } = await requireAgentAuth(request);
    if (authError || !agent) {
      return authError;
    }

    // Update agent heartbeat
    await updateAgentLastSeen(agent.id);

    const body = await request.json();
    const validationResult = reportSizeSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.errors[0]?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { requestId, totalBytes, totalFiles, error } = validationResult.data;

    // Update the size assessment request with results
    await prisma.sizeAssessmentRequest.update({
      where: { id: requestId },
      data: {
        status: error ? 'failed' : 'completed',
        totalBytes: error ? null : totalBytes,
        totalFiles: error ? null : totalFiles,
        error: error || null,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process size assessment:', error);
    return NextResponse.json(
      { error: 'Failed to process size assessment' },
      { status: 500 }
    );
  }
}
