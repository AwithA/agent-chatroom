import { ErrorCode } from '../types';

// ID generation
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Error creation
export function createError(code: ErrorCode, message: string) {
  return {
    code,
    message,
  };
}

// Timestamp
export function now(): number {
  return Date.now();
}

// Validation
export function isValidString(value: any, minLength = 1, maxLength = 1000): boolean {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

export function isValidId(value: any): boolean {
  return typeof value === 'string' && value.length > 0;
}
