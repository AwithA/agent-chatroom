// ==================== 聊天室协议类型 ====================

export type RoomMode = "broadcast" | "directed";

export interface Room {
  id: string;
  name: string;
  mode: RoomMode;
  createdAt: number;
  messageCount: number;
  clientCount: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  content: string;
  sender: string;
  timestamp: number;
  mentions?: string[];
}

// 客户端 -> 服务器的消息
export type ClientAction =
  | { action: "join"; roomId: string; sender: string; mode?: RoomMode }
  | { action: "send"; content: string; mentions?: string[] }
  | { action: "leave" }
  | { action: "rooms" }
  | { action: "info" }
  | { action: "members" };

// 服务器 -> 客户端的消息
export type ServerMessage =
  | { type: "connected"; data: { clientId: string } }
  | { type: "joined"; data: { room: Room; messages: ChatMessage[] } }
  | { type: "message"; data: ChatMessage }
  | { type: "join"; data: { clientId: string; sender: string } }
  | { type: "leave"; data: { clientId: string; sender: string } }
  | { type: "left"; data: { roomId: string } }
  | { type: "error"; data: string }
  | { type: "rooms"; data: Room[] }
  | { type: "info"; data: Room }
  | { type: "members"; data: string[] };

// ==================== Claude Code SDK 协议类型 ====================

// 发给 Claude Code 的消息
export type ClaudeSdkInput =
  | {
      type: "user";
      message: { role: "user"; content: string };
      parent_tool_use_id: string | null;
      session_id: string;
    }
  | { type: "keep_alive" }
  | {
      type: "control_response";
      response: {
        subtype: "success";
        request_id: string;
        response: {
          behavior: "allow" | "deny";
          updatedInput?: Record<string, unknown>;
        };
      };
    };

// 从 Claude Code 收到的消息
export type ClaudeSdkOutput =
  | {
      type: "system";
      subtype: "init";
      session_id: string;
      model: string;
    }
  | {
      type: "assistant";
      message: {
        content: Array<{ type: "text"; text: string }>;
      };
    }
  | {
      type: "control_request";
      request_id: string;
      request: {
        subtype: "can_use_tool";
        tool_name: string;
        input: Record<string, unknown>;
      };
    }
  | {
      type: "result";
      is_error: boolean;
      total_cost_usd: number;
      usage: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
    };

// ==================== 内部使用类型 ====================

export interface AgentProcess {
  pid: number;
  name: string;
  type: "claude" | "openclaw";
  cwd: string;
}

export interface Config {
  defaultRoom?: string;
  defaultPort?: number;
  recentRooms?: string[];
}
