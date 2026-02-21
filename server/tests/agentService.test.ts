/**
 * Agent Service Tests
 * Unit tests for AgentService lifecycle and CRUD operations
 */

import { Agent } from '../types';
import {
  deployAgent,
  startAgent,
  stopAgent,
  restartAgent,
  getAgent,
  listAgents,
  deleteAgent
} from '../src/services/agentService';

describe('AgentService', () => {
  beforeEach(() => {
    // Clear all agents before each test
    const agents = listAgents();
    agents.forEach(agent => deleteAgent(agent.id));
  });

  describe('deployAgent', () => {
    it('should create agent with correct properties', () => {
      const agent = deployAgent('test-agent', 'worker', { maxRetries: 3 });

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('test-agent');
      expect(agent.type).toBe('worker');
      expect(agent.config).toEqual({ maxRetries: 3 });
      expect(agent.status).toBe('idle');
      expect(agent.createdAt).toBeInstanceOf(Date);
      expect(agent.updatedAt).toBeInstanceOf(Date);
    });

    it('should add agent to registry', () => {
      const agent = deployAgent('agent-1', 'processor', {});

      expect(getAgent(agent.id)).toBeDefined();
      expect(getAgent(agent.id)?.name).toBe('agent-1');
    });
  });

  describe('startAgent', () => {
    it('should transition status to running', () => {
      const agent = deployAgent('test-agent', 'worker', {});
      const startedAgent = startAgent(agent.id);

      expect(startedAgent.status).toBe('running');
    });

    it('should throw error for non-existent agent', () => {
      expect(() => startAgent('non-existent-id')).toThrow('Agent not found');
    });
  });

  describe('stopAgent', () => {
    it('should transition status to stopped', () => {
      const agent = deployAgent('test-agent', 'worker', {});
      startAgent(agent.id); // Start first
      const stoppedAgent = stopAgent(agent.id);

      expect(stoppedAgent.status).toBe('stopped');
    });

    it('should throw error for non-existent agent', () => {
      expect(() => stopAgent('non-existent-id')).toThrow('Agent not found');
    });
  });

  describe('restartAgent', () => {
    it('should stop then start agent', () => {
      const agent = deployAgent('test-agent', 'worker', {});
      startAgent(agent.id);
      const restartedAgent = restartAgent(agent.id);

      expect(restartedAgent.status).toBe('running');
    });
  });

  describe('getAgent', () => {
    it('should return agent by id', () => {
      const agent = deployAgent('test-agent', 'worker', {});

      const found = getAgent(agent.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(agent.id);
    });

    it('should return undefined for non-existent agent', () => {
      const found = getAgent('non-existent-id');

      expect(found).toBeUndefined();
    });
  });

  describe('listAgents', () => {
    it('should return empty array when no agents', () => {
      const agents = listAgents();

      expect(agents).toEqual([]);
    });

    it('should return all registered agents', () => {
      const agent1 = deployAgent('agent-1', 'worker', {});
      const agent2 = deployAgent('agent-2', 'processor', {});

      const agents = listAgents();

      expect(agents).toHaveLength(2);
      expect(agents.map(a => a.id)).toContain(agent1.id);
      expect(agents.map(a => a.id)).toContain(agent2.id);
    });
  });

  describe('deleteAgent', () => {
    it('should remove agent from registry', () => {
      const agent = deployAgent('test-agent', 'worker', {});

      const result = deleteAgent(agent.id);

      expect(result).toBe(true);
      expect(getAgent(agent.id)).toBeUndefined();
    });

    it('should return false for non-existent agent', () => {
      const result = deleteAgent('non-existent-id');

      expect(result).toBe(false);
    });
  });
});
