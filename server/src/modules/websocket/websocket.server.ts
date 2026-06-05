import { WebSocketServer as WSServer } from 'ws';
import * as ws from 'ws';
import { createServer as httpCreateServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketManager, WebSocketConnection, WebSocketMessage } from './websocket.manager';

export interface WebSocketServerOptions {
  port?: number;
  host?: string;
  heartbeatInterval?: number;
  maxConnections?: number;
}

export class WebSocketServer {
  private wsServer: WSServer | null = null;
  private httpServer: any = null;
  private manager: WebSocketManager;
  private port: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private options: WebSocketServerOptions;

  constructor(manager: WebSocketManager, options: WebSocketServerOptions = {}) {
    this.manager = manager;
    this.options = {
      port: options.port || 0, // 0 means auto-assign port
      host: options.host || '0.0.0.0',
      heartbeatInterval: options.heartbeatInterval || 30000, // 30 seconds
      maxConnections: options.maxConnections || 1000,
      ...options
    };
  }

  async start(port?: number): Promise<string> {
    if (this.isRunning) {
      throw new Error('WebSocket server is already running');
    }

    const serverPort = port || this.options.port;
    this.port = serverPort || 0;

    // Create HTTP server for WebSocket upgrade
    this.httpServer = httpCreateServer((req: IncomingMessage, res: ServerResponse) => {
      // Handle HTTP requests (can be used for health checks, stats, etc.)
      if (req.url === '/ws/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'healthy',
          connections: this.manager.getConnectionCount(),
          users: this.manager.getUserCount(),
          timestamp: new Date().toISOString()
        }));
        return;
      }

      if (req.url === '/ws/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.manager.getStats()));
        return;
      }

      // Default response for other HTTP requests
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Not Found',
        timestamp: new Date().toISOString()
      }));
    });

    // Create WebSocket server
    this.wsServer = new WSServer({
      server: this.httpServer,
      path: '/ws'
    });

    // Setup WebSocket handlers
    this.setupWebSocketHandlers();

    // Start heartbeat
    this.startHeartbeat();

    // Start the server
    await new Promise<void>((resolve, reject) => {
      this.httpServer.listen(serverPort, this.options.host, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          this.isRunning = true;
          console.log(`WebSocket server listening on ws://${this.options.host}:${serverPort}`);
          resolve();
        }
      });
    });

    // Get the actual port assigned
    if (serverPort === 0) {
      const address = this.httpServer.address();
      if (address && typeof address === 'object') {
        this.port = address.port;
      }
    }

    return `ws://localhost:${this.port}/ws`;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('Stopping WebSocket server...');

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all WebSocket connections
    if (this.wsServer) {
      this.wsServer.close();
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer.close(() => {
          resolve();
        });
      });
    }

    this.isRunning = false;
    console.log('WebSocket server stopped');
  }

  getPort(): number {
    return this.port;
  }

  getManager(): WebSocketManager {
    return this.manager;
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  private setupWebSocketHandlers(): void {
    if (!this.wsServer) {
      return;
    }

    this.wsServer.on('connection', (ws: ws.WebSocket, req: import('http').IncomingMessage) => {
      // Check connection limits
      if (this.manager.getConnectionCount() >= this.options.maxConnections!) {
        ws.close(1013, 'Server overloaded');
        return;
      }

      const connectionId = crypto.randomUUID();
      let isAuthenticated = false;

      console.log(`New WebSocket connection: ${connectionId}`);

      // Set up initial message handler for authentication
      const authHandler = (data: ws.Data) => {
        try {
          const message = JSON.parse(data.toString());

          // Validate message format
          if (!message.type || !message.data) {
            this.sendToConnection(ws, {
              type: 'error',
              data: { message: 'Invalid message format' },
              timestamp: new Date().toISOString()
            });
            return;
          }

          // Handle authentication
          if (message.type === 'connect') {
            this.handleAuthentication(connectionId, ws, message.data);
            // Remove auth handler after authentication attempt
            ws.removeListener('message', authHandler);
          } else {
            this.sendToConnection(ws, {
              type: 'error',
              data: { message: 'Authentication required' },
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error in authentication handler:', error);
          this.sendToConnection(ws, {
            type: 'error',
            data: { message: 'Invalid message format' },
            timestamp: new Date().toISOString()
          });
        }
      };

      // Set up timeout for authentication
      const authTimeout = setTimeout(() => {
        if (!isAuthenticated) {
          console.log(`Authentication timeout for connection: ${connectionId}`);
          ws.close(1008, 'Authentication timeout');
        }
      }, 10000); // 10 seconds timeout

      ws.on('message', authHandler);

      ws.on('close', () => {
        clearTimeout(authTimeout);
        if (!isAuthenticated) {
          console.log(`Unauthenticated connection closed: ${connectionId}`);
        }
      });

      ws.on('error', (error: Error) => {
        clearTimeout(authTimeout);
        console.error(`WebSocket error for connection ${connectionId}:`, error);
      });
    });

    this.wsServer.on('error', (error: Error) => {
      console.error('WebSocket server error:', error);
    });

    this.wsServer.on('listening', () => {
      console.log('WebSocket server is listening');
    });
  }

  private async handleAuthentication(
    connectionId: string,
    ws: ws.WebSocket,
    data: any
  ): Promise<void> {
    try {
      const { token } = data;

      if (!token) {
        this.sendToConnection(ws, {
          type: 'error',
          data: { message: 'Authentication token is required' },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const authResult = await this.manager.authenticateConnection(token);

      if (!authResult) {
        this.sendToConnection(ws, {
          type: 'error',
          data: { message: 'Invalid authentication' },
          timestamp: new Date().toISOString()
        });
        ws.close(4001, 'Authentication failed');
        return;
      }

      const { userId, email } = authResult;

      // Add authenticated connection
      this.manager.addConnection(connectionId, ws, userId, email);

      // Send success response
      this.sendToConnection(ws, {
        type: 'connected',
        data: {
          userId,
          email,
          connectionId,
          serverTime: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });

      console.log(`WebSocket authenticated: ${connectionId} for user ${userId}`);
    } catch (error) {
      console.error('Error handling authentication:', error);
      this.sendToConnection(ws, {
        type: 'error',
        data: { message: 'Authentication error' },
        timestamp: new Date().toISOString()
      });
      ws.close(1011, 'Internal server error');
    }
  }

  private sendToConnection(ws: ws.WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending message to WebSocket:', error);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wsServer) {
        return;
      }

      const clients = this.wsServer.clients;
      clients.forEach((ws: ws.WebSocket) => {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.ping();
          } catch (error) {
            console.error('Error sending ping:', error);
          }
        }
      });

      // Clean up inactive connections
      this.manager.cleanupInactiveConnections();
    }, this.options.heartbeatInterval);
  }

  // Health check endpoint
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    connections: number;
    users: number;
    uptime: number;
    timestamp: string;
  }> {
    return {
      status: this.isRunning ? 'healthy' : 'unhealthy',
      connections: this.manager.getConnectionCount(),
      users: this.manager.getUserCount(),
      uptime: Date.now() - (this.httpServer ? 0 : Date.now()),
      timestamp: new Date().toISOString()
    };
  }
}