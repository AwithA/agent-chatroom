import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import type {
  Room,
  RoomMode,
  ChatMessage,
  ClientAction,
  ServerMessage,
} from "./types.js";

interface RoomData {
  id: string;
  name: string;
  mode: RoomMode;
  createdAt: number;
  messages: ChatMessage[];
  members: Map<string, string>; // clientId -> senderName
}

interface ClientData {
  clientId: string;
  currentRoomId: string | null;
  senderName: string | null;
  isOperator: boolean;
  ws: WebSocket;
}

const MAX_MESSAGES = 200;

export class ChatServer {
  private httpServer: ReturnType<typeof createServer>;
  private wss: WebSocketServer;
  private rooms = new Map<string, RoomData>();
  private clients = new Map<WebSocket, ClientData>();
  private port: number;

  constructor(port: number) {
    this.port = port;
    this.httpServer = createServer();
    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: "/ws",
    });

    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      const clientId = randomUUID();
      const clientData: ClientData = {
        clientId,
        currentRoomId: null,
        senderName: null,
        isOperator: false,
        ws,
      };
      this.clients.set(ws, clientData);

      // 立即下发 connected 消息
      this.sendToClient(ws, {
        type: "connected",
        data: { clientId },
      });

      ws.on("message", (data: Buffer) => {
        try {
          const action: ClientAction = JSON.parse(data.toString());
          this.handleAction(ws, clientData, action);
        } catch (err) {
          this.sendToClient(ws, {
            type: "error",
            data: `Invalid JSON: ${err}`,
          });
        }
      });

      ws.on("close", () => {
        this.handleDisconnect(clientData);
        this.clients.delete(ws);
      });

      ws.on("error", (err) => {
        console.error(`WebSocket error for client ${clientId}:`, err);
      });
    });
  }

  private handleAction(
    ws: WebSocket,
    client: ClientData,
    action: ClientAction
  ): void {
    switch (action.action) {
      case "join":
        this.handleJoin(ws, client, action);
        break;
      case "send":
        this.handleSend(client, action);
        break;
      case "leave":
        this.handleLeave(client);
        break;
      case "rooms":
        this.handleRooms(ws);
        break;
      case "info":
        this.handleInfo(ws, client);
        break;
      case "members":
        this.handleMembers(ws, client);
        break;
      default:
        this.sendToClient(ws, {
          type: "error",
          data: "Unknown action",
        });
    }
  }

  private handleJoin(
    ws: WebSocket,
    client: ClientData,
    action: Extract<ClientAction, { action: "join" }>
  ): void {
    const { roomId, sender, mode } = action;

    // 如果已经在某个房间，先离开
    if (client.currentRoomId) {
      this.handleLeave(client);
    }

    // 判断是否为 operator（人类操作者）
    const isOperator = sender === "operator";
    client.senderName = sender;
    client.isOperator = isOperator;
    client.currentRoomId = roomId;

    // 获取或创建房间
    let room = this.rooms.get(roomId);
    if (!room) {
      // 房间不存在，创建新房间（使用指定的 mode 或默认 directed）
      room = {
        id: roomId,
        name: roomId,
        mode: mode || "directed",
        createdAt: Date.now(),
        messages: [],
        members: new Map(),
      };
      this.rooms.set(roomId, room);
    }

    // 添加成员
    room.members.set(client.clientId, sender);

    // 构建 Room 信息
    const roomInfo: Room = {
      id: room.id,
      name: room.name,
      mode: room.mode,
      createdAt: room.createdAt,
      messageCount: room.messages.length,
      clientCount: room.members.size,
    };

    // 发送 joined 消息给当前客户端
    this.sendToClient(ws, {
      type: "joined",
      data: {
        room: roomInfo,
        messages: room.messages,
      },
    });

    // 广播 join 消息给房间其他成员
    this.broadcastToRoom(
      roomId,
      {
        type: "join",
        data: { clientId: client.clientId, sender },
      },
      client.clientId
    );
  }

  private handleSend(
    client: ClientData,
    action: Extract<ClientAction, { action: "send" }>
  ): void {
    if (!client.currentRoomId || !client.senderName) {
      this.sendToClient(client.ws, {
        type: "error",
        data: "Not in a room",
      });
      return;
    }

    const room = this.rooms.get(client.currentRoomId);
    if (!room) {
      this.sendToClient(client.ws, {
        type: "error",
        data: "Room not found",
      });
      return;
    }

    // 解析 mentions
    let mentions = action.mentions || [];
    if (mentions.length === 0) {
      // 从 content 中解析 @mentions
      const mentionRegex = /@(\w+)/g;
      let match;
      while ((match = mentionRegex.exec(action.content)) !== null) {
        if (!mentions.includes(match[1])) {
          mentions.push(match[1]);
        }
      }
    }

    // 创建消息
    const message: ChatMessage = {
      id: randomUUID(),
      roomId: client.currentRoomId,
      content: action.content,
      sender: client.senderName,
      timestamp: Date.now(),
      mentions: mentions.length > 0 ? mentions : undefined,
    };

    // 保存消息
    room.messages.push(message);
    if (room.messages.length > MAX_MESSAGES) {
      room.messages.shift();
    }

    // 根据房间模式投递消息
    if (room.mode === "broadcast") {
      // 广播模式：发送给房间所有人
      this.broadcastToRoom(client.currentRoomId, {
        type: "message",
        data: message,
      });
    } else {
      // directed 模式：只发送给被 @ 的 agent + 发送者自己 + operator
      this.deliverDirectedMessage(room, message, client.clientId);
    }
  }

  private deliverDirectedMessage(
    room: RoomData,
    message: ChatMessage,
    senderClientId: string
  ): void {
    const mentions = message.mentions || [];
    const senderName = message.sender;

    // 收集需要接收消息的客户端
    const targetClientIds = new Set<string>();

    // 1. 发送者自己
    targetClientIds.add(senderClientId);

    // 2. 被 @ 的 agent
    for (const [clientId, memberName] of room.members) {
      if (mentions.includes(memberName)) {
        targetClientIds.add(clientId);
      }
    }

    // 3. 所有 operator（监控者角色）
    for (const [ws, client] of this.clients) {
      if (
        client.currentRoomId === room.id &&
        client.isOperator &&
        client.clientId !== senderClientId
      ) {
        targetClientIds.add(client.clientId);
      }
    }

    // 发送消息
    for (const [ws, client] of this.clients) {
      if (targetClientIds.has(client.clientId)) {
        this.sendToClient(ws, { type: "message", data: message });
      }
    }
  }

  private handleLeave(client: ClientData): void {
    if (!client.currentRoomId) {
      this.sendToClient(client.ws, {
        type: "error",
        data: "Not in a room",
      });
      return;
    }

    const room = this.rooms.get(client.currentRoomId);
    if (room) {
      room.members.delete(client.clientId);

      // 广播 leave 消息
      this.broadcastToRoom(
        client.currentRoomId,
        {
          type: "leave",
          data: {
            clientId: client.clientId,
            sender: client.senderName || "unknown",
          },
        },
        client.clientId
      );

      // 如果房间空了，删除房间
      if (room.members.size === 0) {
        this.rooms.delete(client.currentRoomId);
      }
    }

    // 发送 left 确认
    this.sendToClient(client.ws, {
      type: "left",
      data: { roomId: client.currentRoomId },
    });

    client.currentRoomId = null;
    client.senderName = null;
  }

  private handleRooms(ws: WebSocket): void {
    const roomList: Room[] = [];
    for (const room of this.rooms.values()) {
      roomList.push({
        id: room.id,
        name: room.name,
        mode: room.mode,
        createdAt: room.createdAt,
        messageCount: room.messages.length,
        clientCount: room.members.size,
      });
    }
    this.sendToClient(ws, { type: "rooms", data: roomList });
  }

  private handleInfo(ws: WebSocket, client: ClientData): void {
    if (!client.currentRoomId) {
      this.sendToClient(ws, {
        type: "error",
        data: "Not in a room",
      });
      return;
    }

    const room = this.rooms.get(client.currentRoomId);
    if (!room) {
      this.sendToClient(ws, {
        type: "error",
        data: "Room not found",
      });
      return;
    }

    this.sendToClient(ws, {
      type: "info",
      data: {
        id: room.id,
        name: room.name,
        mode: room.mode,
        createdAt: room.createdAt,
        messageCount: room.messages.length,
        clientCount: room.members.size,
      },
    });
  }

  private handleMembers(ws: WebSocket, client: ClientData): void {
    if (!client.currentRoomId) {
      this.sendToClient(ws, {
        type: "error",
        data: "Not in a room",
      });
      return;
    }

    const room = this.rooms.get(client.currentRoomId);
    if (!room) {
      this.sendToClient(ws, {
        type: "error",
        data: "Room not found",
      });
      return;
    }

    const members = Array.from(room.members.values());
    this.sendToClient(ws, { type: "members", data: members });
  }

  private handleDisconnect(client: ClientData): void {
    if (client.currentRoomId) {
      const room = this.rooms.get(client.currentRoomId);
      if (room) {
        room.members.delete(client.clientId);

        // 广播 leave 消息
        this.broadcastToRoom(
          client.currentRoomId,
          {
            type: "leave",
            data: {
              clientId: client.clientId,
              sender: client.senderName || "unknown",
            },
          },
          client.clientId
        );

        // 如果房间空了，删除房间
        if (room.members.size === 0) {
          this.rooms.delete(client.currentRoomId);
        }
      }
    }
  }

  private sendToClient(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToRoom(
    roomId: string,
    message: ServerMessage,
    excludeClientId?: string
  ): void {
    for (const [ws, client] of this.clients) {
      if (
        client.currentRoomId === roomId &&
        client.clientId !== excludeClientId
      ) {
        this.sendToClient(ws, message);
      }
    }
  }

  public start(): Promise<number> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        const address = this.httpServer.address();
        const port =
          typeof address === "object" && address !== null
            ? address.port
            : this.port;
        console.log(`Chat server started on ws://localhost:${port}/ws`);
        resolve(port);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // 关闭所有 WebSocket 连接
      for (const [ws] of this.clients) {
        ws.close();
      }
      this.clients.clear();

      // 关闭 WebSocketServer
      this.wss.close(() => {
        // 关闭 HTTP 服务器
        this.httpServer.close(() => {
          resolve();
        });
      });
    });
  }
}
