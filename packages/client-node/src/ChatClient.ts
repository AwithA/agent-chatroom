import WebSocket from 'ws';
import { WSRequest, WSResponse, WSPush, ErrorCode } from '@agent-chatroom/shared';

export interface ChatClientOptions {
  url: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface RoomInfo {
  roomId: string;
  name: string;
  ownerId: string;
  adminIds: string[];
  memberIds: string[];
  memberCount?: number;
  announcement?: string;
  isPrivateChat: boolean;
  createdAt: number;
}

export interface MessageData {
  messageId: string;
  roomId: string;
  senderId: string;
  senderNickname?: string;
  content: string;
  type: 'text' | 'system';
  timestamp: number;
}

export interface UserInfo {
  userId: string;
  nickname?: string;
  joinedRooms: string[];
  createdAt: number;
}

type EventHandler = (...args: any[]) => void;

export class ChatClient {
  private ws: WebSocket | null = null;
  private options: Required<ChatClientOptions>;
  private userId: string | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private requestId: number = 0;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  constructor(options: ChatClientOptions) {
    this.options = {
      url: options.url,
      autoReconnect: options.autoReconnect ?? true,
      reconnectInterval: options.reconnectInterval ?? 3000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
    };
  }

  // Connection management
  connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.options.url);

        this.ws.on('open', () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connect');
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('close', () => {
          console.log('WebSocket disconnected');
          this.connected = false;
          this.stopHeartbeat();
          this.emit('disconnect');

          if (this.options.autoReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        });

        // Wait for connected message
        const connectedHandler = (data: any) => {
          this.userId = data.userId;
          this.off('connected', connectedHandler);
          resolve(data.userId);
        };
        this.on('connected', connectedHandler);

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.options.autoReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    console.log(`Reconnecting... (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnect failed:', error);
      });
    }, this.options.reconnectInterval);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.ping().catch((error) => {
          console.error('Heartbeat failed:', error);
        });
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle push messages
      if (message.type && !message.requestId && message.data !== undefined) {
        this.emit(message.type, message.data);
        return;
      }

      // Handle responses
      if (message.requestId) {
        const pending = this.pendingRequests.get(message.requestId);
        if (pending) {
          this.pendingRequests.delete(message.requestId);
          if (message.success) {
            pending.resolve(message.data);
          } else {
            pending.reject(message.error);
          }
        }
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  private sendRequest<T>(type: string, data: any = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws) {
        reject(new Error('Not connected'));
        return;
      }

      const requestId = `req_${++this.requestId}`;
      const request: WSRequest = { type, requestId, data };

      this.pendingRequests.set(requestId, { resolve, reject });

      try {
        this.ws.send(JSON.stringify(request));
      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(error);
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  // Event handling
  on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // API methods
  getUserId(): string | null {
    return this.userId;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async ping(): Promise<void> {
    await this.sendRequest('ping');
  }

  async setNickname(nickname: string): Promise<{ userId: string; nickname: string }> {
    return this.sendRequest('setNickname', { nickname });
  }

  async getUserInfo(userId: string): Promise<UserInfo> {
    return this.sendRequest('getUserInfo', { userId });
  }

  async createRoom(name: string, isPrivateChat: boolean = false): Promise<RoomInfo> {
    return this.sendRequest('createRoom', { name, isPrivateChat });
  }

  async joinRoom(roomId: string): Promise<{ roomId: string; userId: string }> {
    return this.sendRequest('joinRoom', { roomId });
  }

  async leaveRoom(roomId: string): Promise<{ roomId: string; userId: string }> {
    return this.sendRequest('leaveRoom', { roomId });
  }

  async deleteRoom(roomId: string): Promise<{ roomId: string }> {
    return this.sendRequest('deleteRoom', { roomId });
  }

  async getRoomInfo(roomId: string): Promise<RoomInfo> {
    return this.sendRequest('getRoomInfo', { roomId });
  }

  async setAnnouncement(roomId: string, announcement: string): Promise<{ roomId: string; announcement: string }> {
    return this.sendRequest('setAnnouncement', { roomId, announcement });
  }

  async addAdmin(roomId: string, userId: string): Promise<{ roomId: string; userId: string; adminIds: string[] }> {
    return this.sendRequest('addAdmin', { roomId, userId });
  }

  async removeAdmin(roomId: string, userId: string): Promise<{ roomId: string; userId: string; adminIds: string[] }> {
    return this.sendRequest('removeAdmin', { roomId, userId });
  }

  async sendMessage(roomId: string, content: string): Promise<MessageData> {
    return this.sendRequest('sendMessage', { roomId, content });
  }

  async getMessageHistory(roomId: string, limit: number = 50, offset: number = 0): Promise<{ messages: MessageData[]; hasMore: boolean }> {
    return this.sendRequest('getMessageHistory', { roomId, limit, offset });
  }

  async createPrivateChat(targetUserId: string): Promise<RoomInfo> {
    return this.sendRequest('createPrivateChat', { targetUserId });
  }

  async listRooms(keyword: string = ''): Promise<{ rooms: Array<{ roomId: string; name: string; ownerId: string; memberCount: number; announcement?: string; createdAt: number }> }> {
    return this.sendRequest('listRooms', { keyword });
  }
}
