/**
 * Schedule Query Hooks
 * TanStack Query hooks for schedule CRUD and triggering.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type { ScheduleDefinition } from '../types';
import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  triggerSchedule,
  updateSchedule,
  type CreateScheduleData,
  type UpdateScheduleData
} from '../lib/api';

export const scheduleKeys = {
  all: ['schedules'] as const,
  lists: () => [...scheduleKeys.all, 'list'] as const,
  detail: (id: string) => [...scheduleKeys.all, 'detail', id] as const
};

export function useSchedules(): UseQueryResult<ScheduleDefinition[]> {
  return useQuery({
    queryKey: scheduleKeys.lists(),
    queryFn: getSchedules,
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true
  });
}

export function useCreateSchedule(): UseMutationResult<ScheduleDefinition, Error, CreateScheduleData> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
    }
  });
}

export function useUpdateSchedule(): UseMutationResult<ScheduleDefinition, Error, { id: string; data: UpdateScheduleData }> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }) => updateSchedule(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.detail(updated.id) });
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
    }
  });
}

export function useDeleteSchedule(): UseMutationResult<boolean, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
    }
  });
}

export function useTriggerSchedule(): UseMutationResult<{ taskQueued: boolean }, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleKeys.lists() });
    }
  });
}
