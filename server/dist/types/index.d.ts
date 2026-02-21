/**
 * Agent Orchestration Platform - Server Types
 * TypeScript interfaces for Agent, Task, and SharedMemory
 */
export type AgentStatus = 'registered' | 'starting' | 'running' | 'idle' | 'error' | 'stopped';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export interface Agent {
    id: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
    status: AgentStatus;
    createdAt: Date;
    updatedAt: Date;
}
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
export interface SharedMemoryValue {
    key: string;
    value: unknown;
    createdAt: Date;
    updatedAt: Date;
    ttl?: number;
    expiresAt?: Date;
}
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
export interface SocketEvents {
    'agent-status': AgentStatusEvent;
    'task-status': TaskStatusEvent;
    'task-completed': TaskCompletedEvent;
    'error': ErrorEvent;
    'join-agent': {
        agentId: string;
    };
    'leave-agent': {
        agentId: string;
    };
}
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
//# sourceMappingURL=index.d.ts.map