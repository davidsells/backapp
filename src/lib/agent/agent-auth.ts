import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from '../db/prisma';

export interface AgentAuthResult {
  error: NextResponse | null;
  agent: {
    id: string;
    name: string;
    userId: string;
    platform: string | null;
    version: string | null;
  } | null;
}

/**
 * Authenticate agent using API key from request header
 * Validates X-Agent-API-Key header against stored hashed API key
 */
export async function requireAgentAuth(request: NextRequest): Promise<AgentAuthResult> {
  // Extract API key from header
  const apiKey = request.headers.get('X-Agent-API-Key');

  if (!apiKey) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Missing X-Agent-API-Key header' },
        { status: 401 }
      ),
      agent: null,
    };
  }

  try {
    // Find agent by API key (stored in plaintext for lookup)
    const agent = await prisma.agent.findUnique({
      where: { apiKey },
      select: {
        id: true,
        name: true,
        userId: true,
        platform: true,
        version: true,
        apiKeyHash: true,
        status: true,
      },
    });

    if (!agent) {
      return {
        error: NextResponse.json(
          { success: false, error: 'Invalid API key' },
          { status: 401 }
        ),
        agent: null,
      };
    }

    // Verify the API key hash matches (double verification)
    const isValid = await compare(apiKey, agent.apiKeyHash);

    if (!isValid) {
      return {
        error: NextResponse.json(
          { success: false, error: 'Invalid API key' },
          { status: 401 }
        ),
        agent: null,
      };
    }

    // Return agent info without sensitive fields
    return {
      error: null,
      agent: {
        id: agent.id,
        name: agent.name,
        userId: agent.userId,
        platform: agent.platform,
        version: agent.version,
      },
    };
  } catch (error) {
    console.error('[AgentAuth] Authentication error:', error);
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 500 }
      ),
      agent: null,
    };
  }
}

/**
 * Update agent's last seen timestamp
 */
export async function updateAgentLastSeen(agentId: string): Promise<void> {
  try {
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        lastSeen: new Date(),
        status: 'online',
      },
    });
  } catch (error) {
    console.error('[AgentAuth] Failed to update agent last seen:', error);
  }
}
