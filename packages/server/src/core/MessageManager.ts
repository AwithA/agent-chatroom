import { Message, generateId, now, ErrorCode, createError } from '@agent-chatroom/shared';
import { IStorage } from '../storage';
import { RoomManager } from './RoomManager';

export class MessageManager {
  constructor(
    private storage: IStorage,
    private roomManager: RoomManager
  ) {}

  async sendMessage(senderId: string, roomId: string, content: string): Promise<{ success: boolean; message?: Message; error?: any }> {
    const room = await this.roomManager.getRoom(roomId);
    if (!room) {
      return { success: false, error: createError(ErrorCode.ROOM_NOT_FOUND, 'Room not found') };
    }
    if (!room.memberIds.has(senderId)) {
      return { success: false, error: createError(ErrorCode.PERMISSION_DENIED, 'Not a member of this room') };
    }

    const message: Message = {
      id: generateId('msg'),
      roomId,
      senderId,
      content,
      type: 'text',
      timestamp: now(),
    };

    await this.storage.saveMessage(message);
    return { success: true, message };
  }

  async getHistory(roomId: string, limit: number, offset: number): Promise<Message[]> {
    return this.storage.getMessages(roomId, limit, offset);
  }

  async getMessageCount(roomId: string): Promise<number> {
    return this.storage.getMessageCount(roomId);
  }
}
