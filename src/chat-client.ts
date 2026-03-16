import WebSocket from "ws";
import { EventEmitter } from "events";
import type {
  Room,
  ChatMessage,
  ClientAction,
  ServerMessage,
  RoomMode,
} from "./types.js";

interface ChatClientEvents {
  connected: { clientId: string };
  joined: { room: Room; messages: ChatMessage[] };
  message: ChatMessage;
  join: { clientId: string; sender: string };
  leave: { clientId: string; sender: string };
  left: { roomId: string };
  error: string;
  rooms: Room[];
  info: Room;
  members: string[];
  disconnect: void;
}

export class ChatClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private clientId: string | null = null;
  private currentRoomId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;

  constructor(url: string) {
    super();
    this.url = url;
  }

  public connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.on("open", () => {
          this.reconnectAttempts = 0;
        });

        this.ws.on("message", (data: Buffer) => {
          try {
            const message: ServerMessage = JSON.parse(data.toString());
            this.handleMessage(message, resolve);
          } catch (err) {
            this.emit("error", `Failed to parse message: ${err}`);
          }
        });

        this.ws.on("close", () => {
          this.emit("disconnect");
          this.attemptReconnect();
        });

        this.ws.on("error", (err) => {
          this.emit("error", err.message);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  private handleMessage(
    message: ServerMessage,
    resolve?: (clientId: string) => void
  ): void {
    switch (message.type) {
      case "connected":
        this.clientId = message.data.clientId;
        if (resolve) {
          resolve(message.data.clientId);
        }
        this.emit("connected", message.data);
        break;
      case "joined":
        this.currentRoomId = message.data.room.id;
        this.emit("joined", message.data);
        break;
      case "message":
        this.emit("message", message.data);
        break;
      case "join":
        this.emit("join", message.data);
        break;
      case "leave":
        this.emit("leave", message.data);
        break;
      case "left":
        this.currentRoomId = null;
        this.emit("left", message.data);
        break;
      case "error":
        this.emit("error", message.data);
        break;
      case "rooms":
        this.emit("rooms", message.data);
        break;
      case "info":
        this.emit("info", message.data);
        break;
      case "members":
        this.emit("members", message.data);
        break;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect().catch(() => {});
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  public send(action: ClientAction): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(action));
    } else {
      this.emit("error", "WebSocket not connected");
    }
  }

  public join(roomId: string, sender: string, mode?: RoomMode): void {
    this.send({ action: "join", roomId, sender, mode });
  }

  public sendMessage(content: string, mentions?: string[]): void {
    this.send({ action: "send", content, mentions });
  }

  public leave(): void {
    this.send({ action: "leave" });
  }

  public getRooms(): void {
    this.send({ action: "rooms" });
  }

  public getInfo(): void {
    this.send({ action: "info" });
  }

  public getMembers(): void {
    this.send({ action: "members" });
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  public getClientId(): string | null {
    return this.clientId;
  }

  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
