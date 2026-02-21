"use strict";
/**
 * Agent Service Tests
 * Unit tests for AgentService lifecycle and CRUD operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
const agentService_1 = require("../src/services/agentService");
describe('AgentService', () => {
    beforeEach(() => {
        // Clear all agents before each test
        const agents = (0, agentService_1.listAgents)();
        agents.forEach(agent => (0, agentService_1.deleteAgent)(agent.id));
    });
    describe('deployAgent', () => {
        it('should create agent with correct properties', () => {
            const agent = (0, agentService_1.deployAgent)('test-agent', 'worker', { maxRetries: 3 });
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
            const agent = (0, agentService_1.deployAgent)('agent-1', 'processor', {});
            expect((0, agentService_1.getAgent)(agent.id)).toBeDefined();
            expect((0, agentService_1.getAgent)(agent.id)?.name).toBe('agent-1');
        });
    });
    describe('startAgent', () => {
        it('should transition status to running', () => {
            const agent = (0, agentService_1.deployAgent)('test-agent', 'worker', {});
            const startedAgent = (0, agentService_1.startAgent)(agent.id);
            expect(startedAgent.status).toBe('running');
        });
        it('should throw error for non-existent agent', () => {
            expect(() => (0, agentService_1.startAgent)('non-existent-id')).toThrow('Agent not found');
        });
    });
    describe('stopAgent', () => {
        it('should transition status to stopped', () => {
            const agent = (0, agentService_1.deployAgent)('test-agent', 'worker', {});
            (0, agentService_1.startAgent)(agent.id); // Start first
            const stoppedAgent = (0, agentService_1.stopAgent)(agent.id);
            expect(stoppedAgent.status).toBe('stopped');
        });
        it('should throw error for non-existent agent', () => {
            expect(() => (0, agentService_1.stopAgent)('non-existent-id')).toThrow('Agent not found');
        });
    });
    describe('restartAgent', () => {
        it('should stop then start agent', () => {
            const agent = (0, agentService_1.deployAgent)('test-agent', 'worker', {});
            (0, agentService_1.startAgent)(agent.id);
            const restartedAgent = (0, agentService_1.restartAgent)(agent.id);
            expect(restartedAgent.status).toBe('running');
        });
    });
    describe('getAgent', () => {
        it('should return agent by id', () => {
            const agent = (0, agentService_1.deployAgent)('test-agent', 'worker', {});
            const found = (0, agentService_1.getAgent)(agent.id);
            expect(found).toBeDefined();
            expect(found?.id).toBe(agent.id);
        });
        it('should return undefined for non-existent agent', () => {
            const found = (0, agentService_1.getAgent)('non-existent-id');
            expect(found).toBeUndefined();
        });
    });
    describe('listAgents', () => {
        it('should return empty array when no agents', () => {
            const agents = (0, agentService_1.listAgents)();
            expect(agents).toEqual([]);
        });
        it('should return all registered agents', () => {
            const agent1 = (0, agentService_1.deployAgent)('agent-1', 'worker', {});
            const agent2 = (0, agentService_1.deployAgent)('agent-2', 'processor', {});
            const agents = (0, agentService_1.listAgents)();
            expect(agents).toHaveLength(2);
            expect(agents.map(a => a.id)).toContain(agent1.id);
            expect(agents.map(a => a.id)).toContain(agent2.id);
        });
    });
    describe('deleteAgent', () => {
        it('should remove agent from registry', () => {
            const agent = (0, agentService_1.deployAgent)('test-agent', 'worker', {});
            const result = (0, agentService_1.deleteAgent)(agent.id);
            expect(result).toBe(true);
            expect((0, agentService_1.getAgent)(agent.id)).toBeUndefined();
        });
        it('should return false for non-existent agent', () => {
            const result = (0, agentService_1.deleteAgent)('non-existent-id');
            expect(result).toBe(false);
        });
    });
});
//# sourceMappingURL=agentService.test.js.map