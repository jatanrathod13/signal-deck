"use strict";
/**
 * SharedMemoryService - Redis-based shared memory for inter-agent communication
 * Provides key-value storage with TTL support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRedisInstance = setRedisInstance;
exports.getRedisInstance = getRedisInstance;
exports.setValue = setValue;
exports.getValue = getValue;
exports.deleteValue = deleteValue;
exports.listKeys = listKeys;
exports.setJsonValue = setJsonValue;
exports.getJsonValue = getJsonValue;
exports.refreshTTL = refreshTTL;
const redis_1 = require("../../config/redis");
// Default TTL in seconds (1 hour)
const DEFAULT_TTL = 3600;
// Allow custom Redis connection for testing
let redisInstance = redis_1.redis;
/**
 * Set custom Redis instance (useful for testing)
 */
function setRedisInstance(connection) {
    redisInstance = connection;
}
/**
 * Get current Redis instance
 */
function getRedisInstance() {
    return redisInstance;
}
/**
 * Set a value in shared memory with optional TTL
 * @param key - The key to store the value under
 * @param value - The value to store (will be JSON stringified)
 * @param ttl - Time to live in seconds (default: 3600)
 */
async function setValue(key, value, ttl = DEFAULT_TTL) {
    await redisInstance.set(key, value, 'EX', ttl);
}
/**
 * Get a value from shared memory
 * @param key - The key to retrieve
 * @returns The stored value or null if not found
 */
async function getValue(key) {
    return await redisInstance.get(key);
}
/**
 * Delete a value from shared memory
 * @param key - The key to delete
 * @returns True if the key was deleted, false if it didn't exist
 */
async function deleteValue(key) {
    const result = await redisInstance.del(key);
    return result > 0;
}
/**
 * List keys matching a pattern
 * @param pattern - The pattern to match (default: "*")
 * @returns Array of matching keys
 */
async function listKeys(pattern = '*') {
    return await redisInstance.keys(pattern);
}
/**
 * Set a JSON value in shared memory with optional TTL
 * @param key - The key to store the value under
 * @param value - The value to store (will be JSON stringified)
 * @param ttl - Time to live in seconds (default: 3600)
 */
async function setJsonValue(key, value, ttl = DEFAULT_TTL) {
    const jsonString = JSON.stringify(value);
    await redisInstance.set(key, jsonString, 'EX', ttl);
}
/**
 * Get a JSON value from shared memory
 * @param key - The key to retrieve
 * @returns The parsed JSON value or null if not found
 */
async function getJsonValue(key) {
    const value = await redisInstance.get(key);
    if (value === null) {
        return null;
    }
    return JSON.parse(value);
}
/**
 * Refresh the TTL of an existing key
 * @param key - The key to refresh
 * @param ttl - New time to live in seconds (default: 3600)
 * @returns True if the key exists and TTL was refreshed
 */
async function refreshTTL(key, ttl = DEFAULT_TTL) {
    const result = await redisInstance.expire(key, ttl);
    return result === 1;
}
//# sourceMappingURL=sharedMemoryService.js.map