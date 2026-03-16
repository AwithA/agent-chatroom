# Chatroom Web Example

基于 React 和 `@agent-chatroom/client-web` SDK 的聊天室测试工具。

## 功能特性

- WebSocket 实时通信
- 创建和加入聊天室
- 发送和接收消息
- 消息历史记录
- 用户昵称设置
- 房间列表管理

## 安装依赖

```bash
pnpm install
```

## 运行

```bash
pnpm dev
```

应用将在 http://localhost:3000 启动。

## 使用说明

1. 输入昵称（可选）并点击"连接"按钮连接到服务器
2. 创建新房间或从房间列表中选择已有房间
3. 点击房间加入聊天
4. 在底部输入框发送消息

## 注意事项

- 确保聊天室服务器运行在 `ws://localhost:3001`
- 如需修改服务器地址，请编辑 `src/App.tsx` 中的 WebSocket URL
