"use strict";
/**
 * SocketService - Real-time event emission service
 * Provides helper functions for emitting Socket.IO events to clients
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
exports.initializeSocket = initializeSocket;
exports.getIO = getIO;
exports.emitAgentStatus = emitAgentStatus;
exports.emitTaskStatus = emitTaskStatus;
exports.emitTaskCompleted = emitTaskCompleted;
exports.emitError = emitError;
// Try to import io from server entry, but handle case where it's not initialized
let io = null;
exports.io = io;
/**
 * Initialize the SocketService with the Socket.IO server instance
 * This should be called after the server is created
 */
function initializeSocket(socketIo) {
    exports.io = io = socketIo;
    return io;
}
/**
 * Get the Socket.IO server instance
 * Returns the io instance for direct socket operations
 */
function getIO() {
    return io;
}
/**
 * Emit agent status update to all connected clients
 * Broadcasts the complete agent object as 'agent-status' event
 */
function emitAgentStatus(agent) {
    if (!io) {
        console.warn('Socket.IO not initialized. Call initializeSocket() first.');
        return;
    }
    io.emit('agent-status', {
        agentId: agent.id,
        status: agent.status,
        timestamp: new Date()
    });
}
/**
 * Emit task status update to all connected clients
 * Broadcasts task status change as 'task-status' event
 */
function emitTaskStatus(task) {
    if (!io) {
        console.warn('Socket.IO not initialized. Call initializeSocket() first.');
        return;
    }
    io.emit('task-status', {
        taskId: task.id,
        status: task.status,
        agentId: task.agentId,
        timestamp: new Date()
    });
}
/**
 * Emit task completed event with result to all connected clients
 * Broadcasts as 'task-completed' event
 */
function emitTaskCompleted(task) {
    if (!io) {
        console.warn('Socket.IO not initialized. Call initializeSocket() first.');
        return;
    }
    io.emit('task-completed', {
        taskId: task.id,
        result: task.result,
        timestamp: new Date()
    });
}
/**
 * Emit error event to all connected clients
 * Broadcasts error information as 'error' event
 */
function emitError(error) {
    if (!io) {
        console.warn('Socket.IO not initialized. Call initializeSocket() first.');
        return;
    }
    io.emit('error', {
        code: 'SERVER_ERROR',
        message: error,
        timestamp: new Date()
    });
}
//# sourceMappingURL=socketService.js.map