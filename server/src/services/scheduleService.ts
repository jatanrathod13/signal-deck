/**
 * ScheduleService
 * Manages schedule CRUD, pg_cron registration attempts, and fallback scheduler execution.
 */

import {
  ScheduleRunStatus,
  ScheduleRecord,
  NewScheduleRecord,
  ScheduleRepository
} from '../repositories';
import { getSupabaseAdminClient } from '../lib/supabaseClient';
import { SupabaseScheduleRepository } from '../repositories/supabase';
import { estimateRetryAt, getNextRunAt, normalizeScheduleTimezone, validateCronExpression } from '../lib/cronUtils';
import { Task, TaskExecutionMode } from '../../types';
import { submitTask } from './taskQueueService';
import { emitScheduleTriggered } from './socketService';
import { logger } from '../lib/logger';

interface ScheduleTaskPayload extends Record<string, unknown> {
  agentId?: string;
  type?: string;
  data?: Record<string, unknown>;
  executionMode?: TaskExecutionMode;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateScheduleInput {
  name: string;
  cronExpression: string;
  timezone?: string;
  payload?: ScheduleTaskPayload;
  enabled?: boolean;
  retryLimit?: number;
  retryBackoffSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateScheduleInput {
  name?: string;
  cronExpression?: string;
  timezone?: string;
  payload?: ScheduleTaskPayload;
  enabled?: boolean;
  retryLimit?: number;
  retryBackoffSeconds?: number;
  metadata?: Record<string, unknown>;
}

const schedules = new Map<string, ScheduleRecord>();
let scheduleLoop: NodeJS.Timeout | null = null;
let scheduleProcessing = false;

function getWorkspaceId(): string {
  return process.env.DEFAULT_WORKSPACE_ID ?? '';
}

function getUserId(): string | undefined {
  const raw = process.env.SUPABASE_DEFAULT_USER_ID;
  return raw && raw.trim().length > 0 ? raw.trim() : undefined;
}

function getTickMs(): number {
  const raw = Number.parseInt(process.env.SCHEDULER_TICK_MS ?? '10000', 10);
  if (!Number.isFinite(raw) || raw <= 0) {
    return 10000;
  }
  return raw;
}

function isPgCronAttemptEnabled(): boolean {
  return process.env.FEATURE_SCHEDULE_PG_CRON !== 'false';
}

function getRepository(): ScheduleRepository | null {
  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    return null;
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  return new SupabaseScheduleRepository(client);
}

function generateLocalScheduleId(): string {
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function validateName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error('Schedule name is required');
  }
  if (name.length > 120) {
    throw new Error('Schedule name must be at most 120 characters');
  }
}

function validateCron(cronExpression: string): void {
  const result = validateCronExpression(cronExpression);
  if (!result.valid) {
    throw new Error(`Invalid cron expression: ${result.error ?? 'unknown error'}`);
  }
}

function sanitizePayload(payload: ScheduleTaskPayload | undefined): ScheduleTaskPayload {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const safePayload: ScheduleTaskPayload = {};

  if (typeof payload.agentId === 'string') {
    safePayload.agentId = payload.agentId;
  }
  if (typeof payload.type === 'string') {
    safePayload.type = payload.type;
  }
  if (payload.data && typeof payload.data === 'object') {
    safePayload.data = payload.data;
  }
  if (payload.executionMode === 'tool_loop' || payload.executionMode === 'claude_cli') {
    safePayload.executionMode = payload.executionMode;
  }
  if (typeof payload.priority === 'number' && Number.isFinite(payload.priority)) {
    safePayload.priority = payload.priority;
  }
  if (payload.metadata && typeof payload.metadata === 'object') {
    safePayload.metadata = payload.metadata;
  }

  return safePayload;
}

function buildNextRunAt(cronExpression: string, timezone: string, fromDate: Date): Date | undefined {
  return getNextRunAt(cronExpression, timezone, fromDate) ?? undefined;
}

async function persistScheduleCreate(input: NewScheduleRecord): Promise<ScheduleRecord> {
  const repository = getRepository();
  if (!repository) {
    const now = new Date();
    return {
      id: generateLocalScheduleId(),
      workspaceId: input.workspaceId,
      name: input.name,
      cronExpression: input.cronExpression,
      timezone: input.timezone,
      payload: input.payload ?? {},
      enabled: input.enabled,
      retryLimit: input.retryLimit,
      retryBackoffSeconds: input.retryBackoffSeconds,
      lastRunAt: input.lastRunAt,
      nextRunAt: input.nextRunAt,
      lastRunStatus: input.lastRunStatus,
      createdByUserId: input.createdByUserId,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now
    };
  }

  return repository.createSchedule(input);
}

async function persistScheduleUpdate(
  id: string,
  updates: Partial<Omit<ScheduleRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
): Promise<ScheduleRecord | null> {
  const repository = getRepository();
  if (!repository) {
    const existing = schedules.get(id);
    if (!existing) {
      return null;
    }

    const next: ScheduleRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };

    return next;
  }

  return repository.updateSchedule(id, updates);
}

async function persistScheduleDelete(id: string): Promise<boolean> {
  const repository = getRepository();
  if (!repository) {
    return schedules.delete(id);
  }

  return repository.deleteSchedule(id);
}

async function attemptPgCronUpsert(schedule: ScheduleRecord): Promise<void> {
  if (!isPgCronAttemptEnabled()) {
    return;
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    return;
  }

  const { error } = await client.rpc('upsert_workspace_schedule_job', {
    p_schedule_id: schedule.id,
    p_cron_expression: schedule.cronExpression,
    p_timezone: schedule.timezone,
    p_enabled: schedule.enabled
  });

  if (error) {
    logger.warn({ scheduleId: schedule.id, error: error.message }, 'schedule.pg_cron_upsert_failed');
  }
}

async function attemptPgCronDelete(scheduleId: string): Promise<void> {
  if (!isPgCronAttemptEnabled()) {
    return;
  }

  const client = getSupabaseAdminClient();
  if (!client) {
    return;
  }

  const { error } = await client.rpc('remove_workspace_schedule_job', {
    p_schedule_id: scheduleId
  });

  if (error) {
    logger.warn({ scheduleId, error: error.message }, 'schedule.pg_cron_delete_failed');
  }
}

function createTaskFromSchedule(schedule: ScheduleRecord): Task {
  const payload = sanitizePayload(schedule.payload as ScheduleTaskPayload);
  const agentId = payload.agentId;
  const type = payload.type;

  if (!agentId || !type) {
    throw new Error('Schedule payload must include agentId and type');
  }

  const now = new Date();
  return {
    id: '',
    agentId,
    type,
    data: payload.data ?? {},
    executionMode: payload.executionMode,
    status: 'pending',
    priority: typeof payload.priority === 'number' ? payload.priority : 1,
    createdAt: now,
    updatedAt: now,
    metadata: {
      ...(payload.metadata ?? {}),
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      scheduleTriggeredAt: now.toISOString()
    }
  };
}

async function recordScheduleRun(
  schedule: ScheduleRecord,
  updates: Partial<Omit<ScheduleRecord, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
): Promise<ScheduleRecord> {
  const persisted = await persistScheduleUpdate(schedule.id, updates);
  const next = persisted ?? {
    ...schedule,
    ...updates,
    updatedAt: new Date()
  };
  schedules.set(next.id, next);
  return next;
}

async function triggerSchedule(schedule: ScheduleRecord): Promise<void> {
  const startedAt = new Date();

  try {
    const task = createTaskFromSchedule(schedule);
    const taskId = await submitTask(task);

    const nextRunAt = schedule.enabled
      ? buildNextRunAt(schedule.cronExpression, schedule.timezone, startedAt)
      : undefined;

    const updated = await recordScheduleRun(schedule, {
      lastRunAt: startedAt,
      nextRunAt,
      lastRunStatus: 'succeeded'
    });

    emitScheduleTriggered({
      scheduleId: updated.id,
      scheduleName: updated.name,
      taskId,
      status: 'succeeded',
      timestamp: new Date(),
      nextRunAt: updated.nextRunAt
    });
  } catch (error) {
    const attempts = (schedule.metadata?.failureCount && Number.isFinite(schedule.metadata.failureCount))
      ? Number(schedule.metadata.failureCount)
      : 0;
    const nextFailureCount = attempts + 1;
    const retryAt = estimateRetryAt(startedAt, schedule.retryBackoffSeconds, nextFailureCount);
    const nextRunAt = schedule.enabled ? retryAt : undefined;

    const updated = await recordScheduleRun(schedule, {
      lastRunAt: startedAt,
      nextRunAt,
      lastRunStatus: 'failed',
      metadata: {
        ...(schedule.metadata ?? {}),
        failureCount: nextFailureCount,
        lastFailure: error instanceof Error ? error.message : 'Unknown schedule trigger error'
      }
    });

    emitScheduleTriggered({
      scheduleId: updated.id,
      scheduleName: updated.name,
      status: 'failed',
      timestamp: new Date(),
      nextRunAt: updated.nextRunAt,
      error: error instanceof Error ? error.message : 'Unknown schedule trigger error'
    });
  }
}

async function processDueSchedules(): Promise<void> {
  if (scheduleProcessing) {
    return;
  }

  scheduleProcessing = true;
  try {
    const now = new Date();
    const dueSchedules = Array.from(schedules.values())
      .filter((schedule) => schedule.enabled && schedule.nextRunAt && schedule.nextRunAt.getTime() <= now.getTime())
      .sort((a, b) => (a.nextRunAt?.getTime() ?? 0) - (b.nextRunAt?.getTime() ?? 0));

    for (const schedule of dueSchedules) {
      await triggerSchedule(schedule);
    }
  } finally {
    scheduleProcessing = false;
  }
}

export async function initializeScheduleService(): Promise<void> {
  schedules.clear();

  const repository = getRepository();
  if (repository) {
    try {
      const existing = await repository.listSchedules({
        workspaceId: getWorkspaceId()
      });

      for (const schedule of existing) {
        schedules.set(schedule.id, schedule);
      }
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'schedule.bootstrap_failed');
    }
  }

  if (!scheduleLoop) {
    scheduleLoop = setInterval(() => {
      processDueSchedules().catch((error) => {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'schedule.loop_error');
      });
    }, getTickMs());
  }
}

export async function stopScheduleService(): Promise<void> {
  if (scheduleLoop) {
    clearInterval(scheduleLoop);
    scheduleLoop = null;
  }
}

export async function createSchedule(input: CreateScheduleInput): Promise<ScheduleRecord> {
  validateName(input.name);
  validateCron(input.cronExpression);

  const workspaceId = getWorkspaceId();
  if (!workspaceId) {
    throw new Error('DEFAULT_WORKSPACE_ID is required to create schedules');
  }

  const timezone = normalizeScheduleTimezone(input.timezone);
  const enabled = input.enabled ?? true;
  const retryLimit = input.retryLimit ?? 3;
  const retryBackoffSeconds = input.retryBackoffSeconds ?? 60;
  const nextRunAt = enabled
    ? buildNextRunAt(input.cronExpression, timezone, new Date())
    : undefined;

  const created = await persistScheduleCreate({
    workspaceId,
    name: input.name.trim(),
    cronExpression: input.cronExpression.trim(),
    timezone,
    payload: sanitizePayload(input.payload),
    enabled,
    retryLimit,
    retryBackoffSeconds,
    nextRunAt,
    lastRunStatus: 'never',
    createdByUserId: getUserId(),
    metadata: input.metadata ?? {}
  });

  schedules.set(created.id, created);
  await attemptPgCronUpsert(created);
  return created;
}

export function listSchedules(): ScheduleRecord[] {
  return Array.from(schedules.values())
    .sort((a, b) => {
      const left = a.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const right = b.nextRunAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    });
}

export function getSchedule(scheduleId: string): ScheduleRecord | undefined {
  return schedules.get(scheduleId);
}

export async function updateSchedule(scheduleId: string, updates: UpdateScheduleInput): Promise<ScheduleRecord | null> {
  const existing = schedules.get(scheduleId);
  if (!existing) {
    return null;
  }

  if (updates.name !== undefined) {
    validateName(updates.name);
  }
  if (updates.cronExpression !== undefined) {
    validateCron(updates.cronExpression);
  }

  const cronExpression = updates.cronExpression?.trim() ?? existing.cronExpression;
  const timezone = normalizeScheduleTimezone(updates.timezone ?? existing.timezone);
  const enabled = updates.enabled ?? existing.enabled;
  const retryLimit = updates.retryLimit ?? existing.retryLimit;
  const retryBackoffSeconds = updates.retryBackoffSeconds ?? existing.retryBackoffSeconds;

  const nextRunAt = enabled
    ? buildNextRunAt(cronExpression, timezone, new Date())
    : undefined;

  const persisted = await persistScheduleUpdate(scheduleId, {
    name: updates.name?.trim() ?? existing.name,
    cronExpression,
    timezone,
    payload: updates.payload ? sanitizePayload(updates.payload) : existing.payload,
    enabled,
    retryLimit,
    retryBackoffSeconds,
    nextRunAt,
    metadata: updates.metadata ?? existing.metadata
  });

  const updated = persisted ?? {
    ...existing,
    name: updates.name?.trim() ?? existing.name,
    cronExpression,
    timezone,
    payload: updates.payload ? sanitizePayload(updates.payload) : existing.payload,
    enabled,
    retryLimit,
    retryBackoffSeconds,
    nextRunAt,
    metadata: updates.metadata ?? existing.metadata,
    updatedAt: new Date()
  };

  schedules.set(updated.id, updated);
  await attemptPgCronUpsert(updated);
  return updated;
}

export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  const deleted = await persistScheduleDelete(scheduleId);
  if (!deleted) {
    return false;
  }

  schedules.delete(scheduleId);
  await attemptPgCronDelete(scheduleId);
  return true;
}

export async function triggerScheduleNow(scheduleId: string): Promise<{ taskQueued: boolean }> {
  const schedule = schedules.get(scheduleId);
  if (!schedule) {
    throw new Error('Schedule not found');
  }

  await triggerSchedule(schedule);
  return { taskQueued: true };
}

export function getScheduleHealthSnapshot(): {
  running: boolean;
  loadedSchedules: number;
  tickMs: number;
} {
  return {
    running: scheduleLoop !== null,
    loadedSchedules: schedules.size,
    tickMs: getTickMs()
  };
}

export function resetScheduleStateForTests(): void {
  schedules.clear();
  if (scheduleLoop) {
    clearInterval(scheduleLoop);
    scheduleLoop = null;
  }
  scheduleProcessing = false;
}
