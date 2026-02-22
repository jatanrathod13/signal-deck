/**
 * Agent Orchestration Platform - Server Types
 * TypeScript interfaces for Agent, Task, and SharedMemory
 */

// Agent status types
export type AgentStatus = 'registered' | 'starting' | 'running' | 'idle' | 'error' | 'stopped';

// MCP Server Configuration
export interface McpServerConfig {
  url?: string;           // For HTTP MCP servers
  name: string;
  transport?: 'stdio' | 'http';
  command?: string;       // For stdio transport
  args?: string[];        // For stdio transport
}

// Agent configuration
export interface AgentConfig {
  mcpServers?: McpServerConfig[];
  [key: string]: unknown;
}

// Task status types
export type TaskStatus = 'pending' | 'blocked' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type TaskErrorType = 'tool_error' | 'model_error' | 'timeout' | 'validation_error' | 'unknown_error';
export type PlanStatus = 'draft' | 'active' | 'completed' | 'failed' | 'cancelled';
export type PlanStepStatus = 'pending' | 'blocked' | 'running' | 'completed' | 'failed' | 'skipped';

// Agent interface
export interface Agent {
  id: string;
  name: string;
  type: string;
  config: AgentConfig;
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
  parentTaskId?: string;
  planId?: string;
  stepId?: string;
  dependsOnTaskIds?: string[];
  childTaskIds?: string[];
  idempotencyKey?: string;
  retryCount?: number;
  metadata?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  errorType?: TaskErrorType;
}

export interface PlanStep {
  id: string;
  planId: string;
  title: string;
  description?: string;
  agentId: string;
  taskType: string;
  taskData: Record<string, unknown>;
  dependsOnStepIds: string[];
  status: PlanStepStatus;
  taskId?: string;
  output?: unknown;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Plan {
  id: string;
  objective: string;
  status: PlanStatus;
  createdByTaskId?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
  steps: PlanStep[];
}

export interface ToolPolicy {
  allowTools?: string[];
  denyTools?: string[];
  maxToolCallsPerTask?: number;
  perToolTimeoutMs?: number;
}

export interface OrchestrationSummary {
  planId: string;
  rootTaskId?: string;
  totalSteps: number;
  readySteps: number;
}

// Shared memory value interface
export interface SharedMemoryValue {
  key: string;
  value: unknown;
  createdAt: Date;
  updatedAt: Date;
  ttl?: number;
  expiresAt?: Date;
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
  agentId?: string;
  planId?: string;
  stepId?: string;
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
  'plan-created': { planId: string; timestamp: Date };
  'plan-updated': { planId: string; status: PlanStatus; timestamp: Date };
  'plan-step-status': { planId: string; stepId: string; status: PlanStepStatus; timestamp: Date };
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
