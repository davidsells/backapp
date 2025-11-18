import { requireAgentAuth } from '../agent-auth';
import { prisma } from '@/lib/db/client';
import bcrypt from 'bcrypt';

// Mock Next.js server components
class MockHeaders {
  private headers: Map<string, string>;

  constructor(init?: Record<string, string>) {
    // Store headers with lowercase keys to match real behavior
    this.headers = new Map(
      Object.entries(init || {}).map(([k, v]) => [k.toLowerCase(), v])
    );
  }

  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) || null;
  }

  set(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }
}

class MockNextRequest {
  public headers: MockHeaders;
  public method: string;
  public url: string;

  constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
    this.url = url;
    this.method = init?.method || 'GET';
    this.headers = new MockHeaders(init?.headers);
  }

  async json() {
    return {};
  }
}

// Mock Prisma
jest.mock('@/lib/db/client', () => ({
  prisma: {
    agent: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock bcrypt
jest.mock('bcrypt');

describe('Agent Authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireAgentAuth', () => {
    it('should reject requests without API key header', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        method: 'POST',
      });

      const { error, agent } = await requireAgentAuth(request as any);

      expect(agent).toBeNull();
      expect(error).toBeDefined();
      if (!error) return; // Type guard
      const response = error;
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Missing X-Agent-API-Key header');
    });

    it('should reject requests with invalid API key format', async () => {
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        method: 'POST',
        headers: {
          'X-Agent-API-Key': 'invalid-short-key',
        },
      });

      (prisma.agent.findUnique as jest.Mock).mockResolvedValue(null);

      const { error, agent } = await requireAgentAuth(request as any);

      expect(agent).toBeNull();
      expect(error).toBeDefined();
      if (!error) return; // Type guard
      const response = error;
      expect(response.status).toBe(401);
    });

    it('should reject requests with non-existent API key', async () => {
      const fakeApiKey = 'backapp_' + 'a'.repeat(32);
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        method: 'POST',
        headers: {
          'X-Agent-API-Key': fakeApiKey,
        },
      });

      (prisma.agent.findUnique as jest.Mock).mockResolvedValue(null);

      const { error, agent } = await requireAgentAuth(request as any);

      expect(agent).toBeNull();
      expect(error).toBeDefined();
      if (!error) return; // Type guard
      const response = error;
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.error).toContain('Invalid API key');
    });

    it('should reject requests with mismatched API key hash', async () => {
      const apiKey = 'backapp_' + 'a'.repeat(32);
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        method: 'POST',
        headers: {
          'X-Agent-API-Key': apiKey,
        },
      });

      const mockAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        apiKey,
        apiKeyHash: 'hashed_different_key',
        userId: 'user-123',
      };

      (prisma.agent.findUnique as jest.Mock).mockResolvedValue(mockAgent);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // Hash mismatch

      const { error, agent } = await requireAgentAuth(request as any);

      expect(agent).toBeNull();
      expect(error).toBeDefined();
      if (!error) return; // Type guard
      const response = error;
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.error).toContain('Invalid API key');
    });

    it('should successfully authenticate agent with valid API key', async () => {
      const apiKey = 'backapp_' + 'a'.repeat(32);
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        method: 'POST',
        headers: {
          'X-Agent-API-Key': apiKey,
        },
      });

      const mockAgent = {
        id: 'agent-123',
        name: 'Test Agent',
        apiKey,
        apiKeyHash: 'hashed_correct_key',
        userId: 'user-123',
        platform: null,
        version: null,
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSeenAt: new Date(),
      };

      (prisma.agent.findUnique as jest.Mock).mockResolvedValue(mockAgent);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true); // Hash match

      const { error, agent } = await requireAgentAuth(request as any);

      expect(error).toBeNull();
      expect(agent).toEqual({
        id: mockAgent.id,
        name: mockAgent.name,
        userId: mockAgent.userId,
        platform: null,
        version: null,
      });

      // Verify bcrypt.compare was called correctly
      expect(bcrypt.compare).toHaveBeenCalledWith(apiKey, mockAgent.apiKeyHash);
    });

    it('should handle database errors gracefully', async () => {
      const apiKey = 'backapp_' + 'a'.repeat(32);
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        method: 'POST',
        headers: {
          'X-Agent-API-Key': apiKey,
        },
      });

      (prisma.agent.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const { error, agent } = await requireAgentAuth(request as any);

      expect(agent).toBeNull();
      expect(error).toBeDefined();
      if (!error) return; // Type guard
      const response = error;
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.error).toContain('Authentication failed');
    });
  });

  describe('Security: API Key Storage', () => {
    it('should verify API key using bcrypt hash, not plaintext comparison', async () => {
      const apiKey = 'backapp_' + 'b'.repeat(32);
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        method: 'POST',
        headers: {
          'X-Agent-API-Key': apiKey,
        },
      });

      const mockAgent = {
        id: 'agent-456',
        name: 'Secure Agent',
        apiKey, // Stored in DB (CRITICAL-001 issue)
        apiKeyHash: 'bcrypt_hashed_key',
        userId: 'user-456',
      };

      (prisma.agent.findUnique as jest.Mock).mockResolvedValue(mockAgent);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const { error, agent } = await requireAgentAuth(request as any);

      // Should authenticate successfully
      expect(error).toBeNull();
      expect(agent).toBeDefined();

      // Critical: Must use bcrypt.compare, not direct comparison
      expect(bcrypt.compare).toHaveBeenCalledWith(apiKey, mockAgent.apiKeyHash);
      expect(bcrypt.compare).toHaveBeenCalledTimes(1);
    });

    it('should lookup agent by apiKey field (CRITICAL-001: plaintext storage)', async () => {
      const apiKey = 'backapp_' + 'c'.repeat(32);
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        method: 'POST',
        headers: {
          'X-Agent-API-Key': apiKey,
        },
      });

      (prisma.agent.findUnique as jest.Mock).mockResolvedValue({
        id: 'agent-789',
        apiKey, // Lookup by plaintext key
        apiKeyHash: 'hash',
        userId: 'user-789',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await requireAgentAuth(request as any);

      // Verify lookup is by plaintext apiKey
      // This is the CRITICAL-001 vulnerability documented in security audit
      expect(prisma.agent.findUnique).toHaveBeenCalledWith({
        where: { apiKey },
        select: expect.any(Object),
      });
    });
  });

  describe('API Key Format Validation', () => {
    it('should accept valid backapp_ prefixed keys', async () => {
      const validKey = 'backapp_' + 'x'.repeat(32);
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        headers: { 'X-Agent-API-Key': validKey },
      });

      (prisma.agent.findUnique as jest.Mock).mockResolvedValue({
        id: 'test',
        apiKey: validKey,
        apiKeyHash: 'hash',
        userId: 'user',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const { error } = await requireAgentAuth(request as any);

      expect(error).toBeNull();
    });

    it('should reject keys without backapp_ prefix', async () => {
      const invalidKey = 'invalid_' + 'x'.repeat(32);
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        headers: { 'X-Agent-API-Key': invalidKey },
      });

      (prisma.agent.findUnique as jest.Mock).mockResolvedValue(null);

      const { error } = await requireAgentAuth(request as any);

      expect(error).toBeDefined();
    });

    it('should reject keys that are too short', async () => {
      const shortKey = 'backapp_short';
      const request = new MockNextRequest('http://localhost:3000/api/agent/test', {
        headers: { 'X-Agent-API-Key': shortKey },
      });

      (prisma.agent.findUnique as jest.Mock).mockResolvedValue(null);

      const { error } = await requireAgentAuth(request as any);

      expect(error).toBeDefined();
    });
  });
});
