/**
 * TaskWorker - BullMQ Worker for processing tasks from the queue
 * Handles task execution, status updates, orchestration hooks, and socket emissions.
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { getRedisConnectionPolicy } from '../config/redis';
import { OrchestrationExecutionStrategy, RunArtifacts, Task, TaskErrorType, TaskExecutionMode, TaskStatus } from '../types';
import { enqueueTaskById, getAllTasks, getTask, markTaskFailure, updateTaskStatus } from '../src/services/taskQueueService';
import { emitTaskStatus, emitTaskCompleted, emitError } from '../src/services/socketService';
import { executeAgentTask } from '../src/services/executionService';
import { createAndStartDagPlan, createAndStartPlan, getPlanById, handleTaskCompletion, handleTaskFailure } from '../src/services/orchestratorService';
import { incrementMetric } from '../src/services/metricsService';
import { addConversationMessage, appendRunEvent, getRun, updateRun } from '../src/services/conversationService';
import { enqueueWebhookNotification } from '../src/services/webhookService';
import { enqueueDeadLetter, isDeadLetterQueueEnabled } from '../src/services/deadLetterQueueService';

// Redis connection for BullMQ worker
let redisConnection: Redis | null = null;

// BullMQ worker instance
let taskWorker: Worker | null = null;

// Default concurrency limit
function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const DEFAULT_CONCURRENCY = parsePositiveInt(process.env.WORKER_CONCURRENCY, 10);
const DEFAULT_RATE_LIMIT = parsePositiveInt(process.env.WORKER_RATE_LIMIT, 10);

function normalizeExecutionMode(value: unknown): TaskExecutionMode | undefined {
  if (value === 'claude_cli' || value === 'tool_loop') {
    return value;
  }

  return undefined;
}

function normalizeExecutionStrategy(value: unknown, fallback: OrchestrationExecutionStrategy): OrchestrationExecutionStrategy {
  if (value === 'parallel' || value === 'sequential' || value === 'dag') {
    return value;
  }

  return fallback;
}

function isOrchestrationTask(taskType: string): boolean {
  return taskType === 'orchestrate' || taskType === 'orchestrate-team' || taskType === 'orchestrate-dag';
}

/**
 * Get or create Redis connection for the worker
 */
function getRedisConnection(): Redis {
  if (!redisConnection) {
    const policy = getRedisConnectionPolicy();
    redisConnection = new Redis({
      host: policy.host,
      port: policy.port,
      password: policy.password,
      maxRetriesPerRequest: null,
      enableOfflineQueue: policy.enableOfflineQueue,
      connectTimeout: policy.connectTimeoutMs,
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
 * Re-schedule blocked tasks that were waiting on a completed dependency.
 */
async function releaseBlockedDependents(completedTaskId: string): Promise<void> {
  const blockedDependents = getAllTasks().filter((task) => (
    task.status === 'blocked' && task.dependsOnTaskIds?.includes(completedTaskId)
  ));

  for (const dependentTask of blockedDependents) {
    if (hasIncompleteDependencies(dependentTask)) {
      continue;
    }

    const pendingTask = updateTaskStatus(dependentTask.id, 'pending');
    if (!pendingTask) {
      continue;
    }

    emitTaskStatus(pendingTask);
    await enqueueTaskById(pendingTask.id);
  }
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

    const resultData = isOrchestrationTask(currentTask.type)
      ? await runOrchestrationTask(currentTask)
      : await executeAgentTask(currentTask);

    const orchestrationPlanId = (
      resultData &&
      typeof resultData === 'object' &&
      typeof (resultData as { planId?: unknown }).planId === 'string'
    )
      ? (resultData as { planId: string }).planId
      : undefined;

    const completedTask = updateTaskStatus(taskId, 'completed', {
      result: resultData
    });

    if (completedTask) {
      emitTaskCompleted(completedTask);
      incrementMetric('tasksCompleted');
      enqueueWebhookNotification('task.completed', {
        taskId: completedTask.id,
        agentId: completedTask.agentId,
        type: completedTask.type,
        status: completedTask.status,
        runId: completedTask.runId,
        conversationId: completedTask.conversationId,
        result: completedTask.result,
        timestamp: new Date().toISOString()
      }).catch((webhookError) => {
        console.warn('[TaskWorker] Failed to enqueue task.completed webhook:', webhookError);
      });
      await handleTaskCompletion(completedTask);
      await releaseBlockedDependents(completedTask.id);

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

        if (!completedTask.parentTaskId && !completedTask.planId && !orchestrationPlanId) {
          const resultMetadata = (
            completedTask.result &&
            typeof completedTask.result === 'object' &&
            typeof (completedTask.result as { metadata?: unknown }).metadata === 'object' &&
            (completedTask.result as { metadata?: unknown }).metadata !== null
          )
            ? { ...((completedTask.result as { metadata: Record<string, unknown> }).metadata) }
            : {};

          const executionProfile = resultMetadata.executionProfile === 'deep_research'
            ? 'deep_research'
            : resultMetadata.executionProfile === 'standard'
              ? 'standard'
              : undefined;

          const artifacts = (
            typeof resultMetadata.artifacts === 'object' &&
            resultMetadata.artifacts !== null
          )
            ? resultMetadata.artifacts as RunArtifacts
            : undefined;

          delete resultMetadata.executionProfile;
          delete resultMetadata.artifacts;

          const existingMetadata = getRun(completedTask.runId)?.metadata ?? {};

          updateRun(completedTask.runId, 'completed', {
            summary: summaryMessage,
            executionProfile,
            artifacts,
            metadata: {
              ...existingMetadata,
              ...resultMetadata
            }
          });

          appendRunEvent({
            runId: completedTask.runId,
            conversationId: completedTask.conversationId,
            type: 'run.completed',
            payload: {
              taskId: completedTask.id
            }
          });
        } else if (completedTask.planId) {
          const plan = getPlanById(completedTask.planId);
          if (plan?.status === 'completed') {
            updateRun(completedTask.runId, 'completed', {
              summary: `Plan ${plan.id} completed for objective: ${plan.objective}`,
              metadata: {
                ...(getRun(completedTask.runId)?.metadata ?? {}),
                planId: plan.id,
                executionStrategy: plan.metadata?.executionStrategy
              }
            });

            appendRunEvent({
              runId: completedTask.runId,
              conversationId: completedTask.conversationId,
              type: 'run.completed',
              payload: {
                taskId: completedTask.id,
                planId: plan.id
              }
            });
          } else if (plan?.status === 'failed') {
            updateRun(completedTask.runId, 'failed', {
              error: `Plan ${plan.id} failed`,
              metadata: {
                ...(getRun(completedTask.runId)?.metadata ?? {}),
                planId: plan.id,
                executionStrategy: plan.metadata?.executionStrategy
              }
            });

            appendRunEvent({
              runId: completedTask.runId,
              conversationId: completedTask.conversationId,
              type: 'run.failed',
              payload: {
                taskId: completedTask.id,
                planId: plan.id,
                error: `Plan ${plan.id} failed`
              }
            });
          }
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
      if (isDeadLetterQueueEnabled()) {
        enqueueDeadLetter(failedTask, errorMessage, errorType, {
          runId: failedTask.runId,
          conversationId: failedTask.conversationId
        });
      }
      enqueueWebhookNotification('task.failed', {
        taskId: failedTask.id,
        agentId: failedTask.agentId,
        type: failedTask.type,
        status: failedTask.status,
        runId: failedTask.runId,
        conversationId: failedTask.conversationId,
        error: failedTask.error,
        errorType: failedTask.errorType,
        timestamp: new Date().toISOString()
      }).catch((webhookError) => {
        console.warn('[TaskWorker] Failed to enqueue task.failed webhook:', webhookError);
      });
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
  steps?: unknown;
  stepPrompts?: unknown;
  maxSteps?: unknown;
  teamAgentIds?: unknown;
  executionStrategy?: unknown;
  assignmentStrategy?: unknown;
  executionMode?: unknown;
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
  const dagSteps = Array.isArray(taskData.steps)
    ? taskData.steps.filter((value): value is {
      id?: string;
      title: string;
      description?: string;
      agentId?: string;
      taskType?: string;
      taskData?: Record<string, unknown>;
      dependsOnStepIds?: string[];
    } => (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { title?: unknown }).title === 'string'
    ))
    : undefined;
  const teamAgentIds = Array.isArray(taskData.teamAgentIds)
    ? taskData.teamAgentIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : undefined;
  const assignmentStrategy: 'round_robin' | 'least_loaded' = taskData.assignmentStrategy === 'least_loaded'
    ? 'least_loaded'
    : 'round_robin';

  const maxSteps = typeof taskData.maxSteps === 'number' ? taskData.maxSteps : undefined;
  const executionStrategy = normalizeExecutionStrategy(
    taskData.executionStrategy,
    task.type === 'orchestrate-dag'
      ? 'dag'
      : (task.type === 'orchestrate-team' ? 'parallel' : 'sequential')
  );
  const executionMode = normalizeExecutionMode(taskData.executionMode) ?? task.executionMode;
  const metadata = typeof taskData.metadata === 'object' && taskData.metadata !== null
    ? taskData.metadata as Record<string, unknown>
    : undefined;

  const commonInput = {
    objective,
    defaultAgentId,
    teamAgentIds,
    assignmentStrategy,
    executionMode,
    conversationId: task.conversationId,
    runId: task.runId,
    metadata: {
      ...(metadata ?? {}),
      parentTaskId: task.id,
      workspaceId: task.workspaceId
    }
  };

  const summary = executionStrategy === 'dag'
    ? await createAndStartDagPlan({
      ...commonInput,
      steps: dagSteps ?? []
    })
    : await createAndStartPlan({
      ...commonInput,
      stepPrompts,
      maxSteps,
      executionStrategy
    });

  return {
    message: `Started ${executionStrategy} orchestration plan ${summary.planId} with ${summary.totalSteps} steps for objective: ${objective}`,
    mode: task.type,
    objective,
    executionStrategy,
    assignmentStrategy,
    teamAgentIds: summary.teamAgentIds,
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
        max: DEFAULT_RATE_LIMIT,
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
