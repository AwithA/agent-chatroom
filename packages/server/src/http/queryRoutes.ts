import express, { Request, Response } from 'express';
import { UserManager, RoomManager, MessageManager } from '../core';
import { ErrorCode, now } from '@agent-chatroom/shared';

export function createHTTPRouter(
  userManager: UserManager,
  roomManager: RoomManager,
  messageManager: MessageManager
): express.Router {
  const router = express.Router();

  // User routes
  router.get('/users/:userId', async (req: Request, res: Response) => {
    try {
      const user = await userManager.getUser(req.params.userId);
      if (!user) {
        return res.json({
          success: false,
          error: {
            code: ErrorCode.UNAUTHORIZED,
            message: 'User not found',
          },
          timestamp: now(),
        });
      }

      res.json({
        success: true,
        data: {
          userId: user.id,
          nickname: user.nickname,
          joinedRooms: Array.from(user.joinedRooms),
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt,
        },
        timestamp: now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
        },
        timestamp: now(),
      });
    }
  });

  router.get('/users/:userId/rooms', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const rooms = await roomManager.getRoomsByUser(req.params.userId);
      const start = (page - 1) * pageSize;
      const paginatedRooms = rooms.slice(start, start + pageSize);

      res.json({
        success: true,
        data: {
          rooms: paginatedRooms.map(r => ({
            roomId: r.id,
            name: r.name,
            memberCount: r.memberIds.size,
            isPrivateChat: r.isPrivateChat,
            createdAt: r.createdAt,
          })),
          total: rooms.length,
          page,
          pageSize,
        },
        timestamp: now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
        },
        timestamp: now(),
      });
    }
  });

  // Room routes
  router.get('/rooms/:roomId', async (req: Request, res: Response) => {
    try {
      const room = await roomManager.getRoom(req.params.roomId);
      if (!room) {
        return res.json({
          success: false,
          error: {
            code: ErrorCode.ROOM_NOT_FOUND,
            message: 'Room not found',
          },
          timestamp: now(),
        });
      }

      const owner = await userManager.getUser(room.ownerId);

      res.json({
        success: true,
        data: {
          roomId: room.id,
          name: room.name,
          ownerId: room.ownerId,
          ownerNickname: owner?.nickname,
          adminIds: Array.from(room.adminIds),
          memberCount: room.memberIds.size,
          announcement: room.announcement,
          isPrivateChat: room.isPrivateChat,
          createdAt: room.createdAt,
        },
        timestamp: now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
        },
        timestamp: now(),
      });
    }
  });

  router.get('/rooms/:roomId/members', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;

      const room = await roomManager.getRoom(req.params.roomId);
      if (!room) {
        return res.json({
          success: false,
          error: {
            code: ErrorCode.ROOM_NOT_FOUND,
            message: 'Room not found',
          },
          timestamp: now(),
        });
      }

      const memberIds = Array.from(room.memberIds);
      const start = (page - 1) * pageSize;
      const paginatedIds = memberIds.slice(start, start + pageSize);

      const members = await Promise.all(
        paginatedIds.map(async (memberId) => {
          const user = await userManager.getUser(memberId);
          let role: 'owner' | 'admin' | 'member' = 'member';
          if (memberId === room.ownerId) role = 'owner';
          else if (room.adminIds.has(memberId)) role = 'admin';

          return {
            userId: memberId,
            nickname: user?.nickname,
            role,
            joinedAt: user?.createdAt,
          };
        })
      );

      res.json({
        success: true,
        data: {
          members,
          total: memberIds.length,
          page,
          pageSize,
        },
        timestamp: now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
        },
        timestamp: now(),
      });
    }
  });

  router.get('/rooms/:roomId/messages', async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const messages = await messageManager.getHistory(req.params.roomId, limit, offset);
      const total = await messageManager.getMessageCount(req.params.roomId);

      const messagesWithSender = await Promise.all(
        messages.map(async (msg) => {
          const sender = await userManager.getUser(msg.senderId);
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

      res.json({
        success: true,
        data: {
          messages: messagesWithSender,
          hasMore: offset + limit < total,
          nextOffset: offset + limit,
        },
        timestamp: now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
        },
        timestamp: now(),
      });
    }
  });

  router.get('/rooms/search', async (req: Request, res: Response) => {
    try {
      const keyword = (req.query.keyword as string) || '';
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const allRooms = await roomManager.getAllRooms();
      const filteredRooms = allRooms.filter(r =>
        r.name.toLowerCase().includes(keyword.toLowerCase()) && !r.isPrivateChat
      );

      const start = (page - 1) * pageSize;
      const paginatedRooms = filteredRooms.slice(start, start + pageSize);

      res.json({
        success: true,
        data: {
          rooms: paginatedRooms.map(r => ({
            roomId: r.id,
            name: r.name,
            memberCount: r.memberIds.size,
            isPrivateChat: r.isPrivateChat,
            createdAt: r.createdAt,
          })),
          total: filteredRooms.length,
          page,
          pageSize,
        },
        timestamp: now(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Internal server error',
        },
        timestamp: now(),
      });
    }
  });

  return router;
}
