/**
 * TaskWorker - BullMQ Worker for processing tasks from the queue
 * Handles task execution, status updates, and socket event emission
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { Task, TaskStatus } from '../types';
import { getTask } from '../src/services/taskQueueService';
import { emitTaskStatus, emitTaskCompleted, emitError } from '../src/services/socketService';
import { executeAgentTask } from '../src/services/executionService';

// Redis connection for BullMQ worker
let redisConnection: Redis | null = null;

// BullMQ worker instance
let taskWorker: Worker | null = null;

// Default concurrency limit
const DEFAULT_CONCURRENCY = 10;

/**
 * Get or create Redis connection for the worker
 */
function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null, // Required for BullMQ
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

/**
 * Update task status in the task store
 */
function updateTaskStatus(taskId: string, status: TaskStatus, additionalUpdates?: Partial<Task>): Task | undefined {
  const task = getTask(taskId);
  if (!task) {
    console.warn(`Task not found for update: ${taskId}`);
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
 * Process a task job
 * This is the main processor function for the BullMQ worker
 */
async function processTaskJob(job: Job): Promise<{ result: string }> {
  const { taskId, agentId, data } = job.data;

  console.log(`Processing job ${job.id} for task ${taskId} (agent: ${agentId})`);

  // Check if task was cancelled before processing
  const task = getTask(taskId);
  if (!task) {
    console.log(`Task ${taskId} not found, skipping`);
    throw new Error('Task not found');
  }

  if (task.status === 'cancelled') {
    console.log(`Task ${taskId} was cancelled, skipping`);
    return { result: 'skipped' };
  }

  // Update task status to processing
  updateTaskStatus(taskId, 'processing');
  emitTaskStatus(task);

  try {
    // Simulate task processing
    // In a real implementation, this would call the agent to execute the task
    console.log(`Executing task ${taskId} with data:`, data);

    const taskData = getTask(taskId);
    if (!taskData) {
      throw new Error('Task not found during processing');
    }

    // Call actual AI execution logic
    const resultData = await executeAgentTask(taskData);

    // Mark task as completed
    const completedTask = updateTaskStatus(taskId, 'completed', {
      result: resultData
    });

    if (completedTask) {
      emitTaskCompleted(completedTask);
    }

    console.log(`Task ${taskId} completed successfully`);
    return { result: 'completed' };

  } catch (error) {
    // Mark task as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Task ${taskId} failed:`, errorMessage);

    const failedTask = updateTaskStatus(taskId, 'failed', {
      error: errorMessage
    });

    if (failedTask) {
      emitTaskStatus(failedTask);
    }

    // Re-throw to let BullMQ handle retry logic
    throw error;
  }
}

/**
 * Start the BullMQ worker
 * Exports: startWorker(): void
 */
export function startWorker(): void {
  if (taskWorker) {
    console.warn('Worker already running');
    return;
  }

  const connection = getRedisConnection();

  taskWorker = new Worker(
    'agent-tasks',
    async (job) => {
      if (!job.data.taskId) {
        console.warn('Job missing taskId, skipping');
        return { result: 'skipped' };
      }
      return processTaskJob(job);
    },
    {
      connection,
      concurrency: DEFAULT_CONCURRENCY,
      limiter: {
        max: 10,
        duration: 1000
      }
    }
  );

  // Worker event handlers
  taskWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  taskWorker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  taskWorker.on('error', (error) => {
    console.error('Worker error:', error);
    emitError(error.message);
  });

  console.log(`Task worker started with concurrency ${DEFAULT_CONCURRENCY}`);
}

/**
 * Stop the BullMQ worker
 * Exports: stopWorker(): Promise<void>
 */
export async function stopWorker(): Promise<void> {
  if (taskWorker) {
    await taskWorker.close();
    taskWorker = null;
    console.log('Task worker stopped');
  }

  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}

/**
 * Get the current worker instance (for testing)
 */
export function getWorker(): Worker | null {
  return taskWorker;
}

// Allow worker to be started when run directly
if (require.main === module) {
  startWorker();
}
