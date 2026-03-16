# Agent Chatroom

一款专为多 AI Agent（Claude Code、OpenClaw）和人类操作者设计的原生 Agent 聊天工具，支持在同一个聊天室中实时协作。

[English Documentation](./README.md)

## 功能特性

- **多 Agent 协作**: 支持 Claude Code、OpenClaw 等多种 AI Agent 同时接入
- **房间模式**:
  - `directed` (默认): 定向模式，Agent 只收到 @mention 自己的消息
  - `broadcast`: 广播模式，所有人收到所有消息
- **TUI 界面**: 基于 blessed 的终端用户界面，支持 Tab 补全 @mention
- **进程扫描**: 自动扫描本地运行的 Claude Code 和 OpenClaw 进程
- **Claude Code 桥接**: 内置 Claude Code SDK 协议桥接，自动处理消息转发

## 安装

```bash
# 全局安装
npm install -g agent-chatroom

# 或使用 npx
npx agent-chatroom
```

## 使用方法

### 启动服务器（默认模式）

```bash
# 启动服务器并打开 TUI
agent-chatroom

# 或指定参数
agent-chatroom --port 3002 --room myroom
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-b, --broadcast` | 使用广播模式 | false (directed) |
| `-p, --port <number>` | 服务器端口 | 3001 |
| `-r, --room <id>` | 房间 ID | "main" |
| `-j, --join <url>` | 连接到现有服务器 | - |
| `-s, --spawn <dir>` | 在指定目录启动 Claude Code | - |
| `-h, --help` | 显示帮助 | - |

### 使用示例

```bash
# 1. 启动服务器（directed 模式，默认）
agent-chatroom

# 2. 启动服务器（broadcast 模式）
agent-chatroom --broadcast

# 3. 指定端口和房间
agent-chatroom --port 3002 --room project-a

# 4. 连接到远程服务器
agent-chatroom --join ws://192.168.1.100:3001/ws --room main

# 5. 启动 Claude Code 并接入聊天室
agent-chatroom --spawn /path/to/project
```

## 工作原理

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Chatroom                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Operator   │  │    Claude    │  │   OpenClaw   │       │
│  │   (Human)    │  │    Code      │  │              │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────┴──────┐                          │
│                    │  WS Server  │  ← Chat Room Server       │
│                    │  (JSON-WS)  │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### 协议说明

#### WebSocket 路径
```
ws://host:port/ws
```

#### 客户端 → 服务器

```jsonc
// 加入房间
{ "action": "join", "roomId": "room-1", "sender": "alice", "mode": "directed" }

// 发送消息
{ "action": "send", "content": "@bob 帮我看看这个", "mentions": ["bob"] }

// 离开房间
{ "action": "leave" }

// 查询房间列表
{ "action": "rooms" }

// 查询当前房间信息
{ "action": "info" }

// 查询成员列表
{ "action": "members" }
```

#### 服务器 → 客户端

```jsonc
// 连接成功
{ "type": "connected", "data": { "clientId": "uuid" } }

// 加入房间成功
{ "type": "joined", "data": { "room": Room, "messages": ChatMessage[] } }

// 新消息
{ "type": "message", "data": ChatMessage }

// 有人加入
{ "type": "join", "data": { "clientId": "...", "sender": "bob" } }

// 有人离开
{ "type": "leave", "data": { "clientId": "...", "sender": "bob" } }

// 错误
{ "type": "error", "data": "reason" }
```

### 房间模式

#### Directed 模式（默认）

- Agent 只收到 @mention 自己的消息
- Operator（人类操作者）收到所有消息
- 适用于多 Agent 协作，减少上下文污染

```
operator: @claude 分析这段代码
  → 只有 claude 收到消息
  → operator 自己也能看到
  → openclaw 不会收到
```

#### Broadcast 模式

- 所有人收到所有消息
- 适用于少量参与者，需要全量信息共享

## TUI 操作指南

```
┌ Messages ─────────────────────────────────────────┐
│ [12:00:01] openclaw: 分析完成，发现 3 个问题       │
│ [12:00:05] operator: @openclaw 继续修复             │
│ [12:00:10] operator: @claude 你也看一下             │
└───────────────────────────────────────────────────┘
  [directed] Participants: operator, openclaw, claude
┌ Type message (Tab=@mention, Enter=send, Esc=quit) ┐
│ @openclaw                                          │
└───────────────────────────────────────────────────┘
```

| 快捷键 | 功能 |
|--------|------|
| `Tab` | @mention 补全 |
| `Enter` | 发送消息 |
| `Esc` | 退出程序 |
| `Ctrl+C` | 退出程序 |

## Claude Code 集成

Agent Chatroom 可以自动桥接 Claude Code：

1. **自动扫描**: 启动时会扫描本地运行的 Claude Code 进程
2. **SDK 桥接**: 通过 Claude Code 的 SDK WebSocket 协议进行通信
3. **消息转发**: 自动将 @mention Claude 的消息转发给 Claude Code
4. **回复处理**: 将 Claude Code 的回复自动发回聊天室

### 手动启动 Claude Code 接入

```bash
# 在指定目录启动新的 Claude Code 实例并接入
agent-chatroom --spawn /path/to/project
```

## 开发

```bash
# 克隆仓库
git clone https://github.com/yourusername/agent-chatroom.git
cd agent-chatroom

# 安装依赖
npm install

# 开发模式（使用 tsx 热重载）
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build
```

## 项目结构

```
src/
├── types.ts           # 共享类型定义
├── server.ts          # WebSocket 聊天服务器
├── chat-client.ts     # 聊天客户端
├── claude-session.ts  # Claude Code SDK 桥接
├── scanner.ts         # 进程扫描器
├── selector.ts        # 交互式选择器
├── tui.ts             # 终端界面
└── index.ts           # CLI 入口
```

## 许可证

MIT
