import WebSocket from 'ws';
import { Logger } from './logger.js';

/**
 * WebSocket client for agent to communicate with server
 */
export class AgentWebSocketClient {
  constructor(serverUrl, userId, agentId, logger) {
    this.serverUrl = serverUrl;
    this.userId = userId;
    this.agentId = agentId;
    this.logger = logger || new Logger({ console: true });
    this.ws = null;
    this.connected = false;
    this.authenticated = false;
    this.reconnectInterval = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectTimeout = null;
    this.pingInterval = null;
    this.shouldReconnect = true;
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      // Construct WebSocket URL with agent parameter
      const wsUrl = new URL(this.serverUrl);
      wsUrl.searchParams.set('agent', 'true');

      this.logger.info(`Connecting to WebSocket: ${wsUrl.toString()}`);

      this.ws = new WebSocket(wsUrl.toString());

      this.ws.on('open', () => {
        this.logger.info('WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;

        // Authenticate
        this.send('authenticate', {
          userId: this.userId,
          agentId: this.agentId,
        });

        // Start ping interval
        this.startPingInterval();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        this.logger.info('WebSocket disconnected');
        this.connected = false;
        this.authenticated = false;
        this.stopPingInterval();

        // Attempt reconnection
        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectInterval * Math.min(this.reconnectAttempts, 5);

          this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

          this.reconnectTimeout = setTimeout(() => {
            this.connect();
          }, delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.logger.error('Max reconnection attempts reached');
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error(`WebSocket error: ${error.message}`);
      });

    } catch (error) {
      this.logger.error(`Failed to connect to WebSocket: ${error.message}`);
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data.toString());

      // Handle authentication response
      if (message.type === 'authenticated') {
        this.authenticated = true;
        this.logger.info('WebSocket authenticated');
        return;
      }

      // Handle ping
      if (message.type === 'ping') {
        this.send('pong', {});
        return;
      }

      // Log other messages
      this.logger.debug(`Received message: ${message.type}`);
    } catch (error) {
      this.logger.error(`Error handling message: ${error.message}`);
    }
  }

  /**
   * Send a message to the server
   */
  send(type, data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Cannot send message - WebSocket not open (type: ${type})`);
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        type,
        data,
        timestamp: Date.now(),
      }));
      return true;
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return false;
    }
  }

  /**
   * Send backup started notification
   */
  notifyBackupStarted(configId, configName) {
    return this.send('backup_started', {
      configId,
      configName,
      timestamp: Date.now(),
    });
  }

  /**
   * Send backup progress update
   */
  notifyBackupProgress(configId, configName, progress) {
    return this.send('backup_progress', {
      configId,
      configName,
      progress, // { percentage, currentFile, bytesProcessed, totalBytes }
      timestamp: Date.now(),
    });
  }

  /**
   * Send backup completed notification
   */
  notifyBackupCompleted(configId, configName, stats) {
    return this.send('backup_completed', {
      configId,
      configName,
      stats, // { size, duration, filesProcessed }
      timestamp: Date.now(),
    });
  }

  /**
   * Send backup failed notification
   */
  notifyBackupFailed(configId, configName, error) {
    return this.send('backup_failed', {
      configId,
      configName,
      error: typeof error === 'string' ? error : error.message,
      timestamp: Date.now(),
    });
  }

  /**
   * Start ping interval to keep connection alive
   */
  startPingInterval() {
    this.pingInterval = setInterval(() => {
      this.send('ping', {});
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop ping interval
   */
  stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    this.shouldReconnect = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopPingInterval();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
    this.authenticated = false;
  }

  /**
   * Check if connected and authenticated
   */
  isReady() {
    return this.connected && this.authenticated;
  }
}
