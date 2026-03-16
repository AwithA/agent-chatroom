import express, { Request, Response } from 'express';
import { UserManager, RoomManager, MessageManager } from '../core';
import { ErrorCode, now } from '@agent-chatroom/shared';
import os from 'os';

export function createConsoleRouter(
  userManager: UserManager,
  roomManager: RoomManager,
  messageManager: MessageManager
): express.Router {
  const router = express.Router();
  const startTime = Date.now();

  // System overview
  router.get('/overview', async (req: Request, res: Response) => {
    try {
      const allUsers = await userManager.getAllUsers();
      const onlineUsers = await userManager.getOnlineUsers();
      const allRooms = await roomManager.getAllRooms();

      let totalMessages = 0;
      for (const room of allRooms) {
        totalMessages += await messageManager.getMessageCount(room.id);
      }

      const memUsage = process.memoryUsage();

      res.json({
        success: true,
        data: {
          stats: {
            totalUsers: allUsers.length,
            onlineUsers: onlineUsers.length,
            totalRooms: allRooms.length,
            totalMessages,
            messagesLast24h: totalMessages, // Simplified
          },
          serverInfo: {
            uptime: Date.now() - startTime,
            version: '1.0.0',
            nodeVersion: process.version,
            platform: os.platform(),
            memory: {
              used: memUsage.heapUsed,
              total: memUsage.heapTotal,
              percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
            },
            cpu: {
              usage: os.loadavg()[0],
            },
          },
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

  // Real-time stats
  router.get('/stats/realtime', async (req: Request, res: Response) => {
    try {
      const onlineUsers = await userManager.getOnlineUsers();
      const allRooms = await roomManager.getAllRooms();
      const activeRooms = allRooms.filter(r => r.memberIds.size > 0);

      res.json({
        success: true,
        data: {
          connections: onlineUsers.length,
          messagesPerSecond: 0, // Would need tracking
          activeRooms: activeRooms.length,
          bandwidth: {
            incoming: 0,
            outgoing: 0,
          },
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

  // Online users
  router.get('/users/online', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const sortBy = (req.query.sortBy as string) || 'lastActiveAt';
      const order = (req.query.order as string) || 'desc';

      let users = await userManager.getOnlineUsers();

      // Sort
      users.sort((a, b) => {
        const aVal = a[sortBy as keyof typeof a] as number;
        const bVal = b[sortBy as keyof typeof b] as number;
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      });

      const start = (page - 1) * pageSize;
      const paginatedUsers = users.slice(start, start + pageSize);

      res.json({
        success: true,
        data: {
          users: paginatedUsers.map(u => ({
            userId: u.id,
            nickname: u.nickname,
            connectionId: u.connectionId,
            joinedRooms: Array.from(u.joinedRooms),
            createdAt: u.createdAt,
            lastActiveAt: u.lastActiveAt,
          })),
          total: users.length,
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

  // All rooms
  router.get('/rooms', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;

      const rooms = await roomManager.getAllRooms();
      const start = (page - 1) * pageSize;
      const paginatedRooms = rooms.slice(start, start + pageSize);

      const roomsWithDetails = await Promise.all(
        paginatedRooms.map(async (room) => {
          const owner = await userManager.getUser(room.ownerId);
          const messageCount = await messageManager.getMessageCount(room.id);

          return {
            roomId: room.id,
            name: room.name,
            ownerId: room.ownerId,
            ownerNickname: owner?.nickname,
            memberCount: room.memberIds.size,
            messageCount,
            isPrivateChat: room.isPrivateChat,
            createdAt: room.createdAt,
          };
        })
      );

      res.json({
        success: true,
        data: {
          rooms: roomsWithDetails,
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

  // Room details
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
      const messageCount = await messageManager.getMessageCount(room.id);

      const members = await Promise.all(
        Array.from(room.memberIds).map(async (memberId) => {
          const user = await userManager.getUser(memberId);
          return {
            userId: memberId,
            nickname: user?.nickname,
            isOnline: user ? user.lastActiveAt > now() - 5 * 60 * 1000 : false,
          };
        })
      );

      res.json({
        success: true,
        data: {
          roomId: room.id,
          name: room.name,
          ownerId: room.ownerId,
          ownerNickname: owner?.nickname,
          adminIds: Array.from(room.adminIds),
          members,
          memberCount: room.memberIds.size,
          messageCount,
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

  // System logs (simplified)
  router.get('/logs', async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 100;

      // In a real implementation, this would read from a log file or database
      res.json({
        success: true,
        data: {
          logs: [],
          total: 0,
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
