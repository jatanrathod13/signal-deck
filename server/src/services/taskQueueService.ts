/**
 * TaskQueueService - Task queue management service using BullMQ
 * Provides task submission, retrieval, cancellation, retry, and durable metadata.
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Task, TaskStatus, TaskErrorType } from '../../types';
import { emitTaskStatus } from './socketService';
import { getTaskByIdempotencyKey, loadAllTasks, saveTask } from './taskPersistenceService';
import { incrementMetric } from './metricsService';

// Redis connection for BullMQ
let redisConnection: Redis | null = null;

/**
 * Get or create Redis connection
 */
function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });
  }
  return redisConnection;
}

/**
 * Set custom Redis connection (useful for testing)
 */
export function setRedisConnection(connection: Redis): void {
  redisConnection = connection;
}

// In-memory task cache for fast reads, backed by persistence
const taskStore = new Map<string, Task>();

// Create the BullMQ queue
let taskQueue: Queue | null = null;

/**
 * Get or create the BullMQ queue
 */
function getTaskQueue(): Queue {
  if (!taskQueue) {
    taskQueue = new Queue('agent-tasks', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    });
  }
  return taskQueue;
}

/**
 * Set custom queue (useful for testing)
 */
export function setTaskQueue(queue: Queue): void {
  taskQueue = queue;
}

/**
 * Load persisted tasks into memory on startup.
 */
export async function bootstrapTaskStore(): Promise<void> {
  const persistedTasks = await loadAllTasks();
  for (const task of persistedTasks) {
    taskStore.set(task.id, task);
  }
}

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a Task object from input parameters
 */
function createTask(agentId: string, type: string, data: Record<string, unknown>, priority: number = 1): Task {
  const now = new Date();
  return {
    id: generateTaskId(),
    agentId,
    type,
    data,
    status: 'pending',
    priority,
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
    childTaskIds: [],
    dependsOnTaskIds: []
  };
}

/**
 * Persist task in background, never throw to callers.
 */
function persistTask(task: Task): void {
  saveTask(task).catch((error) => {
    console.warn('[TaskQueue] Failed to persist task:', error);
  });
}

/**
 * Update task status and metadata
 */
export function updateTaskStatus(
  taskId: string,
  status: TaskStatus,
  additionalUpdates?: Partial<Task>
): Task | undefined {
  const task = taskStore.get(taskId);
  if (!task) {
    return undefined;
  }

  task.status = status;
  task.updatedAt = new Date();

  if (additionalUpdates) {
    Object.assign(task, additionalUpdates);
  }

  persistTask(task);
  return task;
}

/**
 * Update task failure metadata
 */
export function markTaskFailure(taskId: string, error: string, errorType: TaskErrorType = 'unknown_error'): Task | undefined {
  return updateTaskStatus(taskId, 'failed', {
    error,
    errorType
  });
}

/**
 * Link child task to parent for graph observability.
 */
export function linkChildTask(parentTaskId: string, childTaskId: string): void {
  const parentTask = taskStore.get(parentTaskId);
  if (!parentTask) {
    return;
  }

  if (!parentTask.childTaskIds) {
    parentTask.childTaskIds = [];
  }

  if (!parentTask.childTaskIds.includes(childTaskId)) {
    parentTask.childTaskIds.push(childTaskId);
    parentTask.updatedAt = new Date();
    persistTask(parentTask);
  }
}

/**
 * Submit a new task to the queue
 * @param task - Task object with agentId, type, data, and optional priority
 * @returns Promise<string> - The task ID
 */
export async function submitTask(task: Task): Promise<string> {
  if (task.idempotencyKey) {
    const existingTaskId = await getTaskByIdempotencyKey(task.idempotencyKey);
    if (existingTaskId) {
      const existingTask = taskStore.get(existingTaskId);
      if (existingTask) {
        return existingTask.id;
      }
    }
  }

  const newTask = task.id
    ? {
      ...task,
      id: task.id,
      status: 'pending' as TaskStatus,
      updatedAt: new Date(),
      retryCount: task.retryCount ?? 0,
      childTaskIds: task.childTaskIds ?? [],
      dependsOnTaskIds: task.dependsOnTaskIds ?? []
    }
    : createTask(task.agentId, task.type, task.data, task.priority);

  if (task.idempotencyKey) {
    newTask.idempotencyKey = task.idempotencyKey;
  }

  if (task.parentTaskId) {
    newTask.parentTaskId = task.parentTaskId;
  }

  if (task.planId) {
    newTask.planId = task.planId;
  }

  if (task.stepId) {
    newTask.stepId = task.stepId;
  }

  if (task.metadata) {
    newTask.metadata = task.metadata;
  }

  if (task.conversationId) {
    newTask.conversationId = task.conversationId;
  }

  if (task.runId) {
    newTask.runId = task.runId;
  }

  if (task.dependsOnTaskIds && task.dependsOnTaskIds.length > 0) {
    newTask.dependsOnTaskIds = task.dependsOnTaskIds;
  }

  taskStore.set(newTask.id, newTask);
  persistTask(newTask);

  emitTaskStatus(newTask);
  incrementMetric('tasksSubmitted');

  await getTaskQueue().add(
    newTask.type,
    {
      taskId: newTask.id,
      agentId: newTask.agentId,
      data: newTask.data
    },
    {
      priority: newTask.priority,
      jobId: newTask.id
    }
  );

  return newTask.id;
}

/**
 * Get a task by ID
 */
export function getTask(taskId: string): Task | undefined {
  return taskStore.get(taskId);
}

/**
 * Cancel a task by ID
 */
export function cancelTask(taskId: string): boolean {
  const task = taskStore.get(taskId);
  if (!task) {
    return false;
  }

  if (task.status !== 'pending' && task.status !== 'processing' && task.status !== 'blocked') {
    return false;
  }

  task.status = 'cancelled';
  task.updatedAt = new Date();

  emitTaskStatus(task);
  persistTask(task);
  incrementMetric('tasksCancelled');
  return true;
}

/**
 * Retry a failed task
 */
export async function retryTask(taskId: string): Promise<string> {
  const task = taskStore.get(taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  if (task.status !== 'failed' && task.status !== 'cancelled') {
    throw new Error('Task can only be retried if it is failed or cancelled');
  }

  const newTask = createTask(task.agentId, task.type, task.data, task.priority);
  newTask.parentTaskId = task.parentTaskId;
  newTask.planId = task.planId;
  newTask.stepId = task.stepId;
  newTask.dependsOnTaskIds = task.dependsOnTaskIds ?? [];
  newTask.metadata = task.metadata;
  newTask.conversationId = task.conversationId;
  newTask.runId = task.runId;
  newTask.retryCount = (task.retryCount ?? 0) + 1;

  taskStore.set(newTask.id, newTask);
  persistTask(newTask);

  emitTaskStatus(newTask);

  await getTaskQueue().add(
    newTask.type,
    {
      taskId: newTask.id,
      agentId: newTask.agentId,
      data: newTask.data
    },
    {
      priority: newTask.priority,
      jobId: newTask.id
    }
  );

  return newTask.id;
}

/**
 * Get all tasks
 */
export function getAllTasks(): Task[] {
  return Array.from(taskStore.values());
}

/**
 * Get tasks by agent ID
 */
export function getTasksByAgent(agentId: string): Task[] {
  return Array.from(taskStore.values()).filter((task) => task.agentId === agentId);
}

/**
 * Get tasks by plan ID
 */
export function getTasksByPlan(planId: string): Task[] {
  return Array.from(taskStore.values()).filter((task) => task.planId === planId);
}

/**
 * Get child tasks for a parent task
 */
export function getChildTasks(parentTaskId: string): Task[] {
  return Array.from(taskStore.values()).filter((task) => task.parentTaskId === parentTaskId);
}

/**
 * Clean up resources (for testing)
 */
export async function closeTaskQueue(): Promise<void> {
  if (taskQueue) {
    await taskQueue.close();
    taskQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
  taskStore.clear();
}

// Export the queue for external worker usage
export { taskQueue };
