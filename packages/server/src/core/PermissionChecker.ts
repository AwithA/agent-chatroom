import { Room } from '@agent-chatroom/shared';

export class PermissionChecker {
  canDeleteRoom(userId: string, room: Room): boolean {
    return room.ownerId === userId;
  }

  canSetAnnouncement(userId: string, room: Room): boolean {
    return room.ownerId === userId || room.adminIds.has(userId);
  }

  canAddAdmin(userId: string, room: Room): boolean {
    return room.ownerId === userId;
  }

  canRemoveAdmin(userId: string, room: Room): boolean {
    return room.ownerId === userId;
  }

  canSendMessage(userId: string, room: Room): boolean {
    return room.memberIds.has(userId);
  }

  isOwner(userId: string, room: Room): boolean {
    return room.ownerId === userId;
  }

  isAdmin(userId: string, room: Room): boolean {
    return room.adminIds.has(userId);
  }

  isMember(userId: string, room: Room): boolean {
    return room.memberIds.has(userId);
  }
}
