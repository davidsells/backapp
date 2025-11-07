import { randomBytes } from 'crypto';
import { hash } from 'bcryptjs';
import { prisma } from '../db/prisma';

export interface RegisterAgentInput {
  userId: string;
  name: string;
  platform?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  status: string;
  platform: string | null;
  version: string | null;
  lastSeen: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentWithApiKey extends AgentInfo {
  apiKey: string; // Only returned once during registration
}

export interface AgentLogEntry {
  id: string;
  level: string;
  message: string;
  metadata: any;
  timestamp: Date;
}

export interface AgentStats {
  total: number;
  online: number;
  offline: number;
  error: number;
}

export class AgentManagementService {
  /**
   * Register a new agent and generate API key
   */
  async registerAgent(input: RegisterAgentInput): Promise<AgentWithApiKey> {
    // Generate random API key (32 bytes = 64 hex characters)
    const apiKey = randomBytes(32).toString('hex');

    // Hash the API key for storage
    const apiKeyHash = await hash(apiKey, 10);

    // Create agent in database
    const agent = await prisma.agent.create({
      data: {
        userId: input.userId,
        name: input.name,
        platform: input.platform || null,
        apiKey, // Store plaintext for unique constraint and lookup
        apiKeyHash, // Store hash for validation
        status: 'offline',
      },
    });

    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      platform: agent.platform,
      version: agent.version,
      lastSeen: agent.lastSeen,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      apiKey, // Return API key ONCE during registration
    };
  }

  /**
   * List all agents for a user
   */
  async listAgents(userId: string): Promise<AgentInfo[]> {
    const agents = await prisma.agent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        platform: true,
        version: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return agents;
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string, userId: string): Promise<AgentInfo | null> {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId },
      select: {
        id: true,
        name: true,
        status: true,
        platform: true,
        version: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return agent;
  }

  /**
   * Update agent information
   */
  async updateAgent(agentId: string, userId: string, updates: { name?: string; status?: string }): Promise<AgentInfo> {
    const agent = await prisma.agent.update({
      where: { id: agentId, userId },
      data: updates,
      select: {
        id: true,
        name: true,
        status: true,
        platform: true,
        version: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return agent;
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string, userId: string): Promise<void> {
    await prisma.agent.delete({
      where: { id: agentId, userId },
    });
  }

  /**
   * Create agent log entry
   */
  async createLog(agentId: string, level: string, message: string, metadata?: any): Promise<void> {
    await prisma.agentLog.create({
      data: {
        agentId,
        level,
        message,
        metadata: metadata || null,
      },
    });
  }

  /**
   * Get agent logs
   */
  async getAgentLogs(agentId: string, limit = 50): Promise<AgentLogEntry[]> {
    const logs = await prisma.agentLog.findMany({
      where: { agentId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        level: true,
        message: true,
        metadata: true,
        timestamp: true,
      },
    });

    return logs;
  }

  /**
   * Get agent statistics for user
   */
  async getAgentStats(userId: string): Promise<AgentStats> {
    const [total, online, offline, error] = await Promise.all([
      prisma.agent.count({ where: { userId } }),
      prisma.agent.count({ where: { userId, status: 'online' } }),
      prisma.agent.count({ where: { userId, status: 'offline' } }),
      prisma.agent.count({ where: { userId, status: 'error' } }),
    ]);

    return { total, online, offline, error };
  }

  /**
   * Mark agents as offline if not seen for specified duration
   */
  async markStaleAgentsOffline(minutes = 5): Promise<number> {
    const threshold = new Date(Date.now() - minutes * 60 * 1000);

    const result = await prisma.agent.updateMany({
      where: {
        status: 'online',
        lastSeen: {
          lt: threshold,
        },
      },
      data: {
        status: 'offline',
      },
    });

    return result.count;
  }
}

// Singleton instance
let agentManagementServiceInstance: AgentManagementService | null = null;

export function getAgentManagementService(): AgentManagementService {
  if (!agentManagementServiceInstance) {
    agentManagementServiceInstance = new AgentManagementService();
  }
  return agentManagementServiceInstance;
}
