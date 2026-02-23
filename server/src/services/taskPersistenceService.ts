/**
 * TaskPersistenceService
 * Persists task metadata for restart-safe orchestration.
 */

import { Task } from '../../types';
import { redis } from '../../config/redis';
import {
  deleteTaskFromSupabase,
  getTaskIdByIdempotencyKeyFromSupabase,
  isSupabasePersistenceEnabled,
  loadTasksFromSupabase,
  saveTaskToSupabase
} from './supabasePersistenceService';

const TASK_KEY_PREFIX = 'task:';
const TASK_INDEX_KEY = 'tasks:index';
const TASK_IDEMPOTENCY_KEY_PREFIX = 'task:idempotency:';

function serializeTask(task: Task): string {
  return JSON.stringify(task);
}

function deserializeTask(raw: string): Task {
  const task = JSON.parse(raw) as Task;
  task.createdAt = new Date(task.createdAt);
  task.updatedAt = new Date(task.updatedAt);
  return task;
}

function hasPipeline(
  candidate: unknown
): candidate is {
  pipeline: () => {
    set: (...args: unknown[]) => unknown;
    sadd: (...args: unknown[]) => unknown;
    del: (...args: unknown[]) => unknown;
    srem: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    exec: () => Promise<unknown>;
  };
} {
  return !!candidate && typeof (candidate as { pipeline?: unknown }).pipeline === 'function';
}

function hasGet(
  candidate: unknown
): candidate is { get: (key: string) => Promise<string | null> } {
  return !!candidate && typeof (candidate as { get?: unknown }).get === 'function';
}

function hasSmembers(
  candidate: unknown
): candidate is { smembers: (key: string) => Promise<string[]> } {
  return !!candidate && typeof (candidate as { smembers?: unknown }).smembers === 'function';
}

export async function saveTask(task: Task): Promise<void> {
  if (isSupabasePersistenceEnabled()) {
    try {
      await saveTaskToSupabase(task);
      return;
    } catch (error) {
      console.warn('[TaskPersistence] Supabase save failed, falling back to Redis:', error);
    }
  }

  try {
    if (!hasPipeline(redis)) {
      return;
    }

    const pipeline = redis.pipeline();
    pipeline.set(`${TASK_KEY_PREFIX}${task.id}`, serializeTask(task));
    pipeline.sadd(TASK_INDEX_KEY, task.id);
    if (task.idempotencyKey) {
      pipeline.set(`${TASK_IDEMPOTENCY_KEY_PREFIX}${task.idempotencyKey}`, task.id);
    }
    await pipeline.exec();
  } catch (error) {
    console.warn('[TaskPersistence] Failed to save task:', error);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  if (isSupabasePersistenceEnabled()) {
    try {
      await deleteTaskFromSupabase(taskId);
      return;
    } catch (error) {
      console.warn('[TaskPersistence] Supabase delete failed, falling back to Redis:', error);
    }
  }

  try {
    if (!hasPipeline(redis)) {
      return;
    }

    const pipeline = redis.pipeline();
    pipeline.del(`${TASK_KEY_PREFIX}${taskId}`);
    pipeline.srem(TASK_INDEX_KEY, taskId);
    await pipeline.exec();
  } catch (error) {
    console.warn('[TaskPersistence] Failed to delete task:', error);
  }
}

export async function getTaskByIdempotencyKey(idempotencyKey: string, workspaceId?: string): Promise<string | null> {
  if (isSupabasePersistenceEnabled()) {
    try {
      return await getTaskIdByIdempotencyKeyFromSupabase(idempotencyKey, workspaceId);
    } catch (error) {
      console.warn('[TaskPersistence] Supabase idempotency lookup failed, falling back to Redis:', error);
    }
  }

  try {
    if (!hasGet(redis)) {
      return null;
    }

    return await redis.get(`${TASK_IDEMPOTENCY_KEY_PREFIX}${idempotencyKey}`);
  } catch (error) {
    console.warn('[TaskPersistence] Failed to read idempotency key:', error);
    return null;
  }
}

export async function loadAllTasks(): Promise<Task[]> {
  if (isSupabasePersistenceEnabled()) {
    try {
      return await loadTasksFromSupabase();
    } catch (error) {
      console.warn('[TaskPersistence] Supabase task load failed, falling back to Redis:', error);
    }
  }

  try {
    if (!hasSmembers(redis) || !hasPipeline(redis)) {
      return [];
    }

    const ids = await redis.smembers(TASK_INDEX_KEY);
    if (ids.length === 0) {
      return [];
    }

    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.get(`${TASK_KEY_PREFIX}${id}`);
    }

    const results = await pipeline.exec();
    if (!results) {
      return [];
    }

    const tasks: Task[] = [];
    for (const [err, raw] of results) {
      if (err || !raw) {
        continue;
      }

      try {
        tasks.push(deserializeTask(raw as string));
      } catch (parseError) {
        console.warn('[TaskPersistence] Failed to parse task payload:', parseError);
      }
    }

    return tasks;
  } catch (error) {
    console.warn('[TaskPersistence] Failed to load tasks:', error);
    return [];
  }
}
