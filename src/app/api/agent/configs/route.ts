import { NextRequest, NextResponse } from 'next/server';
import { requireAgentAuth, updateAgentLastSeen } from '@/lib/agent/agent-auth';
import { prisma } from '@/lib/db/prisma';
import { generateTempS3Credentials } from '@/lib/storage/s3-temp-credentials';

/**
 * GET /api/agent/configs
 * Agent fetches assigned backup configurations
 * Returns configs where executionMode='agent' and agentId matches
 * Includes configs with pending requests (requestedAt is set)
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
        userId: true,
        agentId: true,
        sources: true,
        destination: true,
        schedule: true,
        options: true,
        requestedAt: true,
        lastRunAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // NOTE: Do NOT clear requestedAt here. The agent needs to see it to know a backup was requested.
    // requestedAt will be cleared when the agent reports backup completion via /api/agent/log

    // Generate temporary AWS credentials for rsync backups
    const configsWithCredentials = await Promise.all(
      configs.map(async (config: any) => {
        const configData: any = {
          id: config.id,
          name: config.name,
          userId: config.userId,
          agentId: config.agentId,
          sources: config.sources,
          destination: config.destination,
          schedule: config.schedule,
          options: config.options,
          requestedAt: config.requestedAt,
          lastRunAt: config.lastRunAt,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt,
        };

        // If this is an rsync or rclone backup, include temporary AWS credentials
        if (config.options?.method === 'rsync' || config.options?.method === 'rclone') {
          try {
            const credentials = await generateTempS3Credentials(config.userId, config.agentId);
            configData.awsCredentials = credentials;
          } catch (error) {
            console.error('[API] Failed to generate temp credentials:', error);
            // Continue without credentials - will fail at agent level with better error
          }
        }

        return configData;
      })
    );

    return NextResponse.json({
      success: true,
      configs: configsWithCredentials,
    });
  } catch (error) {
    console.error('[API] Failed to fetch agent configs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch configurations' },
      { status: 500 }
    );
  }
}
