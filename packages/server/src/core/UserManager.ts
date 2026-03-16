import { User, generateId, now } from '@agent-chatroom/shared';
import { IStorage } from '../storage';

export class UserManager {
  private connections: Map<string, string> = new Map(); // connectionId -> userId

  constructor(private storage: IStorage) {}

  async createUser(connectionId: string): Promise<User> {
    const user: User = {
      id: generateId('user'),
      connectionId,
      joinedRooms: new Set(),
      createdAt: now(),
      lastActiveAt: now(),
    };
    await this.storage.saveUser(user);
    this.connections.set(connectionId, user.id);
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.storage.getUser(userId);
  }

  async getUserByConnection(connectionId: string): Promise<User | null> {
    const userId = this.connections.get(connectionId);
    if (!userId) return null;
    return this.storage.getUser(userId);
  }

  async removeUser(userId: string): Promise<void> {
    const user = await this.storage.getUser(userId);
    if (user) {
      this.connections.delete(user.connectionId);
      await this.storage.deleteUser(userId);
    }
  }

  async setNickname(userId: string, nickname: string): Promise<boolean> {
    const user = await this.storage.getUser(userId);
    if (!user) return false;
    user.nickname = nickname;
    await this.storage.saveUser(user);
    return true;
  }

  async updateLastActive(userId: string): Promise<void> {
    const user = await this.storage.getUser(userId);
    if (user) {
      user.lastActiveAt = now();
      await this.storage.saveUser(user);
    }
  }

  async getAllUsers(): Promise<User[]> {
    return this.storage.getAllUsers();
  }

  async getOnlineUsers(): Promise<User[]> {
    const users = await this.storage.getAllUsers();
    const fiveMinutesAgo = now() - 5 * 60 * 1000;
    return users.filter(u => u.lastActiveAt > fiveMinutesAgo);
  }
}
