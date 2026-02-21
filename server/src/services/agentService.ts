/**
 * AgentService - Agent lifecycle management service
 * Provides CRUD operations and lifecycle management for agents
 */

import { EventEmitter } from 'events';
import { Agent, AgentStatus } from '../../types';
import { emitAgentStatus } from './socketService';

// Agent registry type
type AgentRegistry = Map<string, Agent>;

// Create EventEmitter for lifecycle events
class AgentService extends EventEmitter {
  private agents: AgentRegistry = new Map();

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

    this.agents.set(id, agent);
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
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    agent.status = 'running';
    agent.updatedAt = new Date();

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
    const agent = this.agents.get(id);
    if (!agent) {
      throw new Error('Agent not found');
    }

    agent.status = 'stopped';
    agent.updatedAt = new Date();

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
    const agent = this.agents.get(id);
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
    return this.agents.get(id);
  }

  /**
   * List all registered agents
   * @returns Array of all agents
   */
  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Delete an agent from the registry
   * @param id - Agent ID
   * @returns Success status
   */
  deleteAgent(id: string): boolean {
    const agent = this.agents.get(id);
    if (!agent) {
      return false;
    }

    this.agents.delete(id);
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

// Export the EventEmitter for typing purposes
export { AgentService };
