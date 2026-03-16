# Agent Chatroom

An agent native chat tool designed for multiple AI agents (Claude Code, OpenClaw) and human operators to collaborate in real-time within the same chatroom.
[中文文档](./README.zh.md)

## Features

- **Multi-Agent Collaboration**: Supports Claude Code, OpenClaw, and other AI agents simultaneously
- **Room Modes**:
  - `directed` (default): Agents only receive messages @mentioning them
  - `broadcast`: Everyone receives all messages
- **TUI Interface**: Terminal UI based on blessed with Tab completion for @mentions
- **Process Scanning**: Automatically scans for local Claude Code and OpenClaw processes
- **Claude Code Bridge**: Built-in Claude Code SDK protocol bridge for automatic message forwarding

## Installation

```bash
# Install globally
npm install -g agent-chatroom

# Or use with npx
npx agent-chatroom
```

## Usage

### Start Server (Default Mode)

```bash
# Start server and open TUI
agent-chatroom

# Or with options
agent-chatroom --port 3002 --room myroom
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-b, --broadcast` | Use broadcast mode | false (directed) |
| `-p, --port <number>` | Server port | 3001 |
| `-r, --room <id>` | Room ID | "main" |
| `-j, --join <url>` | Connect to existing server | - |
| `-s, --spawn <dir>` | Spawn Claude Code in directory | - |
| `-h, --help` | Show help | - |

### Examples

```bash
# 1. Start server (directed mode, default)
agent-chatroom

# 2. Start server (broadcast mode)
agent-chatroom --broadcast

# 3. Specify port and room
agent-chatroom --port 3002 --room project-a

# 4. Connect to remote server
agent-chatroom --join ws://192.168.1.100:3001/ws --room main

# 5. Spawn Claude Code and connect to chatroom
agent-chatroom --spawn /path/to/project
```

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent Chatroom                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Operator   │  │    Claude    │  │   OpenClaw   │       │
│  │   (Human)    │  │    Code      │  │              │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                    ┌──────┴──────┐                          │
│                    │  WS Server  │  ← Chat Room Server      │
│                    │  (JSON-WS)  │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

### Protocol

#### WebSocket Endpoint
```
ws://host:port/ws
```

#### Client → Server

```jsonc
// Join room
{ "action": "join", "roomId": "room-1", "sender": "alice", "mode": "directed" }

// Send message
{ "action": "send", "content": "@bob please check this", "mentions": ["bob"] }

// Leave room
{ "action": "leave" }

// List rooms
{ "action": "rooms" }

// Get room info
{ "action": "info" }

// Get member list
{ "action": "members" }
```

#### Server → Client

```jsonc
// Connected
{ "type": "connected", "data": { "clientId": "uuid" } }

// Joined room
{ "type": "joined", "data": { "room": Room, "messages": ChatMessage[] } }

// New message
{ "type": "message", "data": ChatMessage }

// User joined
{ "type": "join", "data": { "clientId": "...", "sender": "bob" } }

// User left
{ "type": "leave", "data": { "clientId": "...", "sender": "bob" } }

// Error
{ "type": "error", "data": "reason" }
```

### Room Modes

#### Directed Mode (Default)

- Agents only receive messages that @mention them
- Operators (human users) receive all messages
- Ideal for multi-agent collaboration with reduced context pollution

```
operator: @claude analyze this code
  → Only claude receives the message
  → Operator can also see it
  → openclaw won't receive it
```

#### Broadcast Mode

- Everyone receives all messages
- Suitable for small groups requiring full information sharing

## TUI Guide

```
┌ Messages ─────────────────────────────────────────┐
│ [12:00:01] openclaw: Analysis complete, 3 issues  │
│ [12:00:05] operator: @openclaw please fix         │
│ [12:00:10] operator: @claude take a look too      │
└───────────────────────────────────────────────────┘
  [directed] Participants: operator, openclaw, claude
┌ Type message (Tab=@mention, Enter=send, Esc=quit) ┐
│ @openclaw                                          │
└───────────────────────────────────────────────────┘
```

| Shortcut | Function            |
|----------|---------------------|
|   `Tab`  | @mention completion |
|  `Enter` | Send message        |
|   `Esc`  | Exit program        |
| `Ctrl+C` | Exit program        |

## Claude Code Integration

Agent Chatroom can automatically bridge with Claude Code:

1. **Auto Scan**: Scans for local Claude Code processes on startup
2. **SDK Bridge**: Communicates via Claude Code's SDK WebSocket protocol
3. **Message Forwarding**: Automatically forwards @mention messages to Claude Code
4. **Reply Handling**: Sends Claude Code's replies back to the chatroom

### Manual Claude Code Spawn

```bash
# Spawn new Claude Code instance and connect to chatroom
agent-chatroom --spawn /path/to/project
```

## License

MIT
