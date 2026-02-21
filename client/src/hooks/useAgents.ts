/**
 * Agent Orchestration Platform - Agent Query Hooks
 * TanStack Query hooks for agent operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import type { Agent } from '../types';
import {
  getAgents,
  getAgent,
  deployAgent,
  startAgent,
  stopAgent,
  deleteAgent,
  DeployAgentData,
} from '../lib/api';

// Query keys for cache management
export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: (filters?: string) => [...agentKeys.lists(), { filters }] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (id: string) => [...agentKeys.details(), id] as const,
};

// ============================================
// Query Hooks
// ============================================

/**
 * Fetch all agents with caching
 * Refetches on window focus
 */
export function useAgents(): UseQueryResult<Agent[]> {
  return useQuery({
    queryKey: agentKeys.lists(),
    queryFn: getAgents,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch a single agent by ID with caching
 */
export function useAgent(id: string): UseQueryResult<Agent> {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => getAgent(id),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    enabled: !!id, // Only fetch if id is provided
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Deploy a new agent mutation
 */
export function useDeployAgent(): UseMutationResult<Agent, Error, DeployAgentData> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deployAgent,
    onSuccess: () => {
      // Invalidate agents list to refetch after deployment
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}

/**
 * Start an agent mutation
 */
export function useStartAgent(): UseMutationResult<Agent, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startAgent,
    onSuccess: (data) => {
      // Invalidate the specific agent and the list
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}

/**
 * Stop an agent mutation
 */
export function useStopAgent(): UseMutationResult<Agent, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: stopAgent,
    onSuccess: (data) => {
      // Invalidate the specific agent and the list
      queryClient.invalidateQueries({ queryKey: agentKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}

/**
 * Delete an agent mutation
 */
export function useDeleteAgent(): UseMutationResult<boolean, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAgent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
    },
  });
}

// ============================================
// Type Exports
// ============================================

export type UseAgentsResult = UseQueryResult<Agent[]>;
export type UseAgentResult = UseQueryResult<Agent>;
export type UseDeployAgentVariables = DeployAgentData;
export type UseDeployAgentResult = UseMutationResult<Agent, Error, DeployAgentData>;
export type UseStartAgentVariables = string;
export type UseStartAgentResult = UseMutationResult<Agent, Error, string>;
export type UseStopAgentVariables = string;
export type UseStopAgentResult = UseMutationResult<Agent, Error, string>;
export type UseDeleteAgentVariables = string;
export type UseDeleteAgentResult = UseMutationResult<boolean, Error, string>;
