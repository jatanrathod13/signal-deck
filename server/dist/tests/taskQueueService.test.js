"use strict";
/**
 * TaskQueueService Tests
 * Unit tests for task queue management service
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
const taskQueueService_1 = require("../src/services/taskQueueService");
const bullmq_1 = require("bullmq");
describe('TaskQueueService', () => {
    // Create mock queue and connection before tests
    let mockQueue;
    beforeEach(async () => {
        // Get the mocked Queue instance
        mockQueue = new bullmq_1.Queue('agent-tasks');
        // Set the mock queue
        (0, taskQueueService_1.setTaskQueue)(mockQueue);
        // Clear all tasks before each test
        const tasks = (0, taskQueueService_1.getAllTasks)();
        tasks.forEach(task => {
            const taskObj = (0, taskQueueService_1.getTask)(task.id);
            if (taskObj) {
                (0, taskQueueService_1.cancelTask)(task.id);
            }
        });
    });
    afterEach(async () => {
        // Clean up after each test
        await (0, taskQueueService_1.closeTaskQueue)();
    });
    describe('submitTask', () => {
        it('should create a task with generated ID', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: { input: 'test' }
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            expect(taskId).toBeDefined();
            expect(taskId).toMatch(/^task-/);
        });
        it('should store task in memory', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: { input: 'test' }
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            const retrieved = (0, taskQueueService_1.getTask)(taskId);
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(taskId);
            expect(retrieved?.agentId).toBe('agent-1');
            expect(retrieved?.type).toBe('process');
        });
        it('should set default priority to 1', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {}
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            const retrieved = (0, taskQueueService_1.getTask)(taskId);
            expect(retrieved?.priority).toBe(1);
        });
        it('should use provided priority', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {},
                priority: 5
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            const retrieved = (0, taskQueueService_1.getTask)(taskId);
            expect(retrieved?.priority).toBe(5);
        });
        it('should set status to pending', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {}
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            const retrieved = (0, taskQueueService_1.getTask)(taskId);
            expect(retrieved?.status).toBe('pending');
        });
        it('should add task to BullMQ queue', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: { input: 'test' }
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            expect(mockQueue.add).toHaveBeenCalledWith('process', expect.objectContaining({
                taskId,
                agentId: 'agent-1',
                data: { input: 'test' }
            }), expect.objectContaining({
                priority: 1,
                jobId: taskId
            }));
        });
    });
    describe('getTask', () => {
        it('should return task by ID', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {}
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            const retrieved = (0, taskQueueService_1.getTask)(taskId);
            expect(retrieved).toBeDefined();
            expect(retrieved?.id).toBe(taskId);
        });
        it('should return undefined for non-existent task', () => {
            const retrieved = (0, taskQueueService_1.getTask)('non-existent-id');
            expect(retrieved).toBeUndefined();
        });
    });
    describe('cancelTask', () => {
        it('should cancel a pending task', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {}
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            const result = (0, taskQueueService_1.cancelTask)(taskId);
            const retrieved = (0, taskQueueService_1.getTask)(taskId);
            expect(result).toBe(true);
            expect(retrieved?.status).toBe('cancelled');
        });
        it('should return false for non-existent task', () => {
            const result = (0, taskQueueService_1.cancelTask)('non-existent-id');
            expect(result).toBe(false);
        });
        it('should return false for already completed task', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {}
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            // Manually update status to completed to simulate
            const taskObj = (0, taskQueueService_1.getTask)(taskId);
            if (taskObj) {
                taskObj.status = 'completed';
            }
            const result = (0, taskQueueService_1.cancelTask)(taskId);
            expect(result).toBe(false);
        });
        it('should return false for failed task', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {}
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            // Manually update status to failed to simulate
            const taskObj = (0, taskQueueService_1.getTask)(taskId);
            if (taskObj) {
                taskObj.status = 'failed';
            }
            const result = (0, taskQueueService_1.cancelTask)(taskId);
            expect(result).toBe(false);
        });
    });
    describe('retryTask', () => {
        it('should retry a failed task', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: { input: 'test' }
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            // Manually update status to failed
            const taskObj = (0, taskQueueService_1.getTask)(taskId);
            if (taskObj) {
                taskObj.status = 'failed';
            }
            const newTaskId = await (0, taskQueueService_1.retryTask)(taskId);
            expect(newTaskId).not.toBe(taskId);
            expect(newTaskId).toMatch(/^task-/);
            // Verify new task exists and has correct data
            const newTask = (0, taskQueueService_1.getTask)(newTaskId);
            expect(newTask).toBeDefined();
            expect(newTask?.agentId).toBe('agent-1');
            expect(newTask?.type).toBe('process');
            expect(newTask?.data).toEqual({ input: 'test' });
            expect(newTask?.status).toBe('pending');
        });
        it('should retry a cancelled task', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {}
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            (0, taskQueueService_1.cancelTask)(taskId);
            const newTaskId = await (0, taskQueueService_1.retryTask)(taskId);
            expect(newTaskId).toMatch(/^task-/);
            expect((0, taskQueueService_1.getTask)(newTaskId)?.status).toBe('pending');
        });
        it('should throw error for non-existent task', async () => {
            await expect((0, taskQueueService_1.retryTask)('non-existent-id')).rejects.toThrow('Task not found');
        });
        it('should throw error for pending task', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {}
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            await expect((0, taskQueueService_1.retryTask)(taskId)).rejects.toThrow('Task can only be retried if it is failed or cancelled');
        });
        it('should throw error for processing task', async () => {
            const task = {
                agentId: 'agent-1',
                type: 'process',
                data: {}
            };
            const taskId = await (0, taskQueueService_1.submitTask)(task);
            // Manually update status to processing
            const taskObj = (0, taskQueueService_1.getTask)(taskId);
            if (taskObj) {
                taskObj.status = 'processing';
            }
            await expect((0, taskQueueService_1.retryTask)(taskId)).rejects.toThrow('Task can only be retried if it is failed or cancelled');
        });
    });
    describe('getAllTasks', () => {
        it('should return empty array when no tasks', () => {
            const tasks = (0, taskQueueService_1.getAllTasks)();
            expect(tasks).toEqual([]);
        });
        it('should return all registered tasks', async () => {
            await (0, taskQueueService_1.submitTask)({ agentId: 'agent-1', type: 'process', data: {} });
            await (0, taskQueueService_1.submitTask)({ agentId: 'agent-2', type: 'process', data: {} });
            const tasks = (0, taskQueueService_1.getAllTasks)();
            expect(tasks).toHaveLength(2);
        });
    });
    describe('getTasksByAgent', () => {
        it('should return tasks for specific agent', async () => {
            await (0, taskQueueService_1.submitTask)({ agentId: 'agent-1', type: 'process', data: {} });
            await (0, taskQueueService_1.submitTask)({ agentId: 'agent-2', type: 'process', data: {} });
            await (0, taskQueueService_1.submitTask)({ agentId: 'agent-1', type: 'process', data: {} });
            const tasks = (0, taskQueueService_1.getTasksByAgent)('agent-1');
            expect(tasks).toHaveLength(2);
            expect(tasks.every(t => t.agentId === 'agent-1')).toBe(true);
        });
        it('should return empty array for agent with no tasks', async () => {
            const tasks = (0, taskQueueService_1.getTasksByAgent)('non-existent-agent');
            expect(tasks).toEqual([]);
        });
    });
});
//# sourceMappingURL=taskQueueService.test.js.map