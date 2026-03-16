# 聊天室系统架构设计方案

## 1. 系统概述

基于 Node.js 的通用聊天室服务器，采用 WebSocket 实现实时通信，HTTP 提供查询和管理接口。

## 2. 技术栈

- **运行环境**: Node.js (>=18.x)
- **包管理**: pnpm + monorepo
- **WebSocket**: ws 库
- **HTTP 框架**: Express/Fastify
- **语言**: TypeScript
- **数据存储**: 内存 (预留数据库接口)

## 3. 项目结构

```
agent-chatroom/
├── packages/
│   ├── server/           # 主服务器
│   │   ├── src/
│   │   │   ├── core/     # 核心业务逻辑
│   │   │   ├── ws/       # WebSocket 处理
│   │   │   ├── http/     # HTTP 接口
│   │   │   ├── storage/  # 数据存储抽象层
│   │   │   └── index.ts
│   │   └── package.json
│   ├── shared/           # 共享类型和工具
│   │   ├── src/
│   │   │   ├── types/    # 类型定义
│   │   │   └── utils/    # 工具函数
│   │   └── package.json
│   └── client/           # 客户端 SDK (可选)
├── pnpm-workspace.yaml
└── package.json
```

## 4. 核心模块设计

### 4.1 用户管理 (UserManager)

**职责**: 管理用户连接、认证、状态

```typescript
class UserManager {
  - users: Map<userId, User>
  - connections: Map<connectionId, userId>

  + createUser(connection): User
  + getUser(userId): User | null
  + removeUser(userId): void
  + getUserByConnection(connectionId): User | null
}
```

**User 实体**:
```typescript
interface User {
  id: string              // 唯一标识
  connectionId: string    // WebSocket 连接 ID
  nickname?: string       // 昵称
  joinedRooms: Set<string> // 已加入的群组
  createdAt: number       // 创建时间
  lastActiveAt: number    // 最后活跃时间
}
```

### 4.2 群组管理 (RoomManager)

**职责**: 管理群组创建、成员、权限

```typescript
class RoomManager {
  - rooms: Map<roomId, Room>

  + createRoom(ownerId, options): Room
  + getRoom(roomId): Room | null
  + deleteRoom(roomId, operatorId): boolean
  + joinRoom(roomId, userId): boolean
  + leaveRoom(roomId, userId): boolean
  + setAnnouncement(roomId, operatorId, content): boolean
  + addAdmin(roomId, operatorId, targetUserId): boolean
  + removeAdmin(roomId, operatorId, targetUserId): boolean
}
```

**Room 实体**:
```typescript
interface Room {
  id: string
  name: string
  ownerId: string
  adminIds: Set<string>     // 最多 4 个管理员
  memberIds: Set<string>
  announcement?: string
  isPrivateChat: boolean    // 是否为私聊
  createdAt: number
  maxAdmins: number         // 默认 4
}
```

### 4.3 消息管理 (MessageManager)

**职责**: 处理消息发送、广播、历史记录

```typescript
class MessageManager {
  - messageHistory: Map<roomId, Message[]>

  + sendMessage(senderId, roomId, content): Message
  + getHistory(roomId, limit, offset): Message[]
  + broadcastToRoom(roomId, message): void
}
```

**Message 实体**:
```typescript
interface Message {
  id: string
  roomId: string
  senderId: string
  content: string
  type: 'text' | 'system'
  timestamp: number
}
```

### 4.4 存储抽象层 (Storage)

**职责**: 提供统一的数据访问接口，便于后续扩展

```typescript
interface IStorage {
  // User operations
  saveUser(user: User): Promise<void>
  getUser(userId: string): Promise<User | null>
  deleteUser(userId: string): Promise<void>

  // Room operations
  saveRoom(room: Room): Promise<void>
  getRoom(roomId: string): Promise<Room | null>
  deleteRoom(roomId: string): Promise<void>

  // Message operations
  saveMessage(message: Message): Promise<void>
  getMessages(roomId: string, limit: number, offset: number): Promise<Message[]>
}
```

**实现**:
- `MemoryStorage`: 内存实现（初期）
- `RedisStorage`: Redis 缓存（未来）
- `DatabaseStorage`: 持久化数据库（未来）

## 5. WebSocket 通信层

### 5.1 连接管理

```typescript
class WSConnectionManager {
  - connections: Map<connectionId, WebSocket>

  + addConnection(ws: WebSocket): string
  + removeConnection(connectionId: string): void
  + sendToConnection(connectionId: string, data: any): void
  + broadcast(connectionIds: string[], data: any): void
}
```

### 5.2 消息路由

```typescript
class WSMessageRouter {
  + route(connectionId: string, message: WSMessage): void
  - handlers: Map<MessageType, Handler>
}
```

## 6. HTTP 接口层

### 6.1 查询服务
- 获取群组信息
- 获取用户信息
- 获取消息历史

### 6.2 控制台服务
- 系统统计信息
- 在线用户列表
- 群组列表
- 服务器状态监控

## 7. 权限控制

### 7.1 权限级别
- **群主**: 所有权限
- **管理员**: 设置公告、踢人（未来扩展）
- **普通成员**: 发言、查看

### 7.2 权限检查

```typescript
class PermissionChecker {
  + canDeleteRoom(userId: string, room: Room): boolean
  + canSetAnnouncement(userId: string, room: Room): boolean
  + canAddAdmin(userId: string, room: Room): boolean
  + canSendMessage(userId: string, room: Room): boolean
}
```

## 8. 数据流

### 8.1 用户连接流程
```
Client -> WS Connect -> UserManager.createUser()
       -> 返回 userId -> Client 保存 userId
```

### 8.2 创建群组流程
```
Client -> WS: createRoom -> RoomManager.createRoom()
       -> 返回 roomId -> 自动加入群组
```

### 8.3 发送消息流程
```
Client -> WS: sendMessage -> 权限检查
       -> MessageManager.sendMessage()
       -> 广播给群组所有成员
```

## 9. 错误处理

### 9.1 错误码设计
```typescript
enum ErrorCode {
  UNAUTHORIZED = 1001,
  ROOM_NOT_FOUND = 2001,
  ROOM_FULL = 2002,
  PERMISSION_DENIED = 3001,
  INVALID_PARAMS = 4001,
  INTERNAL_ERROR = 5001
}
```

### 9.2 错误响应格式
```typescript
interface ErrorResponse {
  success: false
  error: {
    code: ErrorCode
    message: string
  }
}
```

## 10. 扩展性考虑

### 10.1 水平扩展
- 使用 Redis Pub/Sub 实现跨服务器消息广播
- 使用 Redis 存储会话信息

### 10.2 功能扩展
- 消息类型扩展（图片、文件等）
- 群组权限细化（禁言、踢人等）
- 好友系统
- 消息已读/未读状态

### 10.3 性能优化
- 消息批量发送
- 连接池管理
- 消息队列缓冲

## 11. 安全性

- WebSocket 连接认证
- 消息内容过滤
- 频率限制（防刷屏）
- XSS 防护
- 输入验证

## 12. 监控与日志

- 连接数监控
- 消息吞吐量统计
- 错误日志记录
- 性能指标采集
