# Examples

客户端 SDK 使用示例。

## 运行示例

### 1. 确保服务器正在运行

```bash
pnpm dev
```

### 2. Node.js 客户端示例

```bash
pnpm --filter examples example:node
```

### 3. 聊天机器人示��

```bash
pnpm --filter examples example:bot
```

可以设置环境变量自定义机器人：

```bash
SERVER_URL=ws://localhost:3000/ws BOT_NAME=MyBot pnpm --filter examples example:bot
```

### 4. 浏览器客户端示例

由于浏览器的 ES 模块限制，需要通过 HTTP 服务器运行：

```bash
# 方法 1: 使用项目脚本
npm run dev:web

# 方法 2: 使用 http-server
npx http-server examples -p 8080 -c-1 --cors

# 方法 3: 使用 Python
cd examples
python -m http.server 8080
```

然后在浏览器中打开: http://localhost:8080/web-client-example.html

**注意**: 不能直接用 `file://` 协议打开 HTML 文件，会遇到 CORS 错误。

## 示例说明

### node-client-example.ts

基础的 Node.js 客户端示例，演示：
- 连接服务器
- 设置昵称
- 创建群组
- 发送消息
- 获取消息历史
- 设置群公告

### chatbot-example.ts

功能完整的聊天机器人，支持：
- 自动回复
- 命令处理（help, time, echo, joke, info, stats）
- 欢迎新成员
- 优雅退出
- **REPL 交互式命令**:
  - `/create <name>` - 创建新群组
  - `/join <roomId>` - 加入群组
  - `/leave` - 离开当前群组
  - `/list [keyword]` - 查看所有群组
  - `/send <message>` - 发送消息
  - `/members` - 查看群成员
  - `/announce <text>` - 设置群公告
  - `/help` - 显示帮助
  - `/quit` - 退出

### web-client-example.html

浏览器端聊天界面示例，包含：
- 连接状态显示
- 群组列表
- 消息显示（实时接收）
- 发送消息
- 创建群组
- 查看所有群组
- 加入群组
- 设置昵称
- 消息历史加载

## 多客户端测试

可以同时运行多个客户端进行测试：

```bash
# 终端 1：启动服务器
pnpm dev

# 终端 2：启动机器人
pnpm --filter examples example:bot

# 终端 3：启动另一个客户端
pnpm --filter examples example:node

# 浏览器：打开 web-client-example.html
```

## 自定义示例

你可以基于这些示例创建自己的客户端应用：

```typescript
import { ChatClient } from '@agent-chatroom/client-node';

const client = new ChatClient({
  url: 'ws://localhost:3000/ws',
});

await client.connect();
await client.setNickname('MyApp');

// 监听新消息（注意：事件名是 newMessage）
client.on('newMessage', (data) => {
  console.log('New message:', data);
});

// 查看所有群组
const { rooms } = await client.listRooms();
console.log('Available rooms:', rooms);

// 创建或加入群组
const room = await client.createRoom('My Room');
await client.joinRoom(room.roomId);

// 发送消息
await client.sendMessage(room.roomId, 'Hello!');
```
