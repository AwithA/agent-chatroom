import { exec } from "child_process";
import { promisify } from "util";
import type { AgentProcess } from "./types.js";

const execAsync = promisify(exec);

export async function scanAgentProcesses(): Promise<AgentProcess[]> {
  const processes: AgentProcess[] = [];
  const seenCwds = new Set<string>();

  try {
    // 获取所有进程列表
    const { stdout } = await execAsync("wmic process get ProcessId,CommandLine /format:csv");
    
    const lines = stdout.split("\n").filter((line) => line.trim());
    
    // 跳过标题行
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // CSV 格式: Node,CommandLine,ProcessId
      const parts = line.split(",");
      if (parts.length < 3) continue;

      const pid = parseInt(parts[parts.length - 1], 10);
      const commandLine = parts.slice(1, parts.length - 1).join(",").toLowerCase();

      if (isNaN(pid)) continue;

      // 检查是否是 claude 或 openclaw 进程
      let type: "claude" | "openclaw" | null = null;
      if (commandLine.includes("claude") && !commandLine.includes("agent-chatroom")) {
        type = "claude";
      } else if (commandLine.includes("openclaw") && !commandLine.includes("agent-chatroom")) {
        type = "openclaw";
      }

      if (type) {
        try {
          const cwd = await getProcessCwd(pid);
          if (cwd && !seenCwds.has(cwd)) {
            seenCwds.add(cwd);
            processes.push({
              pid,
              name: type === "claude" ? `claude@${cwd}` : `openclaw@${cwd}`,
              type,
              cwd,
            });
          }
        } catch {
          // 忽略无法获取 cwd 的进程
        }
      }
    }
  } catch (error) {
    console.error("Failed to scan processes:", error);
  }

  return processes;
}

async function getProcessCwd(pid: number): Promise<string | null> {
  try {
    // Windows 上使用 wmic 获取进程的可执行文件路径
    const { stdout } = await execAsync(
      `wmic process where ProcessId=${pid} get ExecutablePath /value`
    );
    
    const match = stdout.match(/ExecutablePath=(.+)/);
    if (match) {
      const exePath = match[1].trim();
      // 从可执行文件路径推断工作目录
      const lastSlash = exePath.lastIndexOf("\\");
      if (lastSlash > 0) {
        return exePath.substring(0, lastSlash);
      }
    }
    
    // 备选方案：使用当前目录
    return process.cwd();
  } catch {
    return null;
  }
}

// 为 Unix 系统（macOS/Linux）的备用实现
export async function scanAgentProcessesUnix(): Promise<AgentProcess[]> {
  const processes: AgentProcess[] = [];
  const seenCwds = new Set<string>();

  try {
    // 使用 ps 命令获取进程列表
    const { stdout } = await execAsync("ps -ww -eo pid,args");
    const lines = stdout.split("\n").slice(1); // 跳过标题行

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(/^\s*(\d+)\s+(.+)$/);
      if (!match) continue;

      const pid = parseInt(match[1], 10);
      const args = match[2].toLowerCase();

      // 排除自身进程和 grep
      if (
        args.includes("agent-chatroom") ||
        args.includes("grep") ||
        isNaN(pid)
      ) {
        continue;
      }

      // 检查是否是 claude 或 openclaw 进程
      let type: "claude" | "openclaw" | null = null;
      if (args.includes("claude")) {
        type = "claude";
      } else if (args.includes("openclaw")) {
        type = "openclaw";
      }

      if (type) {
        try {
          const cwd = await getProcessCwdUnix(pid);
          if (cwd && !seenCwds.has(cwd)) {
            seenCwds.add(cwd);
            processes.push({
              pid,
              name: type === "claude" ? `claude@${cwd}` : `openclaw@${cwd}`,
              type,
              cwd,
            });
          }
        } catch {
          // 忽略无法获取 cwd 的进程
        }
      }
    }
  } catch (error) {
    console.error("Failed to scan processes:", error);
  }

  return processes;
}

async function getProcessCwdUnix(pid: number): Promise<string | null> {
  // macOS: lsof -Fn 输出机器可读格式，正确处理路径中的空格
  // 输出格式每行以字段类型字母开头：p=pid, f=fd, n=name
  // 示例：p1234\nfcwd\nn/path/to/dir
  try {
    const { stdout } = await execAsync(
      `lsof -a -d cwd -p ${pid} -Fn 2>/dev/null`
    );
    const nameLine = stdout.split("\n").find((l) => l.startsWith("n"));
    if (nameLine && nameLine.length > 1) {
      return nameLine.slice(1); // 去掉前缀 'n'
    }
  } catch {
    // ignore, try Linux fallback
  }

  // Linux: 使用 readlink /proc/<pid>/cwd
  try {
    const { stdout } = await execAsync(`readlink -f /proc/${pid}/cwd`);
    const cwd = stdout.trim();
    if (cwd) return cwd;
  } catch {
    // ignore
  }

  return null;
}

// 根据平台选择合适的扫描函数
export async function scanAgents(): Promise<AgentProcess[]> {
  if (process.platform === "win32") {
    return scanAgentProcesses();
  } else {
    return scanAgentProcessesUnix();
  }
}