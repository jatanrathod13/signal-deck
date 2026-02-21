/**
 * Agent Orchestration Platform - Task Query Hooks
 * TanStack Query hooks for task operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import type { Task } from '../types';
import {
  getTasks,
  getTask,
  submitTask,
  cancelTask,
  retryTask,
  SubmitTaskData,
} from '../lib/api';

// Query keys for cache management
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (status?: string) => [...taskKeys.lists(), { status }] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch all tasks with optional status filtering
 * Caches results and refetches on window focus
 */
export function useTasks(status?: string): UseQueryResult<Task[]> {
  return useQuery({
    queryKey: taskKeys.list(status),
    queryFn: () => getTasks(status),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch a single task by ID with caching
 */
export function useTask(id: string): UseQueryResult<Task> {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: () => getTask(id),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!id, // Only fetch if id is provided
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Submit a new task mutation
 */
export function useSubmitTask(): UseMutationResult<Task, Error, SubmitTaskData> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitTask,
    onSuccess: () => {
      // Invalidate tasks list to refetch after submission
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Cancel a task mutation
 */
export function useCancelTask(): UseMutationResult<boolean, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelTask,
    onSuccess: () => {
      // Invalidate tasks list to refetch after cancellation
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

/**
 * Retry a failed task mutation
 */
export function useRetryTask(): UseMutationResult<Task, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryTask,
    onSuccess: (data) => {
      // Invalidate the specific task and the list
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// ============================================
// Type Exports
// ============================================

export type UseTasksResult = UseQueryResult<Task[]>;
export type UseTaskResult = UseQueryResult<Task>;
export type UseSubmitTaskVariables = SubmitTaskData;
export type UseSubmitTaskResult = UseMutationResult<Task, Error, SubmitTaskData>;
export type UseCancelTaskVariables = string;
export type UseCancelTaskResult = UseMutationResult<boolean, Error, string>;
export type UseRetryTaskVariables = string;
export type UseRetryTaskResult = UseMutationResult<Task, Error, string>;
