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

/**
 * Parse cookies from request headers
 */
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};

  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.split('=');
    const value = rest.join('=').trim();
    if (name && value) {
      cookies[name.trim()] = decodeURIComponent(value);
    }
  });
  return cookies;
}

/**
 * Validate session and extract user ID
 * Returns userId if valid, null otherwise
 */
async function validateSession(req) {
  try {
    const cookies = parseCookies(req.headers.cookie);

    // Look for NextAuth session token
    const sessionToken = cookies['authjs.session-token'] || cookies['__Secure-authjs.session-token'];

    if (!sessionToken) {
      console.log('[WebSocket Auth] No session token found');
      return null;
    }

    // Dynamically import auth to validate session
    const { auth } = await import('./src/lib/auth/auth.js');

    // Create a mock request object with cookies for NextAuth
    const mockRequest = {
      headers: {
        cookie: req.headers.cookie,
      },
      cookies: {
        get: (name) => {
          if (cookies[name]) {
            return { name, value: cookies[name] };
          }
          return undefined;
        },
      },
    };

    // Validate the session
    const session = await auth();

    if (!session?.user?.id) {
      console.log('[WebSocket Auth] Invalid or expired session');
      return null;
    }

    console.log(`[WebSocket Auth] Session validated for user: ${session.user.id}`);
    return session.user.id;
  } catch (error) {
    console.error('[WebSocket Auth] Error validating session:', error);
    return null;
  }
}

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

  // Create WebSocket server with manual upgrade handling
  const wss = new WebSocketServer({
    noServer: true, // We'll handle upgrades manually
  });

  // Import WebSocket service (dynamic import for ESM compatibility)
  let wsService;
  import('./src/lib/websocket/websocket-service.js').then((module) => {
    wsService = module.getWebSocketService();
    console.log('[WebSocket Server] Service initialized');
  }).catch((err) => {
    console.error('[WebSocket Server] Failed to load WebSocket service:', err);
  });

  // Handle WebSocket upgrade with authentication
  server.on('upgrade', async (req, socket, head) => {
    const url = parse(req.url, true);

    // Only handle /api/ws path
    if (url.pathname !== '/api/ws') {
      socket.destroy();
      return;
    }

    // Check if this is an agent connection
    const isAgent = url.query.agent === 'true';

    if (isAgent) {
      // For agents, we trust they'll authenticate via API key after connection
      // The agent sends its API key in the authenticate message
      wss.handleUpgrade(req, socket, head, (ws) => {
        if (wsService) {
          wsService.addClient(ws, true, null); // isAgent=true, userId=null (will be set after auth)
        }
      });
    } else {
      // For browser clients, validate session before upgrade
      const userId = await validateSession(req);

      if (!userId) {
        console.log('[WebSocket Auth] Rejecting connection - invalid session');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Session valid - upgrade connection
      wss.handleUpgrade(req, socket, head, (ws) => {
        if (wsService) {
          wsService.addClient(ws, false, userId); // isAgent=false, validated userId
        }
      });
    }
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
