import { WebSocketServer } from '../../../src/modules/websocket/websocket.server';
import { WebSocketManager } from '../../../src/modules/websocket/websocket.manager';
import { Database } from '../../../src/infrastructure/database';
import { MockDatabase } from '../../mocks/database.mock';
import { JWTManager } from '../../../src/modules/auth/jwt';
import WebSocket from 'ws';
import * as ws from 'ws';

describe('WebSocket Connection and Authentication', () => {
  let wsServer: WebSocketServer;
  let wsManager: WebSocketManager;
  let mockDb: Database;
  let jwtManager: JWTManager;
  let serverUrl: string;

  // Helper function to create test JWT tokens
  const createTestToken = (userId: string, email: string): string => {
    return jwtManager.generateAccessToken({ userId, email });
  };

  beforeAll(async () => {
    mockDb = new MockDatabase();
    await mockDb.connect();

    jwtManager = new JWTManager();
    wsManager = new WebSocketManager();
    wsServer = new WebSocketServer(wsManager);

    // Start WebSocket server
    serverUrl = await wsServer.start(0); // Use port 0 for automatic port assignment
  });

  afterAll(async () => {
    await wsServer.stop();
    await mockDb.disconnect();
  });

  describe('WebSocket Server', () => {
    it('should start WebSocket server successfully', async () => {
      expect(wsServer).toBeDefined();
      expect(wsServer.getPort()).toBeGreaterThan(0);
    });

    it('should accept WebSocket connections', async () => {
      console.log('Attempting to connect to WebSocket URL:', serverUrl);

      const ws = new WebSocket(serverUrl);

      const openPromise = new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          console.log('WebSocket connection opened successfully');
          resolve();
        });
        ws.on('error', (error) => {
          console.error('WebSocket connection error:', error);
          reject(error);
        });
      });

      await openPromise;
      expect(ws.readyState).toBe(ws.OPEN);

      ws.close();
    });
  });

  describe('WebSocket Authentication', () => {
    it('should require authentication token on connection', async () => {
      const ws = new WebSocket(serverUrl);

      const openPromise = new Promise<void>((resolve) => {
        ws.on('open', () => resolve());
      });

      await openPromise;

      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });

      // Send connection attempt without authentication
      ws.send(JSON.stringify({
        type: 'connect',
        data: {}
      }));

      const response: any = await messagePromise;
      expect(response.type).toBe('error');
      expect(response.data.message).toContain('Authentication required');

      ws.close();
    });

    it('should accept valid JWT authentication', async () => {
      // Create a valid test token
      const validToken = createTestToken('test-user-123', 'websocket-test@example.com');

      const ws = new WebSocket(serverUrl);

      const openPromise = new Promise<void>((resolve) => {
        ws.on('open', () => resolve());
      });

      await openPromise;

      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });

      // Send authentication with valid token
      ws.send(JSON.stringify({
        type: 'connect',
        data: { token: validToken }
      }));

      const response: any = await messagePromise;
      expect(response.type).toBe('connected');
      expect(response.data.userId).toBeDefined();
      expect(response.data.email).toBe('websocket-test@example.com');

      ws.close();
    });

    it('should reject invalid JWT authentication', async () => {
      const ws = new WebSocket(serverUrl);

      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });

      // Send authentication with invalid token
      ws.send(JSON.stringify({
        type: 'connect',
        data: { token: 'invalid-jwt-token' }
      }));

      const response: any = await messagePromise;
      expect(response.type).toBe('error');
      expect(response.data.message).toContain('Invalid authentication');

      ws.close();
    });

    it('should reject expired JWT authentication', async () => {
      const ws = new WebSocket(serverUrl);

      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });

      // Send authentication with expired token
      ws.send(JSON.stringify({
        type: 'connect',
        data: { token: 'expired-jwt-token' }
      }));

      const response: any = await messagePromise;
      expect(response.type).toBe('error');
      expect(response.data.message).toContain('Authentication expired');

      ws.close();
    });
  });

  describe('Connection Management', () => {
    it('should track connected users', async () => {
      const validToken = createTestToken('connection-user-456', 'connection-test@example.com');

      const ws = new WebSocket(serverUrl);

      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });

      ws.send(JSON.stringify({
        type: 'connect',
        data: { token: validToken }
      }));

      const response: any = await messagePromise;
      expect(response.type).toBe('connected');

      // Check connection count
      const connections = wsManager.getConnectionCount();
      expect(connections).toBe(1);

      ws.close();

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Connection should be cleaned up
      const connectionsAfterClose = wsManager.getConnectionCount();
      expect(connectionsAfterClose).toBe(0);
    });

    it('should handle multiple connections from same user', async () => {
      const validToken = createTestToken('multi-user-789', 'multi-connection@example.com');

      const ws1 = new WebSocket(serverUrl);
      const ws2 = new WebSocket(serverUrl);

      const connectPromise1 = new Promise<any>((resolve) => {
        ws1.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connected') resolve(message);
        });
      });

      const connectPromise2 = new Promise<any>((resolve) => {
        ws2.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'connected') resolve(message);
        });
      });

      ws1.send(JSON.stringify({
        type: 'connect',
        data: { token: validToken }
      }));

      ws2.send(JSON.stringify({
        type: 'connect',
        data: { token: validToken }
      }));

      await connectPromise1;
      await connectPromise2;

      // Should have 2 connections for the same user
      const connections = wsManager.getConnectionCount();
      expect(connections).toBe(2);

      ws1.close();
      ws2.close();
    });

    it('should validate message format', async () => {
      const ws = new WebSocket(serverUrl);

      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });

      // Send invalid message format
      ws.send('invalid-json');

      const response: any = await messagePromise;
      expect(response.type).toBe('error');
      expect(response.data.message).toContain('Invalid message format');

      ws.close();
    });

    it('should handle malformed messages gracefully', async () => {
      const ws = new WebSocket(serverUrl);

      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });

      // Send malformed message
      ws.send(JSON.stringify({
        // Missing type field
        data: { some: 'data' }
      }));

      const response: any = await messagePromise;
      expect(response.type).toBe('error');
      expect(response.data.message).toContain('Message type is required');

      ws.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', async () => {
      // Try to connect to invalid URL
      const invalidWs = new WebSocket('ws://invalid-url:9999');

      const errorPromise = new Promise<any>((resolve) => {
        invalidWs.on('error', (error) => {
          resolve(error);
        });
      });

      const error = await errorPromise;
      expect(error).toBeDefined();
    });

    it('should handle unexpected server errors', async () => {
      const ws = new WebSocket(serverUrl);

      const messagePromise = new Promise((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });

      // Send message that might cause server error
      ws.send(JSON.stringify({
        type: 'unknown-operation',
        data: {}
      }));

      const response: any = await messagePromise;
      expect(response.type).toBe('error');

      ws.close();
    });
  });
});