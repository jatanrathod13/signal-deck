/**
 * TaskQueueService - Task queue management service using BullMQ
 * Provides task submission, retrieval, cancellation, and retry functionality
 */
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { Task } from '../../types';
/**
 * Set custom Redis connection (useful for testing)
 */
export declare function setRedisConnection(connection: Redis): void;
declare let taskQueue: Queue | null;
/**
 * Set custom queue (useful for testing)
 */
export declare function setTaskQueue(queue: Queue): void;
/**
 * Submit a new task to the queue
 * @param task - Task object with agentId, type, data, and optional priority
 * @returns Promise<string> - The task ID
 */
export declare function submitTask(task: Task): Promise<string>;
/**
 * Get a task by ID
 * @param taskId - The task ID to retrieve
 * @returns Task object or undefined if not found
 */
export declare function getTask(taskId: string): Task | undefined;
/**
 * Cancel a task by ID
 * Cancels a pending or processing task
 * @param taskId - The task ID to cancel
 * @returns boolean - True if task was cancelled, false if not found or already completed/failed
 */
export declare function cancelTask(taskId: string): boolean;
/**
 * Retry a failed task
 * Creates a new task with the same data
 * @param taskId - The failed task ID to retry
 * @returns Promise<string> - The new task ID, or throws if task not found or not in failed state
 */
export declare function retryTask(taskId: string): Promise<string>;
/**
 * Get all tasks
 * @returns Array of all tasks
 */
export declare function getAllTasks(): Task[];
/**
 * Get tasks by agent ID
 * @param agentId - The agent ID to filter by
 * @returns Array of tasks for the agent
 */
export declare function getTasksByAgent(agentId: string): Task[];
/**
 * Clean up resources (for testing)
 */
export declare function closeTaskQueue(): Promise<void>;
export { taskQueue };
//# sourceMappingURL=taskQueueService.d.ts.map