import { ChatClient } from "@agent-chatroom/client-node";
import * as readline from "readline";

class ChatBot {
  private client: ChatClient;
  private roomId: string | null = null;
  private nickname: string;

  constructor(serverUrl: string, nickname: string) {
    this.nickname = nickname;
    this.client = new ChatClient({
      url: serverUrl,
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
    });
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on("connect", () => {
      console.log("✓ Bot connected");
    });

    this.client.on("disconnect", () => {
      console.log("✗ Bot disconnected");
    });

    this.client.on("error", (error) => {
      console.error("✗ Error:", error);
    });

    this.client.on("newMessage", async (data) => {
      // 忽略自己的消息
      if (data.senderId === this.client.getUserId()) return;

      const sender = data.senderNickname || data.senderId;
      const time = new Date(data.timestamp).toLocaleTimeString();
      const roomId = data.roomId.slice(0, 8);
      console.log(`\n[${time}] [${roomId}] ${sender}: ${data.content}`);

      // 自动回复逻辑
      try {
        await this.handleMessage(data);
      } catch (error) {
        console.error("Error handling message:", error);
      }
    });

    this.client.on("memberJoined", (data) => {
      const member = data.nickname || data.userId;
      console.log(`→ ${member} joined room ${data.roomId}`);

      // 欢迎新成员
      if (data.userId !== this.client.getUserId()) {
        this.client
          .sendMessage(data.roomId, `欢迎 ${member} 加入群组！👋`)
          .catch(console.error);
      }
    });

    this.client.on("memberLeft", (data) => {
      const member = data.nickname || data.userId;
      console.log(`← ${member} left room ${data.roomId}`);
    });

    this.client.on("announcementUpdated", (data) => {
      console.log(
        `📢 Announcement updated in ${data.roomId}: ${data.announcement}`,
      );
    });
  }

  private async handleMessage(data: any) {
    const content = data.content.toLowerCase().trim();

    // 帮助命令
    if (content === "help" || content === "帮助") {
      await this.client.sendMessage(
        data.roomId,
        `🤖 可用命令：
• help/帮助 - 显示此帮助信息
• time/时间 - 显示当前时间
• echo <消息> - 回显消息
• joke/笑话 - 讲个笑话
• info/信息 - 显示群组信息
• stats/统计 - 显示消息统计`,
      );
    }
    // 时间命令
    else if (content === "time" || content === "时间") {
      const now = new Date();
      await this.client.sendMessage(
        data.roomId,
        `⏰ 当前时间：${now.toLocaleString("zh-CN")}`,
      );
    }
    // 回显命令
    else if (content.startsWith("echo ")) {
      const msg = data.content.substring(5);
      await this.client.sendMessage(data.roomId, `📢 ${msg}`);
    }
    // 笑话命令
    else if (content === "joke" || content === "笑话") {
      const jokes = [
        "为什么程序员总是分不清万圣节和圣诞节？\n因为 Oct 31 == Dec 25",
        "程序员的三大谎言：\n1. 这个 bug 不可能出现\n2. 我测试过了\n3. 这次一定能上线",
        "为什么程序员喜欢黑暗？\n因为 light attracts bugs",
        "世界上有 10 种人：\n懂二进制的和不懂二进制的",
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      await this.client.sendMessage(data.roomId, `😄 ${joke}`);
    }
    // 群组信息命令
    else if (content === "info" || content === "信息") {
      const roomInfo = await this.client.getRoomInfo(data.roomId);
      await this.client.sendMessage(
        data.roomId,
        `📊 群组信息：
• 名称：${roomInfo.name}
• 成员数：${roomInfo.memberCount || roomInfo.memberIds.length}
• 管理员数：${roomInfo.adminIds.length}
• 创建时间：${new Date(roomInfo.createdAt).toLocaleString("zh-CN")}`,
      );
    }
    // 统计命令
    else if (content === "stats" || content === "统计") {
      const { messages } = await this.client.getMessageHistory(
        data.roomId,
        100,
        0,
      );
      await this.client.sendMessage(
        data.roomId,
        `📈 消息统计：
• 总消息数：${messages.length}
• 最近消息：${messages.length > 0 ? new Date(messages[messages.length - 1].timestamp).toLocaleString("zh-CN") : "无"}`,
      );
    }
    // 打招呼
    else if (
      content.includes("hello") ||
      content.includes("hi") ||
      content.includes("你好")
    ) {
      const greetings = [
        "你好！👋",
        "Hi there! 😊",
        "嗨！有什么可以帮你的吗？",
        "Hello! 很高兴见到你！",
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      await this.client.sendMessage(data.roomId, greeting);
    }
  }

  async start() {
    console.log(`\n🤖 Starting ${this.nickname}...\n`);

    // 连接服务器
    const userId = await this.client.connect();
    console.log(`✓ Connected with userId: ${userId}`);

    // 设置昵称
    await this.client.setNickname(this.nickname);
    console.log(`✓ Nickname set: ${this.nickname}`);

    console.log(`\n✓ Bot is ready! Use /create or /join to enter a room.\n`);
  }

  async stop() {
    console.log(`\n🤖 Stopping ${this.nickname}...\n`);

    if (this.roomId) {
      await this.client.sendMessage(
        this.roomId,
        `🤖 ${this.nickname} 即将下线...`,
      );
      await this.client.leaveRoom(this.roomId);
    }

    this.client.disconnect();
    console.log("✓ Bot stopped");
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  async createRoom(name: string) {
    const room = await this.client.createRoom(name);
    this.roomId = room.roomId;
    console.log(`✓ Room created: ${room.name} (${room.roomId})`);
    return room;
  }

  async joinRoom(roomId: string) {
    await this.client.joinRoom(roomId);
    this.roomId = roomId;
    console.log(`✓ Joined room: ${roomId}`);
  }

  async leaveRoom() {
    if (!this.roomId) {
      console.log("✗ Not in a room");
      return;
    }
    await this.client.leaveRoom(this.roomId);
    console.log(`✓ Left room: ${this.roomId}`);
    this.roomId = null;
  }

  async sendMessage(message: string) {
    if (!this.roomId) {
      console.log("✗ Not in a room yet");
      return;
    }
    await this.client.sendMessage(this.roomId, message);
  }

  async listMembers() {
    if (!this.roomId) {
      console.log("✗ Not in a room yet");
      return;
    }
    const roomInfo = await this.client.getRoomInfo(this.roomId);
    console.log("\n📋 Room members:");
    console.log(`  Total: ${roomInfo.memberCount || roomInfo.memberIds.length}`);
    console.log(`  Owner: ${roomInfo.ownerId}`);
    if (roomInfo.adminIds.length > 0) {
      console.log(`  Admins: ${roomInfo.adminIds.join(", ")}`);
    }
  }

  async setAnnouncement(text: string) {
    if (!this.roomId) {
      console.log("✗ Not in a room yet");
      return;
    }
    await this.client.setAnnouncement(this.roomId, text);
    console.log("✓ Announcement updated");
  }

  async listRooms(keyword: string = '') {
    const result = await this.client.listRooms(keyword);
    console.log("\n📋 Available rooms:");
    if (result.rooms.length === 0) {
      console.log("  No rooms found");
    } else {
      result.rooms.forEach((r) => {
        console.log(`  • ${r.name} (${r.roomId})`);
        console.log(`    Members: ${r.memberCount} | Created: ${new Date(r.createdAt).toLocaleString()}`);
        if (r.announcement) {
          console.log(`    📢 ${r.announcement}`);
        }
      });
    }
  }
}

// 主程序
async function main() {
  const serverUrl = process.env.SERVER_URL || "ws://localhost:3000/ws";
  const botName = process.env.BOT_NAME || "ChatBot";

  const bot = new ChatBot(serverUrl, botName);

  // 启动机器人
  await bot.start();

  // 设置 REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "bot> ",
  });

  console.log("\n🤖 REPL Commands:");
  console.log("  /create <name>   - Create a new room");
  console.log("  /join <roomId>   - Join an existing room");
  console.log("  /leave           - Leave current room");
  console.log("  /list [keyword]  - List all available rooms");
  console.log("  /send <message>  - Send a message to the room");
  console.log("  /members         - List room members");
  console.log("  /announce <text> - Set room announcement");
  console.log("  /help            - Show this help");
  console.log("  /quit            - Exit the bot\n");

  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    try {
      if (input === "/quit" || input === "/exit") {
        await bot.stop();
        rl.close();
        process.exit(0);
      } else if (input === "/help") {
        console.log("\n🤖 REPL Commands:");
        console.log("  /create <name>   - Create a new room");
        console.log("  /join <roomId>   - Join an existing room");
        console.log("  /leave           - Leave current room");
        console.log("  /list [keyword]  - List all available rooms");
        console.log("  /send <message>  - Send a message to the room");
        console.log("  /members         - List room members");
        console.log("  /announce <text> - Set room announcement");
        console.log("  /help            - Show this help");
        console.log("  /quit            - Exit the bot\n");
      } else if (input.startsWith("/create ")) {
        const name = input.slice(8);
        await bot.createRoom(name);
      } else if (input.startsWith("/join ")) {
        const roomId = input.slice(6);
        await bot.joinRoom(roomId);
      } else if (input === "/leave") {
        await bot.leaveRoom();
      } else if (input.startsWith("/list")) {
        const keyword = input.slice(5).trim();
        await bot.listRooms(keyword);
      } else if (input.startsWith("/send ")) {
        const message = input.slice(6);
        await bot.sendMessage(message);
        console.log("✓ Message sent");
      } else if (input === "/members") {
        await bot.listMembers();
      } else if (input.startsWith("/announce ")) {
        const text = input.slice(10);
        await bot.setAnnouncement(text);
      } else {
        console.log("✗ Unknown command. Type /help for available commands.");
      }
    } catch (error) {
      console.error("✗ Error:", error);
    }

    rl.prompt();
  });

  // 优雅退出
  process.on("SIGINT", async () => {
    console.log("\n\nReceived SIGINT, shutting down...");
    rl.close();
    await bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n\nReceived SIGTERM, shutting down...");
    rl.close();
    await bot.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
