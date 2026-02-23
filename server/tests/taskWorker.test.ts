/**
 * TaskWorker dependency unblocking tests
 */

jest.mock('bullmq', () => {
  class MockWorker {
    public __processor: ((job: any) => Promise<any>);
    public on = jest.fn();
    public close = jest.fn().mockResolvedValue(undefined);

    constructor(_name: string, processor: (job: any) => Promise<any>) {
      this.__processor = processor;
    }
  }

  return {
    Worker: jest.fn().mockImplementation((name: string, processor: (job: any) => Promise<any>) => (
      new MockWorker(name, processor)
    ))
  };
});

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    quit: jest.fn().mockResolvedValue(undefined)
  }));
});

jest.mock('../src/services/socketService', () => ({
  emitTaskStatus: jest.fn(),
  emitTaskCompleted: jest.fn(),
  emitError: jest.fn()
}));

jest.mock('../src/services/executionService', () => ({
  executeAgentTask: jest.fn().mockResolvedValue({ message: 'done' })
}));

jest.mock('../src/services/orchestratorService', () => ({
  createAndStartPlan: jest.fn(),
  createAndStartDagPlan: jest.fn(),
  getPlanById: jest.fn(),
  handleTaskCompletion: jest.fn().mockResolvedValue(undefined),
  handleTaskFailure: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/services/metricsService', () => ({
  incrementMetric: jest.fn()
}));

jest.mock('../src/services/conversationService', () => ({
  addConversationMessage: jest.fn(),
  appendRunEvent: jest.fn(),
  getRun: jest.fn(),
  updateRun: jest.fn()
}));

import { Task } from '../types';
import { startWorker, stopWorker, getWorker } from '../worker/taskWorker';
import { executeAgentTask } from '../src/services/executionService';
import { createAndStartDagPlan, getPlanById } from '../src/services/orchestratorService';
import { appendRunEvent, getRun, updateRun } from '../src/services/conversationService';

describe('TaskWorker', () => {
  afterEach(async () => {
    await stopWorker();
    jest.clearAllMocks();
  });

  it('should requeue blocked dependent tasks when dependency completes', async () => {
    const parentTask: Task = {
      id: 'parent-1',
      agentId: 'agent-1',
      type: 'process',
      data: { prompt: 'parent' },
      status: 'pending',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      childTaskIds: [],
      dependsOnTaskIds: []
    };

    const blockedDependent: Task = {
      id: 'child-1',
      agentId: 'agent-1',
      type: 'process',
      data: { prompt: 'child' },
      status: 'blocked',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      childTaskIds: [],
      dependsOnTaskIds: ['parent-1']
    };

    const taskMap = new Map<string, Task>([
      [parentTask.id, parentTask],
      [blockedDependent.id, blockedDependent]
    ]);

    const taskQueueService = require('../src/services/taskQueueService') as any;

    jest.spyOn(taskQueueService, 'getTask').mockImplementation((taskId: unknown) => {
      return taskMap.get(taskId as string);
    });

    jest.spyOn(taskQueueService, 'getAllTasks').mockImplementation(() => {
      return Array.from(taskMap.values());
    });

    jest.spyOn(taskQueueService, 'updateTaskStatus').mockImplementation(
      (taskId: unknown, status: unknown, updates?: unknown) => {
        const task = taskMap.get(taskId as string);
        if (!task) {
          return undefined;
        }

        task.status = status as Task['status'];
        task.updatedAt = new Date();
        if (updates) {
          Object.assign(task, updates as Partial<Task>);
        }

        return task;
      }
    );

    const enqueueSpy = jest.spyOn(taskQueueService, 'enqueueTaskById')
      .mockResolvedValue(true);

    startWorker();
    const worker = getWorker() as any;
    expect(worker).toBeTruthy();

    const result = await worker.__processor({
      id: 'job-1',
      data: { taskId: 'parent-1', agentId: 'agent-1' }
    });

    expect(result).toEqual({ result: 'completed' });
    expect(taskMap.get('parent-1')?.status).toBe('completed');
    expect(taskMap.get('child-1')?.status).toBe('pending');
    expect(enqueueSpy).toHaveBeenCalledWith('child-1');
  });

  it('should not mark run completed when root orchestration task only creates a plan', async () => {
    const orchestrationTask: Task = {
      id: 'task-orch-root',
      agentId: 'agent-1',
      type: 'orchestrate-dag',
      data: { objective: 'Build release notes' },
      status: 'pending',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      childTaskIds: [],
      dependsOnTaskIds: [],
      runId: 'run-1',
      conversationId: 'conv-1'
    };

    const taskQueueService = require('../src/services/taskQueueService') as any;
    const taskMap = new Map<string, Task>([[orchestrationTask.id, orchestrationTask]]);

    jest.spyOn(taskQueueService, 'getTask').mockImplementation((taskId: unknown) => {
      return taskMap.get(taskId as string);
    });
    jest.spyOn(taskQueueService, 'getAllTasks').mockImplementation(() => Array.from(taskMap.values()));
    jest.spyOn(taskQueueService, 'updateTaskStatus').mockImplementation(
      (taskId: unknown, status: unknown, updates?: unknown) => {
        const task = taskMap.get(taskId as string);
        if (!task) {
          return undefined;
        }
        task.status = status as Task['status'];
        task.updatedAt = new Date();
        if (updates) {
          Object.assign(task, updates as Partial<Task>);
        }
        return task;
      }
    );
    jest.spyOn(taskQueueService, 'enqueueTaskById').mockResolvedValue(true);

    (createAndStartDagPlan as jest.Mock).mockResolvedValue({
      planId: 'plan-123',
      totalSteps: 3,
      entryTaskIds: ['step-1'],
      executionStrategy: 'dag'
    });
    (getRun as jest.Mock).mockReturnValue({ id: 'run-1', metadata: {} });

    startWorker();
    const worker = getWorker() as any;
    await worker.__processor({
      id: 'job-orch',
      data: { taskId: orchestrationTask.id, agentId: orchestrationTask.agentId }
    });

    expect(updateRun).not.toHaveBeenCalledWith(
      'run-1',
      'completed',
      expect.anything()
    );
    expect(appendRunEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        type: 'run.completed'
      })
    );
  });

  it('should mark run completed when plan step finishes and plan is completed', async () => {
    const planStepTask: Task = {
      id: 'task-plan-step',
      agentId: 'agent-1',
      type: 'process',
      data: { prompt: 'Step output' },
      status: 'pending',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      childTaskIds: [],
      dependsOnTaskIds: [],
      runId: 'run-2',
      conversationId: 'conv-2',
      planId: 'plan-200'
    };

    const taskQueueService = require('../src/services/taskQueueService') as any;
    const taskMap = new Map<string, Task>([[planStepTask.id, planStepTask]]);

    jest.spyOn(taskQueueService, 'getTask').mockImplementation((taskId: unknown) => {
      return taskMap.get(taskId as string);
    });
    jest.spyOn(taskQueueService, 'getAllTasks').mockImplementation(() => Array.from(taskMap.values()));
    jest.spyOn(taskQueueService, 'updateTaskStatus').mockImplementation(
      (taskId: unknown, status: unknown, updates?: unknown) => {
        const task = taskMap.get(taskId as string);
        if (!task) {
          return undefined;
        }
        task.status = status as Task['status'];
        task.updatedAt = new Date();
        if (updates) {
          Object.assign(task, updates as Partial<Task>);
        }
        return task;
      }
    );
    jest.spyOn(taskQueueService, 'enqueueTaskById').mockResolvedValue(true);

    (executeAgentTask as jest.Mock).mockResolvedValue({ message: 'step done' });
    (getPlanById as jest.Mock).mockReturnValue({
      id: 'plan-200',
      status: 'completed',
      objective: 'Ship feature',
      metadata: { executionStrategy: 'dag' }
    });
    (getRun as jest.Mock).mockReturnValue({ id: 'run-2', metadata: { source: 'test' } });

    startWorker();
    const worker = getWorker() as any;
    await worker.__processor({
      id: 'job-plan-complete',
      data: { taskId: planStepTask.id, agentId: planStepTask.agentId }
    });

    expect(updateRun).toHaveBeenCalledWith(
      'run-2',
      'completed',
      expect.objectContaining({
        summary: expect.stringContaining('Plan plan-200 completed'),
        metadata: expect.objectContaining({
          source: 'test',
          planId: 'plan-200',
          executionStrategy: 'dag'
        })
      })
    );
    expect(appendRunEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-2',
        type: 'run.completed',
        payload: expect.objectContaining({
          planId: 'plan-200'
        })
      })
    );
  });

  it('should mark run failed when plan step finishes and plan is failed', async () => {
    const planStepTask: Task = {
      id: 'task-plan-step-failed',
      agentId: 'agent-1',
      type: 'process',
      data: { prompt: 'Step output' },
      status: 'pending',
      priority: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      childTaskIds: [],
      dependsOnTaskIds: [],
      runId: 'run-3',
      conversationId: 'conv-3',
      planId: 'plan-300'
    };

    const taskQueueService = require('../src/services/taskQueueService') as any;
    const taskMap = new Map<string, Task>([[planStepTask.id, planStepTask]]);

    jest.spyOn(taskQueueService, 'getTask').mockImplementation((taskId: unknown) => {
      return taskMap.get(taskId as string);
    });
    jest.spyOn(taskQueueService, 'getAllTasks').mockImplementation(() => Array.from(taskMap.values()));
    jest.spyOn(taskQueueService, 'updateTaskStatus').mockImplementation(
      (taskId: unknown, status: unknown, updates?: unknown) => {
        const task = taskMap.get(taskId as string);
        if (!task) {
          return undefined;
        }
        task.status = status as Task['status'];
        task.updatedAt = new Date();
        if (updates) {
          Object.assign(task, updates as Partial<Task>);
        }
        return task;
      }
    );
    jest.spyOn(taskQueueService, 'enqueueTaskById').mockResolvedValue(true);

    (executeAgentTask as jest.Mock).mockResolvedValue({ message: 'step done' });
    (getPlanById as jest.Mock).mockReturnValue({
      id: 'plan-300',
      status: 'failed',
      objective: 'Ship feature',
      metadata: { executionStrategy: 'sequential' }
    });
    (getRun as jest.Mock).mockReturnValue({ id: 'run-3', metadata: { source: 'test' } });

    startWorker();
    const worker = getWorker() as any;
    await worker.__processor({
      id: 'job-plan-failed',
      data: { taskId: planStepTask.id, agentId: planStepTask.agentId }
    });

    expect(updateRun).toHaveBeenCalledWith(
      'run-3',
      'failed',
      expect.objectContaining({
        error: 'Plan plan-300 failed',
        metadata: expect.objectContaining({
          source: 'test',
          planId: 'plan-300',
          executionStrategy: 'sequential'
        })
      })
    );
    expect(appendRunEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-3',
        type: 'run.failed',
        payload: expect.objectContaining({
          planId: 'plan-300'
        })
      })
    );
  });
});
