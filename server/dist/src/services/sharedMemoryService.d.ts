/**
 * SharedMemoryService - Redis-based shared memory for inter-agent communication
 * Provides key-value storage with TTL support
 */
import Redis from 'ioredis';
/**
 * Set custom Redis instance (useful for testing)
 */
export declare function setRedisInstance(connection: Redis): void;
/**
 * Get current Redis instance
 */
export declare function getRedisInstance(): Redis;
/**
 * Set a value in shared memory with optional TTL
 * @param key - The key to store the value under
 * @param value - The value to store (will be JSON stringified)
 * @param ttl - Time to live in seconds (default: 3600)
 */
export declare function setValue(key: string, value: string, ttl?: number): Promise<void>;
/**
 * Get a value from shared memory
 * @param key - The key to retrieve
 * @returns The stored value or null if not found
 */
export declare function getValue(key: string): Promise<string | null>;
/**
 * Delete a value from shared memory
 * @param key - The key to delete
 * @returns True if the key was deleted, false if it didn't exist
 */
export declare function deleteValue(key: string): Promise<boolean>;
/**
 * List keys matching a pattern
 * @param pattern - The pattern to match (default: "*")
 * @returns Array of matching keys
 */
export declare function listKeys(pattern?: string): Promise<string[]>;
/**
 * Set a JSON value in shared memory with optional TTL
 * @param key - The key to store the value under
 * @param value - The value to store (will be JSON stringified)
 * @param ttl - Time to live in seconds (default: 3600)
 */
export declare function setJsonValue(key: string, value: unknown, ttl?: number): Promise<void>;
/**
 * Get a JSON value from shared memory
 * @param key - The key to retrieve
 * @returns The parsed JSON value or null if not found
 */
export declare function getJsonValue<T>(key: string): Promise<T | null>;
/**
 * Refresh the TTL of an existing key
 * @param key - The key to refresh
 * @param ttl - New time to live in seconds (default: 3600)
 * @returns True if the key exists and TTL was refreshed
 */
export declare function refreshTTL(key: string, ttl?: number): Promise<boolean>;
//# sourceMappingURL=sharedMemoryService.d.ts.map