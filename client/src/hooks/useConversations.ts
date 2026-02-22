/**
 * Conversation Query Hooks
 * TanStack Query hooks for conversation and run APIs.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { Conversation, ConversationMessage, Run, RunEvent } from '../types';
import {
  createConversation,
  getConversation,
  getConversationEvents,
  getConversations,
  getRun,
  submitConversationMessage,
  type CreateConversationData,
  type SubmitConversationMessageData,
  type SubmitConversationMessageResult
} from '../lib/api';

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  detail: (id: string) => [...conversationKeys.all, 'detail', id] as const,
  events: (id: string, after?: string) => [...conversationKeys.all, 'events', id, after] as const,
  runs: (runId: string) => ['runs', runId] as const
};

export function useConversations(): UseQueryResult<Conversation[]> {
  return useQuery({
    queryKey: conversationKeys.lists(),
    queryFn: getConversations,
    staleTime: 10_000
  });
}

export function useConversation(conversationId: string): UseQueryResult<{
  conversation: Conversation;
  messages: ConversationMessage[];
}> {
  return useQuery({
    queryKey: conversationKeys.detail(conversationId),
    queryFn: () => getConversation(conversationId),
    enabled: !!conversationId,
    staleTime: 5_000
  });
}

export function useConversationEvents(conversationId: string, after?: string): UseQueryResult<RunEvent[]> {
  return useQuery({
    queryKey: conversationKeys.events(conversationId, after),
    queryFn: () => getConversationEvents(conversationId, after),
    enabled: !!conversationId,
    staleTime: 2_000
  });
}

export function useRun(runId: string): UseQueryResult<{ run: Run; events: RunEvent[] }> {
  return useQuery({
    queryKey: conversationKeys.runs(runId),
    queryFn: () => getRun(runId),
    enabled: !!runId,
    staleTime: 2_000
  });
}

export function useCreateConversation(): UseMutationResult<Conversation, Error, CreateConversationData> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    }
  });
}

export function useSubmitConversationMessage(): UseMutationResult<
  SubmitConversationMessageResult,
  Error,
  { conversationId: string; data: SubmitConversationMessageData }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, data }) => submitConversationMessage(conversationId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    }
  });
}
