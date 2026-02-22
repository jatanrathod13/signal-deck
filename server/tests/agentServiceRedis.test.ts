/**
 * AgentService Redis Persistence Tests
 * Unit tests for Redis persistence in AgentService
 */

// Mock Redis before importing agentService
const mockPipeline = {
  get: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  sadd: jest.fn().mockReturnThis(),
  srem: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([])
};

jest.mock('../config/redis', () => ({
  redis: {
    ping: jest.fn(),
    smembers: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    sadd: jest.fn(),
    srem: jest.fn(),
    pipeline: jest.fn(() => mockPipeline)
  }
}));

import { redis } from '../config/redis';
import {
  deployAgent,
  startAgent,
  stopAgent,
  getAgent,
  listAgents,
  deleteAgent,
  initializeAgentPersistence,
  isAgentPersistenceReady
} from '../src/services/agentService';

describe('AgentService Redis Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear agents before each test
    const agents = listAgents();
    agents.forEach(agent => deleteAgent(agent.id));
  });

  describe('initializeAgentPersistence', () => {
    it('should connect to Redis and set availability flag', async () => {
      (redis.ping as jest.Mock).mockResolvedValue('PONG');

      await initializeAgentPersistence();

      expect(redis.ping).toHaveBeenCalled();
      expect(isAgentPersistenceReady()).toBe(true);
    });

    it('should handle Redis connection failure gracefully', async () => {
      (redis.ping as jest.Mock).mockRejectedValue(new Error('Connection refused'));

      await initializeAgentPersistence();

      expect(isAgentPersistenceReady()).toBe(false);
    });

    it('should load existing agents from Redis on startup', async () => {
      (redis.ping as jest.Mock).mockResolvedValue('PONG');
      (redis.smembers as jest.Mock).mockResolvedValue(['agent-123']);
      (redis.pipeline as jest.Mock).mockReturnValue(mockPipeline);
      mockPipeline.exec.mockResolvedValue([
        [null, JSON.stringify({
          id: 'agent-123',
          name: 'test-agent',
          type: 'worker',
          config: {},
          status: 'idle',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })]
      ]);

      await initializeAgentPersistence();

      expect(redis.smembers).toHaveBeenCalledWith('agents:index');
    });
  });

  describe('CRUD operations with Redis', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      // Initialize persistence with mocked Redis
      (redis.ping as jest.Mock).mockResolvedValue('PONG');
      (redis.pipeline as jest.Mock).mockReturnValue(mockPipeline);
      mockPipeline.exec.mockResolvedValue([]);
      await initializeAgentPersistence();
    });

    it('should persist new agent to Redis on deploy', async () => {
      const agent = deployAgent('redis-test', 'worker', { test: true });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('redis-test');

      // Verify Redis pipeline was called
      expect(redis.pipeline).toHaveBeenCalled();
    });

    it('should persist status changes to Redis on startAgent', async () => {
      const agent = deployAgent('start-test', 'worker', {});
      startAgent(agent.id);

      expect(agent.status).toBe('running');
      expect(redis.pipeline).toHaveBeenCalled();
    });

    it('should persist status changes to Redis on stopAgent', async () => {
      const agent = deployAgent('stop-test', 'worker', {});
      startAgent(agent.id);
      stopAgent(agent.id);

      expect(agent.status).toBe('stopped');
      expect(redis.pipeline).toHaveBeenCalled();
    });

    it('should delete agent from Redis on deleteAgent', async () => {
      const agent = deployAgent('delete-test', 'worker', {});
      const result = deleteAgent(agent.id);

      expect(result).toBe(true);
      expect(getAgent(agent.id)).toBeUndefined();
      expect(redis.pipeline).toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain in-memory API when Redis unavailable', async () => {
      // Set Redis as unavailable
      (redis.ping as jest.Mock).mockRejectedValue(new Error('No Redis'));
      await initializeAgentPersistence();

      // Should still work with in-memory
      const agent = deployAgent('memory-test', 'worker', {});
      expect(getAgent(agent.id)).toBeDefined();

      startAgent(agent.id);
      expect(getAgent(agent.id)?.status).toBe('running');

      stopAgent(agent.id);
      expect(getAgent(agent.id)?.status).toBe('stopped');

      const deleted = deleteAgent(agent.id);
      expect(deleted).toBe(true);
      expect(getAgent(agent.id)).toBeUndefined();
    });

    it('should list all agents from memory', async () => {
      // Ensure Redis unavailable
      (redis.ping as jest.Mock).mockRejectedValue(new Error('No Redis'));
      await initializeAgentPersistence();

      deployAgent('agent-1', 'worker', {});
      deployAgent('agent-2', 'processor', {});

      const agents = listAgents();
      expect(agents).toHaveLength(2);
    });
  });
});
