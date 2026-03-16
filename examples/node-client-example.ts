import { ChatClient } from "@agent-chatroom/client-node";

async function main() {
  // 创建客户端
  const client = new ChatClient({
    url: "ws://localhost:3000/ws",
    autoReconnect: true,
  });

  console.log("Connecting to server...");

  // 连接服务器
  const userId = await client.connect();
  console.log("✓ Connected with userId:", userId);

  // 设置昵称
  await client.setNickname("测试用户");
  console.log("✓ Nickname set");

  // 监听消息
  client.on("message", (data) => {
    console.log(`[${data.senderNickname || data.senderId}]: ${data.content}`);
  });

  client.on("memberJoined", (data) => {
    console.log(`✓ ${data.nickname || data.userId} joined room ${data.roomId}`);
  });

  client.on("memberLeft", (data) => {
    console.log(`✗ ${data.nickname || data.userId} left room ${data.roomId}`);
  });

  // 创建群组
  const room = await client.createRoom("测试群组");
  console.log("✓ Room created:", room.roomId);

  // 发送消息
  await client.sendMessage(room.roomId, "Hello, World!");
  console.log("✓ Message sent");

  // 获取消息历史
  const { messages } = await client.getMessageHistory(room.roomId, 10, 0);
  console.log("✓ Message history:", messages.length, "messages");

  // 获取群组信息
  const roomInfo = await client.getRoomInfo(room.roomId);
  console.log("✓ Room info:", roomInfo);

  // 设置群公告
  await client.setAnnouncement(room.roomId, "欢迎来到测试群组！");
  console.log("✓ Announcement set");

  // 等待一段时间后断开
  setTimeout(() => {
    console.log("\nDisconnecting...");
    client.disconnect();
    process.exit(0);
  }, 5000);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
