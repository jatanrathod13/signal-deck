/**
 * TaskWorker - BullMQ Worker for processing tasks from the queue
 * Handles task execution, status updates, and socket event emission
 */
import { Worker } from 'bullmq';
import Redis from 'ioredis';
/**
 * Set custom Redis connection (useful for testing)
 */
export declare function setRedisConnection(connection: Redis): void;
/**
 * Start the BullMQ worker
 * Exports: startWorker(): void
 */
export declare function startWorker(): void;
/**
 * Stop the BullMQ worker
 * Exports: stopWorker(): Promise<void>
 */
export declare function stopWorker(): Promise<void>;
/**
 * Get the current worker instance (for testing)
 */
export declare function getWorker(): Worker | null;
//# sourceMappingURL=taskWorker.d.ts.map