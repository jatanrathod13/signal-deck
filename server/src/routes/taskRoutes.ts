/**
 * Task REST Routes
 * Express router for task queue and orchestration task endpoints.
 */

import { Router, Request, Response } from 'express';
import {
  submitTask,
  getTask,
  cancelTask,
  retryTask,
  getAllTasks,
  getChildTasks,
  getTasksByPlan,
  isTaskVisibleInWorkspace
} from '../services/taskQueueService';
import { Task, TaskExecutionMode, TaskStatus } from '../../types';
import { buildCacheKey, getCachedValue, invalidateCachePrefix, setCachedValue } from '../services/cacheService';
import { getCurrentWorkspaceId } from '../services/workspaceContextService';
import { QuotaExceededError } from '../services/quotaService';

const router = Router();

interface CreateTaskBody {
  agentId: string;
  type: string;
  data?: Record<string, unknown>;
  executionMode?: TaskExecutionMode;
  priority?: number;
  idempotencyKey?: string;
  parentTaskId?: string;
  planId?: string;
  stepId?: string;
  dependsOnTaskIds?: string[];
  metadata?: Record<string, unknown>;
  conversationId?: string;
  runId?: string;
}

interface TaskQuery {
  status?: TaskStatus;
  planId?: string;
}

router.post('/', async (req: Request<{}, {}, CreateTaskBody>, res: Response) => {
  try {
    const {
      agentId,
      type,
      data = {},
      executionMode,
      priority = 1,
      idempotencyKey,
      parentTaskId,
      planId,
      stepId,
      dependsOnTaskIds,
      metadata,
      conversationId,
      runId
    } = req.body;

    if (!agentId || !type) {
      return res.status(400).json({
        success: false,
        error: 'agentId and type are required'
      });
    }

    const now = new Date();
    const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
    const task: Task = {
      id: '',
      workspaceId,
      agentId,
      type,
      data,
      executionMode,
      status: 'pending',
      priority,
      createdAt: now,
      updatedAt: now,
      idempotencyKey,
      parentTaskId,
      planId,
      stepId,
      dependsOnTaskIds,
      metadata,
      conversationId,
      runId,
      childTaskIds: [],
      retryCount: 0
    };

    const taskId = await submitTask(task);
    const createdTask = getTask(taskId);
    invalidateCachePrefix(buildCacheKey(['tasks:list', workspaceId]));

    return res.status(201).json({
      success: true,
      data: createdTask
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return res.status(429).json({
        success: false,
        error: error.message,
        details: {
          metric: error.metric,
          limit: error.limit,
          current: error.current,
          workspaceId: error.workspaceId
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create task'
    });
  }
});

router.get('/', (req: Request<{}, {}, {}, TaskQuery>, res: Response) => {
  try {
    const { status, planId } = req.query;
    const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
    const cacheKey = buildCacheKey(['tasks:list', workspaceId, status, planId]);
    const cached = getCachedValue<Task[]>(cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        data: cached
      });
    }

    let tasks = getAllTasks().filter((task) => isTaskVisibleInWorkspace(task, workspaceId));

    if (status) {
      tasks = tasks.filter((task) => task.status === status);
    }

    if (planId) {
      tasks = getTasksByPlan(planId)
        .filter((task) => isTaskVisibleInWorkspace(task, workspaceId))
        .filter((task) => !status || task.status === status);
    }

    setCachedValue(cacheKey, tasks);

    return res.status(200).json({
      success: true,
      data: tasks
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list tasks'
    });
  }
});

router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
    const task = getTask(id);

    if (!task || !isTaskVisibleInWorkspace(task, workspaceId)) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get task'
    });
  }
});

router.get('/:id/children', (req: Request<{ id: string }>, res: Response) => {
  const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
  return res.status(200).json({
    success: true,
    data: getChildTasks(req.params.id).filter((task) => isTaskVisibleInWorkspace(task, workspaceId))
  });
});

router.delete('/:id', (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
    const task = getTask(id);

    if (!task || !isTaskVisibleInWorkspace(task, workspaceId)) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    if (task.status !== 'pending' && task.status !== 'processing' && task.status !== 'blocked') {
      return res.status(400).json({
        success: false,
        error: 'Task cannot be cancelled in current status'
      });
    }

    const cancelled = cancelTask(id);

    if (!cancelled) {
      return res.status(400).json({
        success: false,
        error: 'Failed to cancel task'
      });
    }

    invalidateCachePrefix(buildCacheKey(['tasks:list', workspaceId]));

    return res.status(200).json({
      success: true,
      data: getTask(id)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel task'
    });
  }
});

router.post('/:id/retry', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const workspaceId = req.auth?.workspaceId ?? getCurrentWorkspaceId();
    const task = getTask(id);

    if (!task || !isTaskVisibleInWorkspace(task, workspaceId)) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    if (task.status !== 'failed' && task.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Task can only be retried if it is failed or cancelled'
      });
    }

    const newTaskId = await retryTask(id);
    invalidateCachePrefix(buildCacheKey(['tasks:list', workspaceId]));

    return res.status(200).json({
      success: true,
      data: getTask(newTaskId)
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Task not found') {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry task'
    });
  }
});

export default router;
