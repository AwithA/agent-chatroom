import { Room, generateId, now, ErrorCode, createError } from '@agent-chatroom/shared';
import { IStorage } from '../storage';

export class RoomManager {
  constructor(private storage: IStorage) {}

  async createRoom(ownerId: string, name: string, isPrivateChat = false): Promise<Room> {
    const room: Room = {
      id: generateId('room'),
      name,
      ownerId,
      adminIds: new Set(),
      memberIds: new Set([ownerId]),
      isPrivateChat,
      createdAt: now(),
      maxAdmins: 4,
    };
    await this.storage.saveRoom(room);
    return room;
  }

  async getRoom(roomId: string): Promise<Room | null> {
    return this.storage.getRoom(roomId);
  }

  async deleteRoom(roomId: string, operatorId: string): Promise<{ success: boolean; error?: any }> {
    const room = await this.storage.getRoom(roomId);
    if (!room) {
      return { success: false, error: createError(ErrorCode.ROOM_NOT_FOUND, 'Room not found') };
    }
    if (room.ownerId !== operatorId) {
      return { success: false, error: createError(ErrorCode.PERMISSION_DENIED, 'Only owner can delete room') };
    }
    await this.storage.deleteRoom(roomId);
    return { success: true };
  }

  async joinRoom(roomId: string, userId: string): Promise<{ success: boolean; error?: any }> {
    const room = await this.storage.getRoom(roomId);
    if (!room) {
      return { success: false, error: createError(ErrorCode.ROOM_NOT_FOUND, 'Room not found') };
    }
    room.memberIds.add(userId);
    await this.storage.saveRoom(room);
    return { success: true };
  }

  async leaveRoom(roomId: string, userId: string): Promise<{ success: boolean; error?: any }> {
    const room = await this.storage.getRoom(roomId);
    if (!room) {
      return { success: false, error: createError(ErrorCode.ROOM_NOT_FOUND, 'Room not found') };
    }
    room.memberIds.delete(userId);
    room.adminIds.delete(userId);
    await this.storage.saveRoom(room);
    return { success: true };
  }

  async setAnnouncement(roomId: string, operatorId: string, announcement: string): Promise<{ success: boolean; error?: any }> {
    const room = await this.storage.getRoom(roomId);
    if (!room) {
      return { success: false, error: createError(ErrorCode.ROOM_NOT_FOUND, 'Room not found') };
    }
    if (room.ownerId !== operatorId && !room.adminIds.has(operatorId)) {
      return { success: false, error: createError(ErrorCode.PERMISSION_DENIED, 'Only owner or admin can set announcement') };
    }
    room.announcement = announcement;
    await this.storage.saveRoom(room);
    return { success: true };
  }

  async addAdmin(roomId: string, operatorId: string, targetUserId: string): Promise<{ success: boolean; error?: any }> {
    const room = await this.storage.getRoom(roomId);
    if (!room) {
      return { success: false, error: createError(ErrorCode.ROOM_NOT_FOUND, 'Room not found') };
    }
    if (room.ownerId !== operatorId) {
      return { success: false, error: createError(ErrorCode.PERMISSION_DENIED, 'Only owner can add admin') };
    }
    if (room.adminIds.size >= room.maxAdmins) {
      return { success: false, error: createError(ErrorCode.ROOM_FULL, 'Max admins reached') };
    }
    if (!room.memberIds.has(targetUserId)) {
      return { success: false, error: createError(ErrorCode.INVALID_PARAMS, 'User is not a member') };
    }
    room.adminIds.add(targetUserId);
    await this.storage.saveRoom(room);
    return { success: true };
  }

  async removeAdmin(roomId: string, operatorId: string, targetUserId: string): Promise<{ success: boolean; error?: any }> {
    const room = await this.storage.getRoom(roomId);
    if (!room) {
      return { success: false, error: createError(ErrorCode.ROOM_NOT_FOUND, 'Room not found') };
    }
    if (room.ownerId !== operatorId) {
      return { success: false, error: createError(ErrorCode.PERMISSION_DENIED, 'Only owner can remove admin') };
    }
    room.adminIds.delete(targetUserId);
    await this.storage.saveRoom(room);
    return { success: true };
  }

  async getAllRooms(): Promise<Room[]> {
    return this.storage.getAllRooms();
  }

  async getRoomsByUser(userId: string): Promise<Room[]> {
    const rooms = await this.storage.getAllRooms();
    return rooms.filter(r => r.memberIds.has(userId));
  }
}
