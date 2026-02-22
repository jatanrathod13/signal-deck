/**
 * SupabaseWorkspaceRepository
 * Workspace and membership repositories for app-level tenancy.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  NewWorkspaceMemberRecord,
  NewWorkspaceRecord,
  RepositoryRequestContext,
  WorkspaceMemberRecord,
  WorkspaceRecord
} from '../repositoryModels';
import {
  WorkspaceMemberRepository,
  WorkspaceRepository
} from '../repositoryInterfaces';

interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  created_by_user_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface WorkspaceMemberRow {
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRecord['role'];
  invited_by_user_id: string | null;
  metadata: Record<string, unknown> | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

function toWorkspaceRecord(row: WorkspaceRow): WorkspaceRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    createdByUserId: row.created_by_user_id,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

function toWorkspaceMemberRecord(row: WorkspaceMemberRow): WorkspaceMemberRecord {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
    invitedByUserId: row.invited_by_user_id ?? undefined,
    metadata: row.metadata ?? undefined,
    joinedAt: new Date(row.joined_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async createWorkspace(
    input: NewWorkspaceRecord,
    _ctx?: RepositoryRequestContext
  ): Promise<WorkspaceRecord> {
    const { data, error } = await this.client
      .from('workspaces')
      .insert({
        slug: input.slug,
        name: input.name,
        created_by_user_id: input.createdByUserId,
        metadata: input.metadata ?? {}
      })
      .select('*')
      .single<WorkspaceRow>();

    if (error || !data) {
      throw new Error(`Failed to create workspace: ${error?.message ?? 'unknown error'}`);
    }

    return toWorkspaceRecord(data);
  }

  public async getWorkspaceById(
    id: string,
    _ctx?: RepositoryRequestContext
  ): Promise<WorkspaceRecord | null> {
    const { data, error } = await this.client
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .maybeSingle<WorkspaceRow>();

    if (error) {
      throw new Error(`Failed to load workspace by id: ${error.message}`);
    }

    return data ? toWorkspaceRecord(data) : null;
  }

  public async getWorkspaceBySlug(
    slug: string,
    _ctx?: RepositoryRequestContext
  ): Promise<WorkspaceRecord | null> {
    const { data, error } = await this.client
      .from('workspaces')
      .select('*')
      .eq('slug', slug)
      .maybeSingle<WorkspaceRow>();

    if (error) {
      throw new Error(`Failed to load workspace by slug: ${error.message}`);
    }

    return data ? toWorkspaceRecord(data) : null;
  }

  public async listWorkspacesForUser(
    userId: string,
    _ctx?: RepositoryRequestContext
  ): Promise<WorkspaceRecord[]> {
    const { data, error } = await this.client
      .from('workspace_members')
      .select('workspace:workspaces(*)')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to list workspaces for user: ${error.message}`);
    }

    const rows = (data ?? [])
      .map((row) => {
        const workspace = (row as { workspace?: WorkspaceRow | WorkspaceRow[] | null }).workspace;
        if (Array.isArray(workspace)) {
          return workspace[0] ?? null;
        }
        return workspace ?? null;
      })
      .filter((workspace): workspace is WorkspaceRow => Boolean(workspace));

    return rows.map(toWorkspaceRecord);
  }

  public async updateWorkspace(
    id: string,
    updates: Partial<Omit<WorkspaceRecord, 'id' | 'createdAt' | 'updatedAt'>>,
    _ctx?: RepositoryRequestContext
  ): Promise<WorkspaceRecord | null> {
    const payload: Record<string, unknown> = {};

    if (typeof updates.slug === 'string') {
      payload.slug = updates.slug;
    }
    if (typeof updates.name === 'string') {
      payload.name = updates.name;
    }
    if (updates.metadata !== undefined) {
      payload.metadata = updates.metadata ?? {};
    }

    if (Object.keys(payload).length === 0) {
      return this.getWorkspaceById(id);
    }

    const { data, error } = await this.client
      .from('workspaces')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle<WorkspaceRow>();

    if (error) {
      throw new Error(`Failed to update workspace: ${error.message}`);
    }

    return data ? toWorkspaceRecord(data) : null;
  }
}

export class SupabaseWorkspaceMemberRepository implements WorkspaceMemberRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async upsertWorkspaceMember(
    input: NewWorkspaceMemberRecord,
    _ctx?: RepositoryRequestContext
  ): Promise<WorkspaceMemberRecord> {
    const { data, error } = await this.client
      .from('workspace_members')
      .upsert({
        workspace_id: input.workspaceId,
        user_id: input.userId,
        role: input.role,
        invited_by_user_id: input.invitedByUserId ?? null,
        metadata: input.metadata ?? {}
      }, { onConflict: 'workspace_id,user_id' })
      .select('*')
      .single<WorkspaceMemberRow>();

    if (error || !data) {
      throw new Error(`Failed to upsert workspace member: ${error?.message ?? 'unknown error'}`);
    }

    return toWorkspaceMemberRecord(data);
  }

  public async getWorkspaceMember(
    workspaceId: string,
    userId: string,
    _ctx?: RepositoryRequestContext
  ): Promise<WorkspaceMemberRecord | null> {
    const { data, error } = await this.client
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle<WorkspaceMemberRow>();

    if (error) {
      throw new Error(`Failed to load workspace member: ${error.message}`);
    }

    return data ? toWorkspaceMemberRecord(data) : null;
  }

  public async listWorkspaceMembers(
    workspaceId: string,
    _ctx?: RepositoryRequestContext
  ): Promise<WorkspaceMemberRecord[]> {
    const { data, error } = await this.client
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
      .returns<WorkspaceMemberRow[]>();

    if (error) {
      throw new Error(`Failed to list workspace members: ${error.message}`);
    }

    return (data ?? []).map(toWorkspaceMemberRecord);
  }

  public async listUserWorkspaceMemberships(
    userId: string,
    _ctx?: RepositoryRequestContext
  ): Promise<WorkspaceMemberRecord[]> {
    const { data, error } = await this.client
      .from('workspace_members')
      .select('*')
      .eq('user_id', userId)
      .returns<WorkspaceMemberRow[]>();

    if (error) {
      throw new Error(`Failed to list user workspace memberships: ${error.message}`);
    }

    return (data ?? []).map(toWorkspaceMemberRecord);
  }

  public async deleteWorkspaceMember(
    workspaceId: string,
    userId: string,
    _ctx?: RepositoryRequestContext
  ): Promise<boolean> {
    const { error, count } = await this.client
      .from('workspace_members')
      .delete({ count: 'exact' })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete workspace member: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }
}
