import { User, Room, Message } from '@agent-chatroom/shared';

export interface IStorage {
  // User operations
  saveUser(user: User): Promise<void>;
  getUser(userId: string): Promise<User | null>;
  deleteUser(userId: string): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Room operations
  saveRoom(room: Room): Promise<void>;
  getRoom(roomId: string): Promise<Room | null>;
  deleteRoom(roomId: string): Promise<void>;
  getAllRooms(): Promise<Room[]>;

  // Message operations
  saveMessage(message: Message): Promise<void>;
  getMessages(roomId: string, limit: number, offset: number): Promise<Message[]>;
  getMessageCount(roomId: string): Promise<number>;
}
