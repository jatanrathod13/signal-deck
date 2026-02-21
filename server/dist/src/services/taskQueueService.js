"use strict";
/**
 * TaskQueueService - Task queue management service using BullMQ
 * Provides task submission, retrieval, cancellation, and retry functionality
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskQueue = void 0;
exports.setRedisConnection = setRedisConnection;
exports.setTaskQueue = setTaskQueue;
exports.submitTask = submitTask;
exports.getTask = getTask;
exports.cancelTask = cancelTask;
exports.retryTask = retryTask;
exports.getAllTasks = getAllTasks;
exports.getTasksByAgent = getTasksByAgent;
exports.closeTaskQueue = closeTaskQueue;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const socketService_1 = require("./socketService");
// Redis connection for BullMQ
let redisConnection = null;
/**
 * Get or create Redis connection
 */
function getRedisConnection() {
    if (!redisConnection) {
        redisConnection = new ioredis_1.default({
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
function setRedisConnection(connection) {
    redisConnection = connection;
}
// In-memory task storage for quick retrieval
// BullMQ stores jobs in Redis, but we keep metadata for quick access
const taskStore = new Map();
// Create the BullMQ queue
let taskQueue = null;
exports.taskQueue = taskQueue;
/**
 * Get or create the BullMQ queue
 */
function getTaskQueue() {
    if (!taskQueue) {
        exports.taskQueue = taskQueue = new bullmq_1.Queue('agent-tasks', {
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
function setTaskQueue(queue) {
    exports.taskQueue = taskQueue = queue;
}
/**
 * Generate a unique task ID
 */
function generateTaskId() {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
/**
 * Create a Task object from input parameters
 */
function createTask(agentId, type, data, priority = 1) {
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
function updateTaskStatus(taskId, status, additionalUpdates) {
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
async function submitTask(task) {
    // Ensure task has required fields
    const newTask = task.id
        ? { ...task, status: 'pending', updatedAt: new Date() }
        : createTask(task.agentId, task.type, task.data, task.priority);
    // Store in memory for quick retrieval
    taskStore.set(newTask.id, newTask);
    // Emit task status event
    (0, socketService_1.emitTaskStatus)(newTask);
    // Add to BullMQ queue
    await getTaskQueue().add(newTask.type, {
        taskId: newTask.id,
        agentId: newTask.agentId,
        data: newTask.data
    }, {
        priority: newTask.priority,
        jobId: newTask.id
    });
    return newTask.id;
}
/**
 * Get a task by ID
 * @param taskId - The task ID to retrieve
 * @returns Task object or undefined if not found
 */
function getTask(taskId) {
    return taskStore.get(taskId);
}
/**
 * Cancel a task by ID
 * Cancels a pending or processing task
 * @param taskId - The task ID to cancel
 * @returns boolean - True if task was cancelled, false if not found or already completed/failed
 */
function cancelTask(taskId) {
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
    (0, socketService_1.emitTaskStatus)(task);
    return true;
}
/**
 * Retry a failed task
 * Creates a new task with the same data
 * @param taskId - The failed task ID to retry
 * @returns Promise<string> - The new task ID, or throws if task not found or not in failed state
 */
async function retryTask(taskId) {
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
    (0, socketService_1.emitTaskStatus)(newTask);
    // Add to BullMQ queue
    await getTaskQueue().add(newTask.type, {
        taskId: newTask.id,
        agentId: newTask.agentId,
        data: newTask.data
    }, {
        priority: newTask.priority,
        jobId: newTask.id
    });
    return newTask.id;
}
/**
 * Get all tasks
 * @returns Array of all tasks
 */
function getAllTasks() {
    return Array.from(taskStore.values());
}
/**
 * Get tasks by agent ID
 * @param agentId - The agent ID to filter by
 * @returns Array of tasks for the agent
 */
function getTasksByAgent(agentId) {
    return Array.from(taskStore.values()).filter(task => task.agentId === agentId);
}
/**
 * Clean up resources (for testing)
 */
async function closeTaskQueue() {
    if (taskQueue) {
        await taskQueue.close();
        exports.taskQueue = taskQueue = null;
    }
    if (redisConnection) {
        await redisConnection.quit();
        redisConnection = null;
    }
    taskStore.clear();
}
//# sourceMappingURL=taskQueueService.js.map