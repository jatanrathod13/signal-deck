/**
 * SharedMemoryService - Redis-based shared memory for inter-agent communication
 * Provides key-value storage with TTL support
 */

import Redis from 'ioredis';
import { redis as defaultRedis } from '../../config/redis';

// Default TTL in seconds (1 hour)
const DEFAULT_TTL = 3600;

// Allow custom Redis connection for testing
let redisInstance: Redis = defaultRedis;

/**
 * Set custom Redis instance (useful for testing)
 */
export function setRedisInstance(connection: Redis): void {
  redisInstance = connection;
}

/**
 * Get current Redis instance
 */
export function getRedisInstance(): Redis {
  return redisInstance;
}

/**
 * Set a value in shared memory with optional TTL
 * @param key - The key to store the value under
 * @param value - The value to store (will be JSON stringified)
 * @param ttl - Time to live in seconds (default: 3600)
 */
export async function setValue(key: string, value: string, ttl: number = DEFAULT_TTL): Promise<void> {
  await redisInstance.set(key, value, 'EX', ttl);
}

/**
 * Get a value from shared memory
 * @param key - The key to retrieve
 * @returns The stored value or null if not found
 */
export async function getValue(key: string): Promise<string | null> {
  return await redisInstance.get(key);
}

/**
 * Delete a value from shared memory
 * @param key - The key to delete
 * @returns True if the key was deleted, false if it didn't exist
 */
export async function deleteValue(key: string): Promise<boolean> {
  const result = await redisInstance.del(key);
  return result > 0;
}

/**
 * List keys matching a pattern
 * @param pattern - The pattern to match (default: "*")
 * @returns Array of matching keys
 */
export async function listKeys(pattern: string = '*'): Promise<string[]> {
  return await redisInstance.keys(pattern);
}

/**
 * Set a JSON value in shared memory with optional TTL
 * @param key - The key to store the value under
 * @param value - The value to store (will be JSON stringified)
 * @param ttl - Time to live in seconds (default: 3600)
 */
export async function setJsonValue(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
  const jsonString = JSON.stringify(value);
  await redisInstance.set(key, jsonString, 'EX', ttl);
}

/**
 * Get a JSON value from shared memory
 * @param key - The key to retrieve
 * @returns The parsed JSON value or null if not found
 */
export async function getJsonValue<T>(key: string): Promise<T | null> {
  const value = await redisInstance.get(key);
  if (value === null) {
    return null;
  }
  return JSON.parse(value) as T;
}

/**
 * Refresh the TTL of an existing key
 * @param key - The key to refresh
 * @param ttl - New time to live in seconds (default: 3600)
 * @returns True if the key exists and TTL was refreshed
 */
export async function refreshTTL(key: string, ttl: number = DEFAULT_TTL): Promise<boolean> {
  const result = await redisInstance.expire(key, ttl);
  return result === 1;
}
