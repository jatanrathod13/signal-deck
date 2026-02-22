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
  handleTaskCompletion: jest.fn().mockResolvedValue(undefined),
  handleTaskFailure: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/services/metricsService', () => ({
  incrementMetric: jest.fn()
}));

jest.mock('../src/services/conversationService', () => ({
  addConversationMessage: jest.fn(),
  appendRunEvent: jest.fn(),
  updateRun: jest.fn()
}));

import { Task } from '../types';
import { startWorker, stopWorker, getWorker } from '../worker/taskWorker';

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
});
