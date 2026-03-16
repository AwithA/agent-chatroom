import WebSocket from 'ws';
import { generateId, now } from '@agent-chatroom/shared';
import { UserManager, RoomManager, MessageManager, PermissionChecker } from '../core';
import { WSConnectionManager } from './WSConnectionManager';
import { WSMessageRouter } from './WSMessageRouter';

export class WSServer {
  private wss: WebSocket.Server;
  private connectionManager: WSConnectionManager;
  private messageRouter: WSMessageRouter;

  constructor(
    private userManager: UserManager,
    private roomManager: RoomManager,
    private messageManager: MessageManager,
    private permissionChecker: PermissionChecker,
    server: any
  ) {
    this.wss = new WebSocket.Server({ server, path: '/ws' });
    this.connectionManager = new WSConnectionManager();
    this.messageRouter = new WSMessageRouter(
      userManager,
      roomManager,
      messageManager,
      permissionChecker,
      this.connectionManager
    );

    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });
  }

  private async handleConnection(ws: WebSocket): Promise<void> {
    const connectionId = generateId('conn');
    this.connectionManager.addConnection(connectionId, ws);

    // Create user
    const user = await this.userManager.createUser(connectionId);

    // Send connected message
    ws.send(JSON.stringify({
      type: 'connected',
      data: {
        userId: user.id,
        timestamp: now(),
      },
    }));

    console.log(`User connected: ${user.id}`);

    // Handle messages
    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.messageRouter.route(connectionId, message);
        await this.userManager.updateLastActive(user.id);
      } catch (error) {
        console.error('Error parsing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          success: false,
          error: {
            code: 4001,
            message: 'Invalid message format',
          },
          timestamp: now(),
        }));
      }
    });

    // Handle close
    ws.on('close', async () => {
      console.log(`User disconnected: ${user.id}`);

      // Leave all rooms
      const rooms = await this.roomManager.getRoomsByUser(user.id);
      for (const room of rooms) {
        await this.roomManager.leaveRoom(room.id, user.id);

        // Notify other members
        const memberConnections = await this.getMemberConnections(room.id, user.id);
        this.connectionManager.broadcast(memberConnections, {
          type: 'memberLeft',
          data: {
            roomId: room.id,
            userId: user.id,
            nickname: user.nickname,
          },
          timestamp: now(),
        });
      }

      this.connectionManager.removeConnection(connectionId);
      await this.userManager.removeUser(user.id);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private async getMemberConnections(roomId: string, excludeUserId?: string): Promise<string[]> {
    const room = await this.roomManager.getRoom(roomId);
    if (!room) return [];

    const connections: string[] = [];
    for (const memberId of room.memberIds) {
      if (excludeUserId && memberId === excludeUserId) continue;
      const user = await this.userManager.getUser(memberId);
      if (user) {
        connections.push(user.connectionId);
      }
    }
    return connections;
  }

  getConnectionManager(): WSConnectionManager {
    return this.connectionManager;
  }
}
