import blessed from "blessed";
import type { ChatClient } from "./chat-client.js";
import type { ChatMessage, Room } from "./types.js";

export class TUI {
  private screen: blessed.Widgets.Screen;
  private messageBox: blessed.Widgets.ListElement;
  private inputBox: blessed.Widgets.TextboxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private chatClient: ChatClient;
  private room: Room | null = null;
  private members: string[] = [];
  private mentionIndex = -1;
  private mentionCandidates: string[] = [];
  private isMentionMode = false;

  constructor(chatClient: ChatClient) {
    this.chatClient = chatClient;

    // 创建主屏幕
    this.screen = blessed.screen({
      smartCSR: true,
      title: "Agent Chatroom",
    });

    // 创建消息显示区域
    this.messageBox = blessed.list({
      parent: this.screen,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%-4",
      border: {
        type: "line",
      },
      label: " Messages ",
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      tags: true,
      style: {
        border: {
          fg: "cyan",
        },
        selected: {
          bg: "blue",
        },
      },
    });

    // 创建状态栏
    this.statusBar = blessed.box({
      parent: this.screen,
      bottom: 2,
      left: 0,
      width: "100%",
      height: 1,
      content: "[disconnected] Participants: -",
      style: {
        fg: "white",
        bg: "blue",
      },
    });

    // 创建输入框
    this.inputBox = blessed.textbox({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: "100%",
      height: 2,
      border: {
        type: "line",
      },
      label: " Type message (Tab=@mention, Enter=send, Esc=quit) ",
      inputOnFocus: true,
      mouse: true,
      keys: true,
      style: {
        border: {
          fg: "green",
        },
        focus: {
          border: {
            fg: "yellow",
          },
        },
      },
    });

    this.setupEventHandlers();
    this.setupChatClientListeners();
  }

  private setupEventHandlers(): void {
    // 输入框提交（按 Enter）
    this.inputBox.on("submit", () => {
      const content = this.inputBox.getValue().trim();
      if (content) {
        this.chatClient.sendMessage(content);
        this.inputBox.clearValue();
        this.screen.render();
      }
      this.inputBox.focus();
    });

    // Tab 键处理（@mention 补全）
    this.inputBox.key("tab", () => {
      const content = this.inputBox.getValue();
      const cursorPos = (this.inputBox as unknown as { _cursor: number })._cursor || 0;

      if (!this.isMentionMode) {
        // 开始 mention 模式
        this.startMentionMode(content, cursorPos);
      } else {
        // 切换到下一个候选
        this.cycleMentionCandidate();
      }
    });

    // Esc 键退出
    this.screen.key("escape", () => {
      this.chatClient.disconnect();
      process.exit(0);
    });

    // Ctrl+C 退出
    this.screen.key("C-c", () => {
      this.chatClient.disconnect();
      process.exit(0);
    });

    // 输入框聚焦
    this.inputBox.focus();
  }

  private setupChatClientListeners(): void {
    this.chatClient.on("joined", (data) => {
      this.room = data.room;
      this.updateStatusBar();
      this.addSystemMessage(`Joined room: ${data.room.id} [${data.room.mode}]`);

      // 显示历史消息
      for (const msg of data.messages) {
        this.addMessage(msg);
      }
    });

    this.chatClient.on("message", (message) => {
      this.addMessage(message);
    });

    this.chatClient.on("join", (data) => {
      this.addSystemMessage(`${data.sender} joined the room`);
      this.chatClient.getMembers();
    });

    this.chatClient.on("leave", (data) => {
      this.addSystemMessage(`${data.sender} left the room`);
      this.chatClient.getMembers();
    });

    this.chatClient.on("members", (members) => {
      this.members = members;
      this.updateStatusBar();
    });

    this.chatClient.on("error", (error) => {
      this.addSystemMessage(`Error: ${error}`, "red");
    });

    this.chatClient.on("disconnect", () => {
      this.addSystemMessage("Disconnected from server", "red");
      this.room = null;
      this.updateStatusBar();
    });
  }

  private startMentionMode(content: string, cursorPos: number): void {
    if (this.members.length === 0) return;

    // 找到当前正在输入的 @mention
    const beforeCursor = content.substring(0, cursorPos);
    const afterCursor = content.substring(cursorPos);
    const lastAtIndex = beforeCursor.lastIndexOf("@");

    if (lastAtIndex === -1) {
      // 没有 @，在光标位置插入 @
      const newContent = beforeCursor + "@" + afterCursor;
      this.inputBox.setValue(newContent);
      (this.inputBox as unknown as { _cursor: number })._cursor = cursorPos + 1;
    }

    this.isMentionMode = true;
    this.mentionIndex = 0;
    this.mentionCandidates = [...this.members];
    this.showMentionCandidate();
  }

  private cycleMentionCandidate(): void {
    if (this.mentionCandidates.length === 0) return;

    this.mentionIndex =
      (this.mentionIndex + 1) % this.mentionCandidates.length;
    this.showMentionCandidate();
  }

  private showMentionCandidate(): void {
    if (this.mentionCandidates.length === 0) return;

    const candidate = this.mentionCandidates[this.mentionIndex];
    const content = this.inputBox.getValue();
    const cursorPos = (this.inputBox as unknown as { _cursor: number })._cursor || 0;
    const beforeCursor = content.substring(0, cursorPos);
    const afterCursor = content.substring(cursorPos);

    // 找到最后一个 @ 的位置
    const lastAtIndex = beforeCursor.lastIndexOf("@");
    if (lastAtIndex === -1) return;

    // 替换 @ 后的内容为候选者
    const beforeAt = beforeCursor.substring(0, lastAtIndex + 1);
    const newContent = beforeAt + candidate + " " + afterCursor;
    const newCursorPos = beforeAt.length + candidate.length + 1;

    this.inputBox.setValue(newContent);
    (this.inputBox as unknown as { _cursor: number })._cursor = newCursorPos;
    this.screen.render();
  }

  private updateStatusBar(): void {
    if (this.room) {
      const mode = this.room.mode;
      const participants = this.members.join(", ") || "-";
      this.statusBar.setContent(
        `[${mode}] Participants: ${participants}`
      );
    } else {
      this.statusBar.setContent("[disconnected] Participants: -");
    }
    this.screen.render();
  }

  public addMessage(message: ChatMessage): void {
    const time = new Date(message.timestamp).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const mentions = message.mentions ? ` [${message.mentions.join(", ")}]` : "";
    const line = `[${time}] {bold}${message.sender}{/bold}${mentions}: ${message.content}`;

    this.messageBox.addItem(line);
    const children = (this.messageBox as unknown as { children: unknown[] }).children;
    this.messageBox.scrollTo(children.length);
    this.screen.render();
  }

  public addSystemMessage(text: string, color: string = "yellow"): void {
    const time = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const line = `[${time}] {${color}-fg}{bold}* System *{/bold}{/${color}-fg}: ${text}`;
    this.messageBox.addItem(line);
    const children = (this.messageBox as unknown as { children: unknown[] }).children;
    this.messageBox.scrollTo(children.length);
    this.screen.render();
  }

  public render(): void {
    this.screen.render();
  }

  public destroy(): void {
    this.screen.destroy();
  }
}
