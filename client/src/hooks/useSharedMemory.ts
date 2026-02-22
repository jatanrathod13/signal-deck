/**
 * Agent Orchestration Platform - Shared Memory Hooks
 * TanStack Query hooks for shared memory operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import type { SharedMemoryValue } from '../types';
import {
  getMemory,
  listMemory,
  setMemory,
  deleteMemory,
  SetMemoryData,
} from '../lib/api';

// Query keys for cache management
export const memoryKeys = {
  all: ['memory'] as const,
  lists: () => [...memoryKeys.all, 'list'] as const,
  list: () => [...memoryKeys.lists()] as const,
  details: () => [...memoryKeys.all, 'detail'] as const,
  detail: (key: string) => [...memoryKeys.details(), key] as const,
};

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch a single memory value by key with caching
 */
export function useMemory(key: string): UseQueryResult<SharedMemoryValue | null> {
  return useQuery({
    queryKey: memoryKeys.detail(key),
    queryFn: () => getMemory(key),
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch all memory keys with caching
 */
export function useListMemory(): UseQueryResult<{ key: string; value: string | null }[]> {
  return useQuery({
    queryKey: memoryKeys.list(),
    queryFn: listMemory,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Set a memory value mutation
 */
export function useSetMemory(): UseMutationResult<void, Error, SetMemoryData> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ key, value, ttl }) => setMemory(key, value, ttl),
    onSuccess: (_, variables) => {
      // Invalidate the specific memory key and the list
      queryClient.invalidateQueries({ queryKey: memoryKeys.detail(variables.key) });
      queryClient.invalidateQueries({ queryKey: memoryKeys.lists() });
    },
  });
}

/**
 * Delete a memory value mutation
 */
export function useDeleteMemory(): UseMutationResult<boolean, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMemory,
    onSuccess: () => {
      // Invalidate the memory list to refetch after deletion
      queryClient.invalidateQueries({ queryKey: memoryKeys.lists() });
    },
  });
}

// ============================================
// Type Exports
// ============================================

export type UseMemoryResult = UseQueryResult<SharedMemoryValue | null>;
export type UseListMemoryResult = UseQueryResult<{ key: string; value: string | null }[]>;
export type UseSetMemoryVariables = SetMemoryData;
export type UseSetMemoryResult = UseMutationResult<void, Error, SetMemoryData>;
export type UseDeleteMemoryVariables = string;
export type UseDeleteMemoryResult = UseMutationResult<boolean, Error, string>;
