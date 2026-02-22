/**
 * SupabaseAgentRepository
 * Agent persistence implementation against Supabase Postgres.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  AgentListFilters,
  NewPersistedAgent,
  PersistedAgent,
  RepositoryRequestContext
} from '../repositoryModels';
import { AgentRepository } from '../repositoryInterfaces';

interface AgentRow {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  config: Record<string, unknown> | null;
  status: PersistedAgent['status'];
  created_by_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function toPersistedAgent(row: AgentRow): PersistedAgent {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    type: row.type,
    config: row.config ?? {},
    status: row.status,
    createdByUserId: row.created_by_user_id ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export class SupabaseAgentRepository implements AgentRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async createAgent(
    input: NewPersistedAgent,
    _ctx?: RepositoryRequestContext
  ): Promise<PersistedAgent> {
    const { data, error } = await this.client
      .from('agents')
      .insert({
        id: input.id,
        workspace_id: input.workspaceId,
        name: input.name,
        type: input.type,
        config: input.config ?? {},
        status: input.status,
        created_by_user_id: input.createdByUserId ?? null,
        metadata: input.metadata ?? {},
        created_at: input.createdAt?.toISOString(),
        updated_at: input.updatedAt?.toISOString()
      })
      .select('*')
      .single<AgentRow>();

    if (error || !data) {
      throw new Error(`Failed to create agent: ${error?.message ?? 'unknown error'}`);
    }

    return toPersistedAgent(data);
  }

  public async getAgentById(
    id: string,
    _ctx?: RepositoryRequestContext
  ): Promise<PersistedAgent | null> {
    const { data, error } = await this.client
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle<AgentRow>();

    if (error) {
      throw new Error(`Failed to get agent by id: ${error.message}`);
    }

    return data ? toPersistedAgent(data) : null;
  }

  public async listAgents(
    filters: AgentListFilters,
    _ctx?: RepositoryRequestContext
  ): Promise<PersistedAgent[]> {
    let query = this.client
      .from('agents')
      .select('*')
      .eq('workspace_id', filters.workspaceId);

    if (filters.statuses && filters.statuses.length > 0) {
      query = query.in('status', filters.statuses);
    }
    if (filters.types && filters.types.length > 0) {
      query = query.in('type', filters.types);
    }
    if (typeof filters.limit === 'number' && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query.returns<AgentRow[]>();
    if (error) {
      throw new Error(`Failed to list agents: ${error.message}`);
    }

    return (data ?? []).map(toPersistedAgent);
  }

  public async updateAgent(
    id: string,
    updates: Partial<Omit<PersistedAgent, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    _ctx?: RepositoryRequestContext
  ): Promise<PersistedAgent | null> {
    const payload: Record<string, unknown> = {};

    if (typeof updates.name === 'string') {
      payload.name = updates.name;
    }
    if (typeof updates.type === 'string') {
      payload.type = updates.type;
    }
    if (updates.config !== undefined) {
      payload.config = updates.config ?? {};
    }
    if (updates.status) {
      payload.status = updates.status;
    }
    if (updates.createdByUserId !== undefined) {
      payload.created_by_user_id = updates.createdByUserId ?? null;
    }
    if (updates.metadata !== undefined) {
      payload.metadata = updates.metadata ?? {};
    }

    if (Object.keys(payload).length === 0) {
      return this.getAgentById(id);
    }

    const { data, error } = await this.client
      .from('agents')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle<AgentRow>();

    if (error) {
      throw new Error(`Failed to update agent: ${error.message}`);
    }

    return data ? toPersistedAgent(data) : null;
  }

  public async deleteAgent(id: string, _ctx?: RepositoryRequestContext): Promise<boolean> {
    const { error, count } = await this.client
      .from('agents')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete agent: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }
}
