/**
 * Task Store - Zustand store for task state management
 */
import { create } from 'zustand';
import type { Task } from '../types';

interface TaskStore {
  tasks: Record<string, Task>;
  setTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  addTask: (task: Task) => void;
  removeTask: (id: string) => void;
  getTask: (id: string) => Task | undefined;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: {},

  setTasks: (tasks: Task[]) =>
    set(() => ({
      tasks: tasks.reduce<Record<string, Task>>((acc, task) => {
        acc[task.id] = task;
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
