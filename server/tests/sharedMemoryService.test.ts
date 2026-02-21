/**
 * SharedMemoryService Tests
 * Unit tests for Redis-based shared memory service
 */

// Mock ioredis
const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
  get: jest.fn().mockResolvedValue(null),
  del: jest.fn().mockResolvedValue(0),
  keys: jest.fn().mockResolvedValue([]),
  expire: jest.fn().mockResolvedValue(0)
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

import {
  setValue,
  getValue,
  deleteValue,
  listKeys,
  setJsonValue,
  getJsonValue,
  refreshTTL,
  setRedisInstance
} from '../src/services/sharedMemoryService';

describe('SharedMemoryService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    // Set the mock Redis instance
    setRedisInstance(mockRedis as any);
  });

  describe('setValue', () => {
    it('should store value with default TTL', async () => {
      await setValue('test-key', 'test-value');

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 3600);
    });

    it('should store value with custom TTL', async () => {
      await setValue('test-key', 'test-value', 1800);

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 1800);
    });

    it('should store value with TTL of 0 (no expiration)', async () => {
      await setValue('test-key', 'test-value', 0);

      expect(mockRedis.set).toHaveBeenCalledWith('test-key', 'test-value', 'EX', 0);
    });
  });

  describe('getValue', () => {
    it('should return value when key exists', async () => {
      mockRedis.get.mockResolvedValueOnce('stored-value');

      const result = await getValue('test-key');

      expect(result).toBe('stored-value');
      expect(mockRedis.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null when key does not exist', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getValue('non-existent-key');

      expect(result).toBeNull();
    });
  });

  describe('deleteValue', () => {
    it('should return true when key was deleted', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      const result = await deleteValue('test-key');

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should return false when key did not exist', async () => {
      mockRedis.del.mockResolvedValueOnce(0);

      const result = await deleteValue('non-existent-key');

      expect(result).toBe(false);
    });
  });

  describe('listKeys', () => {
    it('should return all keys with default pattern', async () => {
      mockRedis.keys.mockResolvedValueOnce(['key1', 'key2', 'key3']);

      const result = await listKeys();

      expect(result).toEqual(['key1', 'key2', 'key3']);
      expect(mockRedis.keys).toHaveBeenCalledWith('*');
    });

    it('should return keys matching custom pattern', async () => {
      mockRedis.keys.mockResolvedValueOnce(['agent:1', 'agent:2']);

      const result = await listKeys('agent:*');

      expect(result).toEqual(['agent:1', 'agent:2']);
      expect(mockRedis.keys).toHaveBeenCalledWith('agent:*');
    });

    it('should return empty array when no keys match', async () => {
      mockRedis.keys.mockResolvedValueOnce([]);

      const result = await listKeys('non-existent:*');

      expect(result).toEqual([]);
    });
  });

  describe('setJsonValue', () => {
    it('should stringify and store object value', async () => {
      const testObj = { name: 'test', value: 123 };

      await setJsonValue('json-key', testObj);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'json-key',
        JSON.stringify(testObj),
        'EX',
        3600
      );
    });

    it('should store array value', async () => {
      const testArray = [1, 2, 3];

      await setJsonValue('array-key', testArray);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'array-key',
        JSON.stringify(testArray),
        'EX',
        3600
      );
    });
  });

  describe('getJsonValue', () => {
    it('should parse and return JSON value', async () => {
      const testObj = { name: 'test', value: 123 };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(testObj));

      const result = await getJsonValue<{ name: string; value: number }>('json-key');

      expect(result).toEqual(testObj);
    });

    it('should return null when key does not exist', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await getJsonValue('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('refreshTTL', () => {
    it('should return true when key exists and TTL refreshed', async () => {
      mockRedis.expire.mockResolvedValueOnce(1);

      const result = await refreshTTL('test-key', 1800);

      expect(result).toBe(true);
      expect(mockRedis.expire).toHaveBeenCalledWith('test-key', 1800);
    });

    it('should return false when key does not exist', async () => {
      mockRedis.expire.mockResolvedValueOnce(0);

      const result = await refreshTTL('non-existent-key');

      expect(result).toBe(false);
    });
  });

  describe('roundtrip operations', () => {
    it('should store and retrieve value correctly', async () => {
      // Set a value
      await setValue('roundtrip-key', 'roundtrip-value');
      expect(mockRedis.set).toHaveBeenCalledWith('roundtrip-key', 'roundtrip-value', 'EX', 3600);

      // Get the value back
      mockRedis.get.mockResolvedValueOnce('roundtrip-value');
      const result = await getValue('roundtrip-key');
      expect(result).toBe('roundtrip-value');
    });

    it('should handle set, get, delete cycle', async () => {
      // Set
      await setValue('cycle-key', 'cycle-value');
      expect(mockRedis.set).toHaveBeenCalledWith('cycle-key', 'cycle-value', 'EX', 3600);

      // Get (exists)
      mockRedis.get.mockResolvedValueOnce('cycle-value');
      let result = await getValue('cycle-key');
      expect(result).toBe('cycle-value');

      // Delete
      mockRedis.del.mockResolvedValueOnce(1);
      const deleteResult = await deleteValue('cycle-key');
      expect(deleteResult).toBe(true);

      // Get (now deleted)
      mockRedis.get.mockResolvedValueOnce(null);
      result = await getValue('cycle-key');
      expect(result).toBeNull();
    });
  });
});
