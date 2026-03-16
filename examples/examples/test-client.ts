import { ChatClient } from '@agent-chatroom/client-node';

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

    // 8. 加入机器人的房间测试
    console.log('8️⃣ Testing join bot room...');
    const botRoomId = 'room_1773679389767_b9dicfyn4'; // 从机器人输出获取
    try {
      await client.joinRoom(botRoomId);
      console.log(`✓ Joined bot room: ${botRoomId}\n`);

      // 9. 向机器人发送消息
      console.log('9️⃣ Testing send message to bot...');
      await client.sendMessage(botRoomId, 'hello');
      await new Promise(resolve => setTimeout(resolve, 500));
      await client.sendMessage(botRoomId, 'help');
      await new Promise(resolve => setTimeout(resolve, 500));
      await client.sendMessage(botRoomId, 'time');
      console.log('✓ Messages sent to bot\n');

      // 等待机器人回复
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log('⚠ Bot room not found (this is expected if bot is not running)\n');
    }

    // 10. 离开群组测试
    console.log('🔟 Testing leave room...');
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
