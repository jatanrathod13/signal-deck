/**
 * AgentService - Agent lifecycle management service
 * Provides CRUD operations and lifecycle management for agents
 */
import { EventEmitter } from 'events';
import { Agent } from '../../types';
declare class AgentService extends EventEmitter {
    private agents;
    /**
     * Deploy a new agent with idle status
     * @param name - Agent name
     * @param type - Agent type
     * @param config - Agent configuration
     * @returns Created agent object
     */
    deployAgent(name: string, type: string, config: Record<string, unknown>): Agent;
    /**
     * Start an agent - transitions status to running
     * @param id - Agent ID
     * @returns Updated agent object
     */
    startAgent(id: string): Agent;
    /**
     * Stop an agent - transitions status to stopped
     * @param id - Agent ID
     * @returns Updated agent object
     */
    stopAgent(id: string): Agent;
    /**
     * Restart an agent - stops then starts
     * @param id - Agent ID
     * @returns Updated agent object
     */
    restartAgent(id: string): Agent;
    /**
     * Get a single agent by ID
     * @param id - Agent ID
     * @returns Agent object or undefined
     */
    getAgent(id: string): Agent | undefined;
    /**
     * List all registered agents
     * @returns Array of all agents
     */
    listAgents(): Agent[];
    /**
     * Delete an agent from the registry
     * @param id - Agent ID
     * @returns Success status
     */
    deleteAgent(id: string): boolean;
    /**
     * Generate a unique ID for agents
     */
    private generateId;
}
export declare const agentService: AgentService;
export declare const deployAgent: (name: string, type: string, config: Record<string, unknown>) => Agent;
export declare const startAgent: (id: string) => Agent;
export declare const stopAgent: (id: string) => Agent;
export declare const restartAgent: (id: string) => Agent;
export declare const getAgent: (id: string) => Agent | undefined;
export declare const listAgents: () => Agent[];
export declare const deleteAgent: (id: string) => boolean;
export { AgentService };
//# sourceMappingURL=agentService.d.ts.map