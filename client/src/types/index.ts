/**
 * Agent Orchestration Platform - Client Types
 * TypeScript interfaces mirroring server types
 */

// Agent status types
export type AgentStatus = 'registered' | 'starting' | 'running' | 'idle' | 'error' | 'stopped';

// Task status types
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Agent interface
export interface Agent {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  status: AgentStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Task interface
export interface Task {
  id: string;
  agentId: string;
  type: string;
  data: Record<string, unknown>;
  status: TaskStatus;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  result?: unknown;
  error?: string;
}

// Shared memory value interface
export interface SharedMemoryValue {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
  ttl?: number; // TTL in seconds
  expiresAt?: Date; // Calculated expiration time
}

// WebSocket event payloads
export interface AgentStatusEvent {
  agentId: string;
  status: AgentStatus;
  timestamp: Date;
}

export interface TaskStatusEvent {
  taskId: string;
  status: TaskStatus;
  timestamp: Date;
}

export interface TaskCompletedEvent {
  taskId: string;
  result: unknown;
  timestamp: Date;
}

export interface ErrorEvent {
  code: string;
  message: string;
  timestamp: Date;
}

// Socket events type definition
export interface SocketEvents {
  // Server -> Client events
  'agent-status': AgentStatusEvent;
  'task-status': TaskStatusEvent;
  'task-completed': TaskCompletedEvent;
  'error': ErrorEvent;

  // Client -> Server events
  'join-agent': { agentId: string };
  'leave-agent': { agentId: string };
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Client-specific types
export interface AgentWithStats extends Agent {
  taskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
}

export interface TaskWithAgent extends Task {
  agentName: string;
  agentType: string;
}
