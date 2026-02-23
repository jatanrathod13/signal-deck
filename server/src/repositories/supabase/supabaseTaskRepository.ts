/**
 * SupabaseTaskRepository
 * Task persistence implementation against Supabase Postgres.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  NewPersistedTask,
  PersistedTask,
  RepositoryRequestContext,
  TaskListFilters
} from '../repositoryModels';
import { TaskRepository } from '../repositoryInterfaces';

interface TaskRow {
  id: string;
  workspace_id: string;
  agent_id: string;
  type: string;
  data: Record<string, unknown> | null;
  execution_mode: PersistedTask['executionMode'];
  status: PersistedTask['status'];
  priority: number;
  parent_task_id: string | null;
  plan_id: string | null;
  step_id: string | null;
  depends_on_task_ids: string[] | null;
  child_task_ids: string[] | null;
  idempotency_key: string | null;
  retry_count: number | null;
  metadata: Record<string, unknown> | null;
  conversation_id: string | null;
  run_id: string | null;
  result: unknown;
  error: string | null;
  error_type: PersistedTask['errorType'] | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

function toPersistedTask(row: TaskRow): PersistedTask {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    agentId: row.agent_id,
    type: row.type,
    data: row.data ?? {},
    executionMode: row.execution_mode,
    status: row.status,
    priority: row.priority,
    parentTaskId: row.parent_task_id ?? undefined,
    planId: row.plan_id ?? undefined,
    stepId: row.step_id ?? undefined,
    dependsOnTaskIds: row.depends_on_task_ids ?? [],
    childTaskIds: row.child_task_ids ?? [],
    idempotencyKey: row.idempotency_key ?? undefined,
    retryCount: row.retry_count ?? 0,
    metadata: row.metadata ?? undefined,
    conversationId: row.conversation_id ?? undefined,
    runId: row.run_id ?? undefined,
    result: row.result ?? undefined,
    error: row.error ?? undefined,
    errorType: row.error_type ?? undefined,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function toInsertPayload(input: NewPersistedTask): Record<string, unknown> {
  return {
    id: input.id,
    workspace_id: input.workspaceId,
    agent_id: input.agentId,
    type: input.type,
    data: input.data ?? {},
    execution_mode: input.executionMode ?? 'tool_loop',
    status: input.status,
    priority: input.priority,
    parent_task_id: input.parentTaskId ?? null,
    plan_id: input.planId ?? null,
    step_id: input.stepId ?? null,
    depends_on_task_ids: input.dependsOnTaskIds ?? [],
    child_task_ids: input.childTaskIds ?? [],
    idempotency_key: input.idempotencyKey ?? null,
    retry_count: input.retryCount ?? 0,
    metadata: input.metadata ?? {},
    conversation_id: input.conversationId ?? null,
    run_id: input.runId ?? null,
    result: input.result ?? null,
    error: input.error ?? null,
    error_type: input.errorType ?? null,
    created_by_user_id: input.createdByUserId ?? null,
    created_at: input.createdAt?.toISOString(),
    updated_at: input.updatedAt?.toISOString()
  };
}

export class SupabaseTaskRepository implements TaskRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async createTask(
    input: NewPersistedTask,
    _ctx?: RepositoryRequestContext
  ): Promise<PersistedTask> {
    const payload = toInsertPayload(input);

    const { data, error } = await this.client
      .from('tasks')
      .upsert(payload, { onConflict: 'id' })
      .select('*')
      .single<TaskRow>();

    if (error || !data) {
      throw new Error(`Failed to create task: ${error?.message ?? 'unknown error'}`);
    }

    return toPersistedTask(data);
  }

  public async getTaskById(
    id: string,
    _ctx?: RepositoryRequestContext
  ): Promise<PersistedTask | null> {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle<TaskRow>();

    if (error) {
      throw new Error(`Failed to get task by id: ${error.message}`);
    }

    return data ? toPersistedTask(data) : null;
  }

  public async getTaskByIdempotencyKey(
    workspaceId: string,
    idempotencyKey: string,
    _ctx?: RepositoryRequestContext
  ): Promise<PersistedTask | null> {
    const { data, error } = await this.client
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('idempotency_key', idempotencyKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<TaskRow>();

    if (error) {
      throw new Error(`Failed to get task by idempotency key: ${error.message}`);
    }

    return data ? toPersistedTask(data) : null;
  }

  public async listTasks(
    filters: TaskListFilters,
    _ctx?: RepositoryRequestContext
  ): Promise<PersistedTask[]> {
    let query = this.client
      .from('tasks')
      .select('*')
      .eq('workspace_id', filters.workspaceId);

    if (filters.statuses && filters.statuses.length > 0) {
      query = query.in('status', filters.statuses);
    }
    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }
    if (filters.runId) {
      query = query.eq('run_id', filters.runId);
    }
    if (filters.planId) {
      query = query.eq('plan_id', filters.planId);
    }
    if (filters.createdAt?.from) {
      query = query.gte('created_at', filters.createdAt.from.toISOString());
    }
    if (filters.createdAt?.to) {
      query = query.lte('created_at', filters.createdAt.to.toISOString());
    }
    if (typeof filters.limit === 'number' && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query.returns<TaskRow[]>();
    if (error) {
      throw new Error(`Failed to list tasks: ${error.message}`);
    }

    return (data ?? []).map(toPersistedTask);
  }

  public async updateTask(
    id: string,
    updates: Partial<Omit<PersistedTask, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    _ctx?: RepositoryRequestContext
  ): Promise<PersistedTask | null> {
    const payload: Record<string, unknown> = {};

    if (updates.agentId !== undefined) {
      payload.agent_id = updates.agentId;
    }
    if (updates.type !== undefined) {
      payload.type = updates.type;
    }
    if (updates.data !== undefined) {
      payload.data = updates.data ?? {};
    }
    if (updates.executionMode !== undefined) {
      payload.execution_mode = updates.executionMode ?? 'tool_loop';
    }
    if (updates.status !== undefined) {
      payload.status = updates.status;
    }
    if (updates.priority !== undefined) {
      payload.priority = updates.priority;
    }
    if (updates.parentTaskId !== undefined) {
      payload.parent_task_id = updates.parentTaskId ?? null;
    }
    if (updates.planId !== undefined) {
      payload.plan_id = updates.planId ?? null;
    }
    if (updates.stepId !== undefined) {
      payload.step_id = updates.stepId ?? null;
    }
    if (updates.dependsOnTaskIds !== undefined) {
      payload.depends_on_task_ids = updates.dependsOnTaskIds ?? [];
    }
    if (updates.childTaskIds !== undefined) {
      payload.child_task_ids = updates.childTaskIds ?? [];
    }
    if (updates.idempotencyKey !== undefined) {
      payload.idempotency_key = updates.idempotencyKey ?? null;
    }
    if (updates.retryCount !== undefined) {
      payload.retry_count = updates.retryCount ?? 0;
    }
    if (updates.metadata !== undefined) {
      payload.metadata = updates.metadata ?? {};
    }
    if (updates.conversationId !== undefined) {
      payload.conversation_id = updates.conversationId ?? null;
    }
    if (updates.runId !== undefined) {
      payload.run_id = updates.runId ?? null;
    }
    if (updates.result !== undefined) {
      payload.result = updates.result ?? null;
    }
    if (updates.error !== undefined) {
      payload.error = updates.error ?? null;
    }
    if (updates.errorType !== undefined) {
      payload.error_type = updates.errorType ?? null;
    }
    if (updates.createdByUserId !== undefined) {
      payload.created_by_user_id = updates.createdByUserId ?? null;
    }

    if (Object.keys(payload).length === 0) {
      return this.getTaskById(id);
    }

    const { data, error } = await this.client
      .from('tasks')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle<TaskRow>();

    if (error) {
      throw new Error(`Failed to update task: ${error.message}`);
    }

    return data ? toPersistedTask(data) : null;
  }

  public async deleteTask(id: string, _ctx?: RepositoryRequestContext): Promise<boolean> {
    const { error, count } = await this.client
      .from('tasks')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete task: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }
}
