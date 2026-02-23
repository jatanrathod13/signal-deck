/**
 * AuditService
 * Governance-grade audit logging with Supabase persistence and in-memory fallback.
 */

import { getSupabaseAdminClient } from '../lib/supabaseClient';
import { AuditEventRecord } from '../repositories';
import { getCurrentWorkspaceId, getRequestContext } from './workspaceContextService';

interface AuditEventRow {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  actor_type: 'user' | 'service' | 'system';
  action: string;
  resource_type: string;
  resource_id: string | null;
  request_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface AuditEventInput {
  workspaceId?: string;
  actorUserId?: string;
  actorType?: 'user' | 'service' | 'system';
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditListFilters {
  workspaceId?: string;
  action?: string;
  resourceType?: string;
  limit?: number;
}

const fallbackStore = new Map<string, AuditEventRecord[]>();

function toRecord(row: AuditEventRow): AuditEventRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorUserId: row.actor_user_id ?? undefined,
    actorType: row.actor_type,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? undefined,
    requestId: row.request_id ?? undefined,
    ipAddress: row.ip_address ?? undefined,
    userAgent: row.user_agent ?? undefined,
    metadata: row.metadata,
    occurredAt: new Date(row.occurred_at)
  };
}

function normalizeActorType(input: string | undefined): 'user' | 'service' | 'system' {
  if (input === 'service' || input === 'system') {
    return input;
  }

  return 'user';
}

function buildFallbackRecord(input: Required<Pick<AuditEventInput, 'workspaceId' | 'action' | 'resourceType'>> & AuditEventInput): AuditEventRecord {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorType: normalizeActorType(input.actorType),
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requestId: input.requestId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: input.metadata,
    occurredAt: new Date()
  };
}

export async function appendAuditEvent(input: AuditEventInput): Promise<AuditEventRecord | null> {
  const requestContext = getRequestContext();
  const workspaceId = input.workspaceId ?? getCurrentWorkspaceId();

  if (!workspaceId || !input.action || !input.resourceType) {
    return null;
  }

  const eventInput: Required<Pick<AuditEventInput, 'workspaceId' | 'action' | 'resourceType'>> & AuditEventInput = {
    ...input,
    workspaceId,
    action: input.action,
    resourceType: input.resourceType,
    actorUserId: input.actorUserId ?? requestContext.userId,
    actorType: input.actorType ?? (requestContext.userId ? 'user' : 'system'),
    requestId: input.requestId ?? requestContext.requestId,
    ipAddress: input.ipAddress ?? requestContext.ipAddress,
    userAgent: input.userAgent ?? requestContext.userAgent,
    metadata: input.metadata ?? {}
  };

  const client = getSupabaseAdminClient();
  if (client) {
    const { data, error } = await client
      .from('audit_events')
      .insert({
        workspace_id: eventInput.workspaceId,
        actor_user_id: eventInput.actorUserId,
        actor_type: normalizeActorType(eventInput.actorType),
        action: eventInput.action,
        resource_type: eventInput.resourceType,
        resource_id: eventInput.resourceId,
        request_id: eventInput.requestId,
        ip_address: eventInput.ipAddress,
        user_agent: eventInput.userAgent,
        metadata: eventInput.metadata ?? {}
      })
      .select('*')
      .single();

    if (!error && data) {
      return toRecord(data as AuditEventRow);
    }
  }

  const fallbackRecord = buildFallbackRecord(eventInput);
  const existing = fallbackStore.get(eventInput.workspaceId) ?? [];
  existing.push(fallbackRecord);
  fallbackStore.set(eventInput.workspaceId, existing);
  return fallbackRecord;
}

export async function listAuditEvents(filters: AuditListFilters = {}): Promise<AuditEventRecord[]> {
  const workspaceId = filters.workspaceId ?? getCurrentWorkspaceId();
  if (!workspaceId) {
    return [];
  }

  const limit = typeof filters.limit === 'number' && Number.isFinite(filters.limit)
    ? Math.max(1, Math.min(500, Math.floor(filters.limit)))
    : 100;

  const client = getSupabaseAdminClient();
  if (client) {
    let query = client
      .from('audit_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    const { data, error } = await query;
    if (!error && data) {
      return (data as AuditEventRow[]).map(toRecord);
    }
  }

  const fallback = fallbackStore.get(workspaceId) ?? [];
  return fallback
    .filter((event) => !filters.action || event.action === filters.action)
    .filter((event) => !filters.resourceType || event.resourceType === filters.resourceType)
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit);
}

export function resetAuditStateForTests(): void {
  fallbackStore.clear();
}
