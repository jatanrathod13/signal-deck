/**
 * TaskWorker - BullMQ Worker for processing tasks from the queue
 * Handles task execution, status updates, orchestration hooks, and socket emissions.
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { Task, TaskErrorType, TaskStatus } from '../types';
import { getTask, markTaskFailure, updateTaskStatus } from '../src/services/taskQueueService';
import { emitTaskStatus, emitTaskCompleted, emitError } from '../src/services/socketService';
import { executeAgentTask } from '../src/services/executionService';
import { createAndStartPlan, handleTaskCompletion, handleTaskFailure } from '../src/services/orchestratorService';
import { incrementMetric } from '../src/services/metricsService';
import { addConversationMessage, appendRunEvent, updateRun } from '../src/services/conversationService';

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
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: null,
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
 * Resolve error type for normalized failure analytics.
 */
function resolveErrorType(error: unknown): TaskErrorType {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('timeout')) return 'timeout';
  if (message.includes('tool')) return 'tool_error';
  if (message.includes('validation')) return 'validation_error';
  if (message.includes('model')) return 'model_error';
  return 'unknown_error';
}

/**
 * Check task dependencies.
 */
function hasIncompleteDependencies(task: Task): boolean {
  if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) {
    return false;
  }

  return task.dependsOnTaskIds.some((dependencyId) => {
    const dependencyTask = getTask(dependencyId);
    return !dependencyTask || dependencyTask.status !== 'completed';
  });
}

/**
 * Process a task job
 */
async function processTaskJob(job: Job): Promise<{ result: string }> {
  const { taskId, agentId } = job.data;

  console.log(`Processing job ${job.id} for task ${taskId} (agent: ${agentId})`);

  const task = getTask(taskId);
  if (!task) {
    console.log(`Task ${taskId} not found, skipping`);
    throw new Error('Task not found');
  }

  if (task.status === 'cancelled') {
    console.log(`Task ${taskId} was cancelled, skipping`);
    return { result: 'skipped' };
  }

  if (hasIncompleteDependencies(task)) {
    const blockedTask = updateTaskStatus(taskId, 'blocked');
    if (blockedTask) {
      emitTaskStatus(blockedTask);
    }
    return { result: 'blocked' };
  }

  const processingTask = updateTaskStatus(taskId, 'processing');
  if (processingTask) {
    emitTaskStatus(processingTask);
    if (processingTask.runId && processingTask.conversationId) {
      appendRunEvent({
        runId: processingTask.runId,
        conversationId: processingTask.conversationId,
        type: 'task.status',
        payload: {
          taskId: processingTask.id,
          status: processingTask.status,
          type: processingTask.type
        }
      });
    }
  }

  try {
    const currentTask = getTask(taskId);
    if (!currentTask) {
      throw new Error('Task not found during processing');
    }

    const resultData = currentTask.type === 'orchestrate'
      ? await runOrchestrationTask(currentTask)
      : await executeAgentTask(currentTask);

    const completedTask = updateTaskStatus(taskId, 'completed', {
      result: resultData
    });

    if (completedTask) {
      emitTaskCompleted(completedTask);
      incrementMetric('tasksCompleted');
      await handleTaskCompletion(completedTask);

      if (completedTask.runId && completedTask.conversationId) {
        const summaryMessage = (() => {
          if (
            completedTask.result &&
            typeof completedTask.result === 'object' &&
            typeof (completedTask.result as { message?: unknown }).message === 'string'
          ) {
            return (completedTask.result as { message: string }).message;
          }

          if (typeof completedTask.result === 'string') {
            return completedTask.result;
          }

          return JSON.stringify(completedTask.result);
        })();

        if (summaryMessage && summaryMessage !== '{}') {
          addConversationMessage({
            conversationId: completedTask.conversationId,
            role: 'assistant',
            content: summaryMessage,
            runId: completedTask.runId,
            metadata: {
              taskId: completedTask.id
            }
          });

          appendRunEvent({
            runId: completedTask.runId,
            conversationId: completedTask.conversationId,
            type: 'message.created',
            payload: {
              role: 'assistant',
              content: summaryMessage,
              taskId: completedTask.id
            }
          });
        }

        if (!completedTask.parentTaskId && !completedTask.planId) {
          updateRun(completedTask.runId, 'completed', {
            summary: summaryMessage
          });

          appendRunEvent({
            runId: completedTask.runId,
            conversationId: completedTask.conversationId,
            type: 'run.completed',
            payload: {
              taskId: completedTask.id
            }
          });
        }
      }
    }

    console.log(`Task ${taskId} completed successfully`);
    return { result: 'completed' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorType = resolveErrorType(error);

    console.error(`Task ${taskId} failed:`, errorMessage);

    const failedTask = markTaskFailure(taskId, errorMessage, errorType);

    if (failedTask) {
      emitTaskStatus(failedTask);
      incrementMetric('tasksFailed');
      await handleTaskFailure(failedTask);

      if (failedTask.runId && failedTask.conversationId) {
        updateRun(failedTask.runId, 'failed', {
          error: errorMessage
        });

        appendRunEvent({
          runId: failedTask.runId,
          conversationId: failedTask.conversationId,
          type: 'run.failed',
          payload: {
            taskId: failedTask.id,
            error: errorMessage,
            errorType
          }
        });
      }
    }

    throw error;
  }
}

interface OrchestrationTaskData {
  objective?: unknown;
  defaultAgentId?: unknown;
  stepPrompts?: unknown;
  maxSteps?: unknown;
  metadata?: unknown;
}

async function runOrchestrationTask(task: Task): Promise<Record<string, unknown>> {
  const taskData = task.data as OrchestrationTaskData;

  const objective = typeof taskData.objective === 'string'
    ? taskData.objective.trim()
    : '';

  if (!objective) {
    throw new Error('orchestrate task requires a non-empty objective');
  }

  const defaultAgentId = typeof taskData.defaultAgentId === 'string'
    ? taskData.defaultAgentId
    : task.agentId;

  const stepPrompts = Array.isArray(taskData.stepPrompts)
    ? taskData.stepPrompts.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : undefined;

  const maxSteps = typeof taskData.maxSteps === 'number' ? taskData.maxSteps : undefined;
  const metadata = typeof taskData.metadata === 'object' && taskData.metadata !== null
    ? taskData.metadata as Record<string, unknown>
    : undefined;

  const summary = await createAndStartPlan({
    objective,
    defaultAgentId,
    stepPrompts,
    maxSteps,
    conversationId: task.conversationId,
    runId: task.runId,
    metadata: {
      ...(metadata ?? {}),
      parentTaskId: task.id
    }
  });

  return {
    mode: 'orchestrate',
    objective,
    ...summary
  };
}

/**
 * Start the BullMQ worker
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

if (require.main === module) {
  startWorker();
}
