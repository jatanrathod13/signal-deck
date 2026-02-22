/**
 * SocketService - Real-time event emission service
 * Provides helper functions for emitting Socket.IO events to clients
 */

import { Server } from 'socket.io';
import { Agent, PlanStatus, PlanStepStatus, RunEvent, Task } from '../../types';

// Try to import io from server entry, but handle case where it's not initialized
let io: Server | null = null;

/**
 * Initialize the SocketService with the Socket.IO server instance
 * This should be called after the server is created
 */
export function initializeSocket(socketIo: Server): Server {
  io = socketIo;
  return io;
}

/**
 * Get the Socket.IO server instance
 * Returns the io instance for direct socket operations
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Emit agent status update to all connected clients
 * Broadcasts the complete agent object as 'agent-status' event
 */
export function emitAgentStatus(agent: Agent): void {
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
export function emitTaskStatus(task: Task): void {
  if (!io) {
    console.warn('Socket.IO not initialized. Call initializeSocket() first.');
    return;
  }

  io.emit('task-status', {
    taskId: task.id,
    status: task.status,
    agentId: task.agentId,
    planId: task.planId,
    stepId: task.stepId,
    runId: task.runId,
    conversationId: task.conversationId,
    timestamp: new Date()
  });
}

/**
 * Emit task completed event with result to all connected clients
 * Broadcasts as 'task-completed' event
 */
export function emitTaskCompleted(task: Task): void {
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
export function emitError(error: string): void {
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

/**
 * Emit plan created event.
 */
export function emitPlanCreated(planId: string): void {
  if (!io) {
    return;
  }

  io.emit('plan-created', {
    planId,
    timestamp: new Date()
  });
}

/**
 * Emit plan status update.
 */
export function emitPlanUpdated(planId: string, status: PlanStatus): void {
  if (!io) {
    return;
  }

  io.emit('plan-updated', {
    planId,
    status,
    timestamp: new Date()
  });
}

/**
 * Emit plan step status update.
 */
export function emitPlanStepStatus(planId: string, stepId: string, status: PlanStepStatus): void {
  if (!io) {
    return;
  }

  io.emit('plan-step-status', {
    planId,
    stepId,
    status,
    timestamp: new Date()
  });
}

/**
 * Emit run event updates to clients.
 */
export function emitRunEvent(event: RunEvent): void {
  if (!io) {
    return;
  }

  io.emit('run-event', {
    id: event.id,
    runId: event.runId,
    conversationId: event.conversationId,
    type: event.type,
    payload: event.payload,
    timestamp: event.timestamp
  });
}

// Re-export io for external access if needed
export { io };
