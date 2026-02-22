/**
 * useSocket + SocketProvider
 * Maintains a single shared Socket.IO connection across the app.
 */
/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAgentStore } from '../stores/agentStore';
import { useTaskStore } from '../stores/taskStore';
import type {
  AgentStatusEvent,
  TaskStatusEvent,
  ErrorEvent,
  TaskCompletedEvent,
  Agent,
  Task,
  RunEvent,
  RunEventType
} from '../types';
import { useConversationStore } from '../stores/conversationStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false
});

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const updateAgent = useAgentStore((state) => state.updateAgent);
  const addAgent = useAgentStore((state) => state.addAgent);
  const updateTask = useTaskStore((state) => state.updateTask);
  const addTask = useTaskStore((state) => state.addTask);

  const appendRunEvent = useConversationStore((state) => state.appendRunEvent);
  const addMessage = useConversationStore((state) => state.addMessage);
  const upsertRun = useConversationStore((state) => state.upsertRun);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      setIsConnected(false);
    });

    socket.on('agent-status', (data: AgentStatusEvent) => {
      const existingAgent = useAgentStore.getState().getAgent(data.agentId);

      if (existingAgent) {
        updateAgent(data.agentId, {
          status: data.status,
          updatedAt: new Date(data.timestamp)
        });
      } else {
        const newAgent: Agent = {
          id: data.agentId,
          name: `Agent-${data.agentId}`,
          type: 'unknown',
          config: {},
          status: data.status,
          createdAt: new Date(data.timestamp),
          updatedAt: new Date(data.timestamp)
        };
        addAgent(newAgent);
      }
    });

    socket.on('task-status', (data: TaskStatusEvent) => {
      const existingTask = useTaskStore.getState().getTask(data.taskId);

      if (existingTask) {
        updateTask(data.taskId, {
          status: data.status,
          updatedAt: new Date(data.timestamp)
        });
      } else {
        const newTask: Task = {
          id: data.taskId,
          agentId: data.agentId || '',
          type: 'unknown',
          data: {},
          status: data.status,
          priority: 0,
          createdAt: new Date(data.timestamp),
          updatedAt: new Date(data.timestamp),
          conversationId: data.conversationId,
          runId: data.runId
        };
        addTask(newTask);
      }
    });

    socket.on('task-completed', (data: TaskCompletedEvent) => {
      updateTask(data.taskId, {
        status: 'completed',
        result: data.result,
        updatedAt: new Date(data.timestamp)
      });
    });

    socket.on('run-event', (event: RunEvent) => {
      appendRunEvent(event);

      if (event.type === 'message.created') {
        const role = typeof event.payload.role === 'string' ? event.payload.role : undefined;
        const content = typeof event.payload.content === 'string' ? event.payload.content : undefined;
        if ((role === 'assistant' || role === 'user' || role === 'system' || role === 'tool') && content) {
          addMessage(event.conversationId, {
            id: typeof event.payload.messageId === 'string' ? event.payload.messageId : `tmp-${event.id}`,
            conversationId: event.conversationId,
            role,
            content,
            createdAt: new Date(event.timestamp),
            runId: event.runId,
            metadata: {
              source: 'socket'
            }
          });
        }
      }

      if (event.type === 'run.completed' || event.type === 'run.failed' || event.type === 'run.started') {
        const status: RunEventType = event.type;
        upsertRun({
          id: event.runId,
          conversationId: event.conversationId,
          status: status === 'run.completed' ? 'completed' : (status === 'run.failed' ? 'failed' : 'running'),
          startedAt: new Date(event.timestamp),
          endedAt: status === 'run.started' ? undefined : new Date(event.timestamp)
        });
      }
    });

    socket.on('error', (data: ErrorEvent) => {
      console.error('[Socket] Error event:', data.message);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [updateAgent, addAgent, updateTask, addTask, appendRunEvent, addMessage, upsertRun]);

  const value = useMemo(() => ({ socket: socketRef.current, isConnected }), [isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
