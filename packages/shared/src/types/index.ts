// User types
export interface User {
  id: string;
  connectionId: string;
  nickname?: string;
  joinedRooms: Set<string>;
  createdAt: number;
  lastActiveAt: number;
}

// Room types
export interface Room {
  id: string;
  name: string;
  ownerId: string;
  adminIds: Set<string>;
  memberIds: Set<string>;
  announcement?: string;
  isPrivateChat: boolean;
  createdAt: number;
  maxAdmins: number;
}

// Message types
export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type: 'text' | 'system';
  timestamp: number;
}

// WebSocket message types
export interface WSRequest {
  type: string;
  requestId?: string;
  data: any;
}

export interface WSSuccessResponse<T = any> {
  type: string;
  requestId?: string;
  success: true;
  data: T;
  timestamp: number;
}

export interface WSErrorResponse {
  type: string;
  requestId?: string;
  success: false;
  error: {
    code: number;
    message: string;
  };
  timestamp: number;
}

export type WSResponse<T = any> = WSSuccessResponse<T> | WSErrorResponse;

export interface WSPush<T = any> {
  type: string;
  data: T;
  timestamp: number;
}

// HTTP response types
export interface HTTPSuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: number;
}

export interface HTTPErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
  };
  timestamp: number;
}

export type HTTPResponse<T = any> = HTTPSuccessResponse<T> | HTTPErrorResponse;

// Error codes
export enum ErrorCode {
  UNAUTHORIZED = 1001,
  ROOM_NOT_FOUND = 2001,
  ROOM_FULL = 2002,
  PERMISSION_DENIED = 3001,
  INVALID_PARAMS = 4001,
  INTERNAL_ERROR = 5001,
}

// Role types
export type UserRole = 'owner' | 'admin' | 'member';
