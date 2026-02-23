/**
 * DeadLetterQueueService
 * Captures task failures for later inspection and replay.
 */

import { Task, TaskErrorType } from '../../types';

export type DeadLetterStatus = 'pending' | 'requeued' | 'discarded';

export interface DeadLetterEntry {
  id: string;
  taskId: string;
  workspaceId?: string;
  agentId: string;
  taskType: string;
  error: string;
  errorType: TaskErrorType;
  attempts: number;
  status: DeadLetterStatus;
  failedAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface DeadLetterSnapshot {
  enabled: boolean;
  maxEntries: number;
  entries: number;
  pending: number;
}

const deadLetters = new Map<string, DeadLetterEntry>();

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function isDeadLetterQueueEnabled(): boolean {
  return process.env.FEATURE_DEAD_LETTER_QUEUE === 'true';
}

function getMaxEntries(): number {
  return parsePositiveInt(process.env.DLQ_MAX_ENTRIES, 500);
}

function nextId(): string {
  return `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function evictOverflow(): void {
  const maxEntries = getMaxEntries();
  if (deadLetters.size <= maxEntries) {
    return;
  }

  const sorted = Array.from(deadLetters.values())
    .sort((a, b) => a.failedAt.getTime() - b.failedAt.getTime());

  while (deadLetters.size > maxEntries && sorted.length > 0) {
    const entry = sorted.shift();
    if (entry) {
      deadLetters.delete(entry.id);
    }
  }
}

export function enqueueDeadLetter(
  task: Task,
  error: string,
  errorType: TaskErrorType,
  metadata?: Record<string, unknown>
): DeadLetterEntry {
  const now = new Date();
  const entry: DeadLetterEntry = {
    id: nextId(),
    taskId: task.id,
    workspaceId: task.workspaceId,
    agentId: task.agentId,
    taskType: task.type,
    error,
    errorType,
    attempts: (task.retryCount ?? 0) + 1,
    status: 'pending',
    failedAt: now,
    updatedAt: now,
    metadata
  };

  deadLetters.set(entry.id, entry);
  evictOverflow();

  return entry;
}

export function listDeadLetters(workspaceId?: string): DeadLetterEntry[] {
  const entries = Array.from(deadLetters.values())
    .sort((a, b) => b.failedAt.getTime() - a.failedAt.getTime());

  if (!workspaceId) {
    return entries;
  }

  return entries.filter((entry) => entry.workspaceId === workspaceId);
}

export function getDeadLetter(entryId: string): DeadLetterEntry | undefined {
  return deadLetters.get(entryId);
}

export function markDeadLetterStatus(entryId: string, status: DeadLetterStatus, metadata?: Record<string, unknown>): DeadLetterEntry | undefined {
  const entry = deadLetters.get(entryId);
  if (!entry) {
    return undefined;
  }

  entry.status = status;
  entry.updatedAt = new Date();
  if (metadata) {
    entry.metadata = {
      ...(entry.metadata ?? {}),
      ...metadata
    };
  }

  return entry;
}

export function getDeadLetterSnapshot(): DeadLetterSnapshot {
  const entries = Array.from(deadLetters.values());
  return {
    enabled: isDeadLetterQueueEnabled(),
    maxEntries: getMaxEntries(),
    entries: entries.length,
    pending: entries.filter((entry) => entry.status === 'pending').length
  };
}

export function clearDeadLetters(): void {
  deadLetters.clear();
}
