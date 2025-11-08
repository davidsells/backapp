import { WebSocket } from 'ws';

export type WebSocketMessageType =
  | 'backup_started'
  | 'backup_progress'
  | 'backup_completed'
  | 'backup_failed'
  | 'alert_created'
  | 'agent_connected'
  | 'agent_disconnected'
  | 'agent_log'
  | 'ping'
  | 'pong';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: any;
  timestamp: number;
}

export interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
  agentId?: string;
  isAgent: boolean;
  authenticated: boolean;
}

/**
 * Service to manage WebSocket connections and message broadcasting
 */
export class WebSocketService {
  private clients: Map<WebSocket, WebSocketClient> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPingInterval();
  }

  /**
   * Add a new client connection
   */
  addClient(ws: WebSocket, isAgent = false): void {
    const client: WebSocketClient = {
      ws,
      isAgent,
      authenticated: false,
    };

    this.clients.set(ws, client);

    // Set up message handler
    ws.on('message', (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    // Handle disconnect
    ws.on('close', () => {
      this.removeClient(ws);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      this.removeClient(ws);
    });

    console.log(`[WebSocket] Client connected (agent: ${isAgent}). Total: ${this.clients.size}`);
  }

  /**
   * Remove a client connection
   */
  removeClient(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      if (client.authenticated && client.userId) {
        // Notify other clients if an agent disconnected
        if (client.isAgent && client.agentId) {
          this.broadcastToUser(client.userId, {
            type: 'agent_disconnected',
            data: { agentId: client.agentId },
            timestamp: Date.now(),
          });
        }
      }
      this.clients.delete(ws);
      console.log(`[WebSocket] Client disconnected. Total: ${this.clients.size}`);
    }
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: WebSocket, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString()) as any;
      const client = this.clients.get(ws);

      if (!client) return;

      // Handle authentication
      if (message.type === 'authenticate') {
        this.authenticateClient(ws, message.data);
        return;
      }

      // Require authentication for all other messages
      if (!client.authenticated) {
        this.sendToClient(ws, {
          type: 'error' as any,
          data: { message: 'Not authenticated' },
          timestamp: Date.now(),
        });
        return;
      }

      // Handle ping/pong
      if (message.type === 'ping') {
        this.sendToClient(ws, {
          type: 'pong',
          timestamp: Date.now(),
        });
        return;
      }

      // Handle agent messages
      if (client.isAgent) {
        this.handleAgentMessage(client, message);
      }
    } catch (error) {
      console.error('[WebSocket] Error handling message:', error);
    }
  }

  /**
   * Authenticate a client
   */
  private authenticateClient(ws: WebSocket, data: { userId: string; agentId?: string; token?: string }): void {
    const client = this.clients.get(ws);
    if (!client) return;

    // TODO: Validate token with auth system
    // For now, we'll accept the userId and agentId

    client.authenticated = true;
    client.userId = data.userId;

    if (client.isAgent) {
      client.agentId = data.agentId;

      // Notify user that agent connected
      this.broadcastToUser(data.userId, {
        type: 'agent_connected',
        data: { agentId: data.agentId },
        timestamp: Date.now(),
      });
    }

    this.sendToClient(ws, {
      type: 'authenticated' as any,
      data: { success: true },
      timestamp: Date.now(),
    });

    console.log(`[WebSocket] Client authenticated: userId=${data.userId}, agent=${client.isAgent}`);
  }

  /**
   * Handle messages from agent clients
   */
  private handleAgentMessage(client: WebSocketClient, message: any): void {
    if (!client.userId) return;

    // Broadcast agent messages to the user's browser clients
    this.broadcastToUser(client.userId, {
      type: message.type,
      data: message.data,
      timestamp: Date.now(),
    });
  }

  /**
   * Send message to a specific client
   */
  sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all clients of a specific user
   */
  broadcastToUser(userId: string, message: WebSocketMessage): void {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.authenticated && client.userId === userId && !client.isAgent) {
        this.sendToClient(client.ws, message);
        count++;
      }
    });
    if (count > 0) {
      console.log(`[WebSocket] Broadcast to ${count} client(s) for user ${userId}: ${message.type}`);
    }
  }

  /**
   * Broadcast message to all authenticated clients
   */
  broadcast(message: WebSocketMessage): void {
    this.clients.forEach((client) => {
      if (client.authenticated && !client.isAgent) {
        this.sendToClient(client.ws, message);
      }
    });
  }

  /**
   * Start periodic ping to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, ws) => {
        if (client.authenticated && ws.readyState === WebSocket.OPEN) {
          this.sendToClient(ws, {
            type: 'ping',
            timestamp: Date.now(),
          });
        }
      });
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop the ping interval
   */
  stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalClients: number;
    authenticatedClients: number;
    agentClients: number;
    browserClients: number;
  } {
    let authenticatedClients = 0;
    let agentClients = 0;
    let browserClients = 0;

    this.clients.forEach((client) => {
      if (client.authenticated) {
        authenticatedClients++;
        if (client.isAgent) {
          agentClients++;
        } else {
          browserClients++;
        }
      }
    });

    return {
      totalClients: this.clients.size,
      authenticatedClients,
      agentClients,
      browserClients,
    };
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    this.stopPingInterval();
    this.clients.forEach((client, ws) => {
      ws.close();
    });
    this.clients.clear();
  }
}

// Singleton instance
let wsServiceInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!wsServiceInstance) {
    wsServiceInstance = new WebSocketService();
  }
  return wsServiceInstance;
}
