/**
 * WebhookService
 * Handles webhook CRUD, inbound triggers, outbound notifications, and retry delivery loop.
 */

import { createHmac } from 'crypto';
import {
  NewWebhookDeliveryRecord,
  WebhookDeliveryRecord,
  WebhookRepository
} from '../repositories';
import { getSupabaseAdminClient } from '../lib/supabaseClient';
import { SupabaseWebhookRepository } from '../repositories/supabase';
import { estimateRetryAt } from '../lib/cronUtils';
import { submitTask } from './taskQueueService';
import { Task, TaskExecutionMode } from '../../types';
import { emitWebhookDelivery } from './socketService';
import { logger } from '../lib/logger';
import { getCurrentWorkspaceId, getCurrentWorkspaceIdOrDefault, isWorkspaceMatch } from './workspaceContextService';
import { appendAuditEvent } from './auditService';

interface InboundTaskPayload {
  agentId?: string;
  type?: string;
  data?: Record<string, unknown>;
  executionMode?: TaskExecutionMode;
  priority?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateWebhookInput {
  direction: 'inbound' | 'outbound';
  eventName: string;
  targetUrl?: string;
  headers?: Record<string, string>;
  maxAttempts?: number;
  status?: WebhookDeliveryRecord['status'];
  metadata?: Record<string, unknown>;
}

export interface UpdateWebhookInput {
  eventName?: string;
  targetUrl?: string;
  headers?: Record<string, string>;
  maxAttempts?: number;
  status?: WebhookDeliveryRecord['status'];
  metadata?: Record<string, unknown>;
}

const webhooks = new Map<string, WebhookDeliveryRecord>();
const pendingWebhookIds = new Set<string>();
let retryLoop: NodeJS.Timeout | null = null;
let processingRetries = false;

function getWorkspaceId(): string {
  return getCurrentWorkspaceIdOrDefault() ?? '';
}

function getRetryTickMs(): number {
  const parsed = Number.parseInt(process.env.WEBHOOK_RETRY_TICK_MS ?? '5000', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 5000;
  }
  return parsed;
}

function getRetryBaseSeconds(): number {
  const parsed = Number.parseInt(process.env.WEBHOOK_RETRY_BASE_SECONDS ?? '30', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
  }
  return parsed;
}

function getRequestTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.WEBHOOK_REQUEST_TIMEOUT_MS ?? '10000', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10000;
  }
  return parsed;
}

function getRepository(): WebhookRepository | null {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    return null;
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  return new SupabaseWebhookRepository(client);
}

function generateLocalWebhookId(): string {
  return `webhook-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!key || typeof value !== 'string') {
      continue;
    }
    output[key.trim().toLowerCase()] = value;
  }
  return output;
}

function getWebhookSecret(webhook: WebhookDeliveryRecord): string | null {
  const fromMetadata = webhook.metadata?.secret;
  if (typeof fromMetadata === 'string' && fromMetadata.trim().length > 0) {
    return fromMetadata;
  }

  const globalSecret = process.env.WEBHOOK_SIGNING_SECRET;
  if (globalSecret && globalSecret.trim().length > 0) {
    return globalSecret.trim();
  }

  return null;
}

function buildSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function validateWebhookInput(input: CreateWebhookInput): void {
  if (!input.eventName || input.eventName.trim().length === 0) {
    throw new Error('eventName is required');
  }

  if (input.direction === 'outbound') {
    if (!input.targetUrl || input.targetUrl.trim().length === 0) {
      throw new Error('targetUrl is required for outbound webhooks');
    }

    try {
      new URL(input.targetUrl);
    } catch (_error) {
      throw new Error('targetUrl must be a valid URL');
    }
  }
}

async function persistWebhookCreate(input: NewWebhookDeliveryRecord): Promise<WebhookDeliveryRecord> {
  const repository = getRepository();
  if (!repository) {
    const now = new Date();
    return {
      id: generateLocalWebhookId(),
      workspaceId: input.workspaceId,
      direction: input.direction,
      eventName: input.eventName,
      targetUrl: input.targetUrl,
      status: input.status,
      headers: input.headers,
      payload: input.payload,
      signature: input.signature,
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      attemptCount: input.attemptCount,
      maxAttempts: input.maxAttempts,
      nextAttemptAt: input.nextAttemptAt,
      lastAttemptAt: input.lastAttemptAt,
      deliveredAt: input.deliveredAt,
      error: input.error,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now
    };
  }

  return repository.createWebhookDelivery(input);
}

async function persistWebhookUpdate(
  id: string,
  updates: Partial<Omit<WebhookDeliveryRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
): Promise<WebhookDeliveryRecord | null> {
  const repository = getRepository();
  if (!repository) {
    const existing = webhooks.get(id);
    if (!existing) {
      return null;
    }

    return {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
  }

  return repository.updateWebhookDelivery(id, updates);
}

async function persistWebhookDelete(id: string): Promise<boolean> {
  const repository = getRepository();
  if (!repository) {
    return webhooks.delete(id);
  }

  return repository.deleteWebhookDelivery(id);
}

async function patchWebhook(id: string, updates: Partial<Omit<WebhookDeliveryRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>): Promise<WebhookDeliveryRecord | null> {
  const persisted = await persistWebhookUpdate(id, updates);
  if (!persisted) {
    const existing = webhooks.get(id);
    if (!existing) {
      return null;
    }
    const fallback = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    webhooks.set(id, fallback);
    return fallback;
  }

  webhooks.set(id, persisted);
  return persisted;
}

async function postWebhookPayload(webhook: WebhookDeliveryRecord): Promise<{ responseStatus: number; responseBody: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getRequestTimeoutMs());

  const payloadString = JSON.stringify(webhook.payload ?? {});
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...normalizeHeaders(webhook.headers)
  };

  const secret = getWebhookSecret(webhook);
  if (secret) {
    headers['x-webhook-signature'] = buildSignature(payloadString, secret);
  }

  try {
    const response = await fetch(webhook.targetUrl as string, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal
    });

    const responseBody = await response.text();
    return {
      responseStatus: response.status,
      responseBody
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function attemptDelivery(webhookId: string): Promise<void> {
  const existing = webhooks.get(webhookId);
  if (!existing || existing.direction !== 'outbound' || existing.status === 'disabled') {
    pendingWebhookIds.delete(webhookId);
    return;
  }

  if (!existing.targetUrl) {
    await patchWebhook(webhookId, {
      status: 'failed',
      error: 'targetUrl missing for outbound webhook',
      nextAttemptAt: undefined
    });
    pendingWebhookIds.delete(webhookId);
    return;
  }

  const now = new Date();

  try {
    const result = await postWebhookPayload(existing);

    if (result.responseStatus < 200 || result.responseStatus >= 300) {
      throw new Error(`HTTP ${result.responseStatus}`);
    }

    const updated = await patchWebhook(webhookId, {
      status: 'delivered',
      attemptCount: (existing.attemptCount ?? 0) + 1,
      deliveredAt: now,
      lastAttemptAt: now,
      nextAttemptAt: undefined,
      responseStatus: result.responseStatus,
      responseBody: result.responseBody,
      error: undefined
    });

    pendingWebhookIds.delete(webhookId);

    if (updated) {
      emitWebhookDelivery({
        webhookId: updated.id,
        eventName: updated.eventName,
        status: updated.status,
        direction: updated.direction,
        timestamp: new Date(),
        attemptCount: updated.attemptCount,
        responseStatus: updated.responseStatus
      });
    }

    return;
  } catch (error) {
    const nextAttemptCount = (existing.attemptCount ?? 0) + 1;
    const nextAttemptAt = estimateRetryAt(now, getRetryBaseSeconds(), nextAttemptCount);
    const isExhausted = nextAttemptCount >= existing.maxAttempts;

    const updated = await patchWebhook(webhookId, {
      status: isExhausted ? 'failed' : 'pending',
      attemptCount: nextAttemptCount,
      lastAttemptAt: now,
      nextAttemptAt: isExhausted ? undefined : nextAttemptAt,
      error: error instanceof Error ? error.message : 'Webhook delivery failed'
    });

    emitWebhookDelivery({
      webhookId,
      eventName: existing.eventName,
      status: isExhausted ? 'failed' : 'pending',
      direction: existing.direction,
      timestamp: new Date(),
      attemptCount: nextAttemptCount,
      nextAttemptAt: updated?.nextAttemptAt,
      error: error instanceof Error ? error.message : 'Webhook delivery failed'
    });

    if (isExhausted) {
      pendingWebhookIds.delete(webhookId);
    }
  }
}

async function processRetries(): Promise<void> {
  if (processingRetries) {
    return;
  }

  processingRetries = true;
  try {
    const now = new Date();

    for (const webhookId of Array.from(pendingWebhookIds)) {
      const record = webhooks.get(webhookId);
      if (!record) {
        pendingWebhookIds.delete(webhookId);
        continue;
      }

      if (record.status === 'disabled' || record.status === 'failed' || record.status === 'delivered') {
        pendingWebhookIds.delete(webhookId);
        continue;
      }

      if (record.nextAttemptAt && record.nextAttemptAt.getTime() > now.getTime()) {
        continue;
      }

      await attemptDelivery(webhookId);
    }
  } finally {
    processingRetries = false;
  }
}

function parseInboundTaskPayload(payload: Record<string, unknown>): InboundTaskPayload {
  const source = (
    payload.task && typeof payload.task === 'object' && payload.task !== null
      ? payload.task
      : payload
  ) as Record<string, unknown>;

  const taskPayload: InboundTaskPayload = {};

  if (typeof source.agentId === 'string') {
    taskPayload.agentId = source.agentId;
  }
  if (typeof source.type === 'string') {
    taskPayload.type = source.type;
  }
  if (source.data && typeof source.data === 'object') {
    taskPayload.data = source.data as Record<string, unknown>;
  }
  if (source.executionMode === 'tool_loop' || source.executionMode === 'claude_cli') {
    taskPayload.executionMode = source.executionMode;
  }
  if (typeof source.priority === 'number' && Number.isFinite(source.priority)) {
    taskPayload.priority = source.priority;
  }
  if (typeof source.idempotencyKey === 'string') {
    taskPayload.idempotencyKey = source.idempotencyKey;
  }
  if (source.metadata && typeof source.metadata === 'object') {
    taskPayload.metadata = source.metadata as Record<string, unknown>;
  }

  return taskPayload;
}

export async function initializeWebhookService(): Promise<void> {
  webhooks.clear();
  pendingWebhookIds.clear();

  const repository = getRepository();
  if (repository) {
    try {
      const existing = await repository.listWebhookDeliveries({
        workspaceId: getWorkspaceId()
      });

      for (const webhook of existing) {
        webhooks.set(webhook.id, webhook);
        if (webhook.direction === 'outbound' && webhook.status === 'pending') {
          pendingWebhookIds.add(webhook.id);
        }
      }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'webhook.bootstrap_failed');
    }
  }

  if (!retryLoop) {
    retryLoop = setInterval(() => {
      processRetries().catch((error) => {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'webhook.retry_loop_error');
      });
    }, getRetryTickMs());
  }
}

export async function stopWebhookService(): Promise<void> {
  if (retryLoop) {
    clearInterval(retryLoop);
    retryLoop = null;
  }
}

export async function createWebhook(input: CreateWebhookInput): Promise<WebhookDeliveryRecord> {
  validateWebhookInput(input);

  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error('DEFAULT_WORKSPACE_ID is required to create webhooks');
  }

  const now = new Date();
  const created = await persistWebhookCreate({
    workspaceId,
    direction: input.direction,
    eventName: input.eventName.trim(),
    targetUrl: input.targetUrl?.trim(),
    status: input.status ?? 'pending',
    headers: normalizeHeaders(input.headers),
    payload: {},
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 5,
    metadata: input.metadata ?? {},
    nextAttemptAt: undefined,
    lastAttemptAt: undefined,
    deliveredAt: undefined,
    responseStatus: undefined,
    responseBody: undefined,
    signature: undefined,
    error: undefined
  });

  webhooks.set(created.id, created);

  if (created.direction === 'outbound' && created.status === 'pending') {
    pendingWebhookIds.add(created.id);
    await patchWebhook(created.id, {
      nextAttemptAt: now,
      payload: { event: 'webhook.registered', webhookId: created.id, eventName: created.eventName }
    });
  }

  appendAuditEvent({
    workspaceId,
    action: 'webhook.created',
    resourceType: 'webhook',
    resourceId: created.id,
    metadata: {
      direction: created.direction,
      eventName: created.eventName
    }
  }).catch(() => undefined);

  return webhooks.get(created.id) ?? created;
}

export function listWebhooks(): WebhookDeliveryRecord[] {
  return Array.from(webhooks.values())
    .filter((webhook) => isWorkspaceMatch(webhook.workspaceId, getCurrentWorkspaceId()))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function getWebhook(webhookId: string): WebhookDeliveryRecord | undefined {
  const webhook = webhooks.get(webhookId);
  if (!webhook) {
    return undefined;
  }

  if (!isWorkspaceMatch(webhook.workspaceId, getCurrentWorkspaceId())) {
    return undefined;
  }

  return webhook;
}

export async function updateWebhook(webhookId: string, updates: UpdateWebhookInput): Promise<WebhookDeliveryRecord | null> {
  const existing = getWebhook(webhookId);
  if (!existing) {
    return null;
  }

  if (updates.targetUrl !== undefined && updates.targetUrl.length > 0) {
    try {
      new URL(updates.targetUrl);
    } catch (_error) {
      throw new Error('targetUrl must be a valid URL');
    }
  }

  const updated = await patchWebhook(webhookId, {
    eventName: updates.eventName?.trim() ?? existing.eventName,
    targetUrl: updates.targetUrl?.trim() ?? existing.targetUrl,
    headers: updates.headers ? normalizeHeaders(updates.headers) : existing.headers,
    maxAttempts: updates.maxAttempts ?? existing.maxAttempts,
    status: updates.status ?? existing.status,
    metadata: updates.metadata ?? existing.metadata
  });

  if (updated && updated.direction === 'outbound' && updated.status === 'pending') {
    pendingWebhookIds.add(updated.id);
    if (!updated.nextAttemptAt) {
      await patchWebhook(updated.id, { nextAttemptAt: new Date() });
    }
  }

  if (updated && updated.status === 'disabled') {
    pendingWebhookIds.delete(updated.id);
  }

  if (updated) {
    appendAuditEvent({
      workspaceId: updated.workspaceId,
      action: 'webhook.updated',
      resourceType: 'webhook',
      resourceId: updated.id
    }).catch(() => undefined);
  }

  return webhooks.get(webhookId) ?? updated;
}

export async function deleteWebhook(webhookId: string): Promise<boolean> {
  const existing = getWebhook(webhookId);
  if (!existing) {
    return false;
  }

  const deleted = await persistWebhookDelete(webhookId);
  if (!deleted) {
    return false;
  }

  webhooks.delete(webhookId);
  pendingWebhookIds.delete(webhookId);
  appendAuditEvent({
    workspaceId: existing.workspaceId,
    action: 'webhook.deleted',
    resourceType: 'webhook',
    resourceId: existing.id
  }).catch(() => undefined);
  return true;
}

export async function triggerInboundWebhook(
  eventName: string,
  payload: Record<string, unknown>,
  signatureHeader: string | undefined
): Promise<{ taskId: string; webhookId?: string }> {
  const inboundHooks = listWebhooks().filter((hook) => (
    hook.direction === 'inbound'
      && hook.eventName === eventName
      && hook.status !== 'disabled'
  ));

  if (inboundHooks.length === 0 && process.env.ALLOW_UNREGISTERED_INBOUND_WEBHOOKS !== 'true') {
    throw new Error('No matching inbound webhook registered for this event');
  }

  if (inboundHooks.length > 0) {
    const payloadString = JSON.stringify(payload);
    const hooksWithSecret = inboundHooks.filter((hook) => Boolean(getWebhookSecret(hook)));
    if (hooksWithSecret.length > 0) {
      const matched = hooksWithSecret.some((hook) => {
        const secret = getWebhookSecret(hook);
        if (!secret || !signatureHeader) {
          return false;
        }
        return buildSignature(payloadString, secret) === signatureHeader;
      });

      if (!matched) {
        throw new Error('Webhook signature verification failed');
      }
    }
  }

  const taskPayload = parseInboundTaskPayload(payload);
  if (!taskPayload.agentId || !taskPayload.type) {
    throw new Error('Inbound webhook payload must include task.agentId and task.type');
  }

  const now = new Date();
  const task: Task = {
    id: '',
    workspaceId: inboundHooks[0]?.workspaceId ?? getCurrentWorkspaceIdOrDefault() ?? 'workspace-default',
    agentId: taskPayload.agentId,
    type: taskPayload.type,
    data: taskPayload.data ?? {},
    executionMode: taskPayload.executionMode,
    status: 'pending',
    priority: taskPayload.priority ?? 1,
    createdAt: now,
    updatedAt: now,
    idempotencyKey: taskPayload.idempotencyKey,
    metadata: {
      ...(taskPayload.metadata ?? {}),
      webhookEventName: eventName,
      webhookDirection: 'inbound'
    }
  };

  const taskId = await submitTask(task);

  if (inboundHooks[0]) {
    await patchWebhook(inboundHooks[0].id, {
      status: 'delivered',
      payload,
      deliveredAt: new Date(),
      lastAttemptAt: new Date(),
      attemptCount: (inboundHooks[0].attemptCount ?? 0) + 1,
      error: undefined
    });

    emitWebhookDelivery({
      webhookId: inboundHooks[0].id,
      eventName,
      direction: 'inbound',
      status: 'delivered',
      timestamp: new Date(),
      attemptCount: (inboundHooks[0].attemptCount ?? 0) + 1
    });
    appendAuditEvent({
      workspaceId: inboundHooks[0].workspaceId,
      action: 'webhook.inbound.processed',
      resourceType: 'webhook',
      resourceId: inboundHooks[0].id,
      metadata: {
        eventName
      }
    }).catch(() => undefined);
  }

  return {
    taskId,
    webhookId: inboundHooks[0]?.id
  };
}

export async function enqueueWebhookNotification(eventName: string, payload: Record<string, unknown>): Promise<void> {
  const outboundHooks = listWebhooks().filter((hook) => (
    hook.direction === 'outbound'
      && hook.eventName === eventName
      && hook.status !== 'disabled'
  ));

  for (const hook of outboundHooks) {
    const now = new Date();
    await patchWebhook(hook.id, {
      status: 'pending',
      payload,
      nextAttemptAt: now,
      error: undefined,
      responseStatus: undefined,
      responseBody: undefined
    });

    pendingWebhookIds.add(hook.id);

    emitWebhookDelivery({
      webhookId: hook.id,
      eventName,
      direction: 'outbound',
      status: 'pending',
      timestamp: now,
      attemptCount: hook.attemptCount,
      nextAttemptAt: now
    });
    appendAuditEvent({
      workspaceId: hook.workspaceId,
      action: 'webhook.outbound.queued',
      resourceType: 'webhook',
      resourceId: hook.id,
      metadata: {
        eventName
      }
    }).catch(() => undefined);
  }
}

export function getWebhookHealthSnapshot(): {
  running: boolean;
  totalWebhooks: number;
  pendingDeliveries: number;
  retryTickMs: number;
} {
  return {
    running: retryLoop !== null,
    totalWebhooks: webhooks.size,
    pendingDeliveries: pendingWebhookIds.size,
    retryTickMs: getRetryTickMs()
  };
}

export function resetWebhookStateForTests(): void {
  webhooks.clear();
  pendingWebhookIds.clear();
  if (retryLoop) {
    clearInterval(retryLoop);
    retryLoop = null;
  }
  processingRetries = false;
}
