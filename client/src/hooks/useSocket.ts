/**
 * useSocket Hook - Socket.IO client for real-time communication
 * Connects to the Socket.IO server and handles agent/task status events
 */
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAgentStore } from '../stores/agentStore';
import { useTaskStore } from '../stores/taskStore';
import type { AgentStatusEvent, TaskStatusEvent, ErrorEvent, TaskCompletedEvent, Agent, Task } from '../types';

// Socket server URL - configurable via environment variable
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
}

/**
 * Custom hook for Socket.IO real-time communication
 * Connects to server and listens for agent/task status updates
 */
export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Get store actions
  const updateAgent = useAgentStore((state) => state.updateAgent);
  const addAgent = useAgentStore((state) => state.addAgent);
  const updateTask = useTaskStore((state) => state.updateTask);
  const addTask = useTaskStore((state) => state.addTask);

  useEffect(() => {
    // Create socket connection
    socketRef.current = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[Socket] Connected to server');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
    });

    // Listen for agent-status events
    socket.on('agent-status', (data: AgentStatusEvent) => {
      console.log('[Socket] Agent status update:', data);

      // Update or add agent based on status event
      const existingAgent = useAgentStore.getState().getAgent(data.agentId);

      if (existingAgent) {
        // Update existing agent
        updateAgent(data.agentId, {
          status: data.status,
          updatedAt: new Date(data.timestamp),
        });
      } else {
        // Add new agent (when registered)
        const newAgent: Agent = {
          id: data.agentId,
          name: `Agent-${data.agentId}`,
          type: 'unknown',
          config: {},
          status: data.status,
          createdAt: new Date(data.timestamp),
          updatedAt: new Date(data.timestamp),
        };
        addAgent(newAgent);
      }
    });

    // Listen for task-status events
    socket.on('task-status', (data: TaskStatusEvent) => {
      console.log('[Socket] Task status update:', data);

      // Update task status
      const existingTask = useTaskStore.getState().getTask(data.taskId);

      if (existingTask) {
        updateTask(data.taskId, {
          status: data.status,
          updatedAt: new Date(data.timestamp),
        });
      } else {
        // Add new task if it doesn't exist
        const newTask: Task = {
          id: data.taskId,
          agentId: '',
          type: 'unknown',
          data: {},
          status: data.status,
          priority: 0,
          createdAt: new Date(data.timestamp),
          updatedAt: new Date(data.timestamp),
        };
        addTask(newTask);
      }
    });

    // Listen for error events
    socket.on('error', (data: ErrorEvent) => {
      console.error('[Socket] Error event:', data);

      // Display error to user - could be extended to show a toast notification
      // For now, we log it; UI components can listen to this via store
    });

    // Listen for task-completed events
    socket.on('task-completed', (data: TaskCompletedEvent) => {
      console.log('[Socket] Task completed:', data);
      updateTask(data.taskId, {
        status: 'completed',
        result: data.result,
        updatedAt: new Date(data.timestamp),
      });
    });

    // Cleanup on unmount
    return () => {
      console.log('[Socket] Cleaning up...');

      // Remove all event listeners
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('agent-status');
      socket.off('task-status');
      socket.off('error');
      socket.off('task-completed');

      // Disconnect socket
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [updateAgent, addAgent, updateTask, addTask]);

  return {
    socket: socketRef.current,
    isConnected,
  };
}
