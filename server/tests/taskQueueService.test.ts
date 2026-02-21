/**
 * TaskQueueService Tests
 * Unit tests for task queue management service
 */

// Mock BullMQ
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    close: jest.fn().mockResolvedValue(undefined)
  };

  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Job: jest.fn()
  };
});

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined)
  }));
});

import { Task } from '../types';
import {
  submitTask,
  getTask,
  cancelTask,
  retryTask,
  getAllTasks,
  getTasksByAgent,
  closeTaskQueue,
  setTaskQueue,
  setRedisConnection
} from '../src/services/taskQueueService';
import { Queue } from 'bullmq';

describe('TaskQueueService', () => {
  // Create mock queue and connection before tests
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    // Get the mocked Queue instance
    mockQueue = new Queue('agent-tasks') as jest.Mocked<Queue>;

    // Set the mock queue
    setTaskQueue(mockQueue);

    // Clear all tasks before each test
    const tasks = getAllTasks();
    tasks.forEach(task => {
      const taskObj = getTask(task.id);
      if (taskObj) {
        cancelTask(task.id);
      }
    });
  });

  afterEach(async () => {
    // Clean up after each test
    await closeTaskQueue();
  });

  describe('submitTask', () => {
    it('should create a task with generated ID', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: { input: 'test' }
      };

      const taskId = await submitTask(task as Task);

      expect(taskId).toBeDefined();
      expect(taskId).toMatch(/^task-/);
    });

    it('should store task in memory', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: { input: 'test' }
      };

      const taskId = await submitTask(task as Task);
      const retrieved = getTask(taskId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(taskId);
      expect(retrieved?.agentId).toBe('agent-1');
      expect(retrieved?.type).toBe('process');
    });

    it('should set default priority to 1', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {}
      };

      const taskId = await submitTask(task as Task);
      const retrieved = getTask(taskId);

      expect(retrieved?.priority).toBe(1);
    });

    it('should use provided priority', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {},
        priority: 5
      };

      const taskId = await submitTask(task as Task);
      const retrieved = getTask(taskId);

      expect(retrieved?.priority).toBe(5);
    });

    it('should set status to pending', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {}
      };

      const taskId = await submitTask(task as Task);
      const retrieved = getTask(taskId);

      expect(retrieved?.status).toBe('pending');
    });

    it('should add task to BullMQ queue', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: { input: 'test' }
      };

      const taskId = await submitTask(task as Task);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process',
        expect.objectContaining({
          taskId,
          agentId: 'agent-1',
          data: { input: 'test' }
        }),
        expect.objectContaining({
          priority: 1,
          jobId: taskId
        })
      );
    });
  });

  describe('getTask', () => {
    it('should return task by ID', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {}
      };

      const taskId = await submitTask(task as Task);
      const retrieved = getTask(taskId);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(taskId);
    });

    it('should return undefined for non-existent task', () => {
      const retrieved = getTask('non-existent-id');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('cancelTask', () => {
    it('should cancel a pending task', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {}
      };

      const taskId = await submitTask(task as Task);
      const result = cancelTask(taskId);
      const retrieved = getTask(taskId);

      expect(result).toBe(true);
      expect(retrieved?.status).toBe('cancelled');
    });

    it('should return false for non-existent task', () => {
      const result = cancelTask('non-existent-id');

      expect(result).toBe(false);
    });

    it('should return false for already completed task', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {}
      };

      const taskId = await submitTask(task as Task);

      // Manually update status to completed to simulate
      const taskObj = getTask(taskId);
      if (taskObj) {
        taskObj.status = 'completed';
      }

      const result = cancelTask(taskId);

      expect(result).toBe(false);
    });

    it('should return false for failed task', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {}
      };

      const taskId = await submitTask(task as Task);

      // Manually update status to failed to simulate
      const taskObj = getTask(taskId);
      if (taskObj) {
        taskObj.status = 'failed';
      }

      const result = cancelTask(taskId);

      expect(result).toBe(false);
    });
  });

  describe('retryTask', () => {
    it('should retry a failed task', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: { input: 'test' }
      };

      const taskId = await submitTask(task as Task);

      // Manually update status to failed
      const taskObj = getTask(taskId);
      if (taskObj) {
        taskObj.status = 'failed';
      }

      const newTaskId = await retryTask(taskId);

      expect(newTaskId).not.toBe(taskId);
      expect(newTaskId).toMatch(/^task-/);

      // Verify new task exists and has correct data
      const newTask = getTask(newTaskId);
      expect(newTask).toBeDefined();
      expect(newTask?.agentId).toBe('agent-1');
      expect(newTask?.type).toBe('process');
      expect(newTask?.data).toEqual({ input: 'test' });
      expect(newTask?.status).toBe('pending');
    });

    it('should retry a cancelled task', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {}
      };

      const taskId = await submitTask(task as Task);
      cancelTask(taskId);

      const newTaskId = await retryTask(taskId);

      expect(newTaskId).toMatch(/^task-/);
      expect(getTask(newTaskId)?.status).toBe('pending');
    });

    it('should throw error for non-existent task', async () => {
      await expect(retryTask('non-existent-id')).rejects.toThrow('Task not found');
    });

    it('should throw error for pending task', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {}
      };

      const taskId = await submitTask(task as Task);

      await expect(retryTask(taskId)).rejects.toThrow('Task can only be retried if it is failed or cancelled');
    });

    it('should throw error for processing task', async () => {
      const task: Partial<Task> = {
        agentId: 'agent-1',
        type: 'process',
        data: {}
      };

      const taskId = await submitTask(task as Task);

      // Manually update status to processing
      const taskObj = getTask(taskId);
      if (taskObj) {
        taskObj.status = 'processing';
      }

      await expect(retryTask(taskId)).rejects.toThrow('Task can only be retried if it is failed or cancelled');
    });
  });

  describe('getAllTasks', () => {
    it('should return empty array when no tasks', () => {
      const tasks = getAllTasks();

      expect(tasks).toEqual([]);
    });

    it('should return all registered tasks', async () => {
      await submitTask({ agentId: 'agent-1', type: 'process', data: {} } as Task);
      await submitTask({ agentId: 'agent-2', type: 'process', data: {} } as Task);

      const tasks = getAllTasks();

      expect(tasks).toHaveLength(2);
    });
  });

  describe('getTasksByAgent', () => {
    it('should return tasks for specific agent', async () => {
      await submitTask({ agentId: 'agent-1', type: 'process', data: {} } as Task);
      await submitTask({ agentId: 'agent-2', type: 'process', data: {} } as Task);
      await submitTask({ agentId: 'agent-1', type: 'process', data: {} } as Task);

      const tasks = getTasksByAgent('agent-1');

      expect(tasks).toHaveLength(2);
      expect(tasks.every(t => t.agentId === 'agent-1')).toBe(true);
    });

    it('should return empty array for agent with no tasks', async () => {
      const tasks = getTasksByAgent('non-existent-agent');

      expect(tasks).toEqual([]);
    });
  });
});
