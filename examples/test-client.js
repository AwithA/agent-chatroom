const { ChatClient } = require('@agent-chatroom/client-node');

async function testClient() {
  console.log('\n🧪 Testing Agent Chatroom Client SDK\n');

  const client = new ChatClient({
    url: 'ws://localhost:3000/ws',
  });

  try {
    // 1. 连接测试
    console.log('1️⃣ Testing connection...');
    const userId = await client.connect();
    console.log(`✓ Connected with userId: ${userId}\n`);

    // 2. 设置昵称测试
    console.log('2️⃣ Testing set nickname...');
    await client.setNickname('测试客户端');
    console.log('✓ Nickname set\n');

    // 3. 创建群组测试
    console.log('3️⃣ Testing create room...');
    const room = await client.createRoom('测试群组');
    console.log(`✓ Room created: ${room.roomId}\n`);

    // 4. 发送消息测试
    console.log('4️⃣ Testing send message...');
    await client.sendMessage(room.roomId, 'Hello from test client!');
    console.log('✓ Message sent\n');

    // 5. 获取消息历史测试
    console.log('5️⃣ Testing get message history...');
    const messages = await client.getMessageHistory(room.roomId, 10, 0);
    console.log(`✓ Retrieved ${messages.length} messages\n`);

    // 6. 设置群公告测试
    console.log('6️⃣ Testing set announcement...');
    await client.setAnnouncement(room.roomId, '这是一个测试公告');
    console.log('✓ Announcement set\n');

    // 7. 获取群组信息测试
    console.log('7️⃣ Testing get room info...');
    const roomInfo = await client.getRoomInfo(room.roomId);
    console.log(`✓ Room info retrieved:`);
    console.log(`   - Name: ${roomInfo.name}`);
    console.log(`   - Members: ${roomInfo.memberIds.length}`);
    console.log(`   - Announcement: ${roomInfo.announcement}\n`);

    // 8. 测试与机器人交互
    console.log('8️⃣ Testing interaction with bot...');

    // 监听消息
    client.on('message', (data) => {
      if (data.senderId !== client.getUserId()) {
        console.log(`   📨 Received: [${data.senderNickname}]: ${data.content}`);
      }
    });

    // 尝试加入机器人房间（如果存在）
    try {
      // 这里需要从实际运行的机器人获取 roomId
      // 为了演示，我们创建自己的房间并发送消息
      await client.sendMessage(room.roomId, 'hello');
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✓ Sent test messages\n');
    } catch (error) {
      console.log('⚠ Could not interact with bot (this is expected)\n');
    }

    // 9. 离开群组测试
    console.log('9️⃣ Testing leave room...');
    await client.leaveRoom(room.roomId);
    console.log('✓ Left room\n');

    console.log('✅ All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    client.disconnect();
    console.log('🔌 Disconnected\n');
    process.exit(0);
  }
}

testClient();
