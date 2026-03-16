import { ChatServer } from './dist/server.js';
import { ChatClient } from './dist/chat-client.js';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('=== 开始测试 Agent Chatroom ===\n');

  // 1. 启动服务器
  console.log('1. 启动聊天服务器...');
  const server = new ChatServer(0);
  const port = await server.start();
  console.log(`   ✓ 服务器启动在端口 ${port}\n`);

  await sleep(100);

  // 2. 创建客户端连接
  console.log('2. 创建客户端连接...');
  const client1 = new ChatClient(`ws://localhost:${port}/ws`);
  const client2 = new ChatClient(`ws://localhost:${port}/ws`);

  // 3. 测试连接
  console.log('3. 测试 WebSocket 连接...');
  try {
    const clientId1 = await client1.connect();
    console.log(`   ✓ 客户端1连接成功，ID: ${clientId1}`);
    
    const clientId2 = await client2.connect();
    console.log(`   ✓ 客户端2连接成功，ID: ${clientId2}\n`);
  } catch (err) {
    console.error('   ✗ 连接失败:', err.message);
    await server.stop();
    process.exit(1);
  }

  await sleep(100);

  // 4. 测试加入房间
  console.log('4. 测试加入房间 (directed 模式)...');
  
  const joinPromise1 = new Promise((resolve) => {
    client1.once('joined', (data) => {
      console.log(`   ✓ 客户端1加入房间: ${data.room.id}`);
      console.log(`     - 模式: ${data.room.mode}`);
      console.log(`     - 历史消息数: ${data.messages.length}`);
      resolve();
    });
  });

  const joinPromise2 = new Promise((resolve) => {
    client2.once('joined', (data) => {
      console.log(`   ✓ 客户端2加入房间: ${data.room.id}`);
      resolve();
    });
  });

  client1.join('test-room', 'operator', 'directed');
  await sleep(50);
  client2.join('test-room', 'claude-agent');

  await Promise.all([joinPromise1, joinPromise2]);
  console.log('');

  await sleep(100);

  // 5. 测试发送消息
  console.log('5. 测试发送消息...');
  
  let msgCount = 0;
  const messagePromise = new Promise((resolve) => {
    const checkDone = () => {
      msgCount++;
      if (msgCount >= 2) resolve();
    };
    
    client1.once('message', (msg) => {
      console.log(`   ✓ 客户端1收到消息: "${msg.content.substring(0, 30)}..."`);
      checkDone();
    });
    
    client2.once('message', (msg) => {
      console.log(`   ✓ 客户端2收到消息: "${msg.content.substring(0, 30)}..."`);
      checkDone();
    });
  });

  // 发送带 @mention 的消息
  client1.sendMessage('@claude-agent 你好，请帮我分析这段代码');

  await messagePromise;
  console.log('');

  await sleep(100);

  // 6. 测试成员列表
  console.log('6. 测试获取成员列表...');
  const membersPromise = new Promise((resolve) => {
    client1.once('members', (members) => {
      console.log(`   ✓ 房间成员: ${members.join(', ')}`);
      resolve();
    });
  });
  client1.getMembers();
  await membersPromise;
  console.log('');

  await sleep(100);

  // 7. 测试离开房间
  console.log('7. 测试离开房间...');
  const leavePromise = new Promise((resolve) => {
    client1.once('left', (data) => {
      console.log(`   ✓ 成功离开房间: ${data.roomId}`);
      resolve();
    });
  });
  client1.leave();
  await leavePromise;
  console.log('');

  await sleep(100);

  // 8. 清理
  console.log('8. 清理资源...');
  client1.disconnect();
  client2.disconnect();
  await server.stop();
  console.log('   ✓ 服务器已停止\n');

  console.log('=== 所有测试通过! ===');
}

test().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
