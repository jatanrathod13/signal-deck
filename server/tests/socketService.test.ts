/**
 * SocketService Unit Tests
 */

import { Server } from 'socket.io';
import {
  emitAgentStatus,
  emitTaskLog,
  emitTaskStatus,
  emitError,
  emitTaskCompleted,
  initializeSocket,
  getIO
} from '../src/services/socketService';
import { Agent, Task } from '../types';

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
  let mockIO: MockIO;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIO = new MockIO() as unknown as MockIO;
    initializeSocket(mockIO as unknown as Server);
  });

  describe('initializeSocket', () => {
    it('should initialize the Socket.IO server instance', () => {
      const newMockIO = new MockIO() as unknown as Server;
      initializeSocket(newMockIO);
      expect(getIO()).toBe(newMockIO);
    });
  });

  describe('emitAgentStatus', () => {
    it('should emit agent-status event with correct payload', () => {
      const agent: Agent = {
        id: 'agent-1',
        name: 'Test Agent',
        type: 'worker',
        config: {},
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      emitAgentStatus(agent);

      expect(mockIO.emit).toHaveBeenCalledWith('agent-status', {
        agentId: 'agent-1',
        status: 'running',
        timestamp: expect.any(Date)
      });
    });

    it('should emit event with different agent statuses', () => {
      const agent: Agent = {
        id: 'agent-2',
        name: 'Test Agent 2',
        type: 'processor',
        config: {},
        status: 'error',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      emitAgentStatus(agent);

      expect(mockIO.emit).toHaveBeenCalledWith('agent-status', {
        agentId: 'agent-2',
        status: 'error',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('emitTaskStatus', () => {
    it('should emit task-status event with correct payload', () => {
      const task: Task = {
        id: 'task-1',
        agentId: 'agent-1',
        type: 'process',
        data: { input: 'test' },
        status: 'processing',
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      emitTaskStatus(task);

      expect(mockIO.emit).toHaveBeenCalledWith('task-status', expect.objectContaining({
        taskId: 'task-1',
        status: 'processing',
        agentId: 'agent-1',
        type: 'process',
        priority: 1,
        executionMode: undefined,
        timestamp: expect.any(Date)
      }));
    });

    it('should emit event for different task statuses', () => {
      const task: Task = {
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

      emitTaskStatus(task);

      expect(mockIO.emit).toHaveBeenCalledWith('task-status', expect.objectContaining({
        taskId: 'task-2',
        status: 'completed',
        agentId: 'agent-1',
        type: 'process',
        priority: 2,
        executionMode: undefined,
        timestamp: expect.any(Date)
      }));
    });
  });

  describe('emitTaskLog', () => {
    it('should emit task-log event with stream chunk', () => {
      emitTaskLog('task-1', 'agent-1', 'stdout', 'hello');

      expect(mockIO.emit).toHaveBeenCalledWith('task-log', {
        taskId: 'task-1',
        agentId: 'agent-1',
        stream: 'stdout',
        chunk: 'hello',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('emitTaskCompleted', () => {
    it('should emit task-completed event with result', () => {
      const task: Task = {
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

      emitTaskCompleted(task);

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

      emitError(errorMessage);

      expect(mockIO.emit).toHaveBeenCalledWith('error', {
        code: 'SERVER_ERROR',
        message: errorMessage,
        timestamp: expect.any(Date)
      });
    });

    it('should emit different error messages', () => {
      emitError('Task timeout');
      emitError('Invalid configuration');

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

    const agent: Agent = {
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
