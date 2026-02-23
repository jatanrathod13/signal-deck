/**
 * SupabaseScheduleRepository
 * Schedule persistence implementation against Supabase Postgres.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  NewScheduleRecord,
  RepositoryRequestContext,
  ScheduleListFilters,
  ScheduleRecord
} from '../repositoryModels';
import { ScheduleRepository } from '../repositoryInterfaces';

interface ScheduleRow {
  id: string;
  workspace_id: string;
  name: string;
  cron_expression: string;
  timezone: string;
  payload: Record<string, unknown> | null;
  enabled: boolean;
  retry_limit: number;
  retry_backoff_seconds: number;
  last_run_at: string | null;
  next_run_at: string | null;
  last_run_status: ScheduleRecord['lastRunStatus'];
  created_by_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function toScheduleRecord(row: ScheduleRow): ScheduleRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    payload: row.payload ?? {},
    enabled: row.enabled,
    retryLimit: row.retry_limit,
    retryBackoffSeconds: row.retry_backoff_seconds,
    lastRunAt: row.last_run_at ? new Date(row.last_run_at) : undefined,
    nextRunAt: row.next_run_at ? new Date(row.next_run_at) : undefined,
    lastRunStatus: row.last_run_status,
    createdByUserId: row.created_by_user_id ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export class SupabaseScheduleRepository implements ScheduleRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async createSchedule(
    input: NewScheduleRecord,
    _ctx?: RepositoryRequestContext
  ): Promise<ScheduleRecord> {
    const { data, error } = await this.client
      .from('schedules')
      .insert({
        workspace_id: input.workspaceId,
        name: input.name,
        cron_expression: input.cronExpression,
        timezone: input.timezone,
        payload: input.payload ?? {},
        enabled: input.enabled,
        retry_limit: input.retryLimit,
        retry_backoff_seconds: input.retryBackoffSeconds,
        last_run_at: input.lastRunAt?.toISOString(),
        next_run_at: input.nextRunAt?.toISOString(),
        last_run_status: input.lastRunStatus,
        created_by_user_id: input.createdByUserId ?? null,
        metadata: input.metadata ?? {}
      })
      .select('*')
      .single<ScheduleRow>();

    if (error || !data) {
      throw new Error(`Failed to create schedule: ${error?.message ?? 'unknown error'}`);
    }

    return toScheduleRecord(data);
  }

  public async getScheduleById(
    id: string,
    _ctx?: RepositoryRequestContext
  ): Promise<ScheduleRecord | null> {
    const { data, error } = await this.client
      .from('schedules')
      .select('*')
      .eq('id', id)
      .maybeSingle<ScheduleRow>();

    if (error) {
      throw new Error(`Failed to get schedule by id: ${error.message}`);
    }

    return data ? toScheduleRecord(data) : null;
  }

  public async listSchedules(
    filters: ScheduleListFilters,
    _ctx?: RepositoryRequestContext
  ): Promise<ScheduleRecord[]> {
    let query = this.client
      .from('schedules')
      .select('*')
      .eq('workspace_id', filters.workspaceId);

    if (filters.enabled !== undefined) {
      query = query.eq('enabled', filters.enabled);
    }
    if (filters.dueBefore) {
      query = query.lte('next_run_at', filters.dueBefore.toISOString());
    }
    if (typeof filters.limit === 'number' && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    query = query.order('next_run_at', { ascending: true, nullsFirst: false });

    const { data, error } = await query.returns<ScheduleRow[]>();
    if (error) {
      throw new Error(`Failed to list schedules: ${error.message}`);
    }

    return (data ?? []).map(toScheduleRecord);
  }

  public async updateSchedule(
    id: string,
    updates: Partial<Omit<ScheduleRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    _ctx?: RepositoryRequestContext
  ): Promise<ScheduleRecord | null> {
    const payload: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      payload.name = updates.name;
    }
    if (updates.cronExpression !== undefined) {
      payload.cron_expression = updates.cronExpression;
    }
    if (updates.timezone !== undefined) {
      payload.timezone = updates.timezone;
    }
    if (updates.payload !== undefined) {
      payload.payload = updates.payload ?? {};
    }
    if (updates.enabled !== undefined) {
      payload.enabled = updates.enabled;
    }
    if (updates.retryLimit !== undefined) {
      payload.retry_limit = updates.retryLimit;
    }
    if (updates.retryBackoffSeconds !== undefined) {
      payload.retry_backoff_seconds = updates.retryBackoffSeconds;
    }
    if (updates.lastRunAt !== undefined) {
      payload.last_run_at = updates.lastRunAt ? updates.lastRunAt.toISOString() : null;
    }
    if (updates.nextRunAt !== undefined) {
      payload.next_run_at = updates.nextRunAt ? updates.nextRunAt.toISOString() : null;
    }
    if (updates.lastRunStatus !== undefined) {
      payload.last_run_status = updates.lastRunStatus;
    }
    if (updates.createdByUserId !== undefined) {
      payload.created_by_user_id = updates.createdByUserId ?? null;
    }
    if (updates.metadata !== undefined) {
      payload.metadata = updates.metadata ?? {};
    }

    if (Object.keys(payload).length === 0) {
      return this.getScheduleById(id);
    }

    const { data, error } = await this.client
      .from('schedules')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle<ScheduleRow>();

    if (error) {
      throw new Error(`Failed to update schedule: ${error.message}`);
    }

    return data ? toScheduleRecord(data) : null;
  }

  public async deleteSchedule(id: string, _ctx?: RepositoryRequestContext): Promise<boolean> {
    const { error, count } = await this.client
      .from('schedules')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete schedule: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }
}
