const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Create WebSocket server
  const wss = new WebSocketServer({
    server,
    path: '/api/ws',
  });

  // Import WebSocket service (dynamic import for ESM compatibility)
  let wsService;
  import('./src/lib/websocket/websocket-service.js').then((module) => {
    wsService = module.getWebSocketService();

    wss.on('connection', (ws, req) => {
      // Check if this is an agent connection
      const url = parse(req.url, true);
      const isAgent = url.query.agent === 'true';

      wsService.addClient(ws, isAgent);
    });

    console.log('[WebSocket Server] Initialized');
  }).catch((err) => {
    console.error('[WebSocket Server] Failed to load WebSocket service:', err);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[Server] Shutting down gracefully...');
    wss.close(() => {
      console.log('[WebSocket Server] Closed');
    });
    server.close(() => {
      console.log('[HTTP Server] Closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server ready on ws://${hostname}:${port}/api/ws`);
  });
});
