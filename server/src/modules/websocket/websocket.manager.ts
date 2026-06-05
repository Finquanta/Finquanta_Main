import { EventEmitter } from 'events';
import WebSocket, * as ws from 'ws';
import { JWTManager } from '../auth/jwt';

export interface WebSocketConnection {
  id: string;
  ws: WebSocket;
  userId: string;
  email: string;
  connectedAt: Date;
  lastActivity: Date;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

export class WebSocketManager extends EventEmitter {
  private connections: Map<string, WebSocketConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set of connectionIds
  private jwtService: JWTManager;

  constructor() {
    super();
    this.jwtService = new JWTManager();
  }

  async authenticateConnection(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      const payload = this.jwtService.verifyAccessToken(token);
      if (!payload || !payload.userId) {
        return null;
      }

      return {
        userId: payload.userId,
        email: payload.email || ''
      };
    } catch (error) {
      console.error('WebSocket authentication error:', error);
      return null;
    }
  }

  addConnection(connectionId: string, ws: WebSocket, userId: string, email: string): void {
    const connection: WebSocketConnection = {
      id: connectionId,
      ws,
      userId,
      email,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    this.connections.set(connectionId, connection);

    // Track user connections
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Setup message handler
    this.setupConnectionHandlers(connectionId, connection);

    this.emit('connection:added', connection);
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Remove from user connections
    const userConnections = this.userConnections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.userConnections.delete(connection.userId);
      }
    }

    // Remove from connections
    this.connections.delete(connectionId);

    // Close WebSocket if not already closed
    if (connection.ws.readyState === ws.OPEN) {
      connection.ws.close();
    }

    this.emit('connection:removed', connection);
  }

  getConnection(connectionId: string): WebSocketConnection | null {
    return this.connections.get(connectionId) || null;
  }

  getUserConnections(userId: string): WebSocketConnection[] {
    const connectionIds = this.userConnections.get(userId);
    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter((conn): conn is WebSocketConnection => conn !== undefined);
  }

  getAllConnections(): WebSocketConnection[] {
    return Array.from(this.connections.values());
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getUserCount(): number {
    return this.userConnections.size;
  }

  sendToConnection(connectionId: string, message: WebSocketMessage): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== ws.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      connection.lastActivity = new Date();
      return true;
    } catch (error) {
      console.error('Error sending message to connection:', error);
      return false;
    }
  }

  sendToUser(userId: string, message: WebSocketMessage): number {
    const connections = this.getUserConnections(userId);
    let sentCount = 0;

    connections.forEach(connection => {
      if (this.sendToConnection(connection.id, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  broadcast(message: WebSocketMessage): number {
    let sentCount = 0;

    this.connections.forEach((connection, connectionId) => {
      if (this.sendToConnection(connectionId, message)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  broadcastToUsers(userIds: string[], message: WebSocketMessage): number {
    let sentCount = 0;

    userIds.forEach(userId => {
      sentCount += this.sendToUser(userId, message);
    });

    return sentCount;
  }

  private setupConnectionHandlers(connectionId: string, connection: WebSocketConnection): void {
    const ws = connection.ws;

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        connection.lastActivity = new Date();

        this.emit('message', {
          connectionId,
          userId: connection.userId,
          message
        });
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        this.sendError(connectionId, 'Invalid message format');
      }
    });

    // Handle connection close
    ws.on('close', (code: number, reason: Buffer) => {
      console.log(`WebSocket connection ${connectionId} closed: ${code} ${reason}`);
      this.removeConnection(connectionId);
    });

    // Handle connection errors
    ws.on('error', (error: Error) => {
      console.error(`WebSocket connection ${connectionId} error:`, error);
      this.removeConnection(connectionId);
    });

    // Handle pong responses (for keepalive)
    ws.on('pong', () => {
      connection.lastActivity = new Date();
    });
  }

  sendError(connectionId: string, errorMessage: string): boolean {
    return this.sendToConnection(connectionId, {
      type: 'error',
      data: { message: errorMessage },
      timestamp: new Date().toISOString()
    });
  }

  sendSuccess(connectionId: string, data: any): boolean {
    return this.sendToConnection(connectionId, {
      type: 'success',
      data,
      timestamp: new Date().toISOString()
    });
  }

  // Clean up inactive connections
  cleanupInactiveConnections(maxInactiveTime: number = 30 * 60 * 1000): void { // 30 minutes default
    const now = new Date();
    const toRemove: string[] = [];

    this.connections.forEach((connection, connectionId) => {
      const inactiveTime = now.getTime() - connection.lastActivity.getTime();
      if (inactiveTime > maxInactiveTime) {
        toRemove.push(connectionId);
      }
    });

    toRemove.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    if (toRemove.length > 0) {
      console.log(`Cleaned up ${toRemove.length} inactive WebSocket connections`);
    }
  }

  // Get connection statistics
  getStats(): {
    totalConnections: number;
    totalUsers: number;
    averageConnectionsPerUser: number;
  } {
    const totalConnections = this.connections.size;
    const totalUsers = this.userConnections.size;
    const averageConnectionsPerUser = totalUsers > 0 ? totalConnections / totalUsers : 0;

    return {
      totalConnections,
      totalUsers,
      averageConnectionsPerUser: Math.round(averageConnectionsPerUser * 100) / 100
    };
  }
}