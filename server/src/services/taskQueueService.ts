/**
 * TaskQueueService - Task queue management service using BullMQ
 * Provides task submission, retrieval, cancellation, and retry functionality
 */

import { Queue, Job } from 'bullmq';
import Redis from 'ioredis';
import { Task, TaskStatus } from '../../types';
import { emitTaskStatus, emitTaskCompleted } from './socketService';

// Redis connection for BullMQ
let redisConnection: Redis | null = null;

/**
 * Get or create Redis connection
 */
function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
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

// In-memory task storage for quick retrieval
// BullMQ stores jobs in Redis, but we keep metadata for quick access
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
    updatedAt: now
  };
}

/**
 * Update task status and metadata
 */
export function updateTaskStatus(taskId: string, status: TaskStatus, additionalUpdates?: Partial<Task>): Task | undefined {
  const task = taskStore.get(taskId);
  if (!task) {
    return undefined;
  }

  task.status = status;
  task.updatedAt = new Date();

  if (additionalUpdates) {
    Object.assign(task, additionalUpdates);
  }

  return task;
}

/**
 * Submit a new task to the queue
 * @param task - Task object with agentId, type, data, and optional priority
 * @returns Promise<string> - The task ID
 */
export async function submitTask(task: Task): Promise<string> {
  // Ensure task has required fields
  const newTask = task.id
    ? { ...task, status: 'pending' as TaskStatus, updatedAt: new Date() }
    : createTask(task.agentId, task.type, task.data, task.priority);

  // Store in memory for quick retrieval
  taskStore.set(newTask.id, newTask);

  // Emit task status event
  emitTaskStatus(newTask);

  // Add to BullMQ queue
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
 * @param taskId - The task ID to retrieve
 * @returns Task object or undefined if not found
 */
export function getTask(taskId: string): Task | undefined {
  return taskStore.get(taskId);
}

/**
 * Cancel a task by ID
 * Cancels a pending or processing task
 * @param taskId - The task ID to cancel
 * @returns boolean - True if task was cancelled, false if not found or already completed/failed
 */
export function cancelTask(taskId: string): boolean {
  const task = taskStore.get(taskId);
  if (!task) {
    return false;
  }

  // Can only cancel pending or processing tasks
  if (task.status !== 'pending' && task.status !== 'processing') {
    return false;
  }

  task.status = 'cancelled';
  task.updatedAt = new Date();

  // Emit task status event
  emitTaskStatus(task);

  return true;
}

/**
 * Retry a failed task
 * Creates a new task with the same data
 * @param taskId - The failed task ID to retry
 * @returns Promise<string> - The new task ID, or throws if task not found or not in failed state
 */
export async function retryTask(taskId: string): Promise<string> {
  const task = taskStore.get(taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  // Can only retry failed or cancelled tasks
  if (task.status !== 'failed' && task.status !== 'cancelled') {
    throw new Error('Task can only be retried if it is failed or cancelled');
  }

  // Create a new task with the same data
  const newTask = createTask(task.agentId, task.type, task.data, task.priority);

  // Store in memory
  taskStore.set(newTask.id, newTask);

  // Emit task status event
  emitTaskStatus(newTask);

  // Add to BullMQ queue
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
 * @returns Array of all tasks
 */
export function getAllTasks(): Task[] {
  return Array.from(taskStore.values());
}

/**
 * Get tasks by agent ID
 * @param agentId - The agent ID to filter by
 * @returns Array of tasks for the agent
 */
export function getTasksByAgent(agentId: string): Task[] {
  return Array.from(taskStore.values()).filter(task => task.agentId === agentId);
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
