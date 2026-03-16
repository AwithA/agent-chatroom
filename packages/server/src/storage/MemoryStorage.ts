import { User, Room, Message } from '@agent-chatroom/shared';
import { IStorage } from './IStorage';

export class MemoryStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private rooms: Map<string, Room> = new Map();
  private messages: Map<string, Message[]> = new Map();

  // User operations
  async saveUser(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async deleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Room operations
  async saveRoom(room: Room): Promise<void> {
    this.rooms.set(room.id, room);
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return this.rooms.get(roomId) || null;
  }

  async deleteRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
    this.messages.delete(roomId);
  }

  async getAllRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values());
  }

  // Message operations
  async saveMessage(message: Message): Promise<void> {
    if (!this.messages.has(message.roomId)) {
      this.messages.set(message.roomId, []);
    }
    this.messages.get(message.roomId)!.push(message);
  }

  async getMessages(roomId: string, limit: number, offset: number): Promise<Message[]> {
    const roomMessages = this.messages.get(roomId) || [];
    return roomMessages.slice(offset, offset + limit);
  }

  async getMessageCount(roomId: string): Promise<number> {
    return (this.messages.get(roomId) || []).length;
  }
}
