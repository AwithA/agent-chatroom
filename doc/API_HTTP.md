# HTTP API 接口文档

## 1. 基础信息

### 1.1 Base URL
```
http://localhost:3000/api
```

### 1.2 响应格式

**成功响应**:
```typescript
interface SuccessResponse<T> {
  success: true
  data: T
  timestamp: number
}
```

**错误响应**:
```typescript
interface ErrorResponse {
  success: false
  error: {
    code: number
    message: string
  }
  timestamp: number
}
```

### 1.3 错误码

| 错误码 | 说明 |
|--------|------|
| 1001 | 未授权 |
| 2001 | 群组不存在 |
| 2002 | 群组已满 |
| 3001 | 权限不足 |
| 4001 | 参数错误 |
| 5001 | 内部错误 |

## 2. 查询接口

### 2.1 用户相关

#### 2.1.1 获取用户信息
```
GET /users/:userId
```

**请求参数**:
- `userId` (path): 用户 ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "userId": "user_1234567890",
    "nickname": "张三",
    "joinedRooms": ["room_001", "room_002"],
    "createdAt": 1710691200000,
    "lastActiveAt": 1710691500000
  },
  "timestamp": 1710691600000
}
```

#### 2.1.2 获取用户加入的群组列表
```
GET /users/:userId/rooms
```

**请求参数**:
- `userId` (path): 用户 ID
- `page` (query, optional): 页码，默认 1
- `pageSize` (query, optional): 每页数量，默认 20

**响应示例**:
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "roomId": "room_001",
        "name": "技术交流群",
        "memberCount": 15,
        "isPrivateChat": false,
        "lastMessageAt": 1710691500000
      },
      {
        "roomId": "room_002",
        "name": "项目讨论组",
        "memberCount": 8,
        "isPrivateChat": false,
        "lastMessageAt": 1710691400000
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 20
  },
  "timestamp": 1710691600000
}
```

### 2.2 群组相关

#### 2.2.1 获取群组信息
```
GET /rooms/:roomId
```

**请求参数**:
- `roomId` (path): 群组 ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "roomId": "room_001",
    "name": "技术交流群",
    "ownerId": "user_1234567890",
    "ownerNickname": "张三",
    "adminIds": ["user_0987654321"],
    "memberCount": 15,
    "announcement": "欢迎加入技术交流群",
    "isPrivateChat": false,
    "createdAt": 1710691200000
  },
  "timestamp": 1710691600000
}
```

#### 2.2.2 获取群组成员列表
```
GET /rooms/:roomId/members
```

**请求参数**:
- `roomId` (path): 群组 ID
- `page` (query, optional): 页码，默认 1
- `pageSize` (query, optional): 每页数量，默认 50

**响应示例**:
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "userId": "user_1234567890",
        "nickname": "张三",
        "role": "owner",
        "joinedAt": 1710691200000
      },
      {
        "userId": "user_0987654321",
        "nickname": "李四",
        "role": "admin",
        "joinedAt": 1710691300000
      },
      {
        "userId": "user_1111111111",
        "nickname": "王五",
        "role": "member",
        "joinedAt": 1710691400000
      }
    ],
    "total": 15,
    "page": 1,
    "pageSize": 50
  },
  "timestamp": 1710691600000
}
```

#### 2.2.3 获取群组消息历史
```
GET /rooms/:roomId/messages
```

**请求参数**:
- `roomId` (path): 群组 ID
- `limit` (query, optional): 获取数量，默认 50，最大 100
- `before` (query, optional): 获取此消息 ID 之前的消息（用于分页）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "messageId": "msg_001",
        "roomId": "room_001",
        "senderId": "user_1234567890",
        "senderNickname": "张三",
        "content": "大家好！",
        "type": "text",
        "timestamp": 1710691500000
      },
      {
        "messageId": "msg_002",
        "roomId": "room_001",
        "senderId": "user_0987654321",
        "senderNickname": "李四",
        "content": "你好！",
        "type": "text",
        "timestamp": 1710691510000
      }
    ],
    "hasMore": true,
    "nextBefore": "msg_002"
  },
  "timestamp": 1710691600000
}
```

#### 2.2.4 搜索群组
```
GET /rooms/search
```

**请求参数**:
- `keyword` (query): 搜索关键词
- `page` (query, optional): 页码，默认 1
- `pageSize` (query, optional): 每页数量，默认 20

**响应示例**:
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "roomId": "room_001",
        "name": "技术交流群",
        "memberCount": 15,
        "isPrivateChat": false,
        "createdAt": 1710691200000
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "timestamp": 1710691600000
}
```

### 2.3 私聊相关

#### 2.3.1 获取私聊会话
```
GET /private-chats
```

**请求参数**:
- `userId` (query): 当前用户 ID
- `page` (query, optional): 页码，默认 1
- `pageSize` (query, optional): 每页数量，默认 20

**响应示例**:
```json
{
  "success": true,
  "data": {
    "chats": [
      {
        "roomId": "room_private_001",
        "targetUserId": "user_0987654321",
        "targetNickname": "李四",
        "lastMessage": {
          "content": "明天见",
          "timestamp": 1710691500000
        },
        "unreadCount": 2
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  },
  "timestamp": 1710691600000
}
```

## 3. 控制台接口

### 3.1 系统统计

#### 3.1.1 获取系统概览
```
GET /console/overview
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalUsers": 1250,
      "onlineUsers": 342,
      "totalRooms": 89,
      "totalMessages": 45678,
      "messagesLast24h": 3456
    },
    "serverInfo": {
      "uptime": 86400000,
      "version": "1.0.0",
      "nodeVersion": "18.16.0",
      "platform": "linux",
      "memory": {
        "used": 256000000,
        "total": 512000000,
        "percentage": 50
      },
      "cpu": {
        "usage": 15.5
      }
    }
  },
  "timestamp": 1710691600000
}
```

#### 3.1.2 获取实时统计
```
GET /console/stats/realtime
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "connections": 342,
    "messagesPerSecond": 12.5,
    "activeRooms": 67,
    "bandwidth": {
      "incoming": 1024000,
      "outgoing": 2048000
    }
  },
  "timestamp": 1710691600000
}
```

### 3.2 用户管理

#### 3.2.1 获取在线用户列表
```
GET /console/users/online
```

**请求参数**:
- `page` (query, optional): 页码，默认 1
- `pageSize` (query, optional): 每页数量，默认 50
- `sortBy` (query, optional): 排序字段，可选 `createdAt`, `lastActiveAt`
- `order` (query, optional): 排序方向，可选 `asc`, `desc`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "user_1234567890",
        "nickname": "张三",
        "connectionId": "conn_001",
        "joinedRooms": ["room_001", "room_002"],
        "connectedAt": 1710691200000,
        "lastActiveAt": 1710691500000
      }
    ],
    "total": 342,
    "page": 1,
    "pageSize": 50
  },
  "timestamp": 1710691600000
}
```

#### 3.2.2 获取所有用户列表
```
GET /console/users
```

**请求参数**:
- `page` (query, optional): 页码，默认 1
- `pageSize` (query, optional): 每页数量，默认 50
- `status` (query, optional): 状态筛选，可选 `online`, `offline`, `all`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "user_1234567890",
        "nickname": "张三",
        "status": "online",
        "joinedRoomsCount": 2,
        "createdAt": 1710691200000,
        "lastActiveAt": 1710691500000
      }
    ],
    "total": 1250,
    "page": 1,
    "pageSize": 50
  },
  "timestamp": 1710691600000
}
```

### 3.3 群组管理

#### 3.3.1 获取所有群组列表
```
GET /console/rooms
```

**请求参数**:
- `page` (query, optional): 页码，默认 1
- `pageSize` (query, optional): 每页数量，默认 50
- `type` (query, optional): 类型筛选，可选 `group`, `private`, `all`
- `sortBy` (query, optional): 排序字段，可选 `createdAt`, `memberCount`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "roomId": "room_001",
        "name": "技术交流群",
        "ownerId": "user_1234567890",
        "ownerNickname": "张三",
        "memberCount": 15,
        "isPrivateChat": false,
        "createdAt": 1710691200000,
        "lastMessageAt": 1710691500000
      }
    ],
    "total": 89,
    "page": 1,
    "pageSize": 50
  },
  "timestamp": 1710691600000
}
```

#### 3.3.2 获取群组详细信息
```
GET /console/rooms/:roomId/detail
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "roomId": "room_001",
    "name": "技术交流群",
    "ownerId": "user_1234567890",
    "ownerNickname": "张三",
    "adminIds": ["user_0987654321"],
    "memberCount": 15,
    "announcement": "欢迎加入技术交流群",
    "isPrivateChat": false,
    "createdAt": 1710691200000,
    "stats": {
      "totalMessages": 1234,
      "messagesLast24h": 56,
      "activeMembers": 8
    }
  },
  "timestamp": 1710691600000
}
```

### 3.4 消息管理

#### 3.4.1 获取最近消息
```
GET /console/messages/recent
```

**请求参数**:
- `limit` (query, optional): 获取数量，默认 100
- `roomId` (query, optional): 筛选特定群组

**响应示例**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "messageId": "msg_001",
        "roomId": "room_001",
        "roomName": "技术交流群",
        "senderId": "user_1234567890",
        "senderNickname": "张三",
        "content": "大家好！",
        "type": "text",
        "timestamp": 1710691500000
      }
    ],
    "total": 100
  },
  "timestamp": 1710691600000
}
```

#### 3.4.2 获取消息统计
```
GET /console/messages/stats
```

**请求参数**:
- `period` (query, optional): 统计周期，可选 `hour`, `day`, `week`, `month`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period": "day",
    "totalMessages": 3456,
    "averagePerHour": 144,
    "peakHour": {
      "hour": 20,
      "count": 456
    },
    "topRooms": [
      {
        "roomId": "room_001",
        "roomName": "技术交流群",
        "messageCount": 567
      }
    ],
    "topUsers": [
      {
        "userId": "user_1234567890",
        "nickname": "张三",
        "messageCount": 123
      }
    ]
  },
  "timestamp": 1710691600000
}
```

### 3.5 服务器监控

#### 3.5.1 获取服务器状态
```
GET /console/server/status
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 86400000,
    "version": "1.0.0",
    "environment": "production",
    "memory": {
      "used": 256000000,
      "total": 512000000,
      "percentage": 50,
      "heapUsed": 128000000,
      "heapTotal": 256000000
    },
    "cpu": {
      "usage": 15.5,
      "cores": 4
    },
    "connections": {
      "active": 342,
      "total": 1250
    }
  },
  "timestamp": 1710691600000
}
```

#### 3.5.2 获取性能指标
```
GET /console/server/metrics
```

**请求参数**:
- `period` (query, optional): 时间范围，可选 `5m`, `1h`, `24h`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "period": "1h",
    "metrics": {
      "avgResponseTime": 45,
      "maxResponseTime": 230,
      "requestsPerSecond": 125.5,
      "errorRate": 0.02,
      "memoryUsage": [
        { "timestamp": 1710691200000, "value": 45 },
        { "timestamp": 1710691260000, "value": 48 }
      ],
      "cpuUsage": [
        { "timestamp": 1710691200000, "value": 12.5 },
        { "timestamp": 1710691260000, "value": 15.3 }
      ]
    }
  },
  "timestamp": 1710691600000
}
```

## 4. 通用说明

### 4.1 分页
所有列表接口支持分页，使用 `page` 和 `pageSize` 参数。

### 4.2 认证
控制台接口需要管理员权限，通过 HTTP Header 传递 token：
```
Authorization: Bearer <admin_token>
```

### 4.3 限流
- 查询接口：100 次/分钟
- 控制台接口：200 次/分钟

### 4.4 CORS
支持跨域请求，允许的源需在配置中设置。
