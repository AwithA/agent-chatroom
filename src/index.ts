#!/usr/bin/env node

import { parseArgs } from "util";
import { ChatServer } from "./server.js";
import { ChatClient } from "./chat-client.js";
import { ClaudeSession } from "./claude-session.js";
import { TUI } from "./tui.js";
import { scanAgents } from "./scanner.js";
import { selectAgents } from "./selector.js";
import type { AgentProcess, RoomMode } from "./types.js";
import chalk from "chalk";

interface CLIOptions {
  broadcast: boolean;
  port: number;
  room: string;
  join?: string;
  spawn?: string;
}

function parseArguments(): CLIOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      broadcast: {
        type: "boolean",
        short: "b",
        default: false,
      },
      port: {
        type: "string",
        short: "p",
        default: "3001",
      },
      room: {
        type: "string",
        short: "r",
        default: "main",
      },
      join: {
        type: "string",
        short: "j",
      },
      spawn: {
        type: "string",
        short: "s",
      },
      help: {
        type: "boolean",
        short: "h",
      },
    },
    allowPositionals: false,
  });

  if (values.help) {
    showHelp();
    process.exit(0);
  }

  return {
    broadcast: values.broadcast as boolean,
    port: parseInt(values.port as string, 10),
    room: (values.room as string) || "main",
    join: values.join as string | undefined,
    spawn: values.spawn as string | undefined,
  };
}

function showHelp(): void {
  console.log(`
${chalk.bold("Agent Chatroom")} - A CLI tool for multiple AI agents to chat together

${chalk.bold("Usage:")}
  agent-chatroom [options]

${chalk.bold("Options:")}
  -b, --broadcast          Use broadcast mode (default: directed mode)
  -p, --port <number>      Server port (default: 3001)
  -r, --room <id>          Room ID (default: "main")
  -j, --join <url>         Join existing server (e.g., ws://localhost:3001/ws)
  -s, --spawn <dir>        Spawn Claude Code in specified directory
  -h, --help               Show this help

${chalk.bold("Examples:")}
  # Start server with TUI (default directed mode)
  agent-chatroom

  # Start server with broadcast mode
  agent-chatroom --broadcast

  # Connect to existing server
  agent-chatroom --join ws://localhost:3001/ws --room myroom

  # Spawn Claude Code and connect to chatroom
  agent-chatroom --spawn /path/to/project
`);
}

async function main(): Promise<void> {
  const options = parseArguments();
  const mode: RoomMode = options.broadcast ? "broadcast" : "directed";

  // 客户端模式：仅连接到现有服务器
  if (options.join) {
    await runClientMode(options.join, options.room);
    return;
  }

  // 服务器模式：启动服务器 + TUI + 可选的 agent 桥接
  await runServerMode(options, mode);
}

async function runClientMode(url: string, roomId: string): Promise<void> {
  console.log(chalk.blue(`Connecting to ${url}...`));

  const client = new ChatClient(url);
  const tui = new TUI(client);

  try {
    await client.connect();
    console.log(chalk.green("Connected!"));

    client.join(roomId, "operator");
    tui.render();
  } catch (err) {
    console.error(chalk.red(`Failed to connect: ${err}`));
    process.exit(1);
  }
}

async function runServerMode(
  options: CLIOptions,
  mode: RoomMode
): Promise<void> {
  // 1. 启动服务器
  console.log(chalk.blue("Starting chat server..."));
  const server = new ChatServer(options.port);
  const actualPort = await server.start();

  // 2. 连接到本地服务器
  const client = new ChatClient(`ws://localhost:${actualPort}/ws`);
  const tui = new TUI(client);

  // 3. 启动 TUI
  try {
    await client.connect();
    client.join(options.room, "operator", mode);
    tui.render();
  } catch (err) {
    console.error(chalk.red(`Failed to connect: ${err}`));
    await server.stop();
    process.exit(1);
  }

  // 4. 如果指定了 --spawn，启动 Claude Code
  if (options.spawn) {
    console.log(chalk.blue(`Spawning Claude Code in ${options.spawn}...`));
    try {
      const senderName = `claude@${options.spawn}`;
      const session = new ClaudeSession(
        options.spawn,
        senderName,
        client
      );

      session.on("ready", () => {
        console.log(chalk.green("Claude Code connected!"));
      });

      session.on("error", (err) => {
        console.error(chalk.red(`Claude Code error: ${err}`));
      });

      await session.start();
    } catch (err) {
      console.error(chalk.red(`Failed to spawn Claude Code: ${err}`));
    }
  } else {
    // 5. 扫描现有 agent 进程
    console.log(chalk.blue("Scanning for agent processes..."));
    const agents = await scanAgents();

    if (agents.length > 0) {
      console.log(chalk.green(`Found ${agents.length} agent process(es)`));

      // 6. 让用户选择要连接的 agent
      const selected = await selectAgents(agents);

      // 7. 为选中的 Claude Code 进程创建桥接
      for (const agent of selected) {
        if (agent.type === "claude") {
          console.log(
            chalk.blue(`Connecting to Claude Code in ${agent.cwd}...`)
          );
          try {
            const session = new ClaudeSession(
              agent.cwd,
              agent.name,
              client
            );

            session.on("ready", () => {
              console.log(
                chalk.green(`Claude Code (${agent.cwd}) connected!`)
              );
            });

            session.on("error", (err) => {
              console.error(
                chalk.red(`Claude Code (${agent.cwd}) error: ${err}`)
              );
            });

            await session.start();
          } catch (err) {
            console.error(
              chalk.red(
                `Failed to connect to Claude Code (${agent.cwd}): ${err}`
              )
            );
          }
        }
      }
    } else {
      console.log(chalk.yellow("No agent processes found"));
    }
  }

  // 8. 处理退出
  process.on("SIGINT", async () => {
    console.log(chalk.yellow("\nShutting down..."));
    tui.destroy();
    client.disconnect();
    await server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    tui.destroy();
    client.disconnect();
    await server.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(chalk.red(`Error: ${err}`));
  process.exit(1);
});
