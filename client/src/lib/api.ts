/**
 * Agent Orchestration Platform - API Client
 * HTTP client for REST API calls
 */

import type { Agent, Task, SharedMemoryValue } from '../types';

// Base URL from environment or fallback to localhost
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Generic fetch wrapper with error handling
 * Handles server responses in format { success: true, data: ... }
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseURL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  const json = JSON.parse(text);

  // Check for error responses (non-2xx status or success: false)
  if (!response.ok || json.success === false) {
    const errorMessage = json.error || json.message || `HTTP error ${response.status}`;
    throw new Error(errorMessage);
  }

  // Extract data from wrapped response { success, data }
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }

  // Return raw response if not wrapped
  return json as T;
}

// ============================================
// Agent API Functions
// ============================================

/**
 * Get all agents
 * GET /api/agents
 */
export async function getAgents(): Promise<Agent[]> {
  return fetchApi<Agent[]>('/api/agents');
}

/**
 * Get a single agent by ID
 * GET /api/agents/:id
 */
export async function getAgent(id: string): Promise<Agent> {
  return fetchApi<Agent>(`/api/agents/${encodeURIComponent(id)}`);
}

/**
 * Deploy (create) a new agent
 * POST /api/agents
 */
export interface DeployAgentData {
  name: string;
  type: string;
  config?: Record<string, unknown>;
}

export async function deployAgent(data: DeployAgentData): Promise<Agent> {
  return fetchApi<Agent>('/api/agents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Start an agent
 * POST /api/agents/:id/start
 */
export async function startAgent(id: string): Promise<Agent> {
  return fetchApi<Agent>(`/api/agents/${encodeURIComponent(id)}/start`, {
    method: 'POST',
  });
}

/**
 * Stop an agent
 * POST /api/agents/:id/stop
 */
export async function stopAgent(id: string): Promise<Agent> {
  return fetchApi<Agent>(`/api/agents/${encodeURIComponent(id)}/stop`, {
    method: 'POST',
  });
}

/**
 * Delete an agent
 * DELETE /api/agents/:id
 */
export async function deleteAgent(id: string): Promise<boolean> {
  const result = await fetchApi<{ success: boolean }>(
    `/api/agents/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  return result?.success ?? true;
}

// ============================================
// Task API Functions
// ============================================

/**
 * Submit a new task
 * POST /api/tasks
 */
export interface SubmitTaskData {
  agentId: string;
  type: string;
  data: Record<string, unknown>;
  priority?: number;
}

export async function submitTask(data: SubmitTaskData): Promise<Task> {
  return fetchApi<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get all tasks, optionally filtered by status
 * GET /api/tasks?status=...
 */
export async function getTasks(status?: string): Promise<Task[]> {
  const endpoint = status ? `/api/tasks?status=${encodeURIComponent(status)}` : '/api/tasks';
  return fetchApi<Task[]>(endpoint);
}

/**
 * Get a single task by ID
 * GET /api/tasks/:id
 */
export async function getTask(id: string): Promise<Task> {
  return fetchApi<Task>(`/api/tasks/${encodeURIComponent(id)}`);
}

/**
 * Cancel a task
 * DELETE /api/tasks/:id
 */
export async function cancelTask(id: string): Promise<boolean> {
  const result = await fetchApi<{ success: boolean }>(
    `/api/tasks/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  return result?.success ?? true;
}

/**
 * Retry a failed task
 * POST /api/tasks/:id/retry
 */
export async function retryTask(id: string): Promise<Task> {
  return fetchApi<Task>(`/api/tasks/${encodeURIComponent(id)}/retry`, {
    method: 'POST',
  });
}

// ============================================
// Memory API Functions
// ============================================

/**
 * Get a memory value by key
 * GET /api/memory/:key
 */
export async function getMemory(key: string): Promise<SharedMemoryValue | null> {
  try {
    return await fetchApi<SharedMemoryValue>(`/api/memory/${encodeURIComponent(key)}`);
  } catch (error) {
    // Return null if memory key not found (404)
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Set a memory value
 * POST /api/memory
 */
export interface SetMemoryData {
  key: string;
  value: string;
  ttl?: number;
}

export async function setMemory(key: string, value: string, ttl?: number): Promise<void> {
  await fetchApi<void>('/api/memory', {
    method: 'POST',
    body: JSON.stringify({ key, value, ttl }),
  });
}

/**
 * Delete a memory value
 * DELETE /api/memory/:key
 */
export async function deleteMemory(key: string): Promise<boolean> {
  const result = await fetchApi<{ success: boolean }>(
    `/api/memory/${encodeURIComponent(key)}`,
    { method: 'DELETE' }
  );
  return result?.success ?? true;
}

/**
 * List all memory keys
 * GET /api/memory
 */
export async function listMemory(): Promise<{ key: string; value: string }[]> {
  return fetchApi<{ key: string; value: string }[]>('/api/memory');
}
