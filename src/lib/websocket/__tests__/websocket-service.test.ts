// Mock the 'ws' module before importing
jest.mock('ws', () => {
  const WEBSOCKET_OPEN = 1;
  const WEBSOCKET_CLOSING = 2;
  const WEBSOCKET_CLOSED = 3;

  class MockWebSocket {
    public readyState = WEBSOCKET_OPEN;
    public send = jest.fn();
    public close = jest.fn();
    public on = jest.fn();
    public off = jest.fn();

    static OPEN = WEBSOCKET_OPEN;
    static CLOSING = WEBSOCKET_CLOSING;
    static CLOSED = WEBSOCKET_CLOSED;
  }

  return {
    WebSocket: MockWebSocket,
  };
});

import { WebSocketService } from '../websocket-service';
import { WebSocket } from 'ws';

// Mock WebSocket class for tests
class MockWebSocket {
  public readyState = 1; // WebSocket.OPEN
  public send = jest.fn();
  public close = jest.fn();
  public on = jest.fn();
  public off = jest.fn();
}

describe('WebSocketService', () => {
  let wsService: WebSocketService;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    wsService = new WebSocketService();
    mockWs = new MockWebSocket();
    jest.clearAllMocks();
  });

  describe('addClient - Browser Client Security', () => {
    it('should auto-authenticate browser clients with validated userId', () => {
      const validatedUserId = 'user123';
      wsService.addClient(mockWs as unknown as WebSocket, false, validatedUserId);

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should NOT auto-authenticate browser clients without validated userId', () => {
      wsService.addClient(mockWs as unknown as WebSocket, false, null);

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should prevent userId override for pre-authenticated browser clients', () => {
      const validatedUserId = 'user123';
      wsService.addClient(mockWs as unknown as WebSocket, false, validatedUserId);

      // Get the message handler
      const messageHandler = mockWs.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      expect(messageHandler).toBeDefined();

      // Try to authenticate with a different userId
      const maliciousAuth = JSON.stringify({
        type: 'authenticate',
        data: { userId: 'attacker456' }, // Attempting to impersonate
      });

      messageHandler(Buffer.from(maliciousAuth));

      // Should send back confirmation with ORIGINAL userId, not the attacker's
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"authenticated"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining(validatedUserId)
      );
      expect(mockWs.send).not.toHaveBeenCalledWith(
        expect.stringContaining('attacker456')
      );
    });
  });

  describe('addClient - Agent Client', () => {
    it('should allow agent clients without pre-validated userId', () => {
      wsService.addClient(mockWs as unknown as WebSocket, true, null);

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should authenticate agent with userId and agentId', () => {
      wsService.addClient(mockWs as unknown as WebSocket, true, null);

      const messageHandler = mockWs.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      const agentAuth = JSON.stringify({
        type: 'authenticate',
        data: { userId: 'user123', agentId: 'agent456' },
      });

      messageHandler(Buffer.from(agentAuth));

      // Should broadcast agent_connected event
      expect(mockWs.send).toHaveBeenCalled();
    });

    it('should reject agent authentication without agentId', () => {
      wsService.addClient(mockWs as unknown as WebSocket, true, null);

      const messageHandler = mockWs.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      const invalidAuth = JSON.stringify({
        type: 'authenticate',
        data: { userId: 'user123' }, // Missing agentId
      });

      messageHandler(Buffer.from(invalidAuth));

      // Should send error and close connection
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWs.close).toHaveBeenCalled();
    });
  });

  describe('Security - Cross-User Data Leakage Prevention', () => {
    it('should NOT allow browser client to receive messages for different user', () => {
      // Add two browser clients with different userIds
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      wsService.addClient(ws1 as unknown as WebSocket, false, 'user123');
      wsService.addClient(ws2 as unknown as WebSocket, false, 'user456');

      // Broadcast message to user123
      wsService.broadcastToUser('user123', {
        type: 'backup_progress',
        data: { progress: 50, message: 'Sensitive data for user123' },
        timestamp: Date.now(),
      });

      // user123's ws should receive the message
      expect(ws1.send).toHaveBeenCalled();

      // user456's ws should NOT receive the message
      expect(ws2.send).not.toHaveBeenCalled();
    });

    it('should only send messages to authenticated clients', () => {
      const authenticatedWs = new MockWebSocket();
      const unauthenticatedWs = new MockWebSocket();

      wsService.addClient(authenticatedWs as unknown as WebSocket, false, 'user123');
      wsService.addClient(unauthenticatedWs as unknown as WebSocket, false, null);

      wsService.broadcastToUser('user123', {
        type: 'backup_progress',
        data: {},
        timestamp: Date.now(),
      });

      // Authenticated client should receive
      expect(authenticatedWs.send).toHaveBeenCalled();

      // Unauthenticated client should NOT receive
      expect(unauthenticatedWs.send).not.toHaveBeenCalled();
    });
  });

  describe('removeClient', () => {
    it('should properly clean up client on disconnect', () => {
      wsService.addClient(mockWs as unknown as WebSocket, false, 'user123');

      const closeHandler = mockWs.on.mock.calls.find(
        (call) => call[0] === 'close'
      )?.[1];

      expect(closeHandler).toBeDefined();

      // Verify client is in the map
      expect((wsService as any).clients.size).toBe(1);

      // Trigger close
      closeHandler();

      // Verify client was removed from the map
      expect((wsService as any).clients.size).toBe(0);
    });
  });

  describe('Message Routing', () => {
    it('should broadcast messages to correct user only', () => {
      const ws = new MockWebSocket();
      wsService.addClient(ws as unknown as WebSocket, false, 'user123');

      wsService.broadcastToUser('user123', {
        type: 'backup_progress',
        data: { logId: 'log123', progress: 75 },
        timestamp: Date.now(),
      });

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"backup_progress"')
      );
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"progress":75')
      );
    });

    it('should broadcast backup_completed messages', () => {
      const ws = new MockWebSocket();
      wsService.addClient(ws as unknown as WebSocket, false, 'user123');

      wsService.broadcastToUser('user123', {
        type: 'backup_completed',
        data: { logId: 'log123', success: true },
        timestamp: Date.now(),
      });

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"backup_completed"')
      );
    });

    it('should broadcast agent_disconnected messages', () => {
      const ws = new MockWebSocket();
      wsService.addClient(ws as unknown as WebSocket, false, 'user123');

      wsService.broadcastToUser('user123', {
        type: 'agent_disconnected',
        data: { agentId: 'agent456' },
        timestamp: Date.now(),
      });

      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"agent_disconnected"')
      );
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('agent456')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON messages gracefully without crashing', () => {
      wsService.addClient(mockWs as unknown as WebSocket, false, 'user123');

      const messageHandler = mockWs.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      // Send invalid JSON - should not throw (caught in try/catch)
      expect(() => messageHandler(Buffer.from('not valid json {{{'))).not.toThrow();
    });

    it('should send error for unauthenticated message attempts', () => {
      wsService.addClient(mockWs as unknown as WebSocket, false, null); // Not authenticated

      const messageHandler = mockWs.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      // Try to send message without authentication
      const msg = JSON.stringify({
        type: 'ping',
        data: {},
      });

      messageHandler(Buffer.from(msg));

      // Should receive error about not being authenticated
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('Not authenticated')
      );
    });

    it('should handle WebSocket errors without crashing', () => {
      wsService.addClient(mockWs as unknown as WebSocket, false, 'user123');

      const errorHandler = mockWs.on.mock.calls.find(
        (call) => call[0] === 'error'
      )?.[1];

      expect(errorHandler).toBeDefined();

      // Trigger error - should not throw
      expect(() => errorHandler(new Error('Connection error'))).not.toThrow();
    });

    it('should respond with pong to authenticated ping', () => {
      wsService.addClient(mockWs as unknown as WebSocket, false, 'user123');

      const messageHandler = mockWs.on.mock.calls.find(
        (call) => call[0] === 'message'
      )?.[1];

      const ping = JSON.stringify({ type: 'ping' });
      messageHandler(Buffer.from(ping));

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"pong"')
      );
    });
  });
});
