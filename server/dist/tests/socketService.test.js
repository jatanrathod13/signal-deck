"use strict";
/**
 * SocketService Unit Tests
 */
Object.defineProperty(exports, "__esModule", { value: true });
const socketService_1 = require("../src/services/socketService");
// Mock Socket.IO server
class MockSocket {
    id = 'mock-socket-id';
    emit = jest.fn();
    join = jest.fn();
    leave = jest.fn();
    on = jest.fn();
    disconnect = jest.fn();
}
class MockIO {
    emit = jest.fn();
    on = jest.fn();
    off = jest.fn();
    to = jest.fn().mockReturnThis();
    sockets = {
        adapter: {
            rooms: new Map()
        }
    };
}
describe('SocketService', () => {
    let mockIO;
    beforeEach(() => {
        jest.clearAllMocks();
        mockIO = new MockIO();
        (0, socketService_1.initializeSocket)(mockIO);
    });
    describe('initializeSocket', () => {
        it('should initialize the Socket.IO server instance', () => {
            const newMockIO = new MockIO();
            (0, socketService_1.initializeSocket)(newMockIO);
            expect((0, socketService_1.getIO)()).toBe(newMockIO);
        });
    });
    describe('emitAgentStatus', () => {
        it('should emit agent-status event with correct payload', () => {
            const agent = {
                id: 'agent-1',
                name: 'Test Agent',
                type: 'worker',
                config: {},
                status: 'running',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            (0, socketService_1.emitAgentStatus)(agent);
            expect(mockIO.emit).toHaveBeenCalledWith('agent-status', {
                agentId: 'agent-1',
                status: 'running',
                timestamp: expect.any(Date)
            });
        });
        it('should emit event with different agent statuses', () => {
            const agent = {
                id: 'agent-2',
                name: 'Test Agent 2',
                type: 'processor',
                config: {},
                status: 'error',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            (0, socketService_1.emitAgentStatus)(agent);
            expect(mockIO.emit).toHaveBeenCalledWith('agent-status', {
                agentId: 'agent-2',
                status: 'error',
                timestamp: expect.any(Date)
            });
        });
    });
    describe('emitTaskStatus', () => {
        it('should emit task-status event with correct payload', () => {
            const task = {
                id: 'task-1',
                agentId: 'agent-1',
                type: 'process',
                data: { input: 'test' },
                status: 'processing',
                priority: 1,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            (0, socketService_1.emitTaskStatus)(task);
            expect(mockIO.emit).toHaveBeenCalledWith('task-status', {
                taskId: 'task-1',
                status: 'processing',
                agentId: 'agent-1',
                timestamp: expect.any(Date)
            });
        });
        it('should emit event for different task statuses', () => {
            const task = {
                id: 'task-2',
                agentId: 'agent-1',
                type: 'process',
                data: {},
                status: 'completed',
                priority: 2,
                createdAt: new Date(),
                updatedAt: new Date(),
                result: { output: 'success' }
            };
            (0, socketService_1.emitTaskStatus)(task);
            expect(mockIO.emit).toHaveBeenCalledWith('task-status', {
                taskId: 'task-2',
                status: 'completed',
                agentId: 'agent-1',
                timestamp: expect.any(Date)
            });
        });
    });
    describe('emitTaskCompleted', () => {
        it('should emit task-completed event with result', () => {
            const task = {
                id: 'task-3',
                agentId: 'agent-1',
                type: 'process',
                data: {},
                status: 'completed',
                priority: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
                result: { data: 'processed' }
            };
            (0, socketService_1.emitTaskCompleted)(task);
            expect(mockIO.emit).toHaveBeenCalledWith('task-completed', {
                taskId: 'task-3',
                result: { data: 'processed' },
                timestamp: expect.any(Date)
            });
        });
    });
    describe('emitError', () => {
        it('should emit error event with correct payload', () => {
            const errorMessage = 'Agent connection failed';
            (0, socketService_1.emitError)(errorMessage);
            expect(mockIO.emit).toHaveBeenCalledWith('error', {
                code: 'SERVER_ERROR',
                message: errorMessage,
                timestamp: expect.any(Date)
            });
        });
        it('should emit different error messages', () => {
            (0, socketService_1.emitError)('Task timeout');
            (0, socketService_1.emitError)('Invalid configuration');
            expect(mockIO.emit).toHaveBeenCalledTimes(2);
            expect(mockIO.emit).toHaveBeenCalledWith('error', {
                code: 'SERVER_ERROR',
                message: 'Task timeout',
                timestamp: expect.any(Date)
            });
        });
    });
});
describe('SocketService without initialization', () => {
    beforeEach(() => {
        // Reset io to null by creating a fresh module import
        jest.resetModules();
    });
    it('should handle emit when io is not initialized', () => {
        // This test verifies warning is logged when io is not initialized
        // The functions should not throw errors
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        // Re-import with fresh state - io should be null
        const { emitAgentStatus } = require('../src/services/socketService');
        const agent = {
            id: 'test-agent',
            name: 'Test',
            type: 'worker',
            config: {},
            status: 'running',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        // Should not throw, just log warning
        expect(() => emitAgentStatus(agent)).not.toThrow();
        consoleSpy.mockRestore();
    });
});
//# sourceMappingURL=socketService.test.js.map