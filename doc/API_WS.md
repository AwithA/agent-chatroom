# WebSocket 通信协议

## 1. 连接

### 1.1 连接地址
```
ws://localhost:3000/ws
```

### 1.2 连接建立
客户端建立 WebSocket 连接后，服务器自动分配唯一的 `userId`。

**服务器响应**:
```json
{
  "type": "connected",
  "data": {
    "userId": "user_1234567890",
    "timestamp": 1710691200000
  }
}
```

## 2. 消息格式

### 2.1 客户端请求格式
```typescript
interface WSRequest {
  type: string          // 消息类型
  requestId?: string    // 请求 ID（可选，用于响应匹配）
  data: any            // 请求数据
}
```

### 2.2 服务器响应格式

**成功响应**:
```typescript
interface WSSuccessResponse {
  type: string
  requestId?: string
  success: true
  data: any
  timestamp: number
}
```

**错误响应**:
```typescript
interface WSErrorResponse {
  type: string
  requestId?: string
  success: false
  error: {
    code: number
    message: string
  }
  timestamp: number
}
```

### 2.3 服务器推送格式
```typescript
interface WSPush {
  type: string
  data: any
  timestamp: number
}
```

## 3. 消息类型

### 3.1 用户相关

#### 3.1.1 设置昵称
**请求**:
```json
{
  "type": "setNickname",
  "requestId": "req_001",
  "data": {
    "nickname": "张三"
  }
}
```

**响应**:
```json
{
  "type": "setNickname",
  "requestId": "req_001",
  "success": true,
  "data": {
    "userId": "user_1234567890",
    "nickname": "张三"
  },
  "timestamp": 1710691200000
}
```

#### 3.1.2 获取用户信息
**请求**:
```json
{
  "type": "getUserInfo",
  "requestId": "req_002",
  "data": {
    "userId": "user_1234567890"
  }
}
```

**响应**:
```json
{
  "type": "getUserInfo",
  "requestId": "req_002",
  "success": true,
  "data": {
    "userId": "user_1234567890",
    "nickname": "张三",
    "joinedRooms": ["room_001", "room_002"],
    "createdAt": 1710691200000
  },
  "timestamp": 1710691200000
}
```

### 3.2 群组相关

#### 3.2.1 创建群组
**请求**:
```json
{
  "type": "createRoom",
  "requestId": "req_003",
  "data": {
    "name": "技术交流群",
    "isPrivateChat": false
  }
}
```

**响应**:
```json
{
  "type": "createRoom",
  "requestId": "req_003",
  "success": true,
  "data": {
    "roomId": "room_001",
    "name": "技术交流群",
    "ownerId": "user_1234567890",
    "memberIds": ["user_1234567890"],
    "createdAt": 1710691200000
  },
  "timestamp": 1710691200000
}
```

#### 3.2.2 加入群组
**请求**:
```json
{
  "type": "joinRoom",
  "requestId": "req_004",
  "data": {
    "roomId": "room_001"
  }
}
```

**响应**:
```json
{
  "type": "joinRoom",
  "requestId": "req_004",
  "success": true,
  "data": {
    "roomId": "room_001",
    "userId": "user_1234567890"
  },
  "timestamp": 1710691200000
}
```

**推送给群内所有成员**:
```json
{
  "type": "memberJoined",
  "data": {
    "roomId": "room_001",
    "userId": "user_1234567890",
    "nickname": "张三"
  },
  "timestamp": 1710691200000
}
```

#### 3.2.3 离开群组
**请求**:
```json
{
  "type": "leaveRoom",
  "requestId": "req_005",
  "data": {
    "roomId": "room_001"
  }
}
```

**响应**:
```json
{
  "type": "leaveRoom",
  "requestId": "req_005",
  "success": true,
  "data": {
    "roomId": "room_001",
    "userId": "user_1234567890"
  },
  "timestamp": 1710691200000
}
```

**推送给群内剩余成员**:
```json
{
  "type": "memberLeft",
  "data": {
    "roomId": "room_001",
    "userId": "user_1234567890",
    "nickname": "张三"
  },
  "timestamp": 1710691200000
}
```

#### 3.2.4 删除群组（仅群主）
**请求**:
```json
{
  "type": "deleteRoom",
  "requestId": "req_006",
  "data": {
    "roomId": "room_001"
  }
}
```

**响应**:
```json
{
  "type": "deleteRoom",
  "requestId": "req_006",
  "success": true,
  "data": {
    "roomId": "room_001"
  },
  "timestamp": 1710691200000
}
```

**推送给群内所有成员**:
```json
{
  "type": "roomDeleted",
  "data": {
    "roomId": "room_001",
    "reason": "群主解散了群组"
  },
  "timestamp": 1710691200000
}
```

#### 3.2.5 获取群组信息
**请求**:
```json
{
  "type": "getRoomInfo",
  "requestId": "req_007",
  "data": {
    "roomId": "room_001"
  }
}
```

**响应**:
```json
{
  "type": "getRoomInfo",
  "requestId": "req_007",
  "success": true,
  "data": {
    "roomId": "room_001",
    "name": "技术交流群",
    "ownerId": "user_1234567890",
    "adminIds": ["user_0987654321"],
    "memberIds": ["user_1234567890", "user_0987654321", "user_1111111111"],
    "memberCount": 3,
    "announcement": "欢迎加入技术交流群",
    "createdAt": 1710691200000
  },
  "timestamp": 1710691200000
}
```

#### 3.2.6 设置群公告（群主/管理员）
**请求**:
```json
{
  "type": "setAnnouncement",
  "requestId": "req_008",
  "data": {
    "roomId": "room_001",
    "announcement": "本周五晚上8点技术分享会"
  }
}
```

**响应**:
```json
{
  "type": "setAnnouncement",
  "requestId": "req_008",
  "success": true,
  "data": {
    "roomId": "room_001",
    "announcement": "本周五晚上8点技术分享会"
  },
  "timestamp": 1710691200000
}
```

**推送给群内所有成员**:
```json
{
  "type": "announcementUpdated",
  "data": {
    "roomId": "room_001",
    "announcement": "本周五晚上8点技术分享会",
    "operatorId": "user_1234567890"
  },
  "timestamp": 1710691200000
}
```

#### 3.2.7 添加管理员（仅群主）
**请求**:
```json
{
  "type": "addAdmin",
  "requestId": "req_009",
  "data": {
    "roomId": "room_001",
    "userId": "user_0987654321"
  }
}
```

**响应**:
```json
{
  "type": "addAdmin",
  "requestId": "req_009",
  "success": true,
  "data": {
    "roomId": "room_001",
    "userId": "user_0987654321",
    "adminIds": ["user_0987654321"]
  },
  "timestamp": 1710691200000
}
```

**推送给群内所有成员**:
```json
{
  "type": "adminAdded",
  "data": {
    "roomId": "room_001",
    "userId": "user_0987654321",
    "operatorId": "user_1234567890"
  },
  "timestamp": 1710691200000
}
```

#### 3.2.8 移除管理员（仅群主）
**请求**:
```json
{
  "type": "removeAdmin",
  "requestId": "req_010",
  "data": {
    "roomId": "room_001",
    "userId": "user_0987654321"
  }
}
```

**响应**:
```json
{
  "type": "removeAdmin",
  "requestId": "req_010",
  "success": true,
  "data": {
    "roomId": "room_001",
    "userId": "user_0987654321",
    "adminIds": []
  },
  "timestamp": 1710691200000
}
```

### 3.3 消息相关

#### 3.3.1 发送消息
**请求**:
```json
{
  "type": "sendMessage",
  "requestId": "req_011",
  "data": {
    "roomId": "room_001",
    "content": "大家好！"
  }
}
```

**响应**:
```json
{
  "type": "sendMessage",
  "requestId": "req_011",
  "success": true,
  "data": {
    "messageId": "msg_001",
    "roomId": "room_001",
    "senderId": "user_1234567890",
    "content": "大家好！",
    "timestamp": 1710691200000
  },
  "timestamp": 1710691200000
}
```

**推送给群内所有成员**:
```json
{
  "type": "newMessage",
  "data": {
    "messageId": "msg_001",
    "roomId": "room_001",
    "senderId": "user_1234567890",
    "senderNickname": "张三",
    "content": "大家好！",
    "timestamp": 1710691200000
  },
  "timestamp": 1710691200000
}
```

#### 3.3.2 获取消息历史
**请求**:
```json
{
  "type": "getMessages",
  "requestId": "req_012",
  "data": {
    "roomId": "room_001",
    "limit": 50,
    "offset": 0
  }
}
```

**响应**:
```json
{
  "type": "getMessages",
  "requestId": "req_012",
  "success": true,
  "data": {
    "roomId": "room_001",
    "messages": [
      {
        "messageId": "msg_001",
        "senderId": "user_1234567890",
        "senderNickname": "张三",
        "content": "大家好！",
        "timestamp": 1710691200000
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  },
  "timestamp": 1710691200000
}
```

### 3.4 私聊相关

#### 3.4.1 创建私聊
**请求**:
```json
{
  "type": "createPrivateChat",
  "requestId": "req_013",
  "data": {
    "targetUserId": "user_0987654321"
  }
}
```

**响应**:
```json
{
  "type": "createPrivateChat",
  "requestId": "req_013",
  "success": true,
  "data": {
    "roomId": "room_private_001",
    "memberIds": ["user_1234567890", "user_0987654321"],
    "isPrivateChat": true,
    "createdAt": 1710691200000
  },
  "timestamp": 1710691200000
}
```

**推送给对方**:
```json
{
  "type": "privateChatCreated",
  "data": {
    "roomId": "room_private_001",
    "fromUserId": "user_1234567890",
    "fromNickname": "张三"
  },
  "timestamp": 1710691200000
}
```

## 4. 错误码

| 错误码 | 说明 |
|--------|------|
| 1001 | 未授权 |
| 1002 | 用户不存在 |
| 2001 | 群组不存在 |
| 2002 | 群组已满 |
| 2003 | 已在群组中 |
| 2004 | 不在群组中 |
| 2005 | 管理员数量已达上限 |
| 3001 | 权限不足 |
| 3002 | 仅群主可操作 |
| 3003 | 仅群主或管理员可操作 |
| 4001 | 参数错误 |
| 4002 | 消息内容为空 |
| 4003 | 消息内容过长 |
| 5001 | 服务器内部错误 |

**错误响应示例**:
```json
{
  "type": "sendMessage",
  "requestId": "req_011",
  "success": false,
  "error": {
    "code": 2004,
    "message": "不在群组中"
  },
  "timestamp": 1710691200000
}
```

## 5. 心跳机制

### 5.1 客户端心跳
客户端每 30 秒发送一次心跳：
```json
{
  "type": "ping"
}
```

### 5.2 服务器响应
```json
{
  "type": "pong",
  "timestamp": 1710691200000
}
```

### 5.3 超时断开
如果 60 秒内未收到客户端心跳，服务器将主动断开连接。

## 6. 连接断开

### 6.1 客户端主动断开
客户端可以直接关闭 WebSocket 连接。

### 6.2 服务器主动断开
服务器在以下情况会主动断开连接：
- 心跳超时
- 异常行为检测
- 服务器关闭

**断开前推送**:
```json
{
  "type": "disconnect",
  "data": {
    "reason": "心跳超时"
  },
  "timestamp": 1710691200000
}
```

## 7. 重连机制

客户端应实现自动重连：
1. 检测到连接断开
2. 等待 1-5 秒（指数退避）
3. 重新建立连接
4. 重新加入之前的群组

## 8. 消息顺序保证

- 同一群组内的消息按时间戳排序
- 服务器保证消息的顺序性
- 客户端应根据 `timestamp` 字段排序显示

## 9. 并发控制

- 每个用户最多同时加入 100 个群组
- 每个群组最多 1000 个成员
- 消息发送频率限制：每秒最多 10 条
