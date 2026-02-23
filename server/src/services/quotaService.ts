/**
 * QuotaService
 * Workspace-scoped quota metering and enforcement.
 */

import { redis } from '../../config/redis';

export interface WorkspaceQuotaPolicy {
  enabled: boolean;
  maxTasksPerHour: number;
  maxRunsPerDay: number;
}

export interface WorkspaceQuotaUsage {
  workspaceId: string;
  taskWindowStartIso: string;
  tasksSubmittedInWindow: number;
  runWindowStartIso: string;
  runsStartedInWindow: number;
}

export class QuotaExceededError extends Error {
  readonly metric: 'tasks_per_hour' | 'runs_per_day';
  readonly limit: number;
  readonly current: number;
  readonly workspaceId: string;

  constructor(input: {
    metric: 'tasks_per_hour' | 'runs_per_day';
    limit: number;
    current: number;
    workspaceId: string;
  }) {
    super(`Quota exceeded for ${input.metric}: ${input.current}/${input.limit}`);
    this.metric = input.metric;
    this.limit = input.limit;
    this.current = input.current;
    this.workspaceId = input.workspaceId;
  }
}

const localCounters = new Map<string, number>();

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function getHourWindowStart(now: Date): Date {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    0,
    0,
    0
  ));
}

function getDayWindowStart(now: Date): Date {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0
  ));
}

function buildWindowKey(workspaceId: string, metric: string, windowStart: Date): string {
  return `quota:${workspaceId}:${metric}:${windowStart.toISOString()}`;
}

function hasRedisCounter(candidate: unknown): candidate is {
  incr: (key: string) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  expire: (key: string, seconds: number) => Promise<number>;
} {
  if (process.env.QUOTA_USE_REDIS !== 'true') {
    return false;
  }

  return Boolean(candidate)
    && typeof (candidate as { incr?: unknown }).incr === 'function'
    && typeof (candidate as { get?: unknown }).get === 'function'
    && typeof (candidate as { expire?: unknown }).expire === 'function';
}

async function readCounter(key: string): Promise<number> {
  const redisCounter = hasRedisCounter(redis) ? redis : null;

  if (redisCounter) {
    try {
      const value = await redisCounter.get(key);
      if (!value) {
        return 0;
      }

      const parsed = Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch (_error) {
      // Fall back to local counters when Redis is unavailable.
    }
  }

  return localCounters.get(key) ?? 0;
}

async function incrementCounter(key: string, ttlSeconds: number): Promise<number> {
  const redisCounter = hasRedisCounter(redis) ? redis : null;

  if (redisCounter) {
    try {
      const next = await redisCounter.incr(key);
      if (next === 1) {
        await redisCounter.expire(key, ttlSeconds);
      }
      return next;
    } catch (_error) {
      // Fall back to local counters when Redis is unavailable.
    }
  }

  const next = (localCounters.get(key) ?? 0) + 1;
  localCounters.set(key, next);
  return next;
}

export function getQuotaPolicy(): WorkspaceQuotaPolicy {
  return {
    enabled: process.env.FEATURE_QUOTA_ENFORCEMENT !== 'false',
    maxTasksPerHour: parsePositiveInt(process.env.QUOTA_MAX_TASKS_PER_HOUR, 500),
    maxRunsPerDay: parsePositiveInt(process.env.QUOTA_MAX_RUNS_PER_DAY, 200)
  };
}

export async function getQuotaUsage(workspaceId: string): Promise<WorkspaceQuotaUsage> {
  const now = new Date();
  const hourWindow = getHourWindowStart(now);
  const dayWindow = getDayWindowStart(now);

  const taskKey = buildWindowKey(workspaceId, 'tasks_per_hour', hourWindow);
  const runKey = buildWindowKey(workspaceId, 'runs_per_day', dayWindow);

  const [tasksSubmittedInWindow, runsStartedInWindow] = await Promise.all([
    readCounter(taskKey),
    readCounter(runKey)
  ]);

  return {
    workspaceId,
    taskWindowStartIso: hourWindow.toISOString(),
    tasksSubmittedInWindow,
    runWindowStartIso: dayWindow.toISOString(),
    runsStartedInWindow
  };
}

export async function enforceTaskSubmissionQuota(workspaceId: string): Promise<WorkspaceQuotaUsage> {
  const policy = getQuotaPolicy();
  const usageBefore = await getQuotaUsage(workspaceId);

  if (policy.enabled && usageBefore.tasksSubmittedInWindow >= policy.maxTasksPerHour) {
    throw new QuotaExceededError({
      metric: 'tasks_per_hour',
      limit: policy.maxTasksPerHour,
      current: usageBefore.tasksSubmittedInWindow,
      workspaceId
    });
  }

  const key = buildWindowKey(workspaceId, 'tasks_per_hour', new Date(usageBefore.taskWindowStartIso));
  await incrementCounter(key, 60 * 60 + 30);
  return getQuotaUsage(workspaceId);
}

export async function enforceRunStartQuota(workspaceId: string): Promise<WorkspaceQuotaUsage> {
  const policy = getQuotaPolicy();
  const usageBefore = await getQuotaUsage(workspaceId);

  if (policy.enabled && usageBefore.runsStartedInWindow >= policy.maxRunsPerDay) {
    throw new QuotaExceededError({
      metric: 'runs_per_day',
      limit: policy.maxRunsPerDay,
      current: usageBefore.runsStartedInWindow,
      workspaceId
    });
  }

  const key = buildWindowKey(workspaceId, 'runs_per_day', new Date(usageBefore.runWindowStartIso));
  await incrementCounter(key, 60 * 60 * 24 + 300);
  return getQuotaUsage(workspaceId);
}

export function resetQuotaStateForTests(): void {
  localCounters.clear();
}
