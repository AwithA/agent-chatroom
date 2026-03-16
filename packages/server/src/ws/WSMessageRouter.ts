import { WSRequest, WSResponse, ErrorCode, createError, now, isValidString, isValidId } from '@agent-chatroom/shared';
import { UserManager, RoomManager, MessageManager, PermissionChecker } from '../core';
import { WSConnectionManager } from './WSConnectionManager';

export class WSMessageRouter {
  constructor(
    private userManager: UserManager,
    private roomManager: RoomManager,
    private messageManager: MessageManager,
    private permissionChecker: PermissionChecker,
    private connectionManager: WSConnectionManager
  ) {}

  async route(connectionId: string, message: WSRequest): Promise<void> {
    const { type, requestId, data } = message;

    try {
      switch (type) {
        case 'setNickname':
          await this.handleSetNickname(connectionId, requestId, data);
          break;
        case 'getUserInfo':
          await this.handleGetUserInfo(connectionId, requestId, data);
          break;
        case 'createRoom':
          await this.handleCreateRoom(connectionId, requestId, data);
          break;
        case 'joinRoom':
          await this.handleJoinRoom(connectionId, requestId, data);
          break;
        case 'leaveRoom':
          await this.handleLeaveRoom(connectionId, requestId, data);
          break;
        case 'deleteRoom':
          await this.handleDeleteRoom(connectionId, requestId, data);
          break;
        case 'getRoomInfo':
          await this.handleGetRoomInfo(connectionId, requestId, data);
          break;
        case 'setAnnouncement':
          await this.handleSetAnnouncement(connectionId, requestId, data);
          break;
        case 'addAdmin':
          await this.handleAddAdmin(connectionId, requestId, data);
          break;
        case 'removeAdmin':
          await this.handleRemoveAdmin(connectionId, requestId, data);
          break;
        case 'sendMessage':
          await this.handleSendMessage(connectionId, requestId, data);
          break;
        case 'getMessageHistory':
          await this.handleGetMessageHistory(connectionId, requestId, data);
          break;
        case 'createPrivateChat':
          await this.handleCreatePrivateChat(connectionId, requestId, data);
          break;
        case 'listRooms':
          await this.handleListRooms(connectionId, requestId, data);
          break;
        case 'ping':
          await this.handlePing(connectionId, requestId);
          break;
        default:
          this.sendError(connectionId, type, requestId, ErrorCode.INVALID_PARAMS, 'Unknown message type');
      }
    } catch (error) {
      console.error('Error routing message:', error);
      this.sendError(connectionId, type, requestId, ErrorCode.INTERNAL_ERROR, 'Internal server error');
    }
  }

  private async handleSetNickname(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'setNickname', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidString(data.nickname, 1, 50)) {
      this.sendError(connectionId, 'setNickname', requestId, ErrorCode.INVALID_PARAMS, 'Invalid nickname');
      return;
    }

    await this.userManager.setNickname(user.id, data.nickname);
    this.sendSuccess(connectionId, 'setNickname', requestId, {
      userId: user.id,
      nickname: data.nickname,
    });
  }

  private async handleGetUserInfo(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    if (!isValidId(data.userId)) {
      this.sendError(connectionId, 'getUserInfo', requestId, ErrorCode.INVALID_PARAMS, 'Invalid userId');
      return;
    }

    const user = await this.userManager.getUser(data.userId);
    if (!user) {
      this.sendError(connectionId, 'getUserInfo', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    this.sendSuccess(connectionId, 'getUserInfo', requestId, {
      userId: user.id,
      nickname: user.nickname,
      joinedRooms: Array.from(user.joinedRooms),
      createdAt: user.createdAt,
    });
  }

  private async handleCreateRoom(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'createRoom', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidString(data.name, 1, 100)) {
      this.sendError(connectionId, 'createRoom', requestId, ErrorCode.INVALID_PARAMS, 'Invalid room name');
      return;
    }

    const room = await this.roomManager.createRoom(user.id, data.name, data.isPrivateChat || false);
    user.joinedRooms.add(room.id);
    await this.userManager.getUser(user.id); // Update user

    this.sendSuccess(connectionId, 'createRoom', requestId, {
      roomId: room.id,
      name: room.name,
      ownerId: room.ownerId,
      memberIds: Array.from(room.memberIds),
      createdAt: room.createdAt,
    });
  }

  private async handleJoinRoom(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'joinRoom', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidId(data.roomId)) {
      this.sendError(connectionId, 'joinRoom', requestId, ErrorCode.INVALID_PARAMS, 'Invalid roomId');
      return;
    }

    const result = await this.roomManager.joinRoom(data.roomId, user.id);
    if (!result.success) {
      this.sendError(connectionId, 'joinRoom', requestId, result.error.code, result.error.message);
      return;
    }

    user.joinedRooms.add(data.roomId);
    await this.userManager.getUser(user.id); // Update user

    this.sendSuccess(connectionId, 'joinRoom', requestId, {
      roomId: data.roomId,
      userId: user.id,
    });

    // Broadcast to room members
    const room = await this.roomManager.getRoom(data.roomId);
    if (room) {
      await this.broadcastToRoom(room.id, {
        type: 'memberJoined',
        data: {
          roomId: room.id,
          userId: user.id,
          nickname: user.nickname,
        },
        timestamp: now(),
      }, user.id);
    }
  }

  private async handleLeaveRoom(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'leaveRoom', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidId(data.roomId)) {
      this.sendError(connectionId, 'leaveRoom', requestId, ErrorCode.INVALID_PARAMS, 'Invalid roomId');
      return;
    }

    const result = await this.roomManager.leaveRoom(data.roomId, user.id);
    if (!result.success) {
      this.sendError(connectionId, 'leaveRoom', requestId, result.error.code, result.error.message);
      return;
    }

    user.joinedRooms.delete(data.roomId);

    this.sendSuccess(connectionId, 'leaveRoom', requestId, {
      roomId: data.roomId,
      userId: user.id,
    });

    // Broadcast to remaining room members
    const room = await this.roomManager.getRoom(data.roomId);
    if (room) {
      await this.broadcastToRoom(room.id, {
        type: 'memberLeft',
        data: {
          roomId: room.id,
          userId: user.id,
          nickname: user.nickname,
        },
        timestamp: now(),
      });
    }
  }

  private async handleDeleteRoom(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'deleteRoom', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidId(data.roomId)) {
      this.sendError(connectionId, 'deleteRoom', requestId, ErrorCode.INVALID_PARAMS, 'Invalid roomId');
      return;
    }

    const room = await this.roomManager.getRoom(data.roomId);
    if (!room) {
      this.sendError(connectionId, 'deleteRoom', requestId, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
      return;
    }

    // Broadcast to all members before deleting
    await this.broadcastToRoom(room.id, {
      type: 'roomDeleted',
      data: {
        roomId: room.id,
        reason: 'Room deleted by owner',
      },
      timestamp: now(),
    });

    const result = await this.roomManager.deleteRoom(data.roomId, user.id);
    if (!result.success) {
      this.sendError(connectionId, 'deleteRoom', requestId, result.error.code, result.error.message);
      return;
    }

    // Remove room from all users
    const allUsers = await this.userManager.getAllUsers();
    for (const u of allUsers) {
      u.joinedRooms.delete(data.roomId);
    }

    this.sendSuccess(connectionId, 'deleteRoom', requestId, {
      roomId: data.roomId,
    });
  }

  private async handleGetRoomInfo(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    if (!isValidId(data.roomId)) {
      this.sendError(connectionId, 'getRoomInfo', requestId, ErrorCode.INVALID_PARAMS, 'Invalid roomId');
      return;
    }

    const room = await this.roomManager.getRoom(data.roomId);
    if (!room) {
      this.sendError(connectionId, 'getRoomInfo', requestId, ErrorCode.ROOM_NOT_FOUND, 'Room not found');
      return;
    }

    this.sendSuccess(connectionId, 'getRoomInfo', requestId, {
      roomId: room.id,
      name: room.name,
      ownerId: room.ownerId,
      adminIds: Array.from(room.adminIds),
      memberIds: Array.from(room.memberIds),
      memberCount: room.memberIds.size,
      announcement: room.announcement,
      createdAt: room.createdAt,
    });
  }

  private async handleSetAnnouncement(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'setAnnouncement', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidId(data.roomId) || !isValidString(data.announcement, 0, 500)) {
      this.sendError(connectionId, 'setAnnouncement', requestId, ErrorCode.INVALID_PARAMS, 'Invalid parameters');
      return;
    }

    const result = await this.roomManager.setAnnouncement(data.roomId, user.id, data.announcement);
    if (!result.success) {
      this.sendError(connectionId, 'setAnnouncement', requestId, result.error.code, result.error.message);
      return;
    }

    this.sendSuccess(connectionId, 'setAnnouncement', requestId, {
      roomId: data.roomId,
      announcement: data.announcement,
    });

    // Broadcast to room members
    await this.broadcastToRoom(data.roomId, {
      type: 'announcementUpdated',
      data: {
        roomId: data.roomId,
        announcement: data.announcement,
        operatorId: user.id,
      },
      timestamp: now(),
    });
  }

  private async handleAddAdmin(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'addAdmin', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidId(data.roomId) || !isValidId(data.userId)) {
      this.sendError(connectionId, 'addAdmin', requestId, ErrorCode.INVALID_PARAMS, 'Invalid parameters');
      return;
    }

    const result = await this.roomManager.addAdmin(data.roomId, user.id, data.userId);
    if (!result.success) {
      this.sendError(connectionId, 'addAdmin', requestId, result.error.code, result.error.message);
      return;
    }

    const room = await this.roomManager.getRoom(data.roomId);
    this.sendSuccess(connectionId, 'addAdmin', requestId, {
      roomId: data.roomId,
      userId: data.userId,
      adminIds: room ? Array.from(room.adminIds) : [],
    });

    // Broadcast to room members
    await this.broadcastToRoom(data.roomId, {
      type: 'adminAdded',
      data: {
        roomId: data.roomId,
        userId: data.userId,
        operatorId: user.id,
      },
      timestamp: now(),
    });
  }

  private async handleRemoveAdmin(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'removeAdmin', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidId(data.roomId) || !isValidId(data.userId)) {
      this.sendError(connectionId, 'removeAdmin', requestId, ErrorCode.INVALID_PARAMS, 'Invalid parameters');
      return;
    }

    const result = await this.roomManager.removeAdmin(data.roomId, user.id, data.userId);
    if (!result.success) {
      this.sendError(connectionId, 'removeAdmin', requestId, result.error.code, result.error.message);
      return;
    }

    const room = await this.roomManager.getRoom(data.roomId);
    this.sendSuccess(connectionId, 'removeAdmin', requestId, {
      roomId: data.roomId,
      userId: data.userId,
      adminIds: room ? Array.from(room.adminIds) : [],
    });

    // Broadcast to room members
    await this.broadcastToRoom(data.roomId, {
      type: 'adminRemoved',
      data: {
        roomId: data.roomId,
        userId: data.userId,
        operatorId: user.id,
      },
      timestamp: now(),
    });
  }

  private async handleSendMessage(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'sendMessage', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidId(data.roomId) || !isValidString(data.content, 1, 2000)) {
      this.sendError(connectionId, 'sendMessage', requestId, ErrorCode.INVALID_PARAMS, 'Invalid parameters');
      return;
    }

    const result = await this.messageManager.sendMessage(user.id, data.roomId, data.content);
    if (!result.success) {
      this.sendError(connectionId, 'sendMessage', requestId, result.error.code, result.error.message);
      return;
    }

    this.sendSuccess(connectionId, 'sendMessage', requestId, {
      messageId: result.message!.id,
      roomId: data.roomId,
      timestamp: result.message!.timestamp,
    });

    // Broadcast to room members
    await this.broadcastToRoom(data.roomId, {
      type: 'newMessage',
      data: {
        messageId: result.message!.id,
        roomId: data.roomId,
        senderId: user.id,
        senderNickname: user.nickname,
        content: data.content,
        timestamp: result.message!.timestamp,
      },
      timestamp: now(),
    });
  }

  private async handleGetMessageHistory(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    if (!isValidId(data.roomId)) {
      this.sendError(connectionId, 'getMessageHistory', requestId, ErrorCode.INVALID_PARAMS, 'Invalid roomId');
      return;
    }

    const limit = Math.min(data.limit || 50, 100);
    const offset = data.offset || 0;

    const messages = await this.messageManager.getHistory(data.roomId, limit, offset);
    const enrichedMessages = await Promise.all(
      messages.map(async (msg) => {
        const sender = await this.userManager.getUser(msg.senderId);
        return {
          messageId: msg.id,
          roomId: msg.roomId,
          senderId: msg.senderId,
          senderNickname: sender?.nickname,
          content: msg.content,
          type: msg.type,
          timestamp: msg.timestamp,
        };
      })
    );

    this.sendSuccess(connectionId, 'getMessageHistory', requestId, {
      messages: enrichedMessages,
      hasMore: messages.length === limit,
    });
  }

  private async handleCreatePrivateChat(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (!user) {
      this.sendError(connectionId, 'createPrivateChat', requestId, ErrorCode.UNAUTHORIZED, 'User not found');
      return;
    }

    if (!isValidId(data.targetUserId)) {
      this.sendError(connectionId, 'createPrivateChat', requestId, ErrorCode.INVALID_PARAMS, 'Invalid targetUserId');
      return;
    }

    const targetUser = await this.userManager.getUser(data.targetUserId);
    if (!targetUser) {
      this.sendError(connectionId, 'createPrivateChat', requestId, ErrorCode.INVALID_PARAMS, 'Target user not found');
      return;
    }

    const room = await this.roomManager.createRoom(user.id, `Private: ${user.nickname || user.id} & ${targetUser.nickname || targetUser.id}`, true);
    await this.roomManager.joinRoom(room.id, targetUser.id);

    user.joinedRooms.add(room.id);
    targetUser.joinedRooms.add(room.id);

    this.sendSuccess(connectionId, 'createPrivateChat', requestId, {
      roomId: room.id,
      targetUserId: data.targetUserId,
    });

    // Notify target user
    const targetConnection = await this.userManager.getUser(targetUser.id);
    if (targetConnection) {
      this.connectionManager.sendToConnection(targetConnection.connectionId, {
        type: 'privateChatCreated',
        data: {
          roomId: room.id,
          initiatorId: user.id,
          initiatorNickname: user.nickname,
        },
        timestamp: now(),
      });
    }
  }

  private async handleListRooms(connectionId: string, requestId: string | undefined, data: any): Promise<void> {
    const keyword = data?.keyword || '';
    const allRooms = await this.roomManager.getAllRooms();
    const filteredRooms = allRooms.filter(r =>
      !r.isPrivateChat && r.name.toLowerCase().includes(keyword.toLowerCase())
    );

    this.sendSuccess(connectionId, 'listRooms', requestId, {
      rooms: filteredRooms.map(r => ({
        roomId: r.id,
        name: r.name,
        ownerId: r.ownerId,
        memberCount: r.memberIds.size,
        announcement: r.announcement,
        createdAt: r.createdAt,
      })),
    });
  }

  private async handlePing(connectionId: string, requestId: string | undefined): Promise<void> {
    const user = await this.userManager.getUserByConnection(connectionId);
    if (user) {
      await this.userManager.updateLastActive(user.id);
    }
    this.sendSuccess(connectionId, 'pong', requestId, { timestamp: now() });
  }

  private async broadcastToRoom(roomId: string, message: any, excludeUserId?: string): Promise<void> {
    const room = await this.roomManager.getRoom(roomId);
    if (!room) return;

    const connectionIds: string[] = [];
    for (const memberId of room.memberIds) {
      if (excludeUserId && memberId === excludeUserId) continue;
      const user = await this.userManager.getUser(memberId);
      if (user) {
        connectionIds.push(user.connectionId);
      }
    }

    this.connectionManager.broadcast(connectionIds, message);
  }

  private sendSuccess(connectionId: string, type: string, requestId: string | undefined, data: any): void {
    const response: WSResponse = {
      type,
      requestId,
      success: true,
      data,
      timestamp: now(),
    };
    this.connectionManager.sendToConnection(connectionId, response);
  }

  private sendError(connectionId: string, type: string, requestId: string | undefined, code: ErrorCode, message: string): void {
    const response: WSResponse = {
      type,
      requestId,
      success: false,
      error: createError(code, message),
      timestamp: now(),
    };
    this.connectionManager.sendToConnection(connectionId, response);
  }
}
