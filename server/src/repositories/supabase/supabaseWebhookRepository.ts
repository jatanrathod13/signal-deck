/**
 * SupabaseWebhookRepository
 * Webhook persistence implementation against Supabase Postgres.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  NewWebhookDeliveryRecord,
  RepositoryRequestContext,
  WebhookDeliveryRecord,
  WebhookListFilters
} from '../repositoryModels';
import { WebhookRepository } from '../repositoryInterfaces';

interface WebhookRow {
  id: string;
  workspace_id: string;
  direction: WebhookDeliveryRecord['direction'];
  event_name: string;
  target_url: string | null;
  status: WebhookDeliveryRecord['status'];
  headers: Record<string, string> | null;
  payload: Record<string, unknown> | null;
  signature: string | null;
  response_status: number | null;
  response_body: string | null;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  delivered_at: string | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function toWebhookRecord(row: WebhookRow): WebhookDeliveryRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    direction: row.direction,
    eventName: row.event_name,
    targetUrl: row.target_url ?? undefined,
    status: row.status,
    headers: row.headers ?? undefined,
    payload: row.payload ?? undefined,
    signature: row.signature ?? undefined,
    responseStatus: row.response_status ?? undefined,
    responseBody: row.response_body ?? undefined,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at) : undefined,
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at) : undefined,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
    error: row.error ?? undefined,
    metadata: row.metadata ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

export class SupabaseWebhookRepository implements WebhookRepository {
  public constructor(private readonly client: SupabaseClient) {}

  public async createWebhookDelivery(
    input: NewWebhookDeliveryRecord,
    _ctx?: RepositoryRequestContext
  ): Promise<WebhookDeliveryRecord> {
    const { data, error } = await this.client
      .from('webhooks')
      .insert({
        workspace_id: input.workspaceId,
        direction: input.direction,
        event_name: input.eventName,
        target_url: input.targetUrl ?? null,
        status: input.status,
        headers: input.headers ?? {},
        payload: input.payload ?? {},
        signature: input.signature ?? null,
        response_status: input.responseStatus ?? null,
        response_body: input.responseBody ?? null,
        attempt_count: input.attemptCount,
        max_attempts: input.maxAttempts,
        next_attempt_at: input.nextAttemptAt?.toISOString(),
        last_attempt_at: input.lastAttemptAt?.toISOString(),
        delivered_at: input.deliveredAt?.toISOString(),
        error: input.error ?? null,
        metadata: input.metadata ?? {}
      })
      .select('*')
      .single<WebhookRow>();

    if (error || !data) {
      throw new Error(`Failed to create webhook record: ${error?.message ?? 'unknown error'}`);
    }

    return toWebhookRecord(data);
  }

  public async getWebhookDeliveryById(
    id: string,
    _ctx?: RepositoryRequestContext
  ): Promise<WebhookDeliveryRecord | null> {
    const { data, error } = await this.client
      .from('webhooks')
      .select('*')
      .eq('id', id)
      .maybeSingle<WebhookRow>();

    if (error) {
      throw new Error(`Failed to get webhook by id: ${error.message}`);
    }

    return data ? toWebhookRecord(data) : null;
  }

  public async listWebhookDeliveries(
    filters: WebhookListFilters,
    _ctx?: RepositoryRequestContext
  ): Promise<WebhookDeliveryRecord[]> {
    let query = this.client
      .from('webhooks')
      .select('*')
      .eq('workspace_id', filters.workspaceId);

    if (filters.statuses && filters.statuses.length > 0) {
      query = query.in('status', filters.statuses);
    }
    if (filters.directions && filters.directions.length > 0) {
      query = query.in('direction', filters.directions);
    }
    if (filters.dueBefore) {
      query = query.lte('next_attempt_at', filters.dueBefore.toISOString());
    }
    if (typeof filters.limit === 'number' && filters.limit > 0) {
      query = query.limit(filters.limit);
    }

    query = query.order('updated_at', { ascending: false });

    const { data, error } = await query.returns<WebhookRow[]>();
    if (error) {
      throw new Error(`Failed to list webhooks: ${error.message}`);
    }

    return (data ?? []).map(toWebhookRecord);
  }

  public async updateWebhookDelivery(
    id: string,
    updates: Partial<Omit<WebhookDeliveryRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>,
    _ctx?: RepositoryRequestContext
  ): Promise<WebhookDeliveryRecord | null> {
    const payload: Record<string, unknown> = {};

    if (updates.direction !== undefined) {
      payload.direction = updates.direction;
    }
    if (updates.eventName !== undefined) {
      payload.event_name = updates.eventName;
    }
    if (updates.targetUrl !== undefined) {
      payload.target_url = updates.targetUrl ?? null;
    }
    if (updates.status !== undefined) {
      payload.status = updates.status;
    }
    if (updates.headers !== undefined) {
      payload.headers = updates.headers ?? {};
    }
    if (updates.payload !== undefined) {
      payload.payload = updates.payload ?? {};
    }
    if (updates.signature !== undefined) {
      payload.signature = updates.signature ?? null;
    }
    if (updates.responseStatus !== undefined) {
      payload.response_status = updates.responseStatus ?? null;
    }
    if (updates.responseBody !== undefined) {
      payload.response_body = updates.responseBody ?? null;
    }
    if (updates.attemptCount !== undefined) {
      payload.attempt_count = updates.attemptCount;
    }
    if (updates.maxAttempts !== undefined) {
      payload.max_attempts = updates.maxAttempts;
    }
    if (updates.nextAttemptAt !== undefined) {
      payload.next_attempt_at = updates.nextAttemptAt ? updates.nextAttemptAt.toISOString() : null;
    }
    if (updates.lastAttemptAt !== undefined) {
      payload.last_attempt_at = updates.lastAttemptAt ? updates.lastAttemptAt.toISOString() : null;
    }
    if (updates.deliveredAt !== undefined) {
      payload.delivered_at = updates.deliveredAt ? updates.deliveredAt.toISOString() : null;
    }
    if (updates.error !== undefined) {
      payload.error = updates.error ?? null;
    }
    if (updates.metadata !== undefined) {
      payload.metadata = updates.metadata ?? {};
    }

    if (Object.keys(payload).length === 0) {
      return this.getWebhookDeliveryById(id);
    }

    const { data, error } = await this.client
      .from('webhooks')
      .update(payload)
      .eq('id', id)
      .select('*')
      .maybeSingle<WebhookRow>();

    if (error) {
      throw new Error(`Failed to update webhook: ${error.message}`);
    }

    return data ? toWebhookRecord(data) : null;
  }

  public async deleteWebhookDelivery(id: string, _ctx?: RepositoryRequestContext): Promise<boolean> {
    const { error, count } = await this.client
      .from('webhooks')
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete webhook: ${error.message}`);
    }

    return (count ?? 0) > 0;
  }
}
