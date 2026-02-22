/**
 * Task Store - Zustand store for task state management
 */
import { create } from 'zustand';
import type { Task } from '../types';

interface TaskStore {
  tasks: Record<string, Task>;
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  appendTaskLog: (id: string, stream: 'stdout' | 'stderr' | 'system', chunk: string, timestamp: Date) => void;
  addTask: (task: Task) => void;
  removeTask: (id: string) => void;
  getTask: (id: string) => Task | undefined;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: {},

  setTasks: (tasks: Task[]) =>
    set((state) => ({
      tasks: tasks.reduce<Record<string, Task>>((acc, task) => {
        const existing = state.tasks[task.id];
        acc[task.id] = {
          ...task,
          liveOutput: existing?.liveOutput ?? task.liveOutput,
          liveErrorOutput: existing?.liveErrorOutput ?? task.liveErrorOutput,
          lastLogAt: existing?.lastLogAt ?? task.lastLogAt
        };
        return acc;
      }, {})
    })),

  updateTask: (id: string, updates: Partial<Task>) =>
    set((state) => ({
      tasks: {
        ...state.tasks,
        [id]: { ...state.tasks[id], ...updates }
      }
    })),

  appendTaskLog: (id: string, stream: 'stdout' | 'stderr' | 'system', chunk: string, timestamp: Date) =>
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) {
        return state;
      }

      const nextOutput = stream === 'stderr'
        ? existing.liveOutput
        : `${existing.liveOutput ?? ''}${chunk}`.slice(-20000);
      const nextError = stream === 'stderr'
        ? `${existing.liveErrorOutput ?? ''}${chunk}`.slice(-20000)
        : existing.liveErrorOutput;

      return {
        tasks: {
          ...state.tasks,
          [id]: {
            ...existing,
            liveOutput: nextOutput,
            liveErrorOutput: nextError,
            lastLogAt: timestamp
          }
        }
      };
    }),

  addTask: (task: Task) =>
    set((state) => ({
      tasks: {
        ...state.tasks,
        [task.id]: task
      }
    })),

  removeTask: (id: string) =>
    set((state) => {
      const { [id]: _, ...remainingTasks } = state.tasks;
      return { tasks: remainingTasks };
    }),

  getTask: (id: string) => get().tasks[id]
}));
