import { spawn, ChildProcess } from "child_process";
import { createServer, Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { EventEmitter } from "events";
import type { ClaudeSdkInput, ClaudeSdkOutput, ChatMessage } from "./types.js";
import type { ChatClient } from "./chat-client.js";

interface ClaudeSessionEvents {
  ready: void;
  message: string;
  error: string;
  closed: void;
}

export class ClaudeSession extends EventEmitter {
  private process: ChildProcess | null = null;
  private sdkServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private sdkWs: WebSocket | null = null;
  private chatClient: ChatClient;
  private workingDir: string;
  private senderName: string;
  private sdkPort: number = 0;
  private sessionId: string = "";
  private messageBuffer: string = "";
  private isInConversation = false;
  private lastMentionSender: string | null = null;

  constructor(
    workingDir: string,
    senderName: string,
    chatClient: ChatClient
  ) {
    super();
    this.workingDir = workingDir;
    this.senderName = senderName;
    this.chatClient = chatClient;
  }

  public async start(): Promise<void> {
    // 1. 启动临时 WS 服务供 Claude Code 连接
    await this.startSdkServer();

    // 2. 启动 Claude Code 子进程
    await this.spawnClaudeCode();

    // 3. 设置聊天室消息监听
    this.setupChatClientListeners();
  }

  private startSdkServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sdkServer = createServer();
      this.wss = new WebSocketServer({ server: this.sdkServer });

      this.wss.on("connection", (ws: WebSocket) => {
        this.sdkWs = ws;

        ws.on("message", (data: Buffer) => {
          this.handleSdkMessage(data.toString());
        });

        ws.on("close", () => {
          this.sdkWs = null;
          this.emit("closed");
        });

        ws.on("error", (err) => {
          this.emit("error", `SDK WebSocket error: ${err.message}`);
        });
      });

      this.sdkServer.listen(0, () => {
        const address = this.sdkServer!.address();
        if (typeof address === "object" && address !== null) {
          this.sdkPort = address.port;
          resolve();
        } else {
          reject(new Error("Failed to get server port"));
        }
      });

      this.sdkServer.on("error", reject);
    });
  }

  private spawnClaudeCode(): Promise<void> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      // 删除这些变量，否则 Claude Code 会认为自己在嵌套运行
      delete env.CLAUDECODE;
      delete env.CLAUDE_CODE_ENTRYPOINT;

      this.process = spawn(
        "claude",
        [
          "--sdk-url",
          `ws://localhost:${this.sdkPort}`,
          "--output-format",
          "stream-json",
          "--input-format",
          "stream-json",
          "--print",
          "--add-dir",
          this.workingDir,
        ],
        {
          env,
          cwd: this.workingDir,
          stdio: ["ignore", "ignore", "pipe"],
        }
      );

      this.process.stderr?.on("data", (data: Buffer) => {
        const errorMsg = data.toString();
        // Claude Code 可能会输出一些信息到 stderr，不一定是错误
        if (errorMsg.includes("error") || errorMsg.includes("Error")) {
          this.emit("error", errorMsg);
        }
      });

      this.process.on("error", (err) => {
        reject(new Error(`Failed to spawn Claude Code: ${err.message}`));
      });

      this.process.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          this.emit("error", `Claude Code exited with code ${code}`);
        }
        this.emit("closed");
      });

      // 等待 SDK 连接
      const checkConnection = setInterval(() => {
        if (this.sdkWs) {
          clearInterval(checkConnection);
          this.emit("ready");
          resolve();
        }
      }, 100);

      // 超时处理
      setTimeout(() => {
        clearInterval(checkConnection);
        if (!this.sdkWs) {
          reject(new Error("Timeout waiting for Claude Code to connect"));
        }
      }, 30000);
    });
  }

  private handleSdkMessage(data: string): void {
    // NDJSON 格式，每行一条消息
    const lines = data.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        const message: ClaudeSdkOutput = JSON.parse(line);
        this.processSdkMessage(message);
      } catch (err) {
        this.emit("error", `Failed to parse SDK message: ${err}`);
      }
    }
  }

  private processSdkMessage(message: ClaudeSdkOutput): void {
    switch (message.type) {
      case "system":
        if (message.subtype === "init") {
          this.sessionId = message.session_id;
          this.emit("ready");
        }
        break;

      case "assistant":
        // 聚合文本块
        if (message.message?.content) {
          for (const part of message.message.content) {
            if (part.type === "text") {
              this.messageBuffer += part.text;
            }
          }
        }
        this.isInConversation = true;
        break;

      case "control_request":
        // 自动允许工具使用
        if (message.request?.subtype === "can_use_tool") {
          this.sendToClaude({
            type: "control_response",
            response: {
              subtype: "success",
              request_id: message.request_id,
              response: {
                behavior: "allow",
              },
            },
          });
        }
        break;

      case "result":
        // 一轮对话结束，发送聚合的消息到聊天室
        if (this.messageBuffer.trim()) {
          const reply = this.messageBuffer.trim();
          this.sendToChatRoom(reply);
          this.messageBuffer = "";
        }
        this.isInConversation = false;
        break;
    }
  }

  private sendToClaude(message: ClaudeSdkInput): void {
    if (this.sdkWs && this.sdkWs.readyState === WebSocket.OPEN) {
      this.sdkWs.send(JSON.stringify(message) + "\n");
    }
  }

  private sendToChatRoom(content: string): void {
    // 默认回复给上一个 @ 本 agent 的发送者
    let messageContent = content;
    if (this.lastMentionSender && !content.includes("@")) {
      messageContent = `@${this.lastMentionSender} ${content}`;
    }

    this.chatClient.sendMessage(messageContent);
  }

  private setupChatClientListeners(): void {
    this.chatClient.on("message", (message: ChatMessage) => {
      // 只处理 @ 了本 agent 的消息
      const mentions = message.mentions || [];
      if (!mentions.includes(this.senderName)) {
        return;
      }

      this.lastMentionSender = message.sender;

      // 发送给 Claude Code
      this.sendPrompt(message.content);
    });
  }

  public sendPrompt(content: string): void {
    if (!this.sdkWs || this.sdkWs.readyState !== WebSocket.OPEN) {
      this.emit("error", "Claude Code not connected");
      return;
    }

    // 如果正在对话中，等待完成
    if (this.isInConversation) {
      setTimeout(() => this.sendPrompt(content), 100);
      return;
    }

    this.sendToClaude({
      type: "user",
      message: {
        role: "user",
        content,
      },
      parent_tool_use_id: null,
      session_id: this.sessionId,
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // 关闭 SDK WebSocket
      if (this.sdkWs) {
        this.sdkWs.close();
        this.sdkWs = null;
      }

      // 关闭 SDK Server
      if (this.wss) {
        this.wss.close(() => {
          if (this.sdkServer) {
            this.sdkServer.close(() => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }

      // 终止子进程
      if (this.process) {
        this.process.kill("SIGTERM");
        // 5秒后强制终止
        setTimeout(() => {
          this.process?.kill("SIGKILL");
        }, 5000);
      }
    });
  }

  public isReady(): boolean {
    return this.sdkWs !== null && this.sdkWs.readyState === WebSocket.OPEN;
  }
}
