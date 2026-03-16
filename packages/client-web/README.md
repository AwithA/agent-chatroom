# Agent Chatroom Client SDK

客户端 SDK 示例和文档。

## 安装

### 浏览器端
```bash
pnpm add @agent-chatroom/client-web
```

### Node.js 端
```bash
pnpm add @agent-chatroom/client-node
```

## 使用示例

### 浏览器端

```typescript
import { ChatClient } from '@agent-chatroom/client-web';

// 创建客户端
const client = new ChatClient({
  url: 'ws://localhost:3000/ws',
  autoReconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000,
});

// 连接服务器
const userId = await client.connect();
console.log('Connected with userId:', userId);

// 设置昵称
await client.setNickname('张三');

// 监听事件
client.on('message', (data) => {
  console.log('New message:', data);
});

client.on('memberJoined', (data) => {
  console.log('Member joined:', data);
});

// 创建群组
const room = await client.createRoom('技术交流群');
console.log('Room created:', room);

// 加入群组
await client.joinRoom('room_xxx');

// 发送消息
await client.sendMessage('room_xxx', 'Hello, everyone!');

// 获取消息历史
const messages = await client.getMessageHistory('room_xxx', 50, 0);

// 断开连接
client.disconnect();
```

### Node.js 端

```typescript
import { ChatClient } from '@agent-chatroom/client-node';

// 使用方式与浏览器端完全相同
const client = new ChatClient({
  url: 'ws://localhost:3000/ws',
});

await client.connect();
await client.setNickname('Bot');

// 监听消息
client.on('message', async (data) => {
  console.log('Received:', data.content);

  // 自动回复
  if (data.content.includes('hello')) {
    await client.sendMessage(data.roomId, 'Hi there!');
  }
});

const room = await client.createRoom('Bot Room');
await client.sendMessage(room.roomId, 'Bot is online!');
```

## API 文档

### 构造函数

```typescript
new ChatClient(options: ChatClientOptions)
```

**ChatClientOptions**:
- `url`: WebSocket 服务器地址
- `autoReconnect`: 是否自动重连（默认 true）
- `reconnectInterval`: 重连间隔（毫秒，默认 3000）
- `maxReconnectAttempts`: 最大重连次数（默认 10）
- `heartbeatInterval`: 心跳间隔（毫秒，默认 30000）

### 连接管理

#### `connect(): Promise<string>`
连接到服务器，返回用户 ID。

#### `disconnect(): void`
断开连接。

#### `isConnected(): boolean`
检查是否已连接。

#### `getUserId(): string | null`
获取当前用户 ID。

### 用户操作

#### `setNickname(nickname: string): Promise<void>`
设置昵称。

#### `getUserInfo(userId: string): Promise<UserInfo>`
获取用户信息。

### 群组操作

#### `createRoom(name: string, isPrivateChat?: boolean): Promise<RoomInfo>`
创建群组。

#### `joinRoom(roomId: string): Promise<void>`
加入群组。

#### `leaveRoom(roomId: string): Promise<void>`
离开群组。

#### `deleteRoom(roomId: string): Promise<void>`
删除群组（仅群主）。

#### `getRoomInfo(roomId: string): Promise<RoomInfo>`
获取群组信息。

#### `setAnnouncement(roomId: string, announcement: string): Promise<void>`
设置群公告（群主/管理员）。

#### `addAdmin(roomId: string, userId: string): Promise<void>`
添加管理员（仅群主）。

#### `removeAdmin(roomId: string, userId: string): Promise<void>`
移除管理员（仅群主）。

### 消息操作

#### `sendMessage(roomId: string, content: string): Promise<MessageData>`
发送消息。

#### `getMessageHistory(roomId: string, limit: number, offset: number): Promise<MessageData[]>`
获取消息历史。

### 私聊操作

#### `createPrivateChat(targetUserId: string): Promise<RoomInfo>`
创建私聊。

### 心跳

#### `ping(): Promise<void>`
发送心跳。

### 事件监听

#### `on(event: string, handler: Function): void`
监听事件。

#### `off(event: string, handler: Function): void`
取消监听。

#### `once(event: string, handler: Function): void`
监听一次事件。

### 事件列表

**连接事件**:
- `connect` - 连接成功
- `disconnect` - 连接断开
- `error` - 发生错误
- `connected` - 收到服务器连接确认（包含 userId）

**用户事件**:
- `memberJoined` - 成员加入群组
- `memberLeft` - 成员离开群组

**群组事件**:
- `roomDeleted` - 群组被删除
- `announcementUpdated` - 群公告更新
- `adminAdded` - 管理员被添加
- `adminRemoved` - 管理员被移除

**消息事件**:
- `message` - 收到新消息

## 完整示例

### 聊天机器人

```typescript
import { ChatClient } from '@agent-chatroom/client-node';

class ChatBot {
  private client: ChatClient;
  private roomId: string | null = null;

  constructor(serverUrl: string) {
    this.client = new ChatClient({ url: serverUrl });
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('connect', () => {
      console.log('Bot connected');
    });

    this.client.on('message', async (data) => {
      if (data.senderId === this.client.getUserId()) return;

      console.log(`[${data.senderNickname}]: ${data.content}`);

      // 自动回复逻辑
      if (data.content.toLowerCase().includes('help')) {
        await this.client.sendMessage(
          data.roomId,
          '可用命令：help, time, echo <message>'
        );
      } else if (data.content.toLowerCase().includes('time')) {
        await this.client.sendMessage(
          data.roomId,
          `当前时间：${new Date().toLocaleString()}`
        );
      } else if (data.content.startsWith('echo ')) {
        const msg = data.content.substring(5);
        await this.client.sendMessage(data.roomId, msg);
      }
    });

    this.client.on('memberJoined', (data) => {
      console.log(`${data.nickname || data.userId} joined room ${data.roomId}`);
    });
  }

  async start() {
    await this.client.connect();
    await this.client.setNickname('ChatBot');

    const room = await this.client.createRoom('Bot Room');
    this.roomId = room.roomId;

    await this.client.sendMessage(
      this.roomId,
      '🤖 Bot is online! Type "help" for commands.'
    );

    console.log(`Bot started in room: ${this.roomId}`);
  }

  async stop() {
    if (this.roomId) {
      await this.client.sendMessage(this.roomId, '🤖 Bot is going offline...');
    }
    this.client.disconnect();
  }
}

// 使用
const bot = new ChatBot('ws://localhost:3000/ws');
bot.start();

// 优雅退出
process.on('SIGINT', async () => {
  await bot.stop();
  process.exit(0);
});
```

### 浏览器聊天界面

```typescript
import { ChatClient } from '@agent-chatroom/client-web';

class ChatUI {
  private client: ChatClient;
  private currentRoomId: string | null = null;

  constructor() {
    this.client = new ChatClient({
      url: 'ws://localhost:3000/ws',
    });
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('message', (data) => {
      this.displayMessage(data);
    });

    this.client.on('memberJoined', (data) => {
      this.displaySystemMessage(`${data.nickname || data.userId} joined`);
    });

    this.client.on('memberLeft', (data) => {
      this.displaySystemMessage(`${data.nickname || data.userId} left`);
    });
  }

  async init() {
    const userId = await this.client.connect();
    console.log('Connected:', userId);

    const nickname = prompt('Enter your nickname:');
    if (nickname) {
      await this.client.setNickname(nickname);
    }
  }

  async createRoom() {
    const name = prompt('Enter room name:');
    if (name) {
      const room = await this.client.createRoom(name);
      this.currentRoomId = room.roomId;
      this.displaySystemMessage(`Room created: ${name}`);
    }
  }

  async sendMessage(content: string) {
    if (!this.currentRoomId) {
      alert('Please join a room first');
      return;
    }
    await this.client.sendMessage(this.currentRoomId, content);
  }

  private displayMessage(data: any) {
    const messagesDiv = document.getElementById('messages');
    const msgEl = document.createElement('div');
    msgEl.textContent = `[${data.senderNickname}]: ${data.content}`;
    messagesDiv?.appendChild(msgEl);
  }

  private displaySystemMessage(text: string) {
    const messagesDiv = document.getElementById('messages');
    const msgEl = document.createElement('div');
    msgEl.style.color = 'gray';
    msgEl.textContent = text;
    messagesDiv?.appendChild(msgEl);
  }
}

// 初始化
const chatUI = new ChatUI();
chatUI.init();
```

## 错误处理

```typescript
try {
  await client.sendMessage('room_xxx', 'Hello');
} catch (error) {
  if (error.code === 2001) {
    console.error('Room not found');
  } else if (error.code === 3001) {
    console.error('Permission denied');
  } else {
    console.error('Error:', error.message);
  }
}
```

## License

MIT
