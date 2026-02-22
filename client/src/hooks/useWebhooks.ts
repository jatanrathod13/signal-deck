/**
 * Webhook Query Hooks
 * TanStack Query hooks for webhook CRUD and test dispatch.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { WebhookDefinition } from '../types';
import {
  createWebhook,
  deleteWebhook,
  getWebhooks,
  testWebhook,
  updateWebhook,
  type CreateWebhookData,
  type UpdateWebhookData
} from '../lib/api';

export const webhookKeys = {
  all: ['webhooks'] as const,
  lists: () => [...webhookKeys.all, 'list'] as const,
  detail: (id: string) => [...webhookKeys.all, 'detail', id] as const
};

export function useWebhooks(): UseQueryResult<WebhookDefinition[]> {
  return useQuery({
    queryKey: webhookKeys.lists(),
    queryFn: getWebhooks,
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true
  });
}

export function useCreateWebhook(): UseMutationResult<WebhookDefinition, Error, CreateWebhookData> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.lists() });
    }
  });
}

export function useUpdateWebhook(): UseMutationResult<WebhookDefinition, Error, { id: string; data: UpdateWebhookData }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateWebhook(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.detail(updated.id) });
      queryClient.invalidateQueries({ queryKey: webhookKeys.lists() });
    }
  });
}

export function useDeleteWebhook(): UseMutationResult<boolean, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.lists() });
    }
  });
}

export function useTestWebhook(): UseMutationResult<{ queued: boolean }, Error, { id: string; payload?: Record<string, unknown> }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }) => testWebhook(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.lists() });
    }
  });
}
