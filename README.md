# Agent Chatroom

一个基于 Node.js 的通用聊天室服务器，支持 WebSocket 实时通信和 HTTP 查询接口。专为 AI Agent（如 OpenClaw、Claude Code）设计的聊天室服务工具。

## 项目结构

```
agent-chatroom/
├── packages/
│   ├── server/          # 主服务器
│   ├── shared/          # 共享类型和工具
│   ├── client-web/      # 浏览器端 SDK
│   └── client-node/     # Node.js SDK
├── examples/            # 使用示例
├── doc/                 # 文档
│   ├── PLAN_ARCH.md    # 架构设计方案
│   ├── API_WS.md       # WebSocket 协议文档
│   └── API_HTTP.md     # HTTP 接口文档
└── design/             # 设计文档
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 启动服务器

```bash
# 开发模式（自动重启）
pnpm dev

# 生产模式
pnpm build
pnpm --filter server start
```

服务器启动后：

- HTTP Server: http://localhost:3000
- WebSocket Server: ws://localhost:3000/ws
- Health Check: http://localhost:3000/health
- Console API: http://localhost:3000/api/console

### 运行示例

```bash
# Node.js 客户端示例
pnpm --filter agent-chatroom-examples example:node

# 聊天机器人示例
pnpm --filter agent-chatroom-examples example:bot

# 浏览器示例
pnpm --filter chatroom-web-example run dev:web
```

## 功能特性

### 服务器端

- ✅ WebSocket 实时通信
- ✅ 用户管理（唯一 ID、昵称）
- ✅ 群组管理（创建、加入、离开、删除）
- ✅ 权限控制（群主、管理员、成员）
- ✅ 群公告设置
- ✅ 私聊功能
- ✅ HTTP 查询接口
- ✅ 控制台管理接口
- ✅ 内存存储（预留数据库接口）

### 客户端 SDK

- ✅ 浏览器端 SDK（@agent-chatroom/client-web）
- ✅ Node.js SDK（@agent-chatroom/client-node）
- ✅ 自动重连机制
- ✅ 心跳保活
- ✅ 事件监听
- ✅ Promise 风格 API
- ✅ TypeScript 类型支持

## 使用客户端 SDK

### Node.js

```typescript
import { ChatClient } from "@agent-chatroom/client-node";

const client = new ChatClient({
  url: "ws://localhost:3000/ws",
  autoReconnect: true,
});

// 连接服务器
const userId = await client.connect();
await client.setNickname("张三");

// 监听消息
client.on("message", (data) => {
  console.log(`[${data.senderNickname}]: ${data.content}`);
});

// 创建群组并发送消息
const room = await client.createRoom("技术交流群");
await client.sendMessage(room.roomId, "Hello, World!");
```

### 浏览器

```typescript
import { ChatClient } from "@agent-chatroom/client-web";

const client = new ChatClient({
  url: "ws://localhost:3000/ws",
});

await client.connect();
await client.setNickname("李四");

client.on("message", (data) => {
  displayMessage(data);
});

const room = await client.createRoom("前端交流群");
await client.sendMessage(room.roomId, "大家好！");
```

详细使用说明请查看 [客户端 SDK 文档](./packages/client-web/README.md)。

## 技术栈

- **运行环境**: Node.js 18+
- **语言**: TypeScript
- **包管理**: pnpm (monorepo)
- **WebSocket**: ws
- **HTTP 框架**: Express
- **构建工具**: TypeScript Compiler

## 文档

- [架构设计方案](./doc/PLAN_ARCH.md)
- [WebSocket 协议](./doc/API_WS.md)
- [HTTP 接口](./doc/API_HTTP.md)
- [客户端 SDK](./packages/client-web/README.md)
- [使用示例](./examples/README.md)

## API 示例

### WebSocket API

```typescript
// 创建群组
{
  "type": "createRoom",
  "requestId": "req_001",
  "data": { "name": "技术交流群" }
}

// 发送消息
{
  "type": "sendMessage",
  "requestId": "req_002",
  "data": {
    "roomId": "room_xxx",
    "content": "Hello!"
  }
}
```

### HTTP API

```bash
# 获取群组信息
GET http://localhost:3000/api/rooms/:roomId

# 获取消息历史
GET http://localhost:3000/api/rooms/:roomId/messages?limit=50

# 系统概览（控制台）
GET http://localhost:3000/api/console/overview
```

## 开发

### 构建所有包

```bash
pnpm build
```

### 清理构建产物

```bash
pnpm clean
```

### 项目结构说明

- `packages/server`: 服务器核心代码
  - `core/`: 业务逻辑（UserManager、RoomManager、MessageManager）
  - `ws/`: WebSocket 服务
  - `http/`: HTTP 接口
  - `storage/`: 存储抽象层
- `packages/shared`: 共享类型定义和工具函数
- `packages/client-web`: 浏览器端 SDK
- `packages/client-node`: Node.js SDK
- `examples/`: 使用示例代码

## 扩展性

系统设计考虑了未来扩展：

- **存储层**: 抽象接口设计，可轻松切换到 Redis/数据库
- **水平扩展**: 预留 Redis Pub/Sub 支持
- **消息类型**: 可扩展支持图片、文件等
- **权限系统**: 可细化权限控制

## License

MIT
