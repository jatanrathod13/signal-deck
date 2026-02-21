/**
 * SocketService - Real-time event emission service
 * Provides helper functions for emitting Socket.IO events to clients
 */
import { Server } from 'socket.io';
import { Agent, Task } from '../../types';
declare let io: Server | null;
/**
 * Initialize the SocketService with the Socket.IO server instance
 * This should be called after the server is created
 */
export declare function initializeSocket(socketIo: Server): Server;
/**
 * Get the Socket.IO server instance
 * Returns the io instance for direct socket operations
 */
export declare function getIO(): Server | null;
/**
 * Emit agent status update to all connected clients
 * Broadcasts the complete agent object as 'agent-status' event
 */
export declare function emitAgentStatus(agent: Agent): void;
/**
 * Emit task status update to all connected clients
 * Broadcasts task status change as 'task-status' event
 */
export declare function emitTaskStatus(task: Task): void;
/**
 * Emit task completed event with result to all connected clients
 * Broadcasts as 'task-completed' event
 */
export declare function emitTaskCompleted(task: Task): void;
/**
 * Emit error event to all connected clients
 * Broadcasts error information as 'error' event
 */
export declare function emitError(error: string): void;
export { io };
//# sourceMappingURL=socketService.d.ts.map