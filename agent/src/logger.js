/**
 * Logger that outputs locally and optionally sends to server
 */
export class Logger {
  constructor(apiClient = null, logLevel = 'info', wsClient = null) {
    this.apiClient = apiClient;
    this.wsClient = wsClient;
    this.logLevel = logLevel;
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  /**
   * Check if log level should be output
   */
  shouldLog(level) {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  /**
   * Format log message with timestamp
   */
  format(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Send log to WebSocket if connected
   */
  sendToWebSocket(level, message, metadata = {}) {
    if (this.wsClient?.isReady()) {
      this.wsClient.send('agent_log', {
        level,
        message,
        metadata,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Log debug message
   */
  debug(message, metadata = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message));
    }
    this.sendToWebSocket('debug', message, metadata);
  }

  /**
   * Log info message
   */
  info(message, metadata = {}) {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message));
    }

    this.sendToWebSocket('info', message, metadata);

    // Send to server
    if (this.apiClient) {
      this.apiClient.sendLog('info', message, metadata).catch(() => {
        // Ignore send failures
      });
    }
  }

  /**
   * Log warning message
   */
  warn(message, metadata = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message));
    }

    this.sendToWebSocket('warn', message, metadata);

    // Send to server
    if (this.apiClient) {
      this.apiClient.sendLog('warn', message, metadata).catch(() => {
        // Ignore send failures
      });
    }
  }

  /**
   * Log error message
   */
  error(message, metadata = {}) {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message));
    }

    this.sendToWebSocket('error', message, metadata);

    // Send to server
    if (this.apiClient) {
      this.apiClient.sendLog('error', message, metadata).catch(() => {
        // Ignore send failures
      });
    }
  }
}
