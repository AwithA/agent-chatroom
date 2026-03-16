import blessed from "blessed";
import type { ChatClient } from "./chat-client.js";
import type { ChatMessage, Room } from "./types.js";

export class TUI {
  private screen: blessed.Widgets.Screen;
  private messageBox: blessed.Widgets.ListElement;
  private inputBox: blessed.Widgets.BoxElement;
  private statusBar: blessed.Widgets.BoxElement;
  private chatClient: ChatClient;
  private room: Room | null = null;
  private members: string[] = [];
  private mentionIndex = -1;
  private mentionCandidates: string[] = [];
  private isMentionMode = false;
  // 自己维护当前输入内容，避免 blessed textbox 双重输入 bug
  private currentInput = "";

  constructor(chatClient: ChatClient) {
    this.chatClient = chatClient;

    this.screen = blessed.screen({
      smartCSR: true,
      title: "Agent Chatroom",
    });

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

    // 输入框只作为展示区域，不使用 inputOnFocus 模式
    // 这样可以避免 blessed textbox 的双重输入问题
    this.inputBox = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: "100%",
      height: 2,
      border: {
        type: "line",
      },
      label: " Type message (Tab=@mention, Enter=send, Esc=quit) ",
      tags: true,
      style: {
        border: {
          fg: "green",
        },
      },
    });

    this.setupEventHandlers();
    this.setupChatClientListeners();
  }

  private setupEventHandlers(): void {
    // 所有键盘事件统一在 screen 层处理，避免 textbox readInput 拦截导致的问题
    this.screen.on("keypress", (_ch, key) => {
      if (!key) return;
      const name = key.name || "";

      // 退出
      if (name === "escape" || (key.ctrl && name === "c")) {
        this.chatClient.disconnect();
        process.exit(0);
        return;
      }

      // 回车发送消息
      if (name === "enter" || name === "return") {
        const content = this.currentInput.trim();
        if (content) {
          const mentions = this.extractMentions(content);
          this.chatClient.sendMessage(
            content,
            mentions.length > 0 ? mentions : undefined
          );
          this.currentInput = "";
          this.isMentionMode = false;
          this.refreshInput();
        }
        return;
      }

      // Tab 触发 @mention 补全
      if (name === "tab") {
        this.handleTabCompletion();
        return;
      }

      // Page Up / Page Down 滚动消息
      if (name === "pageup") {
        this.messageBox.scroll(-10);
        this.screen.render();
        return;
      }
      if (name === "pagedown") {
        this.messageBox.scroll(10);
        this.screen.render();
        return;
      }

      // 其他按键重置 mention 模式
      this.isMentionMode = false;

      // 退格删除
      if (name === "backspace") {
        if (this.currentInput.length > 0) {
          // 用扩展运算符正确处理多字节字符（中文等）
          const chars = [...this.currentInput];
          chars.pop();
          this.currentInput = chars.join("");
          this.refreshInput();
        }
        return;
      }

      // 忽略 ctrl / meta 组合键（C-c 已在上面处理）
      if (key.ctrl || key.meta) return;

      // 普通可打印字符（包括中文）
      if (_ch) {
        this.currentInput += _ch;
        this.refreshInput();
      }
    });
  }

  // 刷新输入框显示，末尾加一个块状光标
  private refreshInput(): void {
    this.inputBox.setContent(this.currentInput + "{inverse} {/inverse}");
    this.screen.render();
  }

  // 从消息内容中提取 @成员 列表
  private extractMentions(content: string): string[] {
    const mentions: string[] = [];
    const regex = /@(\S+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      if (this.members.includes(name)) {
        mentions.push(name);
      }
    }
    return mentions;
  }

  // Tab 键 @mention 补全
  private handleTabCompletion(): void {
    if (this.members.length === 0) return;

    if (!this.isMentionMode) {
      // 首次按 Tab，进入 mention 模式
      this.isMentionMode = true;
      this.mentionIndex = 0;
      this.mentionCandidates = [...this.members];
    } else {
      // 继续按 Tab，轮换候选人
      this.mentionIndex =
        (this.mentionIndex + 1) % this.mentionCandidates.length;
    }

    const candidate = this.mentionCandidates[this.mentionIndex];
    const lastAtIndex = this.currentInput.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      // 替换最后一个 @ 之后的内容为当前候选
      this.currentInput =
        this.currentInput.substring(0, lastAtIndex + 1) + candidate + " ";
    } else {
      // 没有 @，在末尾追加
      const sep =
        this.currentInput.length > 0 && !this.currentInput.endsWith(" ")
          ? " "
          : "";
      this.currentInput = this.currentInput + sep + "@" + candidate + " ";
    }

    this.refreshInput();
  }

  private setupChatClientListeners(): void {
    this.chatClient.on("joined", (data) => {
      this.room = data.room;
      this.updateStatusBar();
      this.addSystemMessage(`Joined room: ${data.room.id} [${data.room.mode}]`);

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

  private updateStatusBar(): void {
    if (this.room) {
      const mode = this.room.mode;
      const participants = this.members.join(", ") || "-";
      this.statusBar.setContent(`[${mode}] Participants: ${participants}`);
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

    const mentions = message.mentions
      ? ` [${message.mentions.join(", ")}]`
      : "";
    const line = `[${time}] {bold}${message.sender}{/bold}${mentions}: ${message.content}`;

    this.messageBox.addItem(line);
    const children = (this.messageBox as unknown as { children: unknown[] })
      .children;
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
    const children = (this.messageBox as unknown as { children: unknown[] })
      .children;
    this.messageBox.scrollTo(children.length);
    this.screen.render();
  }

  public render(): void {
    this.refreshInput();
    this.screen.render();
  }

  public destroy(): void {
    this.screen.destroy();
  }
}
