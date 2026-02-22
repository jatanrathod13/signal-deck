/**
 * AgentService - Agent lifecycle management service
 * Provides CRUD operations and lifecycle management for agents
 * Supports Redis persistence for durability across restarts
 */

import { EventEmitter } from 'events';
import { Agent, AgentStatus } from '../../types';
import { emitAgentStatus } from './socketService';
import { redis } from '../../config/redis';

// Redis key prefix for agents
const AGENT_KEY_PREFIX = 'agent:';
const AGENT_INDEX_KEY = 'agents:index';

// Agent registry type
type AgentRegistry = Map<string, Agent>;

// In-memory cache for quick access (backward compatible)
let agents: AgentRegistry = new Map();

// Redis connection status
let redisAvailable = false;

// Initialize Redis connection and load agents
async function initializeRedis(): Promise<void> {
  try {
    // Test Redis connection
    await redis.ping();
    redisAvailable = true;
    console.log('Redis connected for agent persistence');

    // Load existing agents from Redis on startup
    await loadAgentsFromRedis();
  } catch (error) {
    console.warn('Redis unavailable, using in-memory storage only:', error);
    redisAvailable = false;
  }
}

// Load all agents from Redis into memory
async function loadAgentsFromRedis(): Promise<void> {
  try {
    const agentIds = await redis.smembers(AGENT_INDEX_KEY);

    if (agentIds.length > 0) {
      const pipeline = redis.pipeline();

      for (const agentId of agentIds) {
        pipeline.get(`${AGENT_KEY_PREFIX}${agentId}`);
      }

      const results = await pipeline.exec();

      if (results) {
        for (const [err, value] of results) {
          if (!err && value) {
            try {
              const agentData = JSON.parse(value as string);
              // Convert date strings back to Date objects
              agentData.createdAt = new Date(agentData.createdAt);
              agentData.updatedAt = new Date(agentData.updatedAt);
              agents.set(agentData.id, agentData);
            } catch (parseError) {
              console.error('Failed to parse agent data:', parseError);
            }
          }
        }
      }

      console.log(`Loaded ${agents.size} agents from Redis`);
    }
  } catch (error) {
    console.error('Failed to load agents from Redis:', error);
    // Continue with empty in-memory store
  }
}

// Save agent to Redis
async function saveAgentToRedis(agent: Agent): Promise<void> {
  if (!redisAvailable) return;

  try {
    const key = `${AGENT_KEY_PREFIX}${agent.id}`;
    const value = JSON.stringify(agent);

    // Use pipeline for atomic operations
    const pipeline = redis.pipeline();
    pipeline.set(key, value);
    pipeline.sadd(AGENT_INDEX_KEY, agent.id);
    await pipeline.exec();
  } catch (error) {
    console.error('Failed to save agent to Redis:', error);
    // Continue with in-memory only
  }
}

// Update agent in Redis
async function updateAgentInRedis(agent: Agent): Promise<void> {
  await saveAgentToRedis(agent);
}

// Delete agent from Redis
async function deleteAgentFromRedis(agentId: string): Promise<void> {
  if (!redisAvailable) return;

  try {
    const key = `${AGENT_KEY_PREFIX}${agentId}`;
    const pipeline = redis.pipeline();
    pipeline.del(key);
    pipeline.srem(AGENT_INDEX_KEY, agentId);
    await pipeline.exec();
  } catch (error) {
    console.error('Failed to delete agent from Redis:', error);
    // Continue with in-memory only
  }
}

// Create EventEmitter for lifecycle events
class AgentService extends EventEmitter {
  // Uses module-level agents Map for backward compatibility

  /**
   * Deploy a new agent with idle status
   * @param name - Agent name
   * @param type - Agent type
   * @param config - Agent configuration
   * @returns Created agent object
   */
  deployAgent(name: string, type: string, config: Record<string, unknown>): Agent {
    const id = this.generateId();
    const now = new Date();

    const agent: Agent = {
      id,
      name,
      type,
      config,
      status: 'idle',
      createdAt: now,
      updatedAt: now
    };

    agents.set(id, agent);

    // Persist to Redis asynchronously
    saveAgentToRedis(agent).catch(err => {
      console.error('Failed to persist agent to Redis:', err);
    });

    this.emit('agent:registered', { agentId: id, agent });
    emitAgentStatus(agent);

    return agent;
  }

  /**
   * Start an agent - transitions status to running
   * @param id - Agent ID
   * @returns Updated agent object
   */
  startAgent(id: string): Agent {
    const agent = agents.get(id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    agent.status = 'running';
    agent.updatedAt = new Date();

    // Persist to Redis asynchronously
    updateAgentInRedis(agent).catch(err => {
      console.error('Failed to update agent in Redis:', err);
    });

    this.emit('agent:started', { agentId: id, agent });
    emitAgentStatus(agent);

    return agent;
  }

  /**
   * Stop an agent - transitions status to stopped
   * @param id - Agent ID
   * @returns Updated agent object
   */
  stopAgent(id: string): Agent {
    const agent = agents.get(id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    agent.status = 'stopped';
    agent.updatedAt = new Date();

    // Persist to Redis asynchronously
    updateAgentInRedis(agent).catch(err => {
      console.error('Failed to update agent in Redis:', err);
    });

    this.emit('agent:stopped', { agentId: id, agent });
    emitAgentStatus(agent);

    return agent;
  }

  /**
   * Restart an agent - stops then starts
   * @param id - Agent ID
   * @returns Updated agent object
   */
  restartAgent(id: string): Agent {
    const agent = agents.get(id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Stop the agent first
    this.stopAgent(id);

    // Then start it again
    return this.startAgent(id);
  }

  /**
   * Get a single agent by ID
   * @param id - Agent ID
   * @returns Agent object or undefined
   */
  getAgent(id: string): Agent | undefined {
    return agents.get(id);
  }

  /**
   * List all registered agents
   * @returns Array of all agents
   */
  listAgents(): Agent[] {
    return Array.from(agents.values());
  }

  /**
   * Delete an agent from the registry
   * @param id - Agent ID
   * @returns Success status
   */
  deleteAgent(id: string): boolean {
    const agent = agents.get(id);
    if (!agent) {
      return false;
    }

    agents.delete(id);

    // Remove from Redis asynchronously
    deleteAgentFromRedis(id).catch(err => {
      console.error('Failed to delete agent from Redis:', err);
    });

    this.emit('agent:deleted', { agentId: id });

    return true;
  }

  /**
   * Generate a unique ID for agents
   */
  private generateId(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const agentService = new AgentService();

// Export individual functions for convenience
export const deployAgent = (name: string, type: string, config: Record<string, unknown>): Agent =>
  agentService.deployAgent(name, type, config);

export const startAgent = (id: string): Agent =>
  agentService.startAgent(id);

export const stopAgent = (id: string): Agent =>
  agentService.stopAgent(id);

export const restartAgent = (id: string): Agent =>
  agentService.restartAgent(id);

export const getAgent = (id: string): Agent | undefined =>
  agentService.getAgent(id);

export const listAgents = (): Agent[] =>
  agentService.listAgents();

export const deleteAgent = (id: string): boolean =>
  agentService.deleteAgent(id);

// Export initialization function for startup loading
export const initializeAgentPersistence = initializeRedis;

// Export Redis availability status
export const isAgentPersistenceReady = (): boolean => redisAvailable;

// Export the EventEmitter for typing purposes
export { AgentService };
