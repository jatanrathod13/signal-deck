"use strict";
/**
 * AgentService - Agent lifecycle management service
 * Provides CRUD operations and lifecycle management for agents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = exports.deleteAgent = exports.listAgents = exports.getAgent = exports.restartAgent = exports.stopAgent = exports.startAgent = exports.deployAgent = exports.agentService = void 0;
const events_1 = require("events");
const socketService_1 = require("./socketService");
// Create EventEmitter for lifecycle events
class AgentService extends events_1.EventEmitter {
    agents = new Map();
    /**
     * Deploy a new agent with idle status
     * @param name - Agent name
     * @param type - Agent type
     * @param config - Agent configuration
     * @returns Created agent object
     */
    deployAgent(name, type, config) {
        const id = this.generateId();
        const now = new Date();
        const agent = {
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
        (0, socketService_1.emitAgentStatus)(agent);
        return agent;
    }
    /**
     * Start an agent - transitions status to running
     * @param id - Agent ID
     * @returns Updated agent object
     */
    startAgent(id) {
        const agent = this.agents.get(id);
        if (!agent) {
            throw new Error('Agent not found');
        }
        agent.status = 'running';
        agent.updatedAt = new Date();
        this.emit('agent:started', { agentId: id, agent });
        (0, socketService_1.emitAgentStatus)(agent);
        return agent;
    }
    /**
     * Stop an agent - transitions status to stopped
     * @param id - Agent ID
     * @returns Updated agent object
     */
    stopAgent(id) {
        const agent = this.agents.get(id);
        if (!agent) {
            throw new Error('Agent not found');
        }
        agent.status = 'stopped';
        agent.updatedAt = new Date();
        this.emit('agent:stopped', { agentId: id, agent });
        (0, socketService_1.emitAgentStatus)(agent);
        return agent;
    }
    /**
     * Restart an agent - stops then starts
     * @param id - Agent ID
     * @returns Updated agent object
     */
    restartAgent(id) {
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
    getAgent(id) {
        return this.agents.get(id);
    }
    /**
     * List all registered agents
     * @returns Array of all agents
     */
    listAgents() {
        return Array.from(this.agents.values());
    }
    /**
     * Delete an agent from the registry
     * @param id - Agent ID
     * @returns Success status
     */
    deleteAgent(id) {
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
    generateId() {
        return `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.AgentService = AgentService;
// Export singleton instance
exports.agentService = new AgentService();
// Export individual functions for convenience
const deployAgent = (name, type, config) => exports.agentService.deployAgent(name, type, config);
exports.deployAgent = deployAgent;
const startAgent = (id) => exports.agentService.startAgent(id);
exports.startAgent = startAgent;
const stopAgent = (id) => exports.agentService.stopAgent(id);
exports.stopAgent = stopAgent;
const restartAgent = (id) => exports.agentService.restartAgent(id);
exports.restartAgent = restartAgent;
const getAgent = (id) => exports.agentService.getAgent(id);
exports.getAgent = getAgent;
const listAgents = () => exports.agentService.listAgents();
exports.listAgents = listAgents;
const deleteAgent = (id) => exports.agentService.deleteAgent(id);
exports.deleteAgent = deleteAgent;
//# sourceMappingURL=agentService.js.map